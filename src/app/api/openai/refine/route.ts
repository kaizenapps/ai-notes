import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { applyComplianceFilters } from '@/lib/security';
import { templateDb } from '@/lib/database';

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
    
    // Load active template
    const template = await templateDb.findActive();
    const prompt = await buildRefinementPrompt(data, template);
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
  treatmentPlan?: string; // Session-specific treatment plan
  selectedInterventions?: string[]; // Selected interventions for this session
}

// Helper function to replace placeholders in text
function replacePlaceholders(text: string, data: RefineData): string {
  const replacements: Record<string, string> = {
    '{{clientName}}': data.clientName || 'Client',
    '{{location}}': data.location || '',
    '{{duration}}': data.duration ? data.duration.toString() : '',
    '{{objectives}}': data.objectives && data.objectives.length > 0 ? data.objectives.join(', ') : '',
    '{{treatmentPlan}}': data.treatmentPlan || '',
    '{{selectedInterventions}}': data.selectedInterventions && data.selectedInterventions.length > 0
      ? data.selectedInterventions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
      : ''
  };

  let result = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

async function buildRefinementPrompt(data: RefineData, template: any): Promise<string> {
  // Build interventions section
  const interventionsSection = data.selectedInterventions && data.selectedInterventions.length > 0
    ? `\n- Selected Interventions for This Session:\n  ${data.selectedInterventions.map((i, idx) => `${idx + 1}. ${i}`).join('\n  ')}`
    : '';
  
  // Build treatment plan section
  const treatmentPlanSection = data.treatmentPlan && data.treatmentPlan.trim().length > 0
    ? `\n- Treatment Plan for This Session:\n  ${data.treatmentPlan.trim()}`
    : '';
  
  // Build context section if session details are provided
  const contextSection = (data.clientName || data.location || data.duration || data.objectives || data.treatmentPlan || data.selectedInterventions)
    ? `
SESSION CONTEXT (for reference):
${data.clientName ? `- Client: ${data.clientName}` : ''}
${data.location ? `- Location: ${data.location}` : ''}
${data.duration ? `- Duration: ${data.duration} minutes` : ''}
${data.objectives && data.objectives.length > 0 ? `- Objectives: ${data.objectives.join(', ')}` : ''}${treatmentPlanSection}${interventionsSection}
`
    : '';

  // Build template structure if available
  let templateStructureNote = '';
  if (template && template.sections && template.sections.length > 0) {
    const visibleSections = template.sections
      .filter((s: any) => s.isVisible)
      .sort((a: any, b: any) => a.order - b.order);
    
    templateStructureNote = `\n\nTEMPLATE STRUCTURE (maintain this structure in your refined note):\n${visibleSections.map((s: any) => s.heading).join('\n')}\n\nIMPORTANT: The refined note must follow this exact section structure and order.`;
  } else {
    templateStructureNote = '\n\nIMPORTANT: Keep the original note structure and format (Location, Focus, Activities, Interventions, Patient Response, Plan).';
  }
  
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
${templateStructureNote}

INSTRUCTIONS:
1. **PRIMARY TASK**: Refine the CURRENT SESSION NOTE above based on the REFINEMENT REQUEST
2. ${template && template.sections ? 'Follow the template structure provided above' : 'Keep the original note structure and format (Location, Focus, Activities, Interventions, Patient Response, Plan)'}
3. Apply the requested changes from the refinement feedback while preserving the rest of the note
4. Maintain HIPAA compliance (first names/initials only, no last names)
5. Use peer support language exclusively (not clinical/therapeutic terminology)
6. Keep the note professional, factual, and specific
7. Ensure all sections remain present and properly formatted
8. If the feedback requests adding information, integrate it naturally into the appropriate sections
9. If the feedback requests changes, modify only what's necessary while keeping the rest intact
10. **IMPORTANT**: ${data.selectedInterventions && data.selectedInterventions.length > 0 ? 'The "Peer Support Interventions" section should reference ONLY the selected interventions listed in the session context above. Do NOT include interventions that are not in that list.' : ''} ${data.treatmentPlan && data.treatmentPlan.trim().length > 0 ? 'The treatment plan for this session is provided in the context - use it as reference when refining the note.' : ''}
11. The session context (including selected interventions and treatment plan) is provided for reference - use it to ensure accuracy when refining the note

OUTPUT: Return the complete refined session note with all sections, incorporating the requested changes. Include proper line breaks between sections for formatting.`;
}

