import { useQuery } from '@tanstack/react-query';
import { JobStatus } from 'shared';
import { fetchJobs } from '../api/jobs';

export function StatusCounts() {
  const { data: jobs = [] } = useQuery({
    queryKey: ['jobs', undefined],
    queryFn: () => fetchJobs(),
    refetchInterval: 15000,
  });

  const counts = {
    all: jobs.length,
    pending: jobs.filter((j) => j.status === JobStatus.pending).length,
    running: jobs.filter((j) => j.status === JobStatus.running).length,
    completed: jobs.filter((j) => j.status === JobStatus.completed).length,
    failed: jobs.filter((j) => j.status === JobStatus.failed).length,
  };

  return (
    <div className="stat-grid">
      <div className="stat-card pending">
        <div className="stat-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <polyline points="12 6 12 12 16 14"></polyline>
          </svg>
        </div>
        <div className="stat-info">
          <div className="stat-value">{counts.pending}</div>
          <div className="stat-label">Pending</div>
        </div>
      </div>
      
      <div className="stat-card running">
        <div className="stat-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon>
          </svg>
        </div>
        <div className="stat-info">
          <div className="stat-value">{counts.running}</div>
          <div className="stat-label">Running</div>
        </div>
      </div>
      
      <div className="stat-card completed">
        <div className="stat-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
            <polyline points="22 4 12 14.01 9 11.01"></polyline>
          </svg>
        </div>
        <div className="stat-info">
          <div className="stat-value">{counts.completed}</div>
          <div className="stat-label">Completed</div>
        </div>
      </div>
      
      <div className="stat-card failed">
        <div className="stat-icon-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="15" y1="9" x2="9" y2="15"></line>
            <line x1="9" y1="9" x2="15" y2="15"></line>
          </svg>
        </div>
        <div className="stat-info">
          <div className="stat-value">{counts.failed}</div>
          <div className="stat-label">Failed</div>
        </div>
      </div>
    </div>
  );
}
