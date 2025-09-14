'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { SessionNoteForm } from '@/components/forms/SessionNoteForm';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';
import { styles } from '@/lib/styles';
import { Client } from '@/types';
import { apiGet } from '@/lib/api';
import Link from 'next/link';

export default function Dashboard() {
  const { user, setUser, setClients } = useApp();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  useSessionTimeout();
  
  useEffect(() => {
    const loadDashboard = async () => {
      try {
        // Check for existing token on mount
        const token = localStorage.getItem('token');
        if (!token) {
          window.location.href = '/';
          return;
        }

        // If no user but token exists, restore user from localStorage
        if (!user) {
          const storedUser = localStorage.getItem('user');
          if (storedUser) {
            try {
              const userData = JSON.parse(storedUser);
              setUser(userData);
            } catch (parseError) {
              console.error('Error parsing stored user:', parseError);
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              window.location.href = '/';
              return;
            }
          } else {
            // No stored user, redirect to login
            localStorage.removeItem('token');
            window.location.href = '/';
            return;
          }
        }

        // Load clients from database
        try {
          const response = await apiGet<{ success: boolean; data: Client[] }>('/clients');
          if (response.success && response.data) {
            setClients(response.data);
          } else {
            // Fallback to demo clients if database is not available
            const demoClients: Client[] = [
              { id: '1', firstName: 'John', lastInitial: 'D' },
              { id: '2', firstName: 'Jane', lastInitial: 'S' },
              { id: '3', firstName: 'Michael', lastInitial: 'R' },
              { id: '4', firstName: 'Sarah', lastInitial: 'L' },
            ];
            setClients(demoClients);
          }
        } catch (apiError) {
          console.warn('Database not available, using demo data:', apiError);
          // Fallback to demo clients
          const demoClients: Client[] = [
            { id: '1', firstName: 'John', lastInitial: 'D' },
            { id: '2', firstName: 'Jane', lastInitial: 'S' },
            { id: '3', firstName: 'Michael', lastInitial: 'R' },
            { id: '4', firstName: 'Sarah', lastInitial: 'L' },
          ];
          setClients(demoClients);
        }
      } catch (error) {
        console.error('Error loading dashboard:', error);
        setError('Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    };

    loadDashboard();
  }, [user, setUser, setClients]);
  
  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
    setClients([]);
    window.location.href = '/';
  };
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-600 mb-4">{error}</div>
          <button
            onClick={() => window.location.reload()}
            className={styles.button.primary}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }
  
  if (!user) {
    window.location.href = '/';
    return null;
  }
  
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow">
        <div className={`${styles.container} flex justify-between items-center py-4`}>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Session Notes Generator</h1>
            <p className="text-sm text-gray-600">Welcome, {user.username}</p>
          </div>
          <div className="flex gap-3">
            <Link
              href="/dashboard/history"
              className={styles.button.secondary}
            >
              View History
            </Link>
            {user.role === 'admin' && (
              <Link
                href="/dashboard/admin"
                className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
              >
                Admin Dashboard
              </Link>
            )}
            <button
              onClick={handleLogout}
              className={styles.button.secondary}
            >
              Logout
            </button>
          </div>
        </div>
      </header>
      
      {/* Main Content */}
      <main className="py-8">
        <SessionNoteForm />
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t mt-12">
        <div className={`${styles.container} py-4 text-center text-sm text-gray-500`}>
          <p>HIPAA Compliant • Session timeout: 15 minutes • <Link href="/dashboard/history" className="text-blue-600 hover:underline">Session History</Link></p>
        </div>
      </footer>
    </div>
  );
}
