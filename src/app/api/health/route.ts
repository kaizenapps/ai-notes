import { withDatabase } from '@/lib/database';

export async function GET() {
  try {
    // Check database connectivity
    await withDatabase(async (client) => {
      await client.query('SELECT 1');
    });

    return Response.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
  } catch (error) {
    console.error('Health check failed:', error);
    return Response.json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: 'Database connection failed'
    }, { status: 503 });
  }
}
