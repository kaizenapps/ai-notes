import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { userDb, withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function POST(request: NextRequest, context: RouteContext) {
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

    // Parse request body
    const body = await request.json();
    const { newPassword } = body;

    // Validate password
    if (!newPassword || newPassword.length < 6) {
      return Response.json({ 
        error: 'Password must be at least 6 characters' 
      }, { status: 400 });
    }

    // Reset password
    const success = await userDb.resetPassword(params.id, newPassword, payload.userId);

    if (!success) {
      return Response.json({ error: 'User not found' }, { status: 404 });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Password reset successfully' }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error resetting password:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to reset password' 
    }, { status: 500 });
  }
}
