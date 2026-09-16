import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { JobsRepository } from './jobs.repository';
import { CacheService } from '../cache/cache.service';

@Module({
  controllers: [JobsController],
  providers: [JobsService, JobsRepository, CacheService],
})
export class JobsModule {}
