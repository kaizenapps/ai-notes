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
    const { firstName, lastInitial, lastName, gender, address, dateOfBirth, treatmentPlan, objectivesSelected, extractedInterventions } = body;

    // Validate required fields
    if (!firstName) {
      return Response.json({
        error: 'Missing required field: firstName'
      }, { status: 400 });
    }

    // Determine lastInitial - derive from lastName if not provided directly
    let finalLastInitial = lastInitial;
    if (!finalLastInitial && lastName) {
      finalLastInitial = lastName.charAt(0).toUpperCase();
    }
    if (!finalLastInitial) {
      return Response.json({
        error: 'Either lastInitial or lastName must be provided'
      }, { status: 400 });
    }

    // Validate gender if provided
    if (gender && !['male', 'female'].includes(gender)) {
      return Response.json({
        error: 'Gender must be either "male" or "female"'
      }, { status: 400 });
    }

    // Create client in database
    const client = await clientDb.create({
      firstName,
      lastInitial: finalLastInitial.toUpperCase(),
      lastName: lastName || null,
      gender: gender || null,
      address: address || null,
      dateOfBirth: dateOfBirth || null,
      treatmentPlan,
      objectivesSelected: objectivesSelected || [],
      extractedInterventions: extractedInterventions || [],
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
