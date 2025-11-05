import { NextRequest } from 'next/server';
import { sessionDb, userDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse, SessionNote } from '@/types';

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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');
    const clientId = searchParams.get('clientId') || undefined;
    const status = searchParams.get('status') || undefined;
    const viewAll = searchParams.get('viewAll') === 'true';

    // Check if user is admin for viewAll functionality
    let isAdmin = false;
    if (viewAll) {
      try {
        const user = await userDb.findById(payload.userId, payload.userId);
        isAdmin = user?.role === 'admin';
      } catch (error) {
        console.error('Error checking user role:', error);
      }
    }

    // Debug logging
    console.log('Fetching sessions for user:', payload.userId);
    console.log('Query params:', { limit, offset, clientId, status, viewAll, isAdmin });

    // Fetch sessions from database
    const sessions = await sessionDb.findByUser(payload.userId, limit, offset, clientId, status, viewAll && isAdmin);

    console.log('Found sessions:', sessions.length);

    const response: ApiResponse<SessionNote[]> = {
      success: true,
      data: sessions
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching sessions:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch sessions'
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
    if (!payload || !payload.userId) {
      console.error('Invalid token or missing userId:', payload);
      return Response.json({ error: 'Invalid token' }, { status: 401 });
    }

    // Validate userId is a proper UUID format or fallback
    if (!payload.userId || payload.userId.trim() === '') {
      console.error('Empty userId from token:', payload);
      return Response.json({ error: 'Invalid user session' }, { status: 401 });
    }

    console.log('Session creation with userId:', payload.userId);

    // Parse request body
    const body = await request.json();
    const {
      clientId,
      sessionDate,
      duration,
      locationId,
      locationOther,
      generatedNote,
      customFeedback,
      status,
      objectives
    } = body;

    // Validate required fields
    if (!clientId || !sessionDate || !duration || !generatedNote) {
      return Response.json({ 
        error: 'Missing required fields: clientId, sessionDate, duration, generatedNote' 
      }, { status: 400 });
    }

    if (!objectives || !Array.isArray(objectives) || objectives.length === 0) {
      return Response.json({ 
        error: 'At least one objective is required' 
      }, { status: 400 });
    }

    // Create session in database
    const session = await sessionDb.create({
      clientId,
      userId: payload.userId,
      sessionDate: new Date(sessionDate),
      duration: parseInt(duration),
      locationId: locationId || null, // Convert empty string to null
      locationOther,
      generatedNote,
      customFeedback,
      status: status || 'draft',
      objectives: objectives.map((obj: { id?: string; custom?: string; name?: string }) => ({
        id: obj.id,
        custom: obj.custom || obj.name
      }))
    });

    const response: ApiResponse<SessionNote> = {
      success: true,
      data: session
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating session:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create session'
    };
    return Response.json(response, { status: 500 });
  }
}
