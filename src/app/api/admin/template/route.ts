import { NextRequest } from 'next/server';
import { templateDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse, MasterSessionTemplate } from '@/types';

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

    // Check if user is admin
    // Note: You may want to add role checking here
    // For now, we'll allow any authenticated user to view the template

    // Get active template
    const template = await templateDb.findActive();

    if (!template) {
      return Response.json({ 
        error: 'No active template found. Please create a template first.' 
      }, { status: 404 });
    }

    const response: ApiResponse<MasterSessionTemplate> = {
      success: true,
      data: template
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching template:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch template'
    };
    return Response.json(response, { status: 500 });
  }
}

