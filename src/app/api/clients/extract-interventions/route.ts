import { NextRequest } from 'next/server';
import OpenAI from 'openai';
import { verifyToken } from '@/lib/auth';

function getOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OpenAI API key not configured');
  }
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });
}

export async function POST(request: NextRequest) {
  let data: ExtractionData;
  
  try {
    data = await request.json() as ExtractionData;
  } catch {
    return Response.json({ error: 'Invalid request data' }, { status: 400 });
  }
  
  // Validate authentication
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  
  if (!token) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const payload = verifyToken(token);
  if (!payload) {
    return Response.json({ error: 'Invalid token' }, { status: 401 });
  }
  
  // Validate required fields
  if (!data.treatmentPlan || data.treatmentPlan.trim() === '') {
    return Response.json({ error: 'Treatment plan is required' }, { status: 400 });
  }
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }
    
    const prompt = buildExtractionPrompt(data);
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are an expert in analyzing treatment plans and extracting peer support interventions. Your role is to identify 3-5 specific, actionable peer support interventions that align with the client's goals and objectives. Always use the format: '[Category] - [Specific description]' where Category is one of: Peer Mentoring, Anxiety Management, Self-Esteem Building, Goal-Setting, Recovery Support, Parenting Skills, Educational Support, Crisis Prevention, Coping Skills Development, Social Support Building, or similar peer support categories."
        },
        { role: "user", content: prompt }
      ],
      temperature: 0.7,
      max_tokens: 500,
    });
    
    const response = completion.choices[0].message.content || '';
    
    // Parse response into array of interventions
    const interventions = response
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 0)
      // Remove bullet points, numbers, or dashes at the start
      .map(line => line.replace(/^[-•*\d.)\s]+/, '').trim())
      .filter(line => line.length > 5) // Filter out very short lines
      .slice(0, 5); // Limit to 5 interventions
    
    return Response.json({ 
      success: true,
      interventions: interventions
    });
  } catch (error) {
    console.error('OpenAI API error:', error);
    return Response.json({ 
      success: false,
      error: 'Failed to extract interventions' 
    }, { status: 500 });
  }
}

interface ExtractionData {
  treatmentPlan: string;
  objectives?: string[];
}

function buildExtractionPrompt(data: ExtractionData): string {
  const objectivesSection = data.objectives && data.objectives.length > 0
    ? `\n\nCLIENT'S SELECTED OBJECTIVES:\n${data.objectives.map((obj, idx) => `${idx + 1}. ${obj}`).join('\n')}`
    : '';
  
  return `Analyze the following treatment plan and extract 3-5 specific peer support interventions.

TREATMENT PLAN:
${data.treatmentPlan}
${objectivesSection}

INSTRUCTIONS:
1. Extract 3-5 peer support interventions that are mentioned or implied in the treatment plan
2. Focus on practical, actionable peer support activities (not clinical therapy)
3. Each intervention should be formatted as: "[Category] - [Specific description]"
4. Categories should be peer support focused, such as:
   - Peer Mentoring
   - Anxiety Management
   - Self-Esteem Building
   - Goal-Setting
   - Recovery Support
   - Parenting Skills
   - Educational Support
   - Crisis Prevention
   - Coping Skills Development
   - Social Support Building
5. Descriptions should be specific and actionable (not generic)
6. If the treatment plan mentions specific techniques, include them
7. Align interventions with the stated goals and objectives
8. Use peer support language (not clinical/therapeutic terminology)

EXAMPLES OF GOOD FORMAT:
- "Peer Mentoring - Weekly one-on-one support sessions focused on recovery goals"
- "Anxiety Management - Breathing exercises and grounding techniques for stress reduction"
- "Self-Esteem Building - Positive affirmation journaling and strengths identification"
- "Goal-Setting - SMART goal development and weekly progress tracking"
- "Parenting Skills - Peer-led discussions on managing challenging behaviors"

OUTPUT:
Return ONLY the intervention list, one per line, formatted as shown above.
Do not include explanations, numbering, or additional text.`;
}

