import { useState, useRef } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { createJob } from '../api/jobs';

interface Props {
  onClose: () => void;
  onError: (msg: string) => void;
}

export function CreateJobForm({ onClose, onError }: Props) {
  const [title, setTitle] = useState('');
  const [type, setType] = useState('');
  const qc = useQueryClient();
  const idempotencyKey = useRef(crypto.randomUUID()).current;

  const mutation = useMutation({
    mutationFn: () => createJob({ title: title.trim(), type: type.trim() }, idempotencyKey),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs'] });
      onClose();
    },
    onError: (err: Error) => {
      onError(err.message);
      onClose();
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim() || !type.trim()) return;
    mutation.mutate();
  }

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal">
        <div className="modal-header">
          <div className="modal-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 5v14M5 12h14" strokeLinecap="round"/>
            </svg>
          </div>
          <div>
            <h2>New Job</h2>
            <p className="modal-sub">Add a new job to the queue</p>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="job-title">Job Title</label>
            <input
              id="job-title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Export user report CSV"
              autoFocus
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="job-type">Job Type</label>
            <input
              id="job-type"
              type="text"
              value={type}
              onChange={(e) => setType(e.target.value)}
              placeholder="e.g. export, email, sync, backup"
              required
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose} disabled={mutation.isPending}>
              Cancel
            </button>
            <button
              type="submit"
              className="btn-submit"
              disabled={mutation.isPending || !title.trim() || !type.trim()}
            >
              {mutation.isPending ? 'Creating…' : 'Create Job'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
