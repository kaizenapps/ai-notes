'use client';

import { useEffect, useState } from 'react';
import { useApp } from '@/context/AppContext';
import { LoginForm } from '@/components/auth/LoginForm';
import { useSessionTimeout } from '@/hooks/useSessionTimeout';
import { LoadingSpinner } from '@/components/ui/LoadingSpinner';

export default function Home() {
  const { user, setUser } = useApp();
  const [loading, setLoading] = useState(true);
  
  useSessionTimeout();
  
  useEffect(() => {
    // Check for existing token and user data
    const token = localStorage.getItem('token');
    const storedUser = localStorage.getItem('user');
    
    if (token && storedUser && !user) {
      try {
        const userData = JSON.parse(storedUser);
        setUser(userData);
        window.location.href = '/dashboard';
        return;
      } catch {
        // Invalid stored data, clear it
        localStorage.removeItem('token');
        localStorage.removeItem('user');
      }
    }
    
    if (user) {
      // User is already logged in, redirect to dashboard
      window.location.href = '/dashboard';
      return;
    }
    
    setLoading(false);
  }, [user, setUser]);
  
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }
  
  if (!user) {
    return <LoginForm />;
  }

  // This should not be reached due to redirects above
  return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner />
    </div>
  );
}
