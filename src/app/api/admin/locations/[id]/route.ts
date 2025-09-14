import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface LocationData {
  name: string;
  description?: string;
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

    const params = await context.params;
    const body = await request.json() as LocationData;
    const { name, description } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return Response.json({ 
        error: 'Name is required' 
      }, { status: 400 });
    }

    // Update location
    const location = await withDatabase(async (client) => {
      const result = await client.query(
        `UPDATE session_locations 
         SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, name, description, is_active`,
        [name.trim(), description?.trim() || null, params.id]
      );
      return result.rows[0];
    });

    if (!location) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    const response: ApiResponse<typeof location> = {
      success: true,
      data: location
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error updating location:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return Response.json({ 
        success: false, 
        error: 'Location name already exists' 
      }, { status: 400 });
    }
    return Response.json({ 
      success: false, 
      error: 'Failed to update location' 
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

    const params = await context.params;

    // Check if location is being used in any sessions
    const isUsed = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM session_notes WHERE location_id = $1',
        [params.id]
      );
      return parseInt(result.rows[0].count) > 0;
    });

    if (isUsed) {
      return Response.json({ 
        success: false, 
        error: 'Cannot delete location that is used in existing sessions' 
      }, { status: 400 });
    }

    // Delete location
    const deleted = await withDatabase(async (client) => {
      const result = await client.query(
        'DELETE FROM session_locations WHERE id = $1 RETURNING id',
        [params.id]
      );
      return result.rows[0];
    });

    if (!deleted) {
      return Response.json({ error: 'Location not found' }, { status: 404 });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Location deleted successfully' }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error deleting location:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to delete location' 
    }, { status: 500 });
  }
}
