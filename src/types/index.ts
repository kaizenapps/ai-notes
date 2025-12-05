// types/index.ts
export interface User {
  id: string;
  username: string;
  role: 'peer_support' | 'admin';
}

export interface Client {
  id: string;
  firstName: string;
  lastInitial: string; // Legacy field - kept for backward compatibility
  lastName?: string; // Full last name (only first name used in generated notes)
  gender?: 'male' | 'female'; // Used for AI pronoun generation (he/she)
  address?: string; // Client home address - for location context, not shown in notes
  dateOfBirth?: string; // Client date of birth (ISO date string)
  treatmentPlan?: string; // Required for session note generation
  extractedInterventions?: string[]; // AI-extracted interventions from treatment plan
}

export interface SessionNote {
  id: string;
  clientId: string;
  userId: string;
  date: Date;
  duration: number; // in minutes
  location: string;
  generatedNote: string;
  feedback?: string;
  treatmentPlan?: string; // Treatment plan for this session (optional in type for backward compat, required in API)
  selectedInterventions?: string[]; // Interventions selected for this session
  status?: 'draft' | 'completed' | 'archived';
  createdAt: Date;
}

export interface FormData {
  clientId: string;
  clientName?: string; // First name only (e.g., "Sarah")
  clientGender?: 'male' | 'female' | null; // Gender for AI pronoun usage (he/she)
  location: string;
  duration: string;
  feedback?: string;
  treatmentPlan?: string; // Treatment plan for this session
  interventions?: string[]; // Selected peer support interventions for this session
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
