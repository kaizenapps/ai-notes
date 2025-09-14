'use client';

import { useState } from 'react';
import { useApp } from '@/context/AppContext';
import { apiPost } from '@/lib/api';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { styles } from '@/lib/styles';
import { User } from '@/types';

interface LoginResponse {
  token: string;
  user: User;
}

export function LoginForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setUser } = useApp();
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    const formData = new FormData(e.currentTarget);
    const username = formData.get('username') as string;
    const password = formData.get('password') as string;
    
    try {
      const response = await apiPost<LoginResponse>('/auth/login', {
        username,
        password,
      });
      
      localStorage.setItem('token', response.token);
      localStorage.setItem('user', JSON.stringify(response.user));
      setUser(response.user);
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } catch (error) {
      console.error('Login error:', error);
      setError('Invalid username or password');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Session Notes Generator
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Peer Support Documentation System
          </p>
        </div>
        <form className={`${styles.card} space-y-6`} onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          
          <div>
            <label className={styles.label}>Username</label>
            <input
              type="text"
              name="username"
              required
              className={styles.input}
              placeholder="Enter your username"
            />
          </div>
          
          <div>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              name="password"
              required
              className={styles.input}
              placeholder="Enter your password"
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full ${styles.button.primary}`}
          >
            {loading ? <LoadingSpinner /> : 'Sign In'}
          </button>
          
          <div className="text-sm text-gray-500 text-center">
            Demo credentials: admin / admin123
          </div>
        </form>
      </div>
    </div>
  );
}
