'use client';

import { useEffect } from 'react';
import { useApp } from '@/context/AppContext';

// Session timeout hook
export function useSessionTimeout() {
  const { resetTimeout } = useApp();
  
  useEffect(() => {
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart'];
    
    const handleActivity = () => resetTimeout();
    
    events.forEach(event => {
      document.addEventListener(event, handleActivity);
    });
    
    resetTimeout(); // Initial timeout
    
    return () => {
      events.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
    };
  }, [resetTimeout]);
}
