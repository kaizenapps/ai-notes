import { NextRequest } from 'next/server';
import { clientDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { ApiResponse, Client } from '@/types';

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

    // Fetch clients from database
    const clients = await clientDb.findAll(payload.userId);

    const response: ApiResponse<Client[]> = {
      success: true,
      data: clients
    };

    return Response.json(response);
  } catch (error) {
    console.error('Error fetching clients:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to fetch clients'
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
    const { firstName, lastInitial, treatmentPlan } = body;

    // Validate required fields
    if (!firstName || !lastInitial) {
      return Response.json({ 
        error: 'Missing required fields: firstName, lastInitial' 
      }, { status: 400 });
    }

    // Validate lastInitial is single character
    if (lastInitial.length !== 1) {
      return Response.json({ 
        error: 'lastInitial must be a single character' 
      }, { status: 400 });
    }

    // Create client in database
    const client = await clientDb.create({
      firstName,
      lastInitial: lastInitial.toUpperCase(),
      treatmentPlan,
      createdBy: payload.userId
    });

    const response: ApiResponse<Client> = {
      success: true,
      data: client
    };

    return Response.json(response, { status: 201 });
  } catch (error) {
    console.error('Error creating client:', error);
    const response: ApiResponse<never> = {
      success: false,
      error: 'Failed to create client'
    };
    return Response.json(response, { status: 500 });
  }
}
