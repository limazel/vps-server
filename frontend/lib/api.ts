const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

export function setToken(token: string) {
  localStorage.setItem('token', token);
}

export function clearToken() {
  localStorage.removeItem('token');
}

async function request(path: string, options: RequestInit = {}) {
  const token = getToken();
  const res = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers ?? {}),
    },
  });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/login';
    throw new Error('Unauthorized');
  }

  return res;
}

export const api = {
  get:    (path: string)                  => request(path),
  post:   (path: string, body?: unknown)  => request(path, { method: 'POST',   body: JSON.stringify(body) }),
  patch:  (path: string, body?: unknown)  => request(path, { method: 'PATCH',  body: JSON.stringify(body) }),
  delete: (path: string)                  => request(path, { method: 'DELETE' }),
};
