import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { applyComplianceFilters } from '@/lib/security';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  let data: RefineData;
  
  try {
    data = await request.json() as RefineData;
  } catch {
    return Response.json({ error: 'Invalid request data' }, { status: 400 });
  }
  
  // Validate required fields
  if (!data.currentNote || data.currentNote.trim() === '') {
    return Response.json({ error: 'Current note is required' }, { status: 400 });
  }
  
  if (!data.refinementFeedback || data.refinementFeedback.trim() === '') {
    return Response.json({ error: 'Refinement feedback is required' }, { status: 400 });
  }
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    const prompt = buildRefinementPrompt(data);
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a professional peer support specialist refining session documentation based on feedback. Your role is to: 1) Use peer support language exclusively (never clinical/therapeutic terms), 2) Never include last names or full names (HIPAA compliance), 3) Focus on mutual support and peer-to-peer interventions, 4) Maintain the original structure and formatting, 5) Apply the requested changes while keeping the note professional and accurate."
        },
        { role: "user", content: prompt }
      ],
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000"),
    });
    
    const refinedNote = completion.choices[0].message.content || '';
    
    // Apply compliance filters
    const filteredNote = applyComplianceFilters(refinedNote);
    
    return Response.json({ note: filteredNote });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return Response.json({ error: 'Failed to refine note' }, { status: 500 });
  }
}

interface RefineData {
  currentNote: string;
  refinementFeedback: string;
  // Session context for better refinement
  clientName?: string;
  location?: string;
  duration?: number;
  objectives?: string[];
  treatmentPlan?: string;
}

function buildRefinementPrompt(data: RefineData): string {
  // Build context section if session details are provided
  const contextSection = (data.clientName || data.location || data.duration || data.objectives)
    ? `
SESSION CONTEXT (for reference):
${data.clientName ? `- Client: ${data.clientName}` : ''}
${data.location ? `- Location: ${data.location}` : ''}
${data.duration ? `- Duration: ${data.duration} minutes` : ''}
${data.objectives && data.objectives.length > 0 ? `- Objectives: ${data.objectives.join(', ')}` : ''}
${data.treatmentPlan ? `- Treatment Plan: ${data.treatmentPlan}` : ''}
`
    : '';
  
  return `You are refining an existing peer support session note based on specific feedback from the peer support specialist.

═══════════════════════════════════════════════════════════════
CURRENT SESSION NOTE TO REFINE (PRIMARY INPUT):
═══════════════════════════════════════════════════════════════
${data.currentNote}

${contextSection}
═══════════════════════════════════════════════════════════════
REFINEMENT REQUEST (what to change):
═══════════════════════════════════════════════════════════════
${data.refinementFeedback}

INSTRUCTIONS:
1. **PRIMARY TASK**: Refine the CURRENT SESSION NOTE above based on the REFINEMENT REQUEST
2. Keep the original note structure and format (Location, Focus, Activities, Interventions, Patient Response, Plan)
3. Apply the requested changes from the refinement feedback while preserving the rest of the note
4. Maintain HIPAA compliance (first names/initials only, no last names)
5. Use peer support language exclusively (not clinical/therapeutic terminology)
6. Keep the note professional, factual, and specific
7. Ensure all sections remain present and properly formatted
8. If the feedback requests adding information, integrate it naturally into the appropriate sections
9. If the feedback requests changes, modify only what's necessary while keeping the rest intact
10. The session context is provided for reference only - focus on refining the current note based on the feedback

OUTPUT: Return the complete refined session note with all sections, incorporating the requested changes. Include proper line breaks between sections for formatting.`;
}

