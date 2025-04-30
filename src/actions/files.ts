// src/actions/files.ts
'use server';

import * as z from 'zod';
import db from '@/lib/db';
import fs from 'fs/promises';
import path from 'path';
import { revalidatePath } from 'next/cache';
import { cookies, headers } from 'next/headers'; // Assuming session/auth info is in cookies
import crypto from 'crypto';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB (should be fetched from settings ideally)
const UPLOAD_DIR = path.resolve(process.cwd(), 'uploads');

// Helper to get IP Address
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    return cfIp || forwarded || realIp || '::1'; // Fallback for local
}


// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await fs.access(UPLOAD_DIR);
  } catch (error: any) {
     if (error.code === 'ENOENT') {
        try {
        await fs.mkdir(UPLOAD_DIR, { recursive: true });
        console.log(`Created upload directory: ${UPLOAD_DIR}`);
        } catch (mkdirError) {
        console.error(`Failed to create upload directory: ${UPLOAD_DIR}`, mkdirError);
        throw new Error('Server configuration error: Cannot create upload directory.');
        }
    } else {
        // Other access error
        console.error(`Error accessing upload directory: ${UPLOAD_DIR}`, error);
        throw new Error('Server configuration error: Cannot access upload directory.');
    }
  }
}

// Helper to get user ID from session (Replace with your actual session logic)
// This is a placeholder function. Adapt it to your session management system.
async function getUserIdFromSession(): Promise<number | null> {
  const sessionId = cookies().get('session_id')?.value;
  if (!sessionId) return null;

  try {
    const session = db.prepare('SELECT user_id FROM sessions WHERE session_id = ? AND expires_at > CURRENT_TIMESTAMP').get(sessionId);
    return session?.user_id ?? null;
  } catch (error) {
    console.error('Error fetching session:', error);
    return null;
  }
}

// Helper to get user role
async function getUserRole(userId: number): Promise<string | null> {
  try {
    const user = db.prepare('SELECT role FROM users WHERE id = ?').get(userId);
    return user?.role ?? null;
  } catch (error) {
    console.error('Error fetching user role:', error);
    return null;
  }
}

// Fetch settings from DB
function getSetting(key: string, defaultValue: string): string {
    try {
        const setting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
        return setting?.value ?? defaultValue;
    } catch (error) {
        console.error(`Error fetching setting '${key}':`, error);
        return defaultValue;
    }
}


const FileUploadSchema = z.object({
  file: z.instanceof(File),
  visibility: z.enum(['private', 'public']).default('private'),
});

export async function uploadFile(formData: FormData) {
  await ensureUploadDir();
  const userId = await getUserIdFromSession();
  if (!userId) {
    return { success: false, error: 'Authentication required.' };
  }
  const ipAddress = getIpAddress();

  const file = formData.get('file') as File | null;
  const visibility = (formData.get('visibility') as 'private' | 'public') || 'private';

  if (!file) {
    return { success: false, error: 'No file provided.' };
  }

  // Fetch limits and restrictions from settings
  const maxSizeMB = parseInt(getSetting('fileSizeLimitMB', '10'), 10);
  const maxSizeBytes = maxSizeMB * 1024 * 1024;
  const allowedTypesSetting = getSetting('allowedFileTypes', '');
  const allowedExtensions = allowedTypesSetting
    .split(',')
    .map(ext => ext.trim().toLowerCase().replace(/^\./, '')) // Normalize: remove dots, trim whitespace, lowercase
    .filter(ext => ext !== ''); // Remove empty entries

  // Validate size
  if (file.size > maxSizeBytes) {
    return { success: false, error: `File size exceeds the limit of ${maxSizeMB} MB.` };
  }

   // Validate file type based on extension
  const fileExtension = path.extname(file.name).toLowerCase().substring(1);
   if (allowedExtensions.length > 0 && !allowedExtensions.includes(fileExtension)) {
      console.log(`File type rejected: .${fileExtension}. Allowed: ${allowedExtensions.join(', ')}`);
      return { success: false, error: `File type '.${fileExtension}' is not allowed.` };
  }

  // TODO: Add storage quota check per user if implemented

  try {
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const safeFilename = file.name.replace(/[^a-zA-Z0-9_.-]/g, '_'); // Sanitize filename
    const filename = `${Date.now()}-${uniqueSuffix}-${safeFilename}`;
    const filePath = path.join(UPLOAD_DIR, filename);
    const relativePath = path.join('uploads', filename); // Store relative path

    // Write file to disk
    await fs.writeFile(filePath, fileBuffer);
    console.log(`File saved to: ${filePath}`);

    // Insert metadata into database
    const stmt = db.prepare(`
      INSERT INTO files (name, type, size, uploader_id, visibility, path)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    const info = stmt.run(file.name, file.type, file.size, userId, visibility, relativePath);
    const fileId = info.lastInsertRowid as number;

    console.log(`File metadata saved to DB with ID: ${fileId}`);

    // Revalidate paths where file lists are shown
    revalidatePath('/dashboard/files');
    revalidatePath('/dashboard/admin/files');

    // Log the upload action
    db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(userId, ipAddress, 'File Upload', `Uploaded '${file.name}' (Size: ${file.size} bytes, Visibility: ${visibility})`, 'file', fileId);

    return { success: true, message: 'File uploaded successfully.' };

  } catch (error) {
    console.error('File upload error:', error);
    // Attempt to clean up partially saved file if error occurred
     if (error && typeof error === 'object' && 'path' in error && typeof error.path === 'string') {
        try {
            await fs.unlink(error.path); // error.path might not be correct, adjust as needed
            console.log(`Cleaned up partially saved file: ${error.path}`);
        } catch (cleanupError) {
            console.error(`Failed to clean up file ${error.path}:`, cleanupError);
        }
    }
     db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
        .run(userId, ipAddress, 'File Upload Error', `Error uploading '${file.name}': ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
    return { success: false, error: 'Failed to upload file. Please try again.' };
  }
}

export async function listFiles(isAdminView: boolean = false) {
  const userId = await getUserIdFromSession();
  if (!userId) {
    return { success: false, error: 'Authentication required.', files: [] };
  }

  const userRole = await getUserRole(userId);

  try {
    let files;
    if (isAdminView && userRole === 'admin') {
      // Admin sees all files, joining with users to get uploader username
       // Use COALESCE to handle NULL uploader_id (deleted users)
      files = db.prepare(`
        SELECT f.id, f.name, f.type, f.size, f.upload_date, f.visibility, COALESCE(u.username, 'Deleted User') as uploader, f.uploader_id
        FROM files f
        LEFT JOIN users u ON f.uploader_id = u.id
        ORDER BY f.upload_date DESC
      `).all();
    } else {
      // Regular user sees their own files + public files
       // Use COALESCE for public files from deleted users
       files = db.prepare(`
        SELECT id, name, type, size, upload_date, visibility, 'You' as uploader, uploader_id
        FROM files
        WHERE uploader_id = ?
        UNION ALL
        SELECT f.id, f.name, f.type, f.size, f.upload_date, f.visibility, COALESCE(u.username, 'Deleted User') as uploader, f.uploader_id
        FROM files f
        LEFT JOIN users u ON f.uploader_id = u.id
        WHERE f.visibility = 'public' AND f.uploader_id != ?
        ORDER BY upload_date DESC
      `).all(userId, userId);
    }

    // Format dates for display
    const formattedFiles = files.map((file: any) => ({
      ...file,
      uploaded: new Date(file.upload_date).toLocaleString(),
      // Provide a unique key for React lists
      key: `file-${file.id}`
    }));


    return { success: true, files: formattedFiles };
  } catch (error) {
    console.error('Error listing files:', error);
     const ipAddress = getIpAddress();
     db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
        .run(userId, ipAddress, 'File List Error', `Error listing files (Admin: ${isAdminView}): ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
    return { success: false, error: 'Failed to retrieve files.', files: [] };
  }
}

export async function toggleFileVisibility(fileId: number, newVisibility: 'public' | 'private') {
    const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }
    const userRole = await getUserRole(userId);
    const ipAddress = getIpAddress();

    try {
        const file = db.prepare('SELECT uploader_id, name, visibility FROM files WHERE id = ?').get(fileId);

        if (!file) {
            return { success: false, error: 'File not found.' };
        }

        // Check permissions: Only owner or admin can change visibility
        if (file.uploader_id !== userId && userRole !== 'admin') {
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'Unauthorized Action', `User attempted to toggle visibility for file ID ${fileId} without permission`, 'security', fileId);
            return { success: false, error: 'Permission denied.' };
        }

        if (file.visibility === newVisibility) {
             return { success: true, message: 'Visibility already set.' }; // No change needed
        }

        db.prepare('UPDATE files SET visibility = ? WHERE id = ?').run(newVisibility, fileId);

        revalidatePath('/dashboard/files');
        revalidatePath('/dashboard/admin/files');

        // Log the visibility change
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Visibility Change', `Changed '${file.name}' (ID: ${fileId}) visibility from '${file.visibility}' to '${newVisibility}'`, 'file', fileId);

        return { success: true, message: `File visibility changed to ${newVisibility}.` };
    } catch (error) {
        console.error(`Error toggling visibility for file ID ${fileId}:`, error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Visibility Error', `Error toggling visibility for file ID ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', fileId);
        return { success: false, error: 'Failed to update file visibility.' };
    }
}

export async function deleteFile(fileId: number) {
    const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }
    const userRole = await getUserRole(userId);
    const ipAddress = getIpAddress();

    try {
        const file = db.prepare('SELECT uploader_id, path, name FROM files WHERE id = ?').get(fileId);

        if (!file) {
            return { success: false, error: 'File not found.' };
        }

        // Check permissions: Only owner or admin can delete
        if (file.uploader_id !== userId && userRole !== 'admin') {
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'Unauthorized Action', `User attempted to delete file ID ${fileId} without permission`, 'security', fileId);
            return { success: false, error: 'Permission denied to delete this file.' };
        }

        const filePath = path.resolve(process.cwd(), file.path);

        // Start transaction
        const deleteTx = db.transaction(() => {
            // Delete DB record first
            const info = db.prepare('DELETE FROM files WHERE id = ?').run(fileId);
            if (info.changes === 0) {
                throw new Error('File record not found in database during transaction.');
            }
            // Physical file deletion is done outside transaction to avoid holding lock during IO
        });

        deleteTx(); // Execute the transaction

        // Delete physical file after successful DB deletion
        try {
            await fs.unlink(filePath);
            console.log(`Deleted physical file: ${filePath}`);
        } catch (unlinkError: any) {
             // If file doesn't exist, it might be an orphan record, log warning but proceed
            if (unlinkError.code === 'ENOENT') {
                console.warn(`File not found on disk, but DB record deleted: ${filePath}`);
            } else {
                // If other error occurs during deletion, log it but don't fail the operation
                // as the DB record is already gone. Consider strategies for handling orphaned files.
                console.error(`Failed to delete physical file ${filePath}, but DB record removed:`, unlinkError);
                 db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(userId, ipAddress, 'File Deletion IO Error', `Failed to delete physical file '${file.name}' (Path: ${file.path}): ${unlinkError.message}`, 'system', fileId);
            }
        }


        revalidatePath('/dashboard/files');
        revalidatePath('/dashboard/admin/files');

        // Log the deletion
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Deletion', `Deleted '${file.name}' (ID: ${fileId})`, 'file', fileId);

        return { success: true, message: 'File deleted successfully.' };
    } catch (error) {
        console.error(`Error deleting file ID ${fileId}:`, error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Deletion Error', `Error deleting file ID ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', fileId);
        return { success: false, error: 'Failed to delete file.' };
    }
}


