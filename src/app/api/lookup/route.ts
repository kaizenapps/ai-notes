import { NextRequest } from 'next/server';
import { lookupDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse } from '@/types';

interface LookupData {
  locations: Array<{ id: string; name: string }>;
  objectives: Array<{ id: string; name: string; category?: string }>;
  interventions: Array<{ id: string; name: string; category?: string }>;
}

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    if (!token) {
      return Response.json({ error: 'Authentication required' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Fetch all lookup data
    const [locations, objectives, interventions] = await Promise.all([
      lookupDb.getLocations(),
      lookupDb.getObjectives(),
      lookupDb.getInterventions()
    ]);

    const lookupData: LookupData = {
      locations,
      objectives,
      interventions
    };

    const response: ApiResponse<LookupData> = {
      success: true,
      data: lookupData
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching lookup data:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch lookup data'
    };
    return Response.json(response, { status: 500 });
  }
}
