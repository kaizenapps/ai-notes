import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

interface InterventionData {
  name: string;
  category?: string;
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
    const body = await request.json() as InterventionData;
    const { name, category, description } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return Response.json({ 
        error: 'Name is required' 
      }, { status: 400 });
    }

    // Update intervention
    const intervention = await withDatabase(async (client) => {
      const result = await client.query(
        `UPDATE interventions 
         SET name = $1, category = $2, description = $3, updated_at = CURRENT_TIMESTAMP
         WHERE id = $4
         RETURNING id, name, category, description, is_active`,
        [name.trim(), category?.trim() || null, description?.trim() || null, params.id]
      );
      return result.rows[0];
    });

    if (!intervention) {
      return Response.json({ error: 'Intervention not found' }, { status: 404 });
    }

    const response: ApiResponse<typeof intervention> = {
      success: true,
      data: intervention
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error updating intervention:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to update intervention' 
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

    // Check if intervention is being used in any sessions
    const isUsed = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT COUNT(*) as count FROM session_interventions WHERE intervention_id = $1',
        [params.id]
      );
      return parseInt(result.rows[0].count) > 0;
    });

    if (isUsed) {
      return Response.json({ 
        success: false, 
        error: 'Cannot delete intervention that is used in existing sessions' 
      }, { status: 400 });
    }

    // Delete intervention
    const deleted = await withDatabase(async (client) => {
      const result = await client.query(
        'DELETE FROM interventions WHERE id = $1 RETURNING id',
        [params.id]
      );
      return result.rows[0];
    });

    if (!deleted) {
      return Response.json({ error: 'Intervention not found' }, { status: 404 });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Intervention deleted successfully' }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error deleting intervention:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to delete intervention' 
    }, { status: 500 });
  }
}
