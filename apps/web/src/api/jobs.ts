import { Job, JobStatus } from 'shared';

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const msg = Array.isArray(body.message)
      ? body.message.join(', ')
      : (body.message ?? `Request failed with ${res.status}`);
    throw new Error(msg);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function fetchJobs(status?: JobStatus): Promise<Job[]> {
  const qs = status ? `?status=${status}` : '';
  return request<Job[]>(`/jobs${qs}`);
}

export function createJob(
  data: { title: string; type: string },
  idempotencyKey?: string,
): Promise<Job> {
  return request<Job>('/jobs', {
    method: 'POST',
    body: JSON.stringify(data),
    headers: idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : undefined,
  });
}

export function updateJobStatus(
  id: string,
  status: JobStatus,
  version: number,
): Promise<Job> {
  return request<Job>(`/jobs/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status, version }),
  });
}

export function deleteJob(id: string): Promise<void> {
  return request<void>(`/jobs/${id}`, { method: 'DELETE' });
}
