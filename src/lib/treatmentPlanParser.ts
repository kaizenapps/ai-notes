/**
 * Treatment Plan Parser
 * Extracts intervention text from treatment plans based on selected objectives
 */

interface ParsedTreatmentPlan {
  longTermGoals: string[];
  shortTermGoals: string[];
  interventions: Array<{
    category: string;
    description: string;
    relatedObjectives: string[];
  }>;
}

/**
 * Parses a treatment plan text into structured components
 */
export function parseTreatmentPlan(treatmentPlanText: string): ParsedTreatmentPlan {
  const result: ParsedTreatmentPlan = {
    longTermGoals: [],
    shortTermGoals: [],
    interventions: []
  };

  if (!treatmentPlanText || treatmentPlanText.trim().length === 0) {
    return result;
  }

  const lines = treatmentPlanText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
  
  let currentSection: 'longTerm' | 'shortTerm' | 'interventions' | null = null;

  for (const line of lines) {
    const lowerLine = line.toLowerCase();
    
    // Detect section headers
    if (lowerLine.includes('long-term goal') || lowerLine.startsWith('long-term goal')) {
      currentSection = 'longTerm';
      const goal = extractGoalText(line);
      if (goal) result.longTermGoals.push(goal);
      continue;
    }
    
    if (lowerLine.includes('short-term goal') || lowerLine.startsWith('short-term goal')) {
      currentSection = 'shortTerm';
      const goal = extractGoalText(line);
      if (goal) result.shortTermGoals.push(goal);
      continue;
    }
    
    // More flexible intervention detection
    if (lowerLine.includes('intervention') || lowerLine.startsWith('intervention')) {
      currentSection = 'interventions';
      const intervention = parseIntervention(line);
      if (intervention) {
        result.interventions.push(intervention);
      } else {
        // If parseIntervention returns null, try to add the line as description
        const cleaned = line.replace(/^intervention\s+\d*:?\s*/i, '').trim();
        if (cleaned) {
          result.interventions.push({
            category: 'General',
            description: cleaned,
            relatedObjectives: []
          });
        }
      }
      continue;
    }

    // Process content based on current section
    if (currentSection === 'longTerm') {
      const goal = extractGoalText(line);
      if (goal) result.longTermGoals.push(goal);
    } else if (currentSection === 'shortTerm') {
      const goal = extractGoalText(line);
      if (goal) result.shortTermGoals.push(goal);
    } else if (currentSection === 'interventions') {
      const intervention = parseIntervention(line);
      if (intervention) result.interventions.push(intervention);
    }
  }

  return result;
}

/**
 * Extracts goal text from a line (removes "Long-term Goal 1:", etc.)
 */
function extractGoalText(line: string): string | null {
  // Remove common prefixes like "Long-term Goal 1:", "Short-term Goal 2:", etc.
  const cleaned = line.replace(/^(long-term|short-term)\s+goal\s+\d+:\s*/i, '').trim();
  return cleaned.length > 0 ? cleaned : null;
}

/**
 * Parses an intervention line
 * Expected format: "Intervention 1: [category] - [description]"
 */
function parseIntervention(line: string): { category: string; description: string; relatedObjectives: string[] } | null {
  // Remove "Intervention 1:", "Intervention 2:", etc.
  const cleaned = line.replace(/^intervention\s+\d+:\s*/i, '').trim();
  
  if (!cleaned) return null;

  // Try to split by " - " to separate category and description
  const parts = cleaned.split(' - ');
  
  if (parts.length >= 2) {
    return {
      category: parts[0].trim(),
      description: parts.slice(1).join(' - ').trim(),
      relatedObjectives: []
    };
  }

  // If no separator, treat entire line as description
  return {
    category: 'General',
    description: cleaned,
    relatedObjectives: []
  };
}

/**
 * Maps objective names to keywords for matching
 */
