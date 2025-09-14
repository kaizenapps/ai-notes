const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export async function apiGet<T>(endpoint: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
  });
  if (!response.ok) throw new Error('API request failed');
  return response.json();
}

export async function apiPost<T>(endpoint: string, data: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('API request failed');
  return response.json();
}

export async function apiPut<T>(endpoint: string, data: unknown): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'PUT',
    headers: { 
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : '',
    },
    body: JSON.stringify(data),
  });
  if (!response.ok) throw new Error('API request failed');
  return response.json();
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(`${API_URL}${endpoint}`, {
    method: 'DELETE',
    headers: { 
      'Authorization': token ? `Bearer ${token}` : '',
    },
  });
  if (!response.ok) throw new Error('API request failed');
  return response.json();
}