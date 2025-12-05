import { NextRequest } from 'next/server';
import { sessionDb } from '@/lib/database';
import { verifyToken } from '@/lib/auth';
import { SessionNote } from '@/types';

interface RouteContext {
  params: Promise<{
    id: string;
  }>;
}

// Generate export content based on format
function generateExportContent(session: SessionNote, format: 'pdf' | 'docx' | 'txt', includeMetadata = true): { content: string; contentType: string; filename: string } {
  const date = new Date(session.date).toLocaleDateString();
  const timestamp = new Date().getTime();
  
  switch (format) {
    case 'txt':
      const txtContent = `
SESSION NOTE EXPORT
${includeMetadata ? `
Date: ${date}
Duration: ${session.duration} minutes
Location: ${session.location}
${session.feedback ? `Additional Notes: ${session.feedback}` : ''}

---

` : ''}
${session.generatedNote}

---
Generated: ${new Date().toISOString()}
HIPAA Compliant Export
      `.trim();
      
      return {
        content: txtContent,
        contentType: 'text/plain',
        filename: `session-note-${date.replace(/\//g, '-')}-${timestamp}.txt`
      };
      
    case 'pdf':
      // For PDF, we'll return HTML that can be converted to PDF by the browser
      const htmlContent = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Session Note - ${date}</title>
    <style>
        body { 
            font-family: Arial, sans-serif; 
            line-height: 1.6; 
            margin: 40px; 
            color: #333;
        }
        .header { 
            border-bottom: 2px solid #333; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
            text-align: center;
        }
        .metadata { 
            background: #f5f5f5; 
            padding: 15px; 
            margin-bottom: 20px; 
            border-radius: 5px; 
            border-left: 4px solid #007cba;
        }
        .content { 
            margin-bottom: 30px; 
            padding: 20px;
            border: 1px solid #ddd;
            border-radius: 5px;
        }
        .footer { 
            border-top: 1px solid #ccc; 
            padding-top: 10px; 
            font-size: 12px; 
            color: #666; 
            text-align: center;
        }
        h1 { 
            color: #333; 
            margin: 0;
        }
        h2 { 
            color: #555; 
            margin-top: 25px; 
        }
        .metadata-item { 
            margin-bottom: 8px; 
        }
        .metadata-label { 
            font-weight: bold; 
            display: inline-block; 
            width: 120px; 
        }
        .note-content {
            white-space: pre-wrap;
            font-size: 14px;
            line-height: 1.8;
        }
        @media print {
            body { margin: 20px; }
            .header { break-after: avoid; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Session Note</h1>
        <p><strong>Date:</strong> ${date}</p>
    </div>
    
    ${includeMetadata ? `
    <div class="metadata">
        <h2>Session Details</h2>
        <div class="metadata-item"><span class="metadata-label">Duration:</span> ${session.duration} minutes</div>
        <div class="metadata-item"><span class="metadata-label">Location:</span> ${session.location}</div>
        ${session.feedback ? `<div class="metadata-item"><span class="metadata-label">Additional Notes:</span> ${session.feedback}</div>` : ''}
    </div>
    ` : ''}
    
    <div class="content">
        <h2>Session Notes</h2>
        <div class="note-content">${session.generatedNote}</div>
    </div>
    
    <div class="footer">
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>HIPAA Compliant Export</strong> | Session Notes Generator</p>
    </div>
</body>
</html>
      `.trim();
      
      return {
        content: htmlContent,
        contentType: 'text/html',
        filename: `session-note-${date.replace(/\//g, '-')}-${timestamp}.html`
      };
      
    case 'docx':
      // For DOCX, we'll create a simple RTF format that can be opened by Word
      const rtfContent = `{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}
\\f0\\fs24 
\\qc\\b\\fs28 SESSION NOTE\\b0\\fs24\\par
\\qc Date: ${date}\\par
\\par

${includeMetadata ? `
\\b Session Details\\b0\\par
Duration: ${session.duration} minutes\\par
Location: ${session.location}\\par
\\par
${session.feedback ? `Additional Notes: ${session.feedback}\\par` : ''}
\\par

` : ''}

\\b Session Notes\\b0\\par
${session.generatedNote.replace(/\n/g, '\\par ')}\\par
\\par

\\fs20 Generated: ${new Date().toLocaleString()}\\par
HIPAA Compliant Export\\fs24\\par
}`;
      
      return {
        content: rtfContent,
        contentType: 'application/rtf',
        filename: `session-note-${date.replace(/\//g, '-')}-${timestamp}.rtf`
      };
      
    default:
      throw new Error(`Unsupported format: ${format}`);
  }
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

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const format = (searchParams.get('format') || 'pdf') as 'pdf' | 'docx' | 'txt';
    const includeMetadata = searchParams.get('metadata') !== 'false';

    // Validate format
    if (!['pdf', 'docx', 'txt'].includes(format)) {
      return Response.json({ 
        error: 'Invalid format. Supported formats: pdf, docx, txt' 
      }, { status: 400 });
    }

    const params = await context.params;

    // Fetch session from database
    const session = await sessionDb.findById(params.id, payload.userId);
    
    if (!session) {
      return Response.json({ error: 'Session not found' }, { status: 404 });
    }

    // Generate export content
    const { content, contentType, filename } = generateExportContent(session, format, includeMetadata);

    // Return file as download
    return new Response(content, {
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      }
    });
  } catch (error) {
    console.error('Error exporting session:', error);
    return Response.json({ 
      error: 'Failed to export session' 
    }, { status: 500 });
  }
}
