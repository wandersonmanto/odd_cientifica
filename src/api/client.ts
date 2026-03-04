/**
 * src/api/client.ts
 * Cliente HTTP centralizado para a API Express (MySQL backend)
 */

const API_BASE = '/api';

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${path}`;

  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {}),
    },
    ...options,
  });

  if (!response.ok) {
    let errorMsg = `Erro ${response.status}: ${response.statusText}`;
    try {
      const body = await response.json();
      if (body?.error) errorMsg = body.error;
    } catch {}
    throw new ApiError(errorMsg, response.status);
  }

  return response.json() as Promise<T>;
}
