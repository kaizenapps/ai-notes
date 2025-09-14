import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { userDb, withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface UserData {
  username?: string;
  email?: string;
  role?: 'peer_support' | 'admin';
  firstName?: string;
  lastName?: string;
  isActive?: boolean;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const params = await context.params;

    // Fetch user from database
    const user = await userDb.findById(params.id, payload.userId);
    
    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching user:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to fetch user' 
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const params = await context.params;
    const body = await request.json() as UserData;

    // Validate username if provided
    if (body.username !== undefined && !body.username.trim()) {
      return Response.json({ 
        error: 'Username cannot be empty' 
      }, { status: 400 });
    }

    // Check for username conflicts if username is being changed
    if (body.username) {
      const existingUser = await userDb.findByUsername(body.username.trim());
      if (existingUser && existingUser.id !== params.id) {
        return Response.json({ 
          error: 'Username already exists' 
        }, { status: 400 });
      }
    }

    // Update user
    const user = await userDb.update(params.id, {
      username: body.username?.trim(),
      email: body.email?.trim(),
      role: body.role,
      firstName: body.firstName?.trim(),
      lastName: body.lastName?.trim(),
      isActive: body.isActive
    }, payload.userId);

    if (!user) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const response: ApiResponse<typeof user> = {
      success: true,
      data: user
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error updating user:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return Response.json({ 
        success: false, 
        error: 'Username or email already exists' 
      }, { status: 400 });
    }
    return Response.json({ 
      success: false, 
      error: 'Failed to update user' 
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const params = await context.params;

    // Prevent admin from deactivating themselves
    if (params.id === payload.userId) {
      return Response.json({ 
        error: 'Cannot deactivate your own account' 
      }, { status: 400 });
    }

    // Check if user has sessions (for data integrity)
    const hasSessions = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM session_notes WHERE user_id = $1',
        [params.id]
      );
      return parseInt(result.rows[0].count) > 0;
    });

    if (hasSessions) {
      // Deactivate instead of delete if user has sessions
      const success = await userDb.deactivate(params.id, payload.userId);
      
      if (!success) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'User deactivated successfully (has existing sessions)' }
      };

      return Response.json(response);
    } else {
      // Can safely deactivate if no sessions
      const success = await userDb.deactivate(params.id, payload.userId);
      
      if (!success) {
        return Response.json({ error: 'User not found' }, { status: 404 });
      }

      const response: ApiResponse<{ message: string }> = {
        success: true,
        data: { message: 'User deactivated successfully' }
      };

      return Response.json(response);
    }
  } catch (error) {
    console.error('Error deactivating user:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to deactivate user' 
    }, { status: 500 });
  }
}
