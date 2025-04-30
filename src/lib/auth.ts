// src/lib/auth.ts
import crypto from 'crypto';
import db from './db'; // Import the database instance
import { cookies } from 'next/headers';
import { NextApiResponse } from 'next';

/**
 * Hashes a password using SHA256.
 * @param password The plain text password.
 * @returns The SHA256 hash as a hexadecimal string.
 */
export function hashPassword(password: string): string {
  const hash = crypto.createHash('sha256');
  hash.update(password);
  return hash.digest('hex');
}

/**
 * Verifies a password against a stored SHA256 hash.
 * @param password The plain text password to verify.
 * @param storedHash The stored SHA256 hash.
 * @returns True if the password matches the hash, false otherwise.
 */
export function verifyPassword(password: string, storedHash: string): boolean {
  const inputHash = hashPassword(password);
  // Basic timing attack protection (compare hashes securely)
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(storedHash));
}


/**
 * Creates a new session for a user and sets the session cookie.
 * Includes IP address and User Agent in the session record.
 * @param userId The ID of the user to create a session for.
 * @param ipAddress The IP address of the user logging in.
 * @param userAgent The User Agent string of the user's browser.
 * @returns The session ID.
 */
export async function createSession(userId: number, ipAddress: string, userAgent: string): Promise<string> {
  const sessionId = crypto.randomBytes(32).toString('hex');
  const sessionTimeoutMinutes = parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('sessionTimeoutMinutes')?.value || '30', 10);
  const expiresAt = new Date(Date.now() + sessionTimeoutMinutes * 60 * 1000); // Default 30 minutes
  const now = new Date().toISOString();

  try {
    // Insert the new session into the database, including IP and User Agent
    db.prepare(`
      INSERT INTO sessions
      (session_id, user_id, expires_at, created_at, last_accessed_at, ip_address, user_agent)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(sessionId, userId, expiresAt.toISOString(), now, now, ipAddress, userAgent);

    // Set the session cookie using 'next/headers' cookies() for Server Actions/Components
    cookies().set('session_id', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Use secure cookies in production
      expires: expiresAt,
      path: '/',
      sameSite: 'lax', // Or 'strict'
    });

    console.log(`Session created for user ${userId} from ${ipAddress}, expires at ${expiresAt.toISOString()}`);
    return sessionId;
  } catch (error) {
    console.error(`Failed to create session for user ${userId}:`, error);
    throw new Error('Session creation failed.');
  }
}


/**
 * Deletes a session from the database and clears the session cookie.
 */
export async function deleteSession(): Promise<void> {
    const sessionId = cookies().get('session_id')?.value;
    if (!sessionId) {
        console.log("No session ID found in cookies to delete.");
        return; // No session to delete
    }

    try {
        // Delete the session from the database
        const info = db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
        if (info.changes > 0) {
             console.log(`Session ${sessionId} deleted from database.`);
        } else {
            console.log(`Session ${sessionId} not found in database or already deleted.`);
        }


        // Clear the session cookie by setting an expired date
        cookies().set('session_id', '', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            expires: new Date(0), // Set expiry date to the past
            path: '/',
            sameSite: 'lax',
        });

        console.log(`Session cookie cleared for ${sessionId}`);

    } catch (error) {
        console.error(`Failed to delete session ${sessionId}:`, error);
        // Don't necessarily throw an error here, as the cookie might still be clearable
        // Clear the cookie even if DB deletion fails
         try {
             cookies().set('session_id', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                expires: new Date(0),
                path: '/',
                sameSite: 'lax',
            });
            console.log(`Forcefully cleared session cookie for ${sessionId} after DB error.`);
         } catch (cookieError) {
             console.error(`Failed to clear session cookie after DB error for ${sessionId}:`, cookieError);
         }
    }
}

// --- Verify Session (Example for API Routes/Middleware if needed later) ---
/**
 * Verifies if a given session ID is valid and not expired.
 * Optionally updates the last_accessed_at timestamp.
 * @param sessionId The session ID to verify.
 * @returns The user ID if the session is valid, otherwise null.
 */
export function verifySession(sessionId: string): number | null {
    if (!sessionId) return null;

    try {
        const session = db.prepare(
            'SELECT user_id, expires_at FROM sessions WHERE session_id = ?'
        ).get(sessionId);

        if (!session) return null; // Session not found

        if (new Date(session.expires_at) < new Date()) {
             // Session expired, delete it
            db.prepare('DELETE FROM sessions WHERE session_id = ?').run(sessionId);
            return null;
        }

         // Optionally update last accessed time
         // db.prepare('UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);

        return session.user_id;

    } catch (error) {
        console.error(`Error verifying session ${sessionId}:`, error);
        return null;
    }
}
