import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface InterventionData {
  name: string;
  category?: string;
  description?: string;
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

    // Fetch all interventions
    const interventions = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, name, category, description, is_active FROM interventions ORDER BY category, name'
      );
      return result.rows;
    });

    const response: ApiResponse<typeof interventions> = {
      success: true,
      data: interventions
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching interventions:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to fetch interventions' 
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

    // Parse request body
    const body = await request.json() as InterventionData;
    const { name, category, description } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return Response.json({ 
        error: 'Name is required' 
      }, { status: 400 });
    }

    // Create intervention
    const intervention = await withDatabase(async (client) => {
      const result = await client.query(
        `INSERT INTO interventions (name, category, description)
         VALUES ($1, $2, $3)
         RETURNING id, name, category, description, is_active`,
        [name.trim(), category?.trim() || null, description?.trim() || null]
      );
      return result.rows[0];
    });

    const response: ApiResponse<typeof intervention> = {
      success: true,
      data: intervention
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating intervention:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to create intervention' 
    }, { status: 500 });
  }
}
