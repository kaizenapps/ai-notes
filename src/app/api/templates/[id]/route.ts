import { NextRequest } from 'next/server';
import { templateDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse } from '@/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

export async function GET(request: NextRequest, context: RouteContext) {
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

    const params = await context.params;

    // Fetch template from database
    const template = await templateDb.findById(params.id, payload.userId);
    
    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const response: ApiResponse<typeof template> = {
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

export async function PUT(request: NextRequest, context: RouteContext) {
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

    const params = await context.params;

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

    // Update template
    const template = await templateDb.update(params.id, {
      name: name?.trim(),
      description: description?.trim(),
      defaultDuration: defaultDuration ? parseInt(defaultDuration) : undefined,
      defaultLocationId,
      templateObjectives,
      templateInterventions
    }, payload.userId);

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const response: ApiResponse<typeof template> = {
      success: true,
      data: template
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error updating template:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update template'
    };
    return Response.json(response, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, context: RouteContext) {
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

    const params = await context.params;

    // Delete template (soft delete)
    const success = await templateDb.delete(params.id, payload.userId);

    if (!success) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Template deleted successfully' }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error deleting template:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to delete template'
    };
    return Response.json(response, { status: 500 });
  }
}
