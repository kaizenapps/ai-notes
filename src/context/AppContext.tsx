'use client';

import { createContext, useContext, useState, useCallback, useRef, useEffect, ReactNode } from 'react';
import { User, Client } from '@/types';
import { apiGet } from '@/lib/api';

interface LookupItem {
  id: string;
  name: string;
  category?: string;
  description?: string;
}

interface AppContextType {
  user: User | null;
  setUser: (user: User | null) => void;
  clients: Client[];
  setClients: (clients: Client[]) => void;
  locations: LookupItem[];
  loadLookupData: () => Promise<void>;
  resetTimeout: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [clients, setClients] = useState<Client[]>([]);
  const [locations, setLocations] = useState<LookupItem[]>([]);
  const sessionTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  
  // Load lookup data from API
  const loadLookupData = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await apiGet<{
        success: boolean;
        data: {
          locations: LookupItem[];
        }
      }>('/lookup');

      if (response.success && response.data) {
        setLocations(response.data.locations);
      }
    } catch (error) {
      console.warn('Failed to load lookup data, using fallbacks:', error);
      // Fallback data if API fails
      setLocations([
        { id: '1', name: 'Client Home' },
        { id: '2', name: 'Telehealth' },
        { id: '3', name: 'Community' },
        { id: '4', name: 'Office' }
      ]);
    }
  }, []);

  // HIPAA: Auto-logout after 15 minutes of inactivity
  const resetTimeout = useCallback(() => {
    if (sessionTimeoutRef.current) {
      clearTimeout(sessionTimeoutRef.current);
    }
    const timeout = setTimeout(() => {
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }, 15 * 60 * 1000);
    sessionTimeoutRef.current = timeout;
  }, []);

  // Load lookup data when component mounts and user is set
  useEffect(() => {
    if (user) {
      loadLookupData();
    }
  }, [user, loadLookupData]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (sessionTimeoutRef.current) {
        clearTimeout(sessionTimeoutRef.current);
      }
    };
  }, []);
  
  return (
    <AppContext.Provider value={{
      user, setUser,
      clients, setClients,
      locations,
      loadLookupData,
      resetTimeout
    }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
