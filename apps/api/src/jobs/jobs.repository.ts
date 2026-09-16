import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaClient, Job, JobStatus } from '@prisma/client';

@Injectable()
export class JobsRepository extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    await this.$connect();
  }

  findAll(status?: JobStatus): Promise<Job[]> {
    return this.job.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
    });
  }

  findById(id: string): Promise<Job | null> {
    return this.job.findUnique({ where: { id } });
  }

  create(data: { title: string; type: string }): Promise<Job> {
    return this.job.create({ data });
  }

  // Returns null if the version check fails (another update got there first).
  async updateStatusWithVersion(
    id: string,
    status: JobStatus,
    expectedVersion: number,
  ): Promise<Job | null> {
    // $transaction ensures the version check and write are one atomic operation.
    return this.$transaction(async (tx) => {
      const updated = await tx.job.updateMany({
        where: { id, version: expectedVersion },
        data: { status, version: { increment: 1 } },
      });

      if (updated.count === 0) return null;

      return tx.job.findUnique({ where: { id } });
    });
  }

  delete(id: string): Promise<Job> {
    return this.job.delete({ where: { id } });
  }
}