// Action to initiate file download (returns file path/info for client to fetch)
export async function getDownloadFileInfo(fileId: number): Promise<{ success: boolean; error?: string; fileInfo?: { name: string; path: string; type: string | null } }> {
    const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }
     const ipAddress = getIpAddress();

    try {
        const file = db.prepare('SELECT name, path, type, visibility, uploader_id, size FROM files WHERE id = ?').get(fileId);

        if (!file) {
            return { success: false, error: 'File not found.' };
        }

        // Check permissions: Allow download if public or user is the owner or an admin
        const userRole = await getUserRole(userId);
        if (file.visibility === 'private' && file.uploader_id !== userId && userRole !== 'admin') {
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Access Denied', `User denied download access to private file '${file.name}' (ID: ${fileId})`, 'security', fileId);
            return { success: false, error: 'Access denied to this file.' };
        }

        const absolutePath = path.resolve(process.cwd(), file.path);

        // Check if file exists on disk before returning info
        try {
            await fs.access(absolutePath);
        } catch (accessError) {
            console.error(`File record exists (ID: ${fileId}) but file not found on disk: ${absolutePath}`);
            // Consider cleaning up the orphaned DB record here or marking it as missing
             // db.prepare('UPDATE files SET status = ? WHERE id = ?').run('missing', fileId); // Example
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Download Error', `File data missing on disk for '${file.name}' (ID: ${fileId}, Path: ${file.path})`, 'system', fileId);
            return { success: false, error: 'File data is missing. Please contact support.' };
        }

        // Log successful download attempt
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
             .run(userId, ipAddress, 'File Download', `User initiated download for '${file.name}' (ID: ${fileId}, Size: ${file.size})`, 'file', fileId);

        // Return necessary info for the client to construct the download request
        // The actual file serving will happen via an API route or direct link if configured
        return {
            success: true,
            fileInfo: {
                name: file.name, // Original filename for download prompt
                path: file.path, // Relative path for the API route
                type: file.type, // MIME type for Content-Type header
            },
        };
    } catch (error) {
        console.error(`Error getting download info for file ID ${fileId}:`, error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Download Error', `Server error getting download info for file ID ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', fileId);
        return { success: false, error: 'Failed to process download request.' };
    }
}

