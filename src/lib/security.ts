import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
const key = Buffer.from(process.env.ENCRYPTION_KEY || '0'.repeat(64), 'hex');

// Encrypt sensitive data
export function encrypt(text: string): string {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const parts = text.split(':');
  const iv = Buffer.from(parts.shift()!, 'hex');
  const encryptedText = parts.join(':');
  const decipher = crypto.createDecipheriv(algorithm, key, iv);
  let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// Compliance filters
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
    return `${parts[0]} ${parts[1][0]}.`;
  });
  
  return filtered;
}
