import { IsEnum, IsInt, Min } from 'class-validator';
import { JobStatus } from 'shared';

export class UpdateStatusDto {
  @IsEnum(JobStatus)
  status: JobStatus;

  // Client must send the current version for optimistic locking.
  @IsInt()
  @Min(1)
  version: number;
}
