// src/actions/settings.ts
'use server';

import db from '@/lib/db';
import { cookies, headers } from 'next/headers';
import { revalidatePath } from 'next/cache';
import * as z from 'zod';

// Helper to get IP Address
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    return cfIp || forwarded || realIp || '::1'; // Fallback for local
}


// Helper to get user ID and Role from Session (securely)
async function getUserFromSession(): Promise<{ id: number; role: string; username: string } | null> {
  const sessionId = cookies().get('session_id')?.value;
  if (!sessionId) return null;

  try {
    const session = db.prepare(`
        SELECT s.user_id, u.role, u.username
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
        `).get(sessionId);

    if (session) {
        return { id: session.user_id, role: session.role, username: session.username };
    }
    return null;
  } catch (error) {
    console.error('Error fetching session user data for settings:', error);
    return null;
  }
}


// --- Get Settings Action (Admin Only) ---
export async function getSettings(): Promise<{ success: boolean; settings?: Record<string, string>; error?: string }> {
    const adminUser = await getUserFromSession();

    if (!adminUser) {
        return { success: false, error: "Authentication required." };
    }
    if (adminUser.role !== 'admin') {
        return { success: false, error: "Permission denied. Administrator access required." };
    }

    try {
        const settingsData = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
        const settings = settingsData.reduce((acc, setting) => {
            acc[setting.key] = setting.value;
            return acc;
        }, {} as Record<string, string>);

        return { success: true, settings };

    } catch (error) {
        console.error("Error fetching settings:", error);
        const ipAddress = getIpAddress();
         // Log only if logs table likely exists (DB connection is open)
         if (db && db.open) {
            db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
              .run(adminUser.id, ipAddress, 'Settings Fetch Error', `Admin failed to fetch settings: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
         }
        return { success: false, error: "Failed to retrieve settings." };
    }
}


// --- Update Settings Action (Admin Only) ---
// Define expected setting keys and their types for validation
const SettingUpdateSchema = z.object({
    fileSizeLimitMB: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1).max(10)), // Enforce max 10MB
    storageQuotaMB: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(10)),
    allowedFileTypes: z.string().transform(val => val.split(',').map(s => s.trim().toLowerCase().replace(/^\./, '')).filter(Boolean).join(', ')), // Normalize
    maintenanceMode: z.enum(['true', 'false']),
    sessionTimeoutMinutes: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(5)),
    passwordMinLength: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(1)), // Removed min 6, set to 1 as per user request
    // Removed complexity settings as they are no longer in DB schema
    // passwordRequireUppercase: z.enum(['true', 'false']),
    // passwordRequireNumber: z.enum(['true', 'false']),
    // passwordRequireSpecial: z.enum(['true', 'false']),
    passwordExpiryDays: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().min(0)),
});

// Allow any string key, but validate known ones
const UpdateSettingsSchema = z.record(z.string(), z.string()).refine(data => {
    // Validate known keys against their specific schemas
    const knownKeys = Object.keys(SettingUpdateSchema.shape);
    for (const key of knownKeys) {
        if (data[key] !== undefined) {
            // Check if the key actually exists in the schema shape before parsing
             const shape = SettingUpdateSchema.shape[key as keyof typeof SettingUpdateSchema.shape];
             if (shape) { // Only parse if the key is defined in the schema
                 const result = shape.safeParse(data[key]);
                if (!result.success) {
                    console.error(`Validation failed for setting '${key}':`, result.error);
                    return false; // Stop refinement on first error
                }
                // Use transformed value for subsequent checks if needed
                data[key] = String(result.data); // Ensure it's back to string for DB
            }
        }
    }
    return true;
 }, {
    message: "One or more settings have invalid values.",
    // Path is not easily specified for record validation errors like this
 });


export async function updateSettings(settings: Record<string, string>): Promise<{ success: boolean; error?: string }> {
    const adminUser = await getUserFromSession();
    const ipAddress = getIpAddress();

    if (!adminUser) {
        return { success: false, error: "Authentication required." };
    }
    if (adminUser.role !== 'admin') {
         // Log only if logs table likely exists (DB connection is open)
         if (db && db.open) {
            db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to update settings without admin rights`, 'security', adminUser.id);
         }
        return { success: false, error: "Permission denied. Administrator access required." };
    }

    const validatedSettings = UpdateSettingsSchema.safeParse(settings);

    if (!validatedSettings.success) {
        console.error("Settings validation failed:", validatedSettings.error.flatten());
         // Find the first specific error message if possible
         const firstIssue = validatedSettings.error.issues[0];
         const errorMessage = firstIssue ? `Invalid value for setting '${firstIssue.path.join('.')}': ${firstIssue.message}` : "Invalid setting values.";
        return { success: false, error: errorMessage };
    }

     const settingsToUpdate = validatedSettings.data;

    try {
        // Use a transaction to update all settings atomically
        const updateTx = db.transaction((updates: Record<string, string>) => {
            const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)');
            let changesMade = 0;
            for (const key in updates) {
                // Only update keys that are defined in our schema to prevent arbitrary writes
                 if (!(key in SettingUpdateSchema.shape)) {
                    console.warn(`Skipping update for unknown setting key: ${key}`);
                    continue;
                 }

                // Fetch current value to log changes accurately
                 const currentSetting = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
                 const oldValue = currentSetting?.value;
                 const newValue = updates[key];

                if (oldValue !== newValue) {
                    stmt.run(key, newValue);
                    changesMade++;
                     // Log individual setting change
                     db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
                       .run(adminUser.id, ipAddress, 'Setting Change', `Admin updated setting '${key}' from '${oldValue ?? '[not set]'}' to '${newValue}'`, 'admin');
                }
            }
            return changesMade;
        });

        const changes = updateTx(settingsToUpdate);

        console.log(`Admin ${adminUser.username}(${adminUser.id}) updated ${changes} system settings.`);

        // Revalidate relevant paths if settings affect UI/behavior immediately
        revalidatePath('/dashboard/admin/settings');
        // Revalidate other paths if necessary (e.g., file upload if limits changed)
        revalidatePath('/dashboard/files');
        revalidatePath('/dashboard/admin/files');

        return { success: true };

    } catch (error) {
        console.error("Error updating settings:", error);
        // Log only if logs table likely exists
        if (db && db.open) {
            db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
            .run(adminUser.id, ipAddress, 'Settings Update Error', `Admin failed to update settings: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
        }
        return { success: false, error: "Failed to update settings due to a server error." };
    }
}
