import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { Job, JobStatus } from '@prisma/client';
import { canTransition, JobStatus as SharedJobStatus } from 'shared';
import { JobsRepository } from './jobs.repository';
import { CacheService } from '../cache/cache.service';
import { CreateJobDto } from './dto/create-job.dto';
import { UpdateStatusDto } from './dto/update-status.dto';

const CACHE_TTL = 10; // seconds

function listCacheKey(status?: string) {
  // Using a single key per filter variant — simple to invalidate on writes.
  return status ? `jobs:list:${status}` : 'jobs:list';
}

@Injectable()
export class JobsService {
  constructor(
    private readonly repo: JobsRepository,
    private readonly cache: CacheService,
  ) {}

  async findAll(status?: JobStatus): Promise<Job[]> {
    const key = listCacheKey(status);
    const cached = await this.cache.get<Job[]>(key);
    if (cached) return cached;

    const jobs = await this.repo.findAll(status);
    await this.cache.set(key, jobs, CACHE_TTL);
    return jobs;
  }

  async findOne(id: string): Promise<Job> {
    const job = await this.repo.findById(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    return job;
  }

  async create(dto: CreateJobDto, idempotencyKey?: string): Promise<Job> {
    // Check if we've seen this idempotency key before.
    if (idempotencyKey) {
      const iKey = `idempotency:${idempotencyKey}`;
      const existing = await this.cache.get<Job>(iKey);
      if (existing) return existing;

      const job = await this.repo.create(dto);
      // Cache the result for 24h so duplicate retries get the same response.
      await this.cache.set(iKey, job, 86400);
      await this.invalidateListCache();
      return job;
    }

    const job = await this.repo.create(dto);
    await this.invalidateListCache();
    return job;
  }

  async updateStatus(id: string, dto: UpdateStatusDto): Promise<Job> {
    const lockKey = `lock:job:${id}`;

    // Redis lock guards the read-then-check-then-write sequence.
    // If two requests arrive simultaneously, one gets the lock and the other
    // gets a 409 immediately rather than racing to the DB.
    const locked = await this.cache.acquireLock(lockKey);
    if (!locked) {
      throw new ConflictException(
        'Another request is updating this job — please retry',
      );
    }

    try {
      const job = await this.repo.findById(id);
      if (!job) throw new NotFoundException(`Job ${id} not found`);

      // State machine enforcement lives here, not in the controller.
      const currentStatus = job.status as unknown as SharedJobStatus;
      const nextStatus = dto.status as unknown as SharedJobStatus;

      if (!canTransition(currentStatus, nextStatus)) {
        throw new ConflictException(
          `Cannot transition from ${job.status} to ${dto.status}`,
        );
      }

      // Optimistic locking: if version doesn't match, another request updated
      // the row between our read and write.
      const updated = await this.repo.updateStatusWithVersion(
        id,
        dto.status as JobStatus,
        dto.version,
      );

      if (!updated) {
        throw new ConflictException(
          'Job was modified by another request, please retry',
        );
      }

      await this.invalidateListCache();
      return updated;
    } finally {
      await this.cache.releaseLock(lockKey);
    }
  }

  async remove(id: string): Promise<void> {
    const job = await this.repo.findById(id);
    if (!job) throw new NotFoundException(`Job ${id} not found`);
    await this.repo.delete(id);
    await this.invalidateListCache();
  }

  private async invalidateListCache() {
    // Bust all list cache variants (unfiltered + each status).
    const statuses = Object.values(JobStatus);
    const keys = ['jobs:list', ...statuses.map((s) => `jobs:list:${s}`)];
    await this.cache.del(...keys);
  }
}
