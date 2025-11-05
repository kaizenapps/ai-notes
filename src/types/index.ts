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
  objectivesSelected?: string[]; // Array of objective IDs selected for this client
}

export interface SessionNote {
  id: string;
  clientId: string;
  userId: string;
  date: Date;
  duration: number; // in minutes
  location: string;
  objectives: string[];
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
  customGoal?: string;
  feedback?: string;
  treatmentPlan?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}
