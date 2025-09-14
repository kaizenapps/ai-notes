import { NextRequest } from 'next/server';
import { createToken } from '@/lib/auth';
import { userDb } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json();
    
    if (!username || !password) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    let user = null;
    
    try {
      // Try to authenticate user against database
      user = await userDb.validatePassword(username, password);
      
      if (user && user.id) {
        try {
          // Update last login only if we have a valid user ID
          await userDb.updateLastLogin(user.id);
          console.log('Database authentication successful for user:', user.id);
        } catch (updateError) {
          console.error('Failed to update last login:', updateError);
          // Continue anyway - login is still valid
        }
      } else {
        // If database auth fails, don't use fallback - require proper database authentication
        console.error('Database authentication failed: Invalid credentials');
        return Response.json({ error: 'Invalid credentials' }, { status: 401 });
      }
    } catch (dbError) {
      console.error('Database connection failed:', dbError);
      return Response.json({ error: 'Database connection required. Please ensure PostgreSQL is running.' }, { status: 500 });
    }
    
    if (!user) {
      return Response.json({ error: 'Invalid credentials' }, { status: 401 });
    }
    
    const token = createToken(user.id);
    
    return Response.json({ 
      token,
      user: {
        id: user.id,
        username: user.username,
        role: user.role
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
