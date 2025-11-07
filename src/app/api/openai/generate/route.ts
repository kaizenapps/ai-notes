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
  let data: SessionData;
  
  try {
    data = await request.json() as SessionData;
  } catch {
    return Response.json({ error: 'Invalid request data' }, { status: 400 });
  }
  
  // Validate required fields
  if (!data.location || data.location.trim() === '') {
    return Response.json({ error: 'Location is required' }, { status: 400 });
  }
  
  if (!data.duration || data.duration.trim() === '') {
    return Response.json({ error: 'Duration is required' }, { status: 400 });
  }
  
  if (!data.objectives || !Array.isArray(data.objectives) || data.objectives.length === 0) {
    return Response.json({ error: 'At least one objective is required' }, { status: 400 });
  }
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    // Load active template
    const template = await templateDb.findActive();
    const prompt = await buildPrompt(data, template);
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a professional peer support specialist documenting peer support sessions. Your documentation must: 1) Use peer support language exclusively (never clinical/therapeutic terms), 2) Never include last names or full names (HIPAA compliance), 3) Focus on mutual support, shared experiences, and peer-to-peer interventions, 4) Be factual, specific, and professional, 5) Avoid diagnoses or clinical assessments. Always follow the exact output format specified in the user's instructions."
        },
        { role: "user", content: prompt }
      ],
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "2000"), // Increased for more detailed notes
    });
    
    const note = completion.choices[0].message.content || '';
    
    // Apply compliance filters
    const filteredNote = applyComplianceFilters(note);
    
    return Response.json({ note: filteredNote });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return Response.json({ error: 'Failed to generate note' }, { status: 500 });
  }
}

interface SessionData {
  clientId?: string;
  clientName?: string; // Format: "FirstName LastInitial." (e.g., "Dark T.")
  location: string;
  duration: string;
  objectives: string[];
  feedback?: string;
  treatmentPlan?: string;
  interventions?: string[]; // AI-extracted interventions from treatment plan
}

// Helper function to replace placeholders in text
function replacePlaceholders(text: string, data: SessionData): string {
  const duration = parseInt(data.duration);
  const replacements: Record<string, string> = {
    '{{clientName}}': data.clientName || 'Client',
    '{{location}}': data.location || '',
    '{{duration}}': duration.toString(),
    '{{objectives}}': data.objectives.join(', '),
    '{{treatmentPlan}}': data.treatmentPlan || '',
    '{{selectedInterventions}}': data.interventions && data.interventions.length > 0
      ? data.interventions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')
      : ''
  };

  let result = text;
  for (const [placeholder, value] of Object.entries(replacements)) {
    result = result.replace(new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), value);
  }
  return result;
}

