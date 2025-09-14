// types/index.ts
export interface User {
  id: string;
  username: string;
  role: 'peer_support' | 'admin';
}

export interface Client {
  id: string;
  firstName: string;
  lastInitial: string; // HIPAA: Only store initials
  treatmentPlan?: string;
}

export interface SessionNote {
  id: string;
  clientId: string;
  userId: string;
  date: Date;
  duration: number; // in minutes
  location: string;
  objectives: string[];
  interventions: string[];
  generatedNote: string;
  feedback?: string;
  status?: 'draft' | 'completed' | 'archived';
  createdAt: Date;
}

export interface FormData {
  clientId: string;
  location: string;
  duration: string;
  objectives: string[];
  interventions: string[];
  customGoal?: string;
  feedback?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
