import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';

export function createToken(userId: string): string {
  if (!userId || userId.trim() === '') {
    throw new Error('Cannot create token with empty userId');
  }
  console.log('Creating token for userId:', userId);
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '8h' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    return jwt.verify(token, JWT_SECRET) as { userId: string };
  } catch {
    return null;
  }
}
