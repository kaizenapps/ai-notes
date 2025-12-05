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
          content: "You are an expert at analyzing treatment plans for PEER SUPPORT services (NOT clinical therapy). Your role is to suggest 3-5 specific peer support interventions that would help achieve the goals in the treatment plan. CRITICAL RULES: 1) This is for PEER SUPPORT SPECIALISTS - NOT therapists or counselors. 2) Base interventions on the goals and objectives mentioned in the treatment plan. 3) If the treatment plan only lists goals without specific interventions, suggest appropriate peer support activities that would help achieve those goals. 4) Use peer support language (not clinical/therapy terms). 5) Use the format: '[Category] - [Specific description]' where Category is peer-support focused. 6) ALWAYS provide at least 3 relevant interventions based on the treatment plan goals."
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
}

function buildExtractionPrompt(data: ExtractionData): string {
  return `Analyze the following treatment plan and suggest 3-5 specific PEER SUPPORT interventions that would help achieve the stated goals.

IMPORTANT CONTEXT:
- This is for a PEER SUPPORT SPECIALIST (NOT a therapist or counselor)
- Peer support specialists use lived experience and mutual support, NOT clinical therapy
- Focus on peer support activities like: mentoring, sharing experiences, goal-setting, resource navigation, mutual support, skill-building workshops, coping strategies, etc.

TREATMENT PLAN:
${data.treatmentPlan}

INSTRUCTIONS:
1. Read the goals and objectives in the treatment plan
2. Suggest 3-5 peer support interventions that would help achieve those goals
3. If the treatment plan mentions clinical/therapy terms, translate them to peer support equivalents
4. Focus on practical, actionable peer support activities
5. Each intervention should be formatted as: "[Category] - [Specific description]"
6. Categories should be peer support focused:
   - Peer Mentoring
   - Mutual Support
   - Goal-Setting
   - Recovery Support
   - Coping Skills Development
   - Social Support Building
   - Resource Navigation
   - Skill Building
   - Wellness Activities
   - Communication Skills

EXAMPLES OF GOOD FORMAT:
- "Coping Skills Development - Practice breathing exercises and grounding techniques for anxiety management"
- "Goal-Setting - Develop weekly wellness goals and track progress together"
- "Peer Mentoring - Weekly one-on-one support sessions focused on mental health wellness"
- "Mutual Support - Share experiences and strategies for managing daily challenges"
- "Wellness Activities - Engage in stress-reducing activities like walks or mindfulness exercises"

OUTPUT:
Return ONLY the intervention list, one per line, formatted as shown above.
Do not include explanations, numbering, or additional text.
ALWAYS provide at least 3 interventions that relate to the goals in the treatment plan.`;
}

