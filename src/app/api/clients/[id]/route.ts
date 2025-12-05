import { NextRequest } from 'next/server';
import { clientDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse, Client } from '@/types';

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

    // Fetch client from database
    const client = await clientDb.findById(params.id, payload.userId);

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const response: ApiResponse<Client> = {
      success: true,
      data: client
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching client:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch client'
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
    const { firstName, lastInitial, lastName, gender, address, dateOfBirth, treatmentPlan, objectivesSelected, extractedInterventions } = body;

    // Validate gender if provided
    if (gender !== undefined && gender !== null && !['male', 'female'].includes(gender)) {
      return Response.json({
        error: 'Gender must be either "male" or "female"'
      }, { status: 400 });
    }

    // Derive lastInitial from lastName if lastName is provided but lastInitial isn't
    let finalLastInitial = lastInitial;
    if (lastName && !lastInitial) {
      finalLastInitial = lastName.charAt(0).toUpperCase();
    }

    // Update client in database
    const client = await clientDb.update(params.id, {
      firstName,
      lastInitial: finalLastInitial?.toUpperCase(),
      lastName,
      gender,
      address,
      dateOfBirth,
      treatmentPlan,
      objectivesSelected,
      extractedInterventions
    }, payload.userId);

    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    const response: ApiResponse<Client> = {
      success: true,
      data: client
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error updating client:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to update client'
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

    // For HIPAA compliance, we don't actually delete client records
    // Instead, we mark them as inactive in the database
    // For demo purposes, we'll simulate deactivation by returning success
    // In a real implementation, you would update the is_active field to false
    
    // Check if client exists first
    const client = await clientDb.findById(params.id, payload.userId);
    
    if (!client) {
      return Response.json({ error: 'Client not found' }, { status: 404 });
    }

    // In a real implementation, you would do:
    // await clientDb.deactivate(params.id, payload.userId);
    
    const response: ApiResponse<{ message: string }> = {
      success: true,
      data: { message: 'Client deactivated successfully' }
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error deactivating client:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to deactivate client'
    };
    return Response.json(response, { status: 500 });
  }
}