const objectiveKeywords: Record<string, string[]> = {
  'Educational goals': ['educational', 'learning', 'education', 'academic', 'school'],
  'Substance abuse recovery': ['substance', 'abuse', 'recovery', 'addiction', 'sobriety', 'relapse'],
  'Anxiety management': ['anxiety', 'anxious', 'worry', 'stress', 'panic', 'fear'],
  'Parenting skills': ['parenting', 'parent', 'child', 'children', 'family', 'parental'],
  'Self-esteem building': ['self-esteem', 'confidence', 'self-worth', 'self-image', 'self-confidence'],
  'Improve coping skills': ['coping', 'cope', 'manage', 'handle', 'deal with'],
  'Manage anxiety symptoms': ['anxiety', 'anxious', 'worry', 'stress'],
  'Build self-esteem': ['self-esteem', 'confidence', 'self-worth'],
  'Enhance communication skills': ['communication', 'communicate', 'express', 'talk', 'speak'],
  'Develop healthy boundaries': ['boundary', 'boundaries', 'limit', 'limits'],
  'Increase tolerance of uncertainty': ['uncertainty', 'unknown', 'unpredictable', 'tolerate']
};

/**
 * Extracts intervention text from treatment plan based on selected objectives
 */
export function extractInterventionText(
  treatmentPlanText: string,
  selectedObjectives: string[]
): string {
  if (!treatmentPlanText || selectedObjectives.length === 0) {
    return generateGenericIntervention(selectedObjectives);
  }

  const parsed = parseTreatmentPlan(treatmentPlanText);
  console.log('Parsed treatment plan:', {
    interventions: parsed.interventions.length,
    longTermGoals: parsed.longTermGoals.length,
    shortTermGoals: parsed.shortTermGoals.length
  });
  
  // Find interventions that match selected objectives
  const matchingInterventions: string[] = [];
  
  for (const objective of selectedObjectives) {
    const keywords = objectiveKeywords[objective] || [objective.toLowerCase()];
    
    // Check interventions for keyword matches
    for (const intervention of parsed.interventions) {
      const interventionText = `${intervention.category} ${intervention.description}`.toLowerCase();
      
      for (const keyword of keywords) {
        if (interventionText.includes(keyword.toLowerCase())) {
          // Extract relevant intervention description
          const interventionStatement = intervention.description || 
            `${intervention.category}: ${intervention.description}`;
          
          if (!matchingInterventions.includes(interventionStatement)) {
            matchingInterventions.push(interventionStatement);
          }
          break;
        }
      }
    }
  }

  // If we found matching interventions, return them
  if (matchingInterventions.length > 0) {
    // Return 1-2 most relevant interventions (limit to avoid too long text)
    const result = matchingInterventions.slice(0, 2).join('. ');
    console.log('Found matching interventions:', result);
    return result;
  }
  
  // If no direct matches but we have interventions, return first one
  if (parsed.interventions.length > 0) {
    const firstIntervention = parsed.interventions[0];
    const result = firstIntervention.description || `${firstIntervention.category} - ${firstIntervention.description}`;
    console.log('Using first intervention (no keyword match):', result);
    return result;
  }
  
  // If we have interventions but they're in a different format, try to extract from raw text
  if (treatmentPlanText.toLowerCase().includes('intervention')) {
    // Look for intervention patterns in the text
    const interventionMatch = treatmentPlanText.match(/intervention\s*\d*:?\s*([^.\n]+)/i);
    if (interventionMatch && interventionMatch[1]) {
      const extracted = interventionMatch[1].trim();
      if (extracted.length > 10) { // Only use if it's substantial
        console.log('Extracted intervention from raw text:', extracted);
        return extracted;
      }
    }
  }

  // Fallback: try to match based on long-term/short-term goals
  const allGoals = [...parsed.longTermGoals, ...parsed.shortTermGoals];
  const relevantGoals: string[] = [];
  
  for (const objective of selectedObjectives) {
    const keywords = objectiveKeywords[objective] || [objective.toLowerCase()];
    
    for (const goal of allGoals) {
      const goalLower = goal.toLowerCase();
      for (const keyword of keywords) {
        if (goalLower.includes(keyword.toLowerCase())) {
          if (!relevantGoals.includes(goal)) {
            relevantGoals.push(goal);
          }
          break;
        }
      }
    }
  }

  if (relevantGoals.length > 0) {
    // Convert goal to intervention-like statement
    return `Client will work towards: ${relevantGoals[0]}`;
  }

  // Final fallback: generic intervention based on objectives
  return generateGenericIntervention(selectedObjectives);
}

/**
 * Generates a generic intervention statement based on objectives
 */
function generateGenericIntervention(objectives: string[]): string {
  if (objectives.length === 0) {
    return 'Peer support interventions focused on client goals';
  }

  const objectiveText = objectives.join(', ');
  return `Client will work on ${objectiveText.toLowerCase()} through peer support interventions and goal-oriented activities`;
}

