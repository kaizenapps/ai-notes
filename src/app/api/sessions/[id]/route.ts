import { NextRequest } from 'next/server';
import { sessionDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse, SessionNote } from '@/types';

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

    // Fetch session from database
    const session = await sessionDb.findById(params.id, payload.userId);
    
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const response: ApiResponse<SessionNote> = {
      success: true,
      data: session
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch session'
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
      sessionDate,
      duration,
      locationId,
      locationOther,
      generatedNote,
      customFeedback,
      status,
      objectives
    } = body;

    // Update session in database
    const session = await sessionDb.update(params.id, {
      sessionDate: sessionDate ? new Date(sessionDate) : undefined,
      duration: duration ? parseInt(duration) : undefined,
      locationId: locationId || null, // Convert empty string to null
      locationOther,
      generatedNote,
      customFeedback,
      status,
      objectives: objectives?.map((obj: { id?: string; custom?: string; name?: string }) => ({
        id: obj.id,
        custom: obj.custom || obj.name
      }))
    }, payload.userId);

    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    const response: ApiResponse<SessionNote> = {
      success: true,
      data: session
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error updating session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update session'
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

    // Check if session exists and belongs to user
    const session = await sessionDb.findById(params.id, payload.userId);
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // For HIPAA compliance, archive instead of delete by default
    // Use query parameter ?force=true for actual deletion
    const { searchParams } = new URL(request.url);
    const forceDelete = searchParams.get('force') === 'true';

    let success;
    if (forceDelete) {
      success = await sessionDb.delete(params.id, payload.userId);
    } else {
      success = await sessionDb.archive(params.id, payload.userId);
    }

    if (!success) {
      return Response.json({ error: 'Failed to process request' }, { status: 500 });
    }

    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { 
        message: forceDelete ? 'Session deleted successfully' : 'Session archived successfully' 
      }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error deleting/archiving session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to delete session'
    };
    return Response.json(response, { status: 500 });
  }
}