async function buildPrompt(data: SessionData, template: any): Promise<string> {
  // If no template, use default format (backward compatibility)
  if (!template || !template.sections || template.sections.length === 0) {
    return buildDefaultPrompt(data);
  }

  // Build additional context sections
  const additionalNotesSection = data.feedback && data.feedback.trim().length > 0 
    ? `\n\nADDITIONAL NOTES FROM SESSION:\n${data.feedback.trim()}\n` 
    : '';
  
  const treatmentPlanSection = data.treatmentPlan && data.treatmentPlan.trim().length > 0 
    ? `\n\nTREATMENT PLAN FOR THIS SESSION:\n${data.treatmentPlan.trim()}\n\nIMPORTANT: This is the treatment plan specific to this session. Use this treatment plan (not the client's general treatment plan) when generating the session note.\n` 
    : '';
  
  const interventionsSection = data.interventions && data.interventions.length > 0
    ? `\n\nSELECTED PEER SUPPORT INTERVENTIONS FOR THIS SESSION:\n${data.interventions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\nIMPORTANT: These are the specific interventions that were selected for use in this session. You MUST reference and use ONLY these interventions in the "Peer Support Interventions" section of your note.\n`
    : '';

  const duration = parseInt(data.duration);
  
  // Build output format from template sections
  const visibleSections = template.sections
    .filter((s: any) => s.isVisible)
    .sort((a: any, b: any) => a.order - b.order);

  const outputFormat = visibleSections.map((section: any) => {
    const instructions = replacePlaceholders(section.instructions, data);
    return `${section.heading}\n[${instructions}]`;
  }).join('\n\n');

  return `You are a peer support specialist creating professional session documentation. Your role is to document peer support sessions accurately and in compliance with HIPAA guidelines.

CRITICAL COMPLIANCE REQUIREMENTS:
- Use PEER SUPPORT language only (never use therapist, clinical, or medical terminology)
- Never include last names or full names (only first name or initials)
- Focus on peer support interventions, shared experiences, and mutual support
- Avoid diagnoses, clinical assessments, or medical judgments
- Use language like "peer support", "mutual support", "shared experiences" instead of "therapy" or "treatment"

SESSION INFORMATION:
- Client: ${data.clientName || 'Client'}
- Location: ${data.location}
- Duration: ${duration} minutes
- Session Objectives: ${data.objectives.join(', ')}
${treatmentPlanSection}${interventionsSection}${additionalNotesSection}

INSTRUCTIONS FOR NOTE GENERATION:

1. TEMPLATE STRUCTURE:
   - Follow the EXACT section structure and headings provided in the OUTPUT FORMAT below
   - Each section has specific instructions - follow them carefully
   - Maintain the order of sections as specified
   - Include line breaks (newlines) between each section for proper formatting

2. CONTENT GUIDELINES:
   - Be factual, specific, and professional
   - Use peer support terminology (e.g., "peer support specialist", "mutual support", "shared experiences")
   - Include concrete examples and observations from the session
   - Connect activities to the stated objectives
   - Keep each section focused and relevant

OUTPUT FORMAT - Use EXACTLY these headings in this order (no markdown, no bold, just plain text):
IMPORTANT: Include line breaks (newlines) between each section for proper formatting. Each section should be separated by a blank line.

${outputFormat}`;
}

