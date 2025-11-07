import { NextRequest } from 'next/server';
import { templateDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse, MasterSessionTemplate } from '@/types';

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

    const { id } = await context.params;

    // Get template by ID
    const template = await templateDb.findById(id);

    if (!template) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
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

    // Check if user is admin
    // Note: You may want to add role checking here
    // For now, we'll allow any authenticated user to update the template

    const { id } = await context.params;
    const body = await request.json();
    const { name, sections } = body;

    // Validate sections if provided
    if (sections !== undefined) {
      if (!Array.isArray(sections)) {
        return Response.json({ error: 'Sections must be an array' }, { status: 400 });
      }

      // Validate each section
      for (const section of sections) {
        if (!section.name || !section.heading || !section.instructions) {
          return Response.json({ 
            error: 'Each section must have name, heading, and instructions' 
          }, { status: 400 });
        }
      }
    }

    // Update template
    const updatedTemplate = await templateDb.update(id, {
      name,
      sections
    });

    if (!updatedTemplate) {
      return Response.json({ error: 'Template not found' }, { status: 404 });
    }

    const response: ApiResponse<MasterSessionTemplate> = {
      success: true,
      data: updatedTemplate
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

