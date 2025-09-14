import { NextRequest } from 'next/server';
import { templateDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse } from '@/types';

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

    // Fetch all templates
    const templates = await templateDb.findAll(payload.userId);

    const response: ApiResponse<typeof templates> = {
      success: true,
      data: templates
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching templates:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch templates'
    };
    return Response.json(response, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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

    // Parse request body
    const body = await request.json();
    const {
      name,
      description,
      defaultDuration,
      defaultLocationId,
      templateObjectives,
      templateInterventions
    } = body;

    // Validate required fields
    if (!name || !name.trim()) {
      return Response.json({ 
        error: 'Template name is required' 
      }, { status: 400 });
    }

    // Create template
    const template = await templateDb.create({
      name: name.trim(),
      description: description?.trim(),
      defaultDuration: defaultDuration ? parseInt(defaultDuration) : undefined,
      defaultLocationId,
      templateObjectives,
      templateInterventions,
      createdBy: payload.userId
    });

    const response: ApiResponse<typeof template> = {
      success: true,
      data: template
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating template:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create template'
    };
    return Response.json(response, { status: 500 });
  }
}
