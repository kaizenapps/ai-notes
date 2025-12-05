import { NextRequest } from 'next/server';
import { lookupDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse } from '@/types';

interface LookupData {
  locations: Array<{ id: string; name: string }>;
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

    // Fetch all lookup data with individual error handling
    let locations: Array<{ id: string; name: string }> = [];

    try {
      locations = await lookupDb.getLocations();
    } catch (locationError) {
      console.error('Error fetching locations:', locationError);
      // Return empty array instead of failing completely
    }

    const lookupData: LookupData = {
      locations
    };

    const response: ApiResponse<LookupData> = {
      success: true,
      data: lookupData
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching lookup data:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const response: ApiResponse<never> = {
      success: false,
      error: `Failed to fetch lookup data: ${errorMessage}`
    };
    return Response.json(response, { status: 500 });
  }
}
