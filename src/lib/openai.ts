import { apiPost } from '@/lib/api';
import { FormData } from '@/types';

export async function generateSessionNote(data: FormData): Promise<string> {
  const response = await apiPost<{ note: string }>('/openai/generate', {
    ...data,
    compliance: {
      noTherapistTerms: true,
      noLastNames: true,
      usePeerSupportLanguage: true,
    },
  });
  return response.note;
}
