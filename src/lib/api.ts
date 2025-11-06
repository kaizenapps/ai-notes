const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

// Handle token expiration and auto-logout
function handleAuthError(response: Response) {
  if (response.status === 401) {
    // Token is expired or invalid - clear session and redirect to login
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Only redirect if not already on login page
      if (window.location.pathname !== '/') {
        window.location.href = '/';
      }
    }
  }
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  const response = await fetch(`${API_URL}${endpoint}`, {
    headers: {
      'Authorization': token ? `Bearer ${token}` : '',
    },
  });
  
  if (!response.ok) {
    handleAuthError(response);
    throw new Error('API request failed');
  }
  
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
  
  if (!response.ok) {
    handleAuthError(response);
    throw new Error('API request failed');
  }
  
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
  
  if (!response.ok) {
    handleAuthError(response);
    throw new Error('API request failed');
  }
  
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
  
  if (!response.ok) {
    handleAuthError(response);
    throw new Error('API request failed');
  }
  
  return response.json();
}