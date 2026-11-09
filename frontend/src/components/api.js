export const API_BASE = import.meta.env.PUBLIC_API_URL || 'http://localhost:8000';

export function authHeaders() {
  return { Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' };
}
