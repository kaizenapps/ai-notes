import { Pool, PoolClient } from 'pg';
import { User, Client, SessionNote } from '@/types';

interface SessionTemplate {
  id: string;
  name: string;
  description?: string;
  defaultDuration?: number;
  defaultLocationId?: string;
  defaultLocationName?: string;
  templateObjectives: string[];
  templateInterventions: string[];
  createdBy?: string;
  isActive: boolean;
  createdAt: Date;
}

// Create connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Database connection wrapper with error handling
export async function withDatabase<T>(
  callback: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    return await callback(client);
  } finally {
    client.release();
  }
}

// Set audit user for HIPAA compliance
export async function setAuditUser(client: PoolClient, userId: string): Promise<void> {
  // Only set audit user if we have a valid UUID
  if (userId && userId.length > 0 && userId !== 'undefined' && userId !== 'null') {
    try {
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', userId]);
    } catch (error) {
      console.error('Failed to set audit user:', error);
      // Set to null if invalid UUID
      await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', '']);
    }
  } else {
    // Clear the setting if no valid user ID
    await client.query('SELECT set_config($1, $2, true)', ['app.current_user_id', '']);
  }
}

// User database operations
export const userDb = {
  async findByUsername(username: string): Promise<User | null> {
    return withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, username, role, is_active FROM users WHERE username = $1 AND is_active = true',
        [username]
      );
      return result.rows[0] || null;
    });
  },

  async validatePassword(username: string, password: string): Promise<User | null> {
    return withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, username, role FROM users WHERE username = $1 AND password_hash = crypt($2, password_hash) AND is_active = true',
        [username, password]
      );
      return result.rows[0] || null;
    });
  },

  async updateLastLogin(userId: string): Promise<void> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      await client.query(
        'UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1',
        [userId]
      );
    });
  },

  async create(userData: {
    username: string;
    email?: string;
    password: string;
    role?: 'peer_support' | 'admin';
    firstName?: string;
    lastName?: string;
  }): Promise<User> {
    return withDatabase(async (client) => {
      const result = await client.query(
        `INSERT INTO users (username, email, password_hash, role, first_name, last_name)
         VALUES ($1, $2, crypt($3, gen_salt('bf')), $4, $5, $6)
         RETURNING id, username, role`,
        [userData.username, userData.email, userData.password, userData.role || 'peer_support', userData.firstName, userData.lastName]
      );
      return result.rows[0];
    });
  },

  async findAll(adminUserId: string): Promise<Array<{
    id: string;
    username: string;
    email?: string;
    role: 'peer_support' | 'admin';
    firstName?: string;
    lastName?: string;
    isActive: boolean;
    lastLoginAt?: Date;
    createdAt: Date;
  }>> {
    return withDatabase(async (client) => {
      await setAuditUser(client, adminUserId);
      
      const result = await client.query(
        `SELECT id, username, email, role, first_name as "firstName", last_name as "lastName",
                is_active as "isActive", last_login_at as "lastLoginAt", created_at as "createdAt"
         FROM users 
         ORDER BY created_at DESC`
      );
      
      return result.rows;
    });
  },

  async findById(id: string, adminUserId: string): Promise<User | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, adminUserId);
      
      const result = await client.query(
        `SELECT id, username, email, role, first_name as "firstName", last_name as "lastName",
                is_active as "isActive", last_login_at as "lastLoginAt", created_at as "createdAt"
         FROM users 
         WHERE id = $1`,
        [id]
      );
      
      return result.rows[0] || null;
    });
  },

  async update(id: string, userData: {
    username?: string;
    email?: string;
    role?: 'peer_support' | 'admin';
    firstName?: string;
    lastName?: string;
    isActive?: boolean;
  }, adminUserId: string): Promise<User | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, adminUserId);
      
      const setClauses = [];
      const values = [];
      let paramCount = 1;

      if (userData.username !== undefined) {
        setClauses.push(`username = $${paramCount++}`);
        values.push(userData.username);
      }
      if (userData.email !== undefined) {
        setClauses.push(`email = $${paramCount++}`);
        values.push(userData.email);
      }
      if (userData.role !== undefined) {
        setClauses.push(`role = $${paramCount++}`);
        values.push(userData.role);
      }
      if (userData.firstName !== undefined) {
        setClauses.push(`first_name = $${paramCount++}`);
        values.push(userData.firstName);
      }
      if (userData.lastName !== undefined) {
        setClauses.push(`last_name = $${paramCount++}`);
        values.push(userData.lastName);
      }
      if (userData.isActive !== undefined) {
        setClauses.push(`is_active = $${paramCount++}`);
        values.push(userData.isActive);
      }

      if (setClauses.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE users SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount}
         RETURNING id, username, email, role, first_name as "firstName", last_name as "lastName", is_active as "isActive"`,
        values
      );
      
      return result.rows[0] || null;
    });
  },

  async resetPassword(id: string, newPassword: string, adminUserId: string): Promise<boolean> {
    return withDatabase(async (client) => {
      await setAuditUser(client, adminUserId);
      
      const result = await client.query(
        'UPDATE users SET password_hash = crypt($1, gen_salt(\'bf\')), updated_at = CURRENT_TIMESTAMP WHERE id = $2',
        [newPassword, id]
      );
      
      return (result.rowCount ?? 0) > 0;
    });
  },

  async deactivate(id: string, adminUserId: string): Promise<boolean> {
    return withDatabase(async (client) => {
      await setAuditUser(client, adminUserId);
      
      const result = await client.query(
        'UPDATE users SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      
      return (result.rowCount ?? 0) > 0;
    });
  },

  async activate(id: string, adminUserId: string): Promise<boolean> {
    return withDatabase(async (client) => {
      await setAuditUser(client, adminUserId);
      
      const result = await client.query(
        'UPDATE users SET is_active = true, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      
      return (result.rowCount ?? 0) > 0;
    });
  }
};

// Client database operations
export const clientDb = {
  async findAll(userId: string): Promise<Client[]> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      const result = await client.query(
        'SELECT id, first_name as "firstName", last_initial as "lastInitial", treatment_plan as "treatmentPlan" FROM clients WHERE is_active = true ORDER BY first_name, last_initial'
      );
      return result.rows;
    });
  },

  async findById(id: string, userId: string): Promise<Client | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      const result = await client.query(
        'SELECT id, first_name as "firstName", last_initial as "lastInitial", treatment_plan as "treatmentPlan" FROM clients WHERE id = $1 AND is_active = true',
        [id]
      );
      return result.rows[0] || null;
    });
  },

  async create(clientData: {
    firstName: string;
    lastInitial: string;
    treatmentPlan?: string;
    createdBy: string;
  }): Promise<Client> {
    return withDatabase(async (client) => {
      await setAuditUser(client, clientData.createdBy);
      const result = await client.query(
        `INSERT INTO clients (first_name, last_initial, treatment_plan, created_by)
         VALUES ($1, $2, $3, $4)
         RETURNING id, first_name as "firstName", last_initial as "lastInitial", treatment_plan as "treatmentPlan"`,
        [clientData.firstName, clientData.lastInitial, clientData.treatmentPlan, clientData.createdBy]
      );
      return result.rows[0];
    });
  },

  async update(id: string, clientData: {
    firstName?: string;
    lastInitial?: string;
    treatmentPlan?: string;
  }, userId: string): Promise<Client | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      const setClauses = [];
      const values = [];
      let paramCount = 1;

      if (clientData.firstName !== undefined) {
        setClauses.push(`first_name = $${paramCount++}`);
        values.push(clientData.firstName);
      }
      if (clientData.lastInitial !== undefined) {
        setClauses.push(`last_initial = $${paramCount++}`);
        values.push(clientData.lastInitial);
      }
      if (clientData.treatmentPlan !== undefined) {
        setClauses.push(`treatment_plan = $${paramCount++}`);
        values.push(clientData.treatmentPlan);
      }

      if (setClauses.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE clients SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount} AND is_active = true
         RETURNING id, first_name as "firstName", last_initial as "lastInitial", treatment_plan as "treatmentPlan"`,
        values
      );
      return result.rows[0] || null;
    });
  }
};