function buildDefaultPrompt(data: SessionData): string {
  // Build additional notes section
  const additionalNotesSection = data.feedback && data.feedback.trim().length > 0 
    ? `\n\nADDITIONAL NOTES FROM SESSION:\n${data.feedback.trim()}\n` 
    : '';
  
  // Build treatment plan section - this is the SESSION-SPECIFIC treatment plan
  const treatmentPlanSection = data.treatmentPlan && data.treatmentPlan.trim().length > 0 
    ? `\n\nTREATMENT PLAN FOR THIS SESSION:\n${data.treatmentPlan.trim()}\n\nIMPORTANT: This is the treatment plan specific to this session. Use this treatment plan (not the client's general treatment plan) when generating the session note.\n` 
    : '';
  
  // Build interventions section - these are the SELECTED interventions for this session
  const interventionsSection = data.interventions && data.interventions.length > 0
    ? `\n\nSELECTED PEER SUPPORT INTERVENTIONS FOR THIS SESSION:\n${data.interventions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\nIMPORTANT: These are the specific interventions that were selected for use in this session. You MUST reference and use ONLY these interventions in the "Peer Support Interventions" section of your note.\n`
    : '';
  
  // Calculate time breakdown points
  const duration = parseInt(data.duration);
  const timePoints = {
    start: 0,
    mid1: Math.floor(duration * 0.25),
    mid2: Math.floor(duration * 0.5),
    mid3: Math.floor(duration * 0.75),
    end: duration
  };
  
  return `You are a peer support specialist creating professional session documentation. Your role is to document peer support sessions accurately and in compliance with HIPAA guidelines.

CRITICAL COMPLIANCE REQUIREMENTS:
- Use PEER SUPPORT language only (never use therapist, clinical, or medical terminology)
- Never include last names or full names (only first name or initials)
- Focus on peer support interventions, shared experiences, and mutual support
- Avoid diagnoses, clinical assessments, or medical judgments
- Use language like "peer support", "mutual support", "shared experiences" instead of "therapy" or "treatment"

SESSION INFORMATION:
- Client: ${data.clientName || 'Client'}
- Location: ${data.location}
- Duration: ${duration} minutes
- Session Objectives: ${data.objectives.join(', ')}
${treatmentPlanSection}${interventionsSection}${additionalNotesSection}

INSTRUCTIONS FOR NOTE GENERATION:

1. PEER SUPPORT INTERVENTIONS USAGE:
${data.interventions && data.interventions.length > 0
  ? `   - CRITICAL: Use ONLY the selected peer support interventions listed above
   - These interventions were specifically selected for this session from the client's available interventions
   - You MUST include ALL of these selected interventions in the "Peer Support Interventions" section
   - Describe how each of these specific interventions was applied during the session
   - Do NOT mention or use any interventions that are NOT in the selected list above
   - Connect session activities to these specific intervention approaches`
  : data.treatmentPlan && data.treatmentPlan.trim().length > 0 
  ? `   - Extract and reference relevant goals, objectives, and interventions from the treatment plan
   - Align session activities with the treatment plan objectives listed above
   - Use general peer support approaches mentioned in the treatment plan when describing activities
   - Connect session outcomes to treatment plan goals`
  : `   - Focus on the session objectives provided above
   - Use general peer support approaches aligned with the client's stated goals`}

2. ADDITIONAL NOTES:
${data.feedback && data.feedback.trim().length > 0 
  ? `   - Incorporate the additional notes provided above into the appropriate sections
   - Use the notes to add specific details about client responses, activities, and observations`
  : `   - Create appropriate content based on the session objectives and treatment plan`}

3. TIME-BASED ACTIVITIES BREAKDOWN:
   - Break down the ${duration}-minute session into logical time segments
   - Suggested breakdown: Opening (0-${timePoints.mid1} min), Main Activities (${timePoints.mid1}-${timePoints.mid3} min), Closing (${timePoints.mid3}-${duration} min)
   - Adjust time segments based on the actual duration and activities described

4. CONTENT GUIDELINES:
   - Be factual, specific, and professional
   - Use peer support terminology (e.g., "peer support specialist", "mutual support", "shared experiences")
   - Include concrete examples and observations from the session
   - Connect activities to the stated objectives
   - Keep each section focused and relevant

OUTPUT FORMAT - Use EXACTLY these headings (no markdown, no bold, just plain text):
IMPORTANT: Include line breaks (newlines) between each section for proper formatting. Each section should be separated by a blank line.

Location of Meeting:
[Provide the location where the session took place]

Focus of the Meeting:
[Describe the primary focus based on the session objectives. ${data.treatmentPlan && data.treatmentPlan.trim().length > 0 ? 'Reference the treatment plan for this session provided above.' : ''} Be specific about what was addressed in this session.]

Activities (time-based breakdown):
[Break down activities by time segments. Include:
- Opening/check-in period
- Main activities aligned with objectives
- Closing/summary period
Use specific time ranges based on the ${duration}-minute duration. Include line breaks between each time segment.]

Peer Support Interventions:
[${data.interventions && data.interventions.length > 0 
  ? `CRITICAL: You MUST use ONLY the selected interventions listed above. For each selected intervention, describe:
- How it was applied during this session
- The specific activities or approaches used
- The client's engagement with that intervention
- Any outcomes or observations related to that intervention
Do NOT include any interventions that are NOT in the selected list above.`
  : 'Describe the peer support interventions used during the session. Reference interventions from the treatment plan if provided.'} Use peer support language - avoid clinical terms. Examples: active listening, shared experiences, mutual support, goal-setting, resource sharing, peer mentoring, etc.]

Patient Response/Content:
[Describe how the client engaged with the session, their responses, participation level, any insights shared, progress observed, and their feedback. IMPORTANT: Use the client's name "${data.clientName || 'Client'}" exactly as provided in the session information above. Do NOT use generic names like "J.", "R.", or other initials unless that is the actual client's name. Be specific and factual.]

Plan for Next Session:
[Based on the session objectives${data.treatmentPlan && data.treatmentPlan.trim().length > 0 ? ' and the treatment plan for this session provided above' : ''}, outline what should be addressed in the next session. ${data.treatmentPlan && data.treatmentPlan.trim().length > 0 ? 'Reference the treatment plan goals from this session.' : ''} Keep it focused and actionable.]`;
}

