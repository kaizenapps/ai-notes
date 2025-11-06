// HIPAA Compliance filters
export function applyComplianceFilters(text: string): string {
  // Remove any therapist-related terms
  const therapistTerms = ['therapist', 'therapy', 'counselor', 'counseling', 'psychologist'];
  let filtered = text;
  
  therapistTerms.forEach(term => {
    const regex = new RegExp(term, 'gi');
    filtered = filtered.replace(regex, 'peer support specialist');
  });
  
  // Remove any last names (simple pattern - improve as needed)
  filtered = filtered.replace(/\b[A-Z][a-z]+\s+[A-Z][a-z]+\b/g, (match) => {
    const parts = match.split(' ');
    // Safety check: ensure we have at least 2 parts and parts[1] exists
    if (parts.length >= 2 && parts[1] && parts[1].length > 0) {
      return `${parts[0]} ${parts[1][0]}.`;
    }
    // If match doesn't split correctly, return original match
    return match;
  });
  
  return filtered;
}
