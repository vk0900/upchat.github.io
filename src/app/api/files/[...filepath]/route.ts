// src/app/api/files/[...filepath]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import db from '@/lib/db'; // Assuming db setup as before
import { cookies, headers } from 'next/headers';
import mime from 'mime-types'; // Use mime-types for better content type detection

// Explicitly set runtime to Node.js as this route uses Node.js specific APIs (fs, path, better-sqlite3)
export const runtime = 'nodejs';

// Helper to get IP Address
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    return cfIp || forwarded || realIp || '::1'; // Fallback for local
}


// Placeholder: Replace with your actual session validation logic
async function validateSessionAndGetUserId(request: NextRequest): Promise<number | null> {
    const sessionId = cookies().get('session_id')?.value;
    if (!sessionId) return null;

    try {
        // This database call requires the Node.js runtime
        const session = db.prepare('SELECT user_id FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP').get(sessionId);
        // Optionally update last_accessed_at here
        if (session) {
            // db.prepare('UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
        }
        return session?.user_id ?? null;
    } catch (error) {
        console.error('API file route session validation error:', error);
        return null;
    }
}

async function getUserRole(userId: number): Promise<string | null> {
  try {
    // This database call requires the Node.js runtime
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    return user?.role ?? null;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

export async function GET(
    request: NextRequest,
    { params }: { params: { filepath: string[] } }
) {
    const userId = await validateSessionAndGetUserId(request);
    const ipAddress = getIpAddress();

    if (!userId) {
        return new NextResponse('Unauthorized', { status: 401 });
    }

    // Reconstruct the relative file path from the URL segments
    // Ensure it starts with 'uploads/' as expected
    // Node.js 'path' module usage requires Node.js runtime
    const relativePath = path.join('uploads', ...params.filepath);

    // Basic path traversal check
    const requestedPath = path.normalize(relativePath);
    const uploadDirResolved = path.resolve(process.cwd(), 'uploads');
    const resolvedPath = path.resolve(process.cwd(), requestedPath);

     if (!resolvedPath.startsWith(uploadDirResolved)) {
        console.warn(`Attempted path traversal: ${requestedPath}`);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'Path Traversal Attempt', `Attempted to access file outside uploads directory: ${requestedPath}`, 'security');
        return new NextResponse('Forbidden', { status: 403 });
    }

    try {
        // Database interaction requires Node.js runtime
        const fileRecord = db.prepare(
            'SELECT id, name, type, visibility, uploader_id, path FROM files WHERE path = ?'
        ).get(relativePath); // Use relativePath for DB lookup

        if (!fileRecord) {
            console.warn(`File not found in DB for path: ${relativePath}`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Access Error', `File record not found in DB for path: ${relativePath}`, 'file');
            return new NextResponse('File not found', { status: 404 });
        }

        // Check permissions
        const userRole = await getUserRole(userId); // DB call
        if (fileRecord.visibility === 'private' && fileRecord.uploader_id !== userId && userRole !== 'admin') {
             console.log(`Access denied for user ${userId} to private file ${fileRecord.id} owned by ${fileRecord.uploader_id}`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Access Denied', `User denied access to private file '${fileRecord.name}' (ID: ${fileRecord.id})`, 'security', fileRecord.id);
            return new NextResponse('Forbidden', { status: 403 });
        }

        // Filesystem operations require Node.js runtime
        const absolutePath = path.resolve(process.cwd(), fileRecord.path);

        // Check if the file actually exists on the filesystem
        if (!fs.existsSync(absolutePath)) {
            console.error(`File record exists (ID: ${fileRecord.id}) but file not found on disk: ${absolutePath}`);
            // Consider cleaning up the orphaned DB record here
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Access Error', `File data missing on disk for '${fileRecord.name}' (ID: ${fileRecord.id}, Path: ${fileRecord.path})`, 'system', fileRecord.id);
            return new NextResponse('File data missing', { status: 404 });
        }

        // Read the file content - requires Node.js runtime
        const fileBuffer = fs.readFileSync(absolutePath);

        // Determine Content-Type
        const contentType = mime.lookup(fileRecord.name) || fileRecord.type || 'application/octet-stream';

        // Determine Content-Disposition (inline for preview, attachment for download)
        // Default to attachment for security unless specifically requested for preview (e.g., via query param)
        const isPreview = request.nextUrl.searchParams.get('preview') === 'true';
        const isInlinePreviewable = contentType.startsWith('image/') || contentType === 'application/pdf' || contentType.startsWith('text/');
        const dispositionType = isPreview && isInlinePreviewable ? 'inline' : 'attachment';
        const disposition = `${dispositionType}; filename="${encodeURIComponent(fileRecord.name)}"`;


         // Log successful download/preview access (include disposition type)
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, isPreview ? 'File Preview' : 'File Download', `Accessed '${fileRecord.name}' (ID: ${fileRecord.id}, Type: ${dispositionType})`, 'file', fileRecord.id);


        // Create the response
        const response = new NextResponse(fileBuffer);
        response.headers.set('Content-Type', contentType);
        response.headers.set('Content-Length', fileBuffer.length.toString());
        response.headers.set('Content-Disposition', disposition);
        // Add cache control headers if appropriate (e.g., prevent caching for private files)
         if (fileRecord.visibility === 'private') {
            response.headers.set('Cache-Control', 'private, no-store, must-revalidate');
         } else {
             // Allow some caching for public files
             response.headers.set('Cache-Control', 'public, max-age=3600'); // Cache for 1 hour
         }


        return response;

    } catch (error) {
        console.error(`Error serving file path ${relativePath}:`, error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Access Error', `Server error serving file path ${relativePath}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
        return new NextResponse('Internal Server Error', { status: 500 });
    }
}
