import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { userDb, withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface UserData {
  username: string;
  email?: string;
  password: string;
  role?: 'peer_support' | 'admin';
  firstName?: string;
  lastName?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Get auth token and verify admin role
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify admin role
    const user = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT role FROM users WHERE id = $1 AND is_active = true',
        [payload.userId]
      );
      return result.rows[0];
    });

    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Fetch all users
    const users = await userDb.findAll(payload.userId);

    const response: ApiResponse<typeof users> = {
      success: true,
      data: users
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching users:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to fetch users' 
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    // Get auth token and verify admin role
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Verify admin role
    const adminUser = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT role FROM users WHERE id = $1 AND is_active = true',
        [payload.userId]
      );
      return result.rows[0];
    });

    if (!adminUser || adminUser.role !== 'admin') {
      return Response.json({ error: 'Admin access required' }, { status: 403 });
    }

    // Parse request body
    const body = await request.json() as UserData;
    const { username, email, password, role, firstName, lastName } = body;

    // Validate required fields
    if (!username || !username.trim()) {
      return Response.json({ 
        error: 'Username is required' 
      }, { status: 400 });
    }

    if (!password || password.length < 6) {
      return Response.json({ 
        error: 'Password must be at least 6 characters' 
      }, { status: 400 });
    }

    // Check if username already exists
    const existingUser = await userDb.findByUsername(username.trim());
    if (existingUser) {
      return Response.json({ 
        error: 'Username already exists' 
      }, { status: 400 });
    }

    // Create user
    const user = await userDb.create({
      username: username.trim(),
      email: email?.trim(),
      password,
      role: role || 'peer_support',
      firstName: firstName?.trim(),
      lastName: lastName?.trim()
    });

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating user:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return Response.json({ 
        success: false, 
        error: 'Username or email already exists' 
      }, { status: 400 });
    }
    return Response.json({ 
      success: false, 
      error: 'Failed to create user' 
    }, { status: 500 });
  }
}
