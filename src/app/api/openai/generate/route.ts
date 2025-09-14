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
  let data: SessionData;
  
  try {
    data = await request.json() as SessionData;
  } catch {
    return Response.json({ error: 'Invalid request data' }, { status: 400 });
  }
  
  try {
    if (!process.env.OPENAI_API_KEY) {
      return Response.json({ 
        note: generateMockNote(data) 
      });
    }
    
    const prompt = buildPrompt(data);
    const openai = getOpenAIClient();
    
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4-turbo-preview",
      messages: [
        {
          role: "system",
          content: "You are a peer support specialist creating session notes. Never use therapist terms, never include last names, focus on peer support interventions."
        },
        { role: "user", content: prompt }
      ],
      temperature: parseFloat(process.env.OPENAI_TEMPERATURE || "0.7"),
      max_tokens: parseInt(process.env.OPENAI_MAX_TOKENS || "1500"),
    });
    
    const note = completion.choices[0].message.content || '';
    
    // Apply compliance filters
    const filteredNote = applyComplianceFilters(note);
    
    return Response.json({ note: filteredNote });
  } catch (error) {
    console.error('OpenAI API error:', error);
    // Fallback to mock note if OpenAI fails
    return Response.json({ 
      note: generateMockNote(data) 
    });
  }
}

interface SessionData {
  location: string;
  duration: string;
  objectives: string[];
  interventions: string[];
}

function buildPrompt(data: SessionData): string {
  return `Generate a peer support session note with these details:
    Location: ${data.location}
    Duration: ${data.duration} minutes
    Objectives: ${data.objectives.join(', ')}
    Interventions: ${data.interventions.join(', ')}
    
    Format:
    - Location of Meeting
    - Focus of the meeting
    - Activities (time-based breakdown)
    - Peer Support Interventions
    - Patient Response/Content
    - Plan for next session`;
}

function generateMockNote(data: SessionData): string {
  return `**Location of Meeting:** ${data.location}

**Focus of the meeting:** The session focused on ${data.objectives.join(', ').toLowerCase()} through peer support interventions.

**Activities:**
- 0-10 minutes: Welcome and check-in, established rapport
- 10-${Math.floor(parseInt(data.duration) * 0.7)} minutes: Engaged in ${data.interventions.join(' and ').toLowerCase()}
- ${Math.floor(parseInt(data.duration) * 0.7)}-${data.duration} minutes: Summary and planning for next session

**Peer Support Interventions:** ${data.interventions.join(', ')}

**Patient Response/Content:** Client was engaged throughout the session and demonstrated understanding of the discussed concepts. Client expressed willingness to continue working on identified goals.

**Plan for next session:** Continue working on ${data.objectives.join(' and ').toLowerCase()}. Schedule follow-up within one week to maintain momentum and support progress.`;
}