// Session notes database operations
export const sessionDb = {
  async create(sessionData: {
    clientId: string;
    userId: string;
    sessionDate: Date;
    duration: number;
    locationId?: string;
    locationOther?: string;
    generatedNote: string;
    customFeedback?: string;
    status?: 'draft' | 'completed' | 'archived';
    objectives: Array<{ id?: string; custom?: string }>;
    interventions: Array<{ id?: string; custom?: string }>;
  }): Promise<SessionNote> {
    return withDatabase(async (client) => {
      // Validate userId before proceeding
      if (!sessionData.userId || sessionData.userId.trim() === '') {
        throw new Error('Invalid userId provided for session creation');
      }
      
      await setAuditUser(client, sessionData.userId);
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Insert session note
        const sessionResult = await client.query(
          `INSERT INTO session_notes (client_id, user_id, session_date, duration_minutes, location_id, location_other, generated_note, custom_feedback, status)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
           RETURNING id, client_id as "clientId", user_id as "userId", session_date as date, duration_minutes as duration, 
                     location_other as location, generated_note as "generatedNote", custom_feedback as feedback, status, created_at as "createdAt"`,
          [sessionData.clientId, sessionData.userId, sessionData.sessionDate, sessionData.duration, 
           sessionData.locationId, sessionData.locationOther, sessionData.generatedNote, sessionData.customFeedback, sessionData.status || 'draft']
        );
        
        const session = sessionResult.rows[0];
        
        // Insert objectives
        const objectives = [];
        for (const objective of sessionData.objectives) {
          if (objective.id) {
            await client.query(
              'INSERT INTO session_objectives (session_note_id, objective_id) VALUES ($1, $2)',
              [session.id, objective.id]
            );
            // Get objective name
            const objResult = await client.query('SELECT name FROM treatment_objectives WHERE id = $1', [objective.id]);
            objectives.push(objResult.rows[0]?.name || '');
          } else if (objective.custom) {
            await client.query(
              'INSERT INTO session_objectives (session_note_id, custom_objective) VALUES ($1, $2)',
              [session.id, objective.custom]
            );
            objectives.push(objective.custom);
          }
        }
        
        // Insert interventions
        const interventions = [];
        for (const intervention of sessionData.interventions) {
          if (intervention.id) {
            await client.query(
              'INSERT INTO session_interventions (session_note_id, intervention_id) VALUES ($1, $2)',
              [session.id, intervention.id]
            );
            // Get intervention name
            const intResult = await client.query('SELECT name FROM interventions WHERE id = $1', [intervention.id]);
            interventions.push(intResult.rows[0]?.name || '');
          } else if (intervention.custom) {
            await client.query(
              'INSERT INTO session_interventions (session_note_id, custom_intervention) VALUES ($1, $2)',
              [session.id, intervention.custom]
            );
            interventions.push(intervention.custom);
          }
        }
        
        await client.query('COMMIT');
        
        return {
          ...session,
          objectives,
          interventions
        };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  },

  async findByUser(userId: string, limit = 50, offset = 0, clientId?: string, status?: string, adminViewAll = false): Promise<SessionNote[]> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      let query = `SELECT sn.id, sn.client_id as "clientId", sn.user_id as "userId", 
                sn.session_date as date, sn.duration_minutes as duration,
                COALESCE(sl.name, sn.location_other) as location,
                sn.generated_note as "generatedNote", sn.custom_feedback as feedback,
                sn.status, sn.created_at as "createdAt",
                c.first_name || ' ' || c.last_initial || '.' as client_name
         FROM session_notes sn
         LEFT JOIN session_locations sl ON sn.location_id = sl.id
         LEFT JOIN clients c ON sn.client_id = c.id
         WHERE ${adminViewAll ? '1=1' : 'sn.user_id = $1'}`;
      
      const params: (string | number)[] = adminViewAll ? [] : [userId];
      let paramCount = adminViewAll ? 1 : 2;
      
      if (clientId) {
        query += ` AND sn.client_id = $${paramCount}`;
        params.push(clientId);
        paramCount++;
      }
      
      if (status) {
        query += ` AND sn.status = $${paramCount}`;
        params.push(status);
        paramCount++;
      }
      
      query += ` ORDER BY sn.session_date DESC, sn.created_at DESC
                 LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
      params.push(limit, offset);
      
      const result = await client.query(query, params);
      
      // Get objectives and interventions for each session
      const sessions = await Promise.all(result.rows.map(async (session) => {
        const objectivesResult = await client.query(
          `SELECT COALESCE(obj.name, so.custom_objective) as name
           FROM session_objectives so
           LEFT JOIN treatment_objectives obj ON so.objective_id = obj.id
           WHERE so.session_note_id = $1`,
          [session.id]
        );
        
        const interventionsResult = await client.query(
          `SELECT COALESCE(intv.name, si.custom_intervention) as name
           FROM session_interventions si
           LEFT JOIN interventions intv ON si.intervention_id = intv.id
           WHERE si.session_note_id = $1`,
          [session.id]
        );
        
        return {
          ...session,
          objectives: objectivesResult.rows.map(row => row.name),
          interventions: interventionsResult.rows.map(row => row.name)
        };
      }));
      
      return sessions;
    });
  },

  async findByClient(clientId: string, userId: string, limit = 50, offset = 0): Promise<SessionNote[]> {
    return this.findByUser(userId, limit, offset, clientId);
  },

  async findByDateRange(
    userId: string, 
    startDate: Date, 
    endDate: Date, 
    limit = 50, 
    offset = 0
  ): Promise<SessionNote[]> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      const result = await client.query(
        `SELECT sn.id, sn.client_id as "clientId", sn.user_id as "userId", 
                sn.session_date as date, sn.duration_minutes as duration,
                COALESCE(sl.name, sn.location_other) as location,
                sn.generated_note as "generatedNote", sn.custom_feedback as feedback,
                sn.status, sn.created_at as "createdAt",
                c.first_name || ' ' || c.last_initial || '.' as client_name
         FROM session_notes sn
         LEFT JOIN session_locations sl ON sn.location_id = sl.id
         LEFT JOIN clients c ON sn.client_id = c.id
         WHERE sn.user_id = $1 AND sn.session_date BETWEEN $2 AND $3
         ORDER BY sn.session_date DESC, sn.created_at DESC
         LIMIT $4 OFFSET $5`,
        [userId, startDate, endDate, limit, offset]
      );
      
      // Get objectives and interventions for each session
      const sessions = await Promise.all(result.rows.map(async (session) => {
        const objectivesResult = await client.query(
          `SELECT COALESCE(obj.name, so.custom_objective) as name
           FROM session_objectives so
           LEFT JOIN treatment_objectives obj ON so.objective_id = obj.id
           WHERE so.session_note_id = $1`,
          [session.id]
        );
        
        const interventionsResult = await client.query(
          `SELECT COALESCE(intv.name, si.custom_intervention) as name
           FROM session_interventions si
           LEFT JOIN interventions intv ON si.intervention_id = intv.id
           WHERE si.session_note_id = $1`,
          [session.id]
        );
        
        return {
          ...session,
          objectives: objectivesResult.rows.map(row => row.name),
          interventions: interventionsResult.rows.map(row => row.name)
        };
      }));
      
      return sessions;
    });
  },

  async update(
    id: string,
    sessionData: {
      sessionDate?: Date;
      duration?: number;
      locationId?: string;
      locationOther?: string;
      generatedNote?: string;
      customFeedback?: string;
      status?: 'draft' | 'completed' | 'archived';
      objectives?: Array<{ id?: string; custom?: string }>;
      interventions?: Array<{ id?: string; custom?: string }>;
    },
    userId: string
  ): Promise<SessionNote | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      // Start transaction
      await client.query('BEGIN');
      
      try {
        // Build dynamic update query
        const setClauses = [];
        const values = [];
        let paramCount = 1;

        if (sessionData.sessionDate !== undefined) {
          setClauses.push(`session_date = $${paramCount++}`);
          values.push(sessionData.sessionDate);
        }
        if (sessionData.duration !== undefined) {
          setClauses.push(`duration_minutes = $${paramCount++}`);
          values.push(sessionData.duration);
        }
        if (sessionData.locationId !== undefined) {
          setClauses.push(`location_id = $${paramCount++}`);
          values.push(sessionData.locationId);
        }
        if (sessionData.locationOther !== undefined) {
          setClauses.push(`location_other = $${paramCount++}`);
          values.push(sessionData.locationOther);
        }
        if (sessionData.generatedNote !== undefined) {
          setClauses.push(`generated_note = $${paramCount++}`);
          values.push(sessionData.generatedNote);
        }
        if (sessionData.customFeedback !== undefined) {
          setClauses.push(`custom_feedback = $${paramCount++}`);
          values.push(sessionData.customFeedback);
        }
        if (sessionData.status !== undefined) {
          setClauses.push(`status = $${paramCount++}`);
          values.push(sessionData.status);
        }

        if (setClauses.length === 0 && !sessionData.objectives && !sessionData.interventions) {
          await client.query('ROLLBACK');
          return null;
        }

        // Update session if there are field changes
        if (setClauses.length > 0) {
          values.push(id, userId);
          await client.query(
            `UPDATE session_notes SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
             WHERE id = $${paramCount++} AND user_id = $${paramCount++}`,
            values
          );
        }

        // Update objectives if provided
        if (sessionData.objectives) {
          await client.query('DELETE FROM session_objectives WHERE session_note_id = $1', [id]);
          
          for (const objective of sessionData.objectives) {
            if (objective.id) {
              await client.query(
                'INSERT INTO session_objectives (session_note_id, objective_id) VALUES ($1, $2)',
                [id, objective.id]
              );
            } else if (objective.custom) {
              await client.query(
                'INSERT INTO session_objectives (session_note_id, custom_objective) VALUES ($1, $2)',
                [id, objective.custom]
              );
            }
          }
        }

        // Update interventions if provided
        if (sessionData.interventions) {
          await client.query('DELETE FROM session_interventions WHERE session_note_id = $1', [id]);
          
          for (const intervention of sessionData.interventions) {
            if (intervention.id) {
              await client.query(
                'INSERT INTO session_interventions (session_note_id, intervention_id) VALUES ($1, $2)',
                [id, intervention.id]
              );
            } else if (intervention.custom) {
              await client.query(
                'INSERT INTO session_interventions (session_note_id, custom_intervention) VALUES ($1, $2)',
                [id, intervention.custom]
              );
            }
          }
        }

        await client.query('COMMIT');
        
        // Return updated session
        return await this.findById(id, userId);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      }
    });
  },

  async updateStatus(id: string, status: 'draft' | 'completed' | 'archived', userId: string): Promise<boolean> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      const result = await client.query(
        'UPDATE session_notes SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND user_id = $3',
        [status, id, userId]
      );
      
      return (result.rowCount ?? 0) > 0;
    });
  },

  async delete(id: string, userId: string): Promise<boolean> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      // For HIPAA compliance, we typically archive instead of delete
      // But this provides the option for true deletion if needed
      const result = await client.query(
        'DELETE FROM session_notes WHERE id = $1 AND user_id = $2',
        [id, userId]
      );
      
      return (result.rowCount ?? 0) > 0;
    });
  },

  async archive(id: string, userId: string): Promise<boolean> {
    // HIPAA-compliant soft delete by changing status to archived
    return await this.updateStatus(id, 'archived', userId);
  },

  async findById(id: string, userId: string): Promise<SessionNote | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      const result = await client.query(
        `SELECT sn.id, sn.client_id as "clientId", sn.user_id as "userId", 
                sn.session_date as date, sn.duration_minutes as duration,
                COALESCE(sl.name, sn.location_other) as location,
                sn.generated_note as "generatedNote", sn.custom_feedback as feedback,
                sn.status, sn.created_at as "createdAt"
         FROM session_notes sn
         LEFT JOIN session_locations sl ON sn.location_id = sl.id
         WHERE sn.id = $1 AND sn.user_id = $2`,
        [id, userId]
      );
      
      if (!result.rows[0]) return null;
      
      const session = result.rows[0];
      
      // Get objectives and interventions
      const objectivesResult = await client.query(
        `SELECT COALESCE(obj.name, so.custom_objective) as name
         FROM session_objectives so
         LEFT JOIN treatment_objectives obj ON so.objective_id = obj.id
         WHERE so.session_note_id = $1`,
        [id]
      );
      
      const interventionsResult = await client.query(
        `SELECT COALESCE(intv.name, si.custom_intervention) as name
         FROM session_interventions si
         LEFT JOIN interventions intv ON si.intervention_id = intv.id
         WHERE si.session_note_id = $1`,
        [id]
      );
      
      return {
        ...session,
        objectives: objectivesResult.rows.map(row => row.name),
        interventions: interventionsResult.rows.map(row => row.name)
      };
    });
  }
};

// Session templates database operations
export const templateDb = {
  async findAll(userId?: string): Promise<Array<{
    id: string;
    name: string;
    description?: string;
    defaultDuration?: number;
    defaultLocationId?: string;
    defaultLocationName?: string;
    templateObjectives: string[];
    templateInterventions: string[];
    createdBy?: string;
    isActive: boolean;
    createdAt: Date;
  }>> {
    return withDatabase(async (client) => {
      if (userId) await setAuditUser(client, userId);
      
      const result = await client.query(
        `SELECT st.id, st.name, st.description, st.default_duration as "defaultDuration",
                st.default_location_id as "defaultLocationId", sl.name as "defaultLocationName",
                st.template_objectives as "templateObjectives", st.template_interventions as "templateInterventions",
                st.created_by as "createdBy", st.is_active as "isActive", st.created_at as "createdAt"
         FROM session_templates st
         LEFT JOIN session_locations sl ON st.default_location_id = sl.id
         WHERE st.is_active = true
         ORDER BY st.name`
      );
      
      // Convert UUID arrays to objective/intervention names
      const templates = await Promise.all(result.rows.map(async (template) => {
        const objectives = [];
        const interventions = [];
        
        if (template.templateObjectives && template.templateObjectives.length > 0) {
          const objResult = await client.query(
            'SELECT name FROM treatment_objectives WHERE id = ANY($1)',
            [template.templateObjectives]
          );
          objectives.push(...objResult.rows.map(row => row.name));
        }
        
        if (template.templateInterventions && template.templateInterventions.length > 0) {
          const intResult = await client.query(
            'SELECT name FROM interventions WHERE id = ANY($1)',
            [template.templateInterventions]
          );
          interventions.push(...intResult.rows.map(row => row.name));
        }
        
        return {
          ...template,
          templateObjectives: objectives,
          templateInterventions: interventions
        };
      }));
      
      return templates;
    });
  },

  async findById(id: string, userId?: string): Promise<SessionTemplate | null> {
    return withDatabase(async (client) => {
      if (userId) await setAuditUser(client, userId);
      
      const result = await client.query(
        `SELECT st.id, st.name, st.description, st.default_duration as "defaultDuration",
                st.default_location_id as "defaultLocationId", sl.name as "defaultLocationName",
                st.template_objectives as "templateObjectives", st.template_interventions as "templateInterventions",
                st.created_by as "createdBy", st.is_active as "isActive", st.created_at as "createdAt"
         FROM session_templates st
         LEFT JOIN session_locations sl ON st.default_location_id = sl.id
         WHERE st.id = $1 AND st.is_active = true`,
        [id]
      );
      
      if (!result.rows[0]) return null;
      
      const template = result.rows[0];
      
      // Convert UUID arrays to objective/intervention names
      const objectives = [];
      const interventions = [];
      
      if (template.templateObjectives && template.templateObjectives.length > 0) {
        const objResult = await client.query(
          'SELECT name FROM treatment_objectives WHERE id = ANY($1)',
          [template.templateObjectives]
        );
        objectives.push(...objResult.rows.map(row => row.name));
      }
      
      if (template.templateInterventions && template.templateInterventions.length > 0) {
        const intResult = await client.query(
          'SELECT name FROM interventions WHERE id = ANY($1)',
          [template.templateInterventions]
        );
        interventions.push(...intResult.rows.map(row => row.name));
      }
      
      return {
        ...template,
        templateObjectives: objectives,
        templateInterventions: interventions
      };
    });
  },

  async create(templateData: {
    name: string;
    description?: string;
    defaultDuration?: number;
    defaultLocationId?: string;
    templateObjectives?: string[]; // objective IDs
    templateInterventions?: string[]; // intervention IDs
    createdBy: string;
  }): Promise<SessionTemplate> {
    return withDatabase(async (client) => {
      await setAuditUser(client, templateData.createdBy);
      
      const result = await client.query(
        `INSERT INTO session_templates (name, description, default_duration, default_location_id, template_objectives, template_interventions, created_by)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, name, description, default_duration as "defaultDuration", default_location_id as "defaultLocationId", is_active as "isActive", created_at as "createdAt"`,
        [
          templateData.name,
          templateData.description,
          templateData.defaultDuration,
          templateData.defaultLocationId,
          templateData.templateObjectives || [],
          templateData.templateInterventions || [],
          templateData.createdBy
        ]
      );
      
      return result.rows[0];
    });
  },

  async update(id: string, templateData: {
    name?: string;
    description?: string;
    defaultDuration?: number;
    defaultLocationId?: string;
    templateObjectives?: string[];
    templateInterventions?: string[];
  }, userId: string): Promise<SessionTemplate | null> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      const setClauses = [];
      const values = [];
      let paramCount = 1;

      if (templateData.name !== undefined) {
        setClauses.push(`name = $${paramCount++}`);
        values.push(templateData.name);
      }
      if (templateData.description !== undefined) {
        setClauses.push(`description = $${paramCount++}`);
        values.push(templateData.description);
      }
      if (templateData.defaultDuration !== undefined) {
        setClauses.push(`default_duration = $${paramCount++}`);
        values.push(templateData.defaultDuration);
      }
      if (templateData.defaultLocationId !== undefined) {
        setClauses.push(`default_location_id = $${paramCount++}`);
        values.push(templateData.defaultLocationId);
      }
      if (templateData.templateObjectives !== undefined) {
        setClauses.push(`template_objectives = $${paramCount++}`);
        values.push(templateData.templateObjectives);
      }
      if (templateData.templateInterventions !== undefined) {
        setClauses.push(`template_interventions = $${paramCount++}`);
        values.push(templateData.templateInterventions);
      }

      if (setClauses.length === 0) return null;

      values.push(id);
      const result = await client.query(
        `UPDATE session_templates SET ${setClauses.join(', ')}, updated_at = CURRENT_TIMESTAMP
         WHERE id = $${paramCount} AND is_active = true
         RETURNING id, name, description, default_duration as "defaultDuration", default_location_id as "defaultLocationId", is_active as "isActive"`,
        values
      );
      
      return result.rows[0] || null;
    });
  },

  async delete(id: string, userId: string): Promise<boolean> {
    return withDatabase(async (client) => {
      await setAuditUser(client, userId);
      
      // Soft delete by setting is_active = false
      const result = await client.query(
        'UPDATE session_templates SET is_active = false, updated_at = CURRENT_TIMESTAMP WHERE id = $1',
        [id]
      );
      
      return (result.rowCount ?? 0) > 0;
    });
  }
};

// Lookup data operations
export const lookupDb = {
  async getLocations(): Promise<Array<{ id: string; name: string }>> {
    return withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, name FROM session_locations WHERE is_active = true ORDER BY name'
      );
      return result.rows;
    });
  },

  async getObjectives(): Promise<Array<{ id: string; name: string; category?: string }>> {
    return withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, name, category FROM treatment_objectives WHERE is_active = true ORDER BY category, name'
      );
      return result.rows;
    });
  },

  async getInterventions(): Promise<Array<{ id: string; name: string; category?: string }>> {
    return withDatabase(async (client) => {
      const result = await client.query(
        'SELECT id, name, category FROM interventions WHERE is_active = true ORDER BY category, name'
      );
      return result.rows;
    });
  }
};

// Health check
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    return await withDatabase(async (client) => {
      const result = await client.query('SELECT 1 as connected');
      return result.rows[0]?.connected === 1;
    });
  } catch (error) {
    console.error('Database connection failed:', error);
    return false;
  }
}

// Graceful shutdown
export async function closeDatabasePool(): Promise<void> {
  await pool.end();
}
