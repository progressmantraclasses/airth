export enum JobStatus {
  pending = 'pending',
  running = 'running',
  completed = 'completed',
  failed = 'failed',
}

export interface Job {
  id: string;
  title: string;
  type: string;
  status: JobStatus;
  version: number;
  createdAt: string;
  updatedAt: string;
}

// Valid state transitions. Each key can move to any status in its array.
const TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  [JobStatus.pending]: [JobStatus.running, JobStatus.failed],
  [JobStatus.running]: [JobStatus.completed, JobStatus.failed],
  [JobStatus.completed]: [],
  [JobStatus.failed]: [JobStatus.pending],
};

/** Returns true if a job in `from` status is allowed to move to `to`. */
export function canTransition(from: JobStatus, to: JobStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export { TRANSITIONS };
