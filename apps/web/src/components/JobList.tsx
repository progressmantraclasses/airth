import { useQuery } from '@tanstack/react-query';
import { JobStatus } from 'shared';
import { fetchJobs } from '../api/jobs';
import { JobRow } from './JobRow';
import { LoadingSkeleton } from './LoadingSkeleton';

interface Props {
  statusFilter: JobStatus | undefined;
  onError: (msg: string) => void;
  totalCount: number;
}

export function JobList({ statusFilter, onError, totalCount }: Props) {
  const { data: jobs, isLoading, isError, error } = useQuery({
    queryKey: ['jobs', statusFilter],
    queryFn: () => fetchJobs(statusFilter),
    refetchInterval: 15000,
  });

  return (
    <div className="table-card">
      <div className="table-header-row">
        <span className="table-title">Job Queue</span>
        <span className="table-count-pill">{jobs?.length ?? totalCount} jobs</span>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : isError ? (
        <div style={{ padding: '32px 20px' }}>
          <div className="error-banner">
            <span className="error-msg">Failed to load jobs: {(error as Error).message}</span>
          </div>
        </div>
      ) : !jobs?.length ? (
        <div className="empty-state">
          <div className="empty-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <rect x="3" y="3" width="18" height="18" rx="3"/>
              <path d="M8 12h8M8 8h5M8 16h3" strokeLinecap="round"/>
            </svg>
          </div>
          <h3>No jobs found</h3>
          <p>{statusFilter ? `No ${statusFilter} jobs right now.` : 'Create your first job to get started.'}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Job</th>
              <th>Status</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {jobs.map((job) => (
              <JobRow key={job.id} job={job} onError={onError} />
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