// Action for file preview (similar to download, might return a temporary URL or path)
// Note: Actual preview rendering (e.g., for images, PDFs) happens client-side or via a dedicated API route.
// This action primarily handles permission checks.
export async function getPreviewFileInfo(fileId: number): Promise<{ success: boolean; error?: string; fileInfo?: { name: string; path: string; type: string | null } }> {
    const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }
     const ipAddress = getIpAddress();

    try {
        const file = db.prepare('SELECT name, path, type, visibility, uploader_id FROM files WHERE id = ?').get(fileId);

        if (!file) {
            return { success: false, error: 'File not found.' };
        }

        // Check permissions (same as download)
        const userRole = await getUserRole(userId);
        if (file.visibility === 'private' && file.uploader_id !== userId && userRole !== 'admin') {
            db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Access Denied', `User denied preview access to private file '${file.name}' (ID: ${fileId})`, 'security', fileId);
            return { success: false, error: 'Access denied to preview this file.' };
        }

         const absolutePath = path.resolve(process.cwd(), file.path);
         try {
            await fs.access(absolutePath);
        } catch (accessError) {
            console.error(`File record exists (ID: ${fileId}) but file not found on disk for preview: ${absolutePath}`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'File Preview Error', `File data missing on disk for preview '${file.name}' (ID: ${fileId}, Path: ${file.path})`, 'system', fileId);
            return { success: false, error: 'File data is missing.' };
        }

        // Check if file type is previewable (simple check, extend as needed)
        const previewableTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'text/plain'];
        if (!file.type || !previewableTypes.includes(file.type.toLowerCase())) {
            // Return info anyway, let client decide how to handle non-previewable types
             // return { success: false, error: 'File type cannot be previewed directly.' };
        }

         // Log preview attempt (less noisy than download)
        // db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
        //     .run(userId, ipAddress, 'File Preview', `User previewed '${file.name}' (ID: ${fileId})`, 'file', fileId);


        return {
            success: true,
            fileInfo: {
                name: file.name,
                path: file.path, // Relative path for API route
                type: file.type,
            },
        };
    } catch (error) {
        console.error(`Error getting preview info for file ID ${fileId}:`, error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(userId, ipAddress, 'File Preview Error', `Server error getting preview info for file ID ${fileId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', fileId);
        return { success: false, error: 'Failed to process preview request.' };
    }
}
