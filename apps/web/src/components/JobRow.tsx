import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Job, JobStatus, canTransition } from 'shared';
import { updateJobStatus, deleteJob } from '../api/jobs';

interface Props {
  job: Job;
  onError: (msg: string) => void;
}

const ALL_STATUSES = Object.values(JobStatus);

const STATUS_LABELS: Record<JobStatus, string> = {
  [JobStatus.pending]:   'Pending',
  [JobStatus.running]:   'Running',
  [JobStatus.completed]: 'Completed',
  [JobStatus.failed]:    'Failed',
};

export function JobRow({ job, onError }: Props) {
  const qc = useQueryClient();

  const statusMutation = useMutation({
    mutationFn: (next: JobStatus) => updateJobStatus(job.id, next, job.version),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
    onError: (err: Error) => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      onError(err.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteJob(job.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['jobs'] }),
    onError: (err: Error) => onError(err.message),
  });

  const current = job.status as JobStatus;
  const validNext = ALL_STATUSES.filter((s) => canTransition(current, s));
  const busy = statusMutation.isPending || deleteMutation.isPending;

  return (
    <tr>
      <td><span className="job-id-cell">{job.id.slice(0, 8)}…</span></td>
      <td>
        <div className="job-title-cell">
          <div className="title">{job.title}</div>
          <span className="type-tag">{job.type}</span>
        </div>
      </td>
      <td>
        <span className={`status-badge ${current}`}>{STATUS_LABELS[current]}</span>
      </td>
      <td>
        <span className="date-cell">
          {new Date(job.createdAt).toLocaleDateString('en-IN', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })}
        </span>
      </td>
      <td>
        <div className="actions-cell">
          {validNext.map((next) => (
            <button
              key={next}
              id={`action-${job.id}-${next}`}
              className="btn-transition"
              disabled={busy}
              onClick={() => statusMutation.mutate(next)}
            >
              → {STATUS_LABELS[next]}
            </button>
          ))}
          <button
            id={`delete-${job.id}`}
            className="btn-delete"
            disabled={busy}
            onClick={() => deleteMutation.mutate()}
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
