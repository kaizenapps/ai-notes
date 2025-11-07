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
  extractedInterventions?: string[]; // AI-extracted interventions from treatment plan
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
  treatmentPlan?: string; // Treatment plan specific to this session (not linked to client)
  selectedInterventions?: string[]; // Interventions selected for this session
  status?: 'draft' | 'completed' | 'archived';
  createdAt: Date;
}

export interface FormData {
  clientId: string;
  clientName?: string; // Format: "FirstName LastInitial." (e.g., "Dark T.")
  location: string;
  duration: string;
  objectives: string[];
  feedback?: string;
  treatmentPlan?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface TemplateSection {
  name: string;
  heading: string;
  instructions: string;
  placeholders: string[];
  isVisible: boolean;
  order: number;
}

export interface MasterSessionTemplate {
  id: string;
  name: string;
  sections: TemplateSection[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}
