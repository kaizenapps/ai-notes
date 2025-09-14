import { NextRequest } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { withDatabase } from '@/lib/database';
import { ApiResponse } from '@/types';

interface LocationData {
  name: string;
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

    // Verify admin role by checking user in database
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

    // Fetch all locations
    const locations = await withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, name, description, is_active FROM session_locations ORDER BY name'
      );
      return result.rows;
    });

    const response: ApiResponse<typeof locations> = {
      success: true,
      data: locations
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return Response.json({ 
      success: false, 
      error: 'Failed to fetch locations' 
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
    const body = await request.json() as LocationData;
    const { name, description } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return Response.json({ 
        error: 'Name is required' 
      }, { status: 400 });
    }

    // Create location
    const location = await withDatabase(async (client) => {
      const result = await client.query(
        `INSERT INTO session_locations (name, description)
         VALUES ($1, $2)
         RETURNING id, name, description, is_active`,
        [name.trim(), description?.trim() || null]
      );
      return result.rows[0];
    });

    const response: ApiResponse<typeof location> = {
      success: true,
      data: location
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    if (error instanceof Error && error.message.includes('duplicate key')) {
      return Response.json({ 
        success: false, 
        error: 'Location name already exists' 
      }, { status: 400 });
    }
    return Response.json({ 
      success: false, 
      error: 'Failed to create location' 
    }, { status: 500 });
  }
}
