'use server';

import * as z from "zod";
import db from '@/lib/db';
import { verifyPassword, createSession, deleteSession, hashPassword } from '@/lib/auth';
import { cookies, headers } from 'next/headers'; // Import headers
import { revalidatePath } from "next/cache";

// --- Helper to get IP Address ---
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    // Fallback for local development or environments without these headers
    return cfIp || forwarded || realIp || '::1'; // Use '::1' for IPv6 loopback or '127.0.0.1'
}


// --- Helper to get User ID and Role from Session ---
async function getUserFromSession(): Promise<{ id: number; role: string } | null> {
  const sessionId = cookies().get('session_id')?.value;
  if (!sessionId) return null;

  try {
    const session = db.prepare(`
        SELECT s.user_id, u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
        `).get(sessionId);

    if (session) {
         // Optionally update last_accessed_at - might impact performance
         // db.prepare('UPDATE sessions SET last_accessed_at = CURRENT_TIMESTAMP WHERE session_id = ?').run(sessionId);
        return { id: session.user_id, role: session.role };
    }
    return null;
  } catch (error) {
    console.error('Error fetching session user data:', error);
    return null;
  }
}


// --- Login Action ---
const LoginSchema = z.object({
  username: z.string().min(1, "Username is required."),
  password: z.string().min(1, "Password is required."),
});

export async function loginUser(values: z.infer<typeof LoginSchema>) {
    const ipAddress = getIpAddress();
    const userAgent = headers().get('user-agent') || 'N/A';

    try {
        const validatedFields = LoginSchema.safeParse(values);
        if (!validatedFields.success) {
            return { success: false, error: "Invalid input." };
        }

        const { username, password } = validatedFields.data;

        const user = db.prepare('SELECT id, username, password_hash, role, status FROM users WHERE username = ?').get(username);

        if (!user) {
            console.log(`Login failed: User '${username}' not found.`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
               .run(null, ipAddress, 'Login Failure', `Attempted login for non-existent user '${username}'. UA: ${userAgent}`, 'auth');
            return { success: false, error: "Invalid username or password." };
        }

        if (user.status !== 'active') {
            console.log(`Login failed: User '${username}' is inactive.`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(user.id, ipAddress, 'Login Failure', `Account is inactive. UA: ${userAgent}`, 'auth', user.id);
            return { success: false, error: "Account is inactive." };
        }

        const passwordMatch = verifyPassword(password, user.password_hash);

        if (!passwordMatch) {
            console.log(`Login failed: Incorrect password for user '${username}'.`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(user.id, ipAddress, 'Login Failure', `Incorrect password. UA: ${userAgent}`, 'auth', user.id);
            return { success: false, error: "Invalid username or password." };
        }

        // Check maintenance mode
         const maintenanceMode = db.prepare('SELECT value FROM settings WHERE key = ?').get('maintenanceMode')?.value === 'true';
         if (maintenanceMode && user.role !== 'admin') {
             console.log(`Login failed: Maintenance mode enabled for non-admin user '${username}'.`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                 .run(user.id, ipAddress, 'Login Failure', `Login blocked due to maintenance mode. UA: ${userAgent}`, 'auth', user.id);
             return { success: false, error: "Platform is currently under maintenance. Please try again later." };
         }


        console.log(`Login successful for user '${username}'.`);
        await createSession(user.id, ipAddress, userAgent);

         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(user.id, ipAddress, 'Login Success', `User logged in. UA: ${userAgent}`, 'auth', user.id);

        return { success: true, user: { id: user.id, username: user.username, role: user.role } };

    } catch (error) {
        console.error("Server action loginUser error:", error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
               .run(null, ipAddress, 'Login Error', `Server error during login attempt for '${values.username}': ${error instanceof Error ? error.message : 'Unknown error'}. UA: ${userAgent}`, 'system');
        return { success: false, error: "An internal server error occurred." };
    }
}

// --- Logout Action ---
export async function logoutUser() {
     const ipAddress = getIpAddress();
     const sessionData = await getUserFromSession();
     const userId = sessionData?.id ?? null;
     const sessionId = cookies().get('session_id')?.value;

    try {
        await deleteSession();

         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(userId, ipAddress, 'Logout Success', `User logged out. Session: ${sessionId?.substring(0, 8) ?? 'N/A'}...`, 'auth', userId);

        revalidatePath('/', 'layout'); // Revalidate root layout to ensure redirect if necessary
        return { success: true, message: "Logged out successfully." };
    } catch (error) {
        console.error("Logout error:", error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
               .run(userId, ipAddress, 'Logout Error', `Server error during logout: ${error instanceof Error ? error.message : 'Unknown error'}. Session: ${sessionId?.substring(0, 8) ?? 'N/A'}...`, 'system');
        return { success: false, error: "Failed to logout." };
    }
}


// --- Registration Action (Admin Only) ---
const RegisterSchema = z.object({
  username: z.string().min(3, "Username must be at least 3 characters."),
  email: z.string().email("Invalid email address."),
  password: z.string().min(1, "Password is required."), // Use password policy settings for length
  role: z.enum(['user', 'admin']).default('user'),
});

export async function registerUser(values: z.infer<typeof RegisterSchema>) {
    const ipAddress = getIpAddress();
    const adminUser = await getUserFromSession();

     if (!adminUser) {
        return { success: false, error: "Authentication required." };
    }
    if (adminUser.role !== 'admin') {
          db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to register new user without admin rights`, 'security', adminUser.id);
        return { success: false, error: "Permission denied. Only administrators can create users." };
    }

    // Fetch password policy from settings
    const minLength = parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('passwordMinLength')?.value || '6', 10);

    // Add password length validation based on settings
    const DynamicRegisterSchema = RegisterSchema.extend({
        password: z.string().min(minLength, `Password must be at least ${minLength} characters.`),
    });


    const validatedFields = DynamicRegisterSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid user data.", issues: validatedFields.error.flatten().fieldErrors };
    }

    const { username, email, password, role } = validatedFields.data;

    try {
        const existingUser = db.prepare('SELECT id FROM users WHERE username = ? OR email = ?').get(username, email);
        if (existingUser) {
            return { success: false, error: "Username or email already in use." };
        }

        const passwordHash = hashPassword(password);

        const info = db.prepare(
            'INSERT INTO users (username, email, password_hash, role, status) VALUES (?, ?, ?, ?, ?)'
        ).run(username, email, passwordHash, role, 'active');

        console.log(`Admin ${adminUser.username}(${adminUser.id}) created new user ${username} (ID: ${info.lastInsertRowid}) with role ${role}.`);

         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'User Creation', `Admin created user '${username}' (ID: ${info.lastInsertRowid}) with role '${role}'`, 'admin', info.lastInsertRowid as number);

        revalidatePath('/dashboard/admin/users');
        revalidatePath('/dashboard/users'); // User list page might change

        return { success: true, message: `User '${username}' created successfully.`, newUser: { id: info.lastInsertRowid as number, username, email, role, status: 'active'} };

    } catch (error) {
        console.error("User registration error:", error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'User Creation Error', `Error creating user '${username}': ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin');
        return { success: false, error: "Failed to create user due to a server error." };
    }
}

// --- Update User Status Action (Admin Only) ---
const UpdateStatusSchema = z.object({
    targetUserId: z.number(),
    status: z.enum(['active', 'inactive']),
});

export async function updateUserStatus(values: z.infer<typeof UpdateStatusSchema>) {
    const ipAddress = getIpAddress();
    const adminUser = await getUserFromSession();

    if (!adminUser) return { success: false, error: "Authentication required." };
    if (adminUser.role !== 'admin') {
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to update user status without admin rights`, 'security', adminUser.id);
        return { success: false, error: "Permission denied." };
    }

    const validatedFields = UpdateStatusSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid data." };
    }

    const { targetUserId, status } = validatedFields.data;

    // Prevent admin from deactivating themselves
    if (targetUserId === adminUser.id && status === 'inactive') {
        return { success: false, error: "Administrators cannot deactivate their own account." };
    }

    try {
        const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(targetUserId);
        if (!targetUser) {
            return { success: false, error: "Target user not found." };
        }

        const info = db.prepare('UPDATE users SET status = ? WHERE id = ?').run(status, targetUserId);

        if (info.changes === 0) {
             return { success: false, error: "User status was not changed (maybe it was already set?)." };
        }

        const actionText = status === 'active' ? 'Activated' : 'Deactivated';
        console.log(`Admin ${adminUser.username}(${adminUser.id}) ${actionText.toLowerCase()} user ${targetUser.username} (ID: ${targetUserId}).`);

        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
              .run(adminUser.id, ipAddress, `User Status ${actionText}`, `Admin ${actionText.toLowerCase()} user '${targetUser.username}' (ID: ${targetUserId})`, 'admin', targetUserId);

        revalidatePath('/dashboard/admin/users');
        revalidatePath('/dashboard/users');

        return { success: true, message: `User '${targetUser.username}' has been ${status}.` };

    } catch (error) {
        console.error("Update user status error:", error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'User Status Update Error', `Error updating status for user ID ${targetUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin', targetUserId);
        return { success: false, error: "Failed to update user status." };
    }
}


// --- Reset User Password Action (Admin Only) ---
const ResetPasswordSchema = z.object({
    targetUserId: z.number(),
    newPassword: z.string().min(1, "New password is required."), // Use policy settings
});

export async function resetUserPassword(values: z.infer<typeof ResetPasswordSchema>) {
    const ipAddress = getIpAddress();
    const adminUser = await getUserFromSession();

    if (!adminUser) return { success: false, error: "Authentication required." };
    if (adminUser.role !== 'admin') {
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to reset password without admin rights`, 'security', adminUser.id);
        return { success: false, error: "Permission denied." };
    }

     // Fetch password policy from settings
    const minLength = parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('passwordMinLength')?.value || '6', 10);

    const DynamicResetPasswordSchema = ResetPasswordSchema.extend({
        newPassword: z.string().min(minLength, `New password must be at least ${minLength} characters.`),
    });


    const validatedFields = DynamicResetPasswordSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid data.", issues: validatedFields.error.flatten().fieldErrors };
    }

    const { targetUserId, newPassword } = validatedFields.data;

    try {
        const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(targetUserId);
        if (!targetUser) {
            return { success: false, error: "Target user not found." };
        }

        const newPasswordHash = hashPassword(newPassword);
        const info = db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newPasswordHash, targetUserId);

        if (info.changes === 0) {
             return { success: false, error: "Password was not updated." }; // Should not happen if user exists
        }

        console.log(`Admin ${adminUser.username}(${adminUser.id}) reset password for user ${targetUser.username} (ID: ${targetUserId}).`);

        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
              .run(adminUser.id, ipAddress, 'Password Reset', `Admin reset password for user '${targetUser.username}' (ID: ${targetUserId})`, 'admin', targetUserId);

        // Force logout the target user's active sessions
         try {
             const sessionsDeleted = db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId).changes;
             if (sessionsDeleted > 0) {
                 console.log(`Terminated ${sessionsDeleted} active session(s) for user ${targetUser.username} after password reset.`);
                 db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(adminUser.id, ipAddress, 'Session Termination', `Terminated ${sessionsDeleted} session(s) for user '${targetUser.username}' due to password reset`, 'security', targetUserId);
            }
        } catch (sessionError) {
             console.error(`Failed to terminate sessions for user ${targetUserId}:`, sessionError);
              db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                   .run(adminUser.id, ipAddress, 'Session Termination Error', `Failed to terminate sessions for user '${targetUser.username}' after password reset: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`, 'security', targetUserId);
        }


        revalidatePath('/dashboard/admin/users');

        return { success: true, message: `Password for user '${targetUser.username}' has been reset successfully.` };

    } catch (error) {
        console.error("Reset password error:", error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'Password Reset Error', `Error resetting password for user ID ${targetUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin', targetUserId);
        return { success: false, error: "Failed to reset password." };
    }
}

// --- Update User Profile Action (Admin Only) ---
const UpdateProfileSchema = z.object({
    targetUserId: z.number(),
    username: z.string().min(3, "Username must be at least 3 characters.").optional(),
    email: z.string().email("Invalid email address.").optional(),
    role: z.enum(['user', 'admin']).optional(),
    // Add other editable fields here if needed (e.g., name, contact details)
});

export async function updateUserProfile(values: z.infer<typeof UpdateProfileSchema>) {
    const ipAddress = getIpAddress();
    const adminUser = await getUserFromSession();

    if (!adminUser) return { success: false, error: "Authentication required." };
    if (adminUser.role !== 'admin') {
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to update profile without admin rights`, 'security', adminUser.id);
        return { success: false, error: "Permission denied." };
    }

    const validatedFields = UpdateProfileSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid data.", issues: validatedFields.error.flatten().fieldErrors };
    }

    const { targetUserId, ...updates } = validatedFields.data;

    if (Object.keys(updates).length === 0) {
        return { success: false, error: "No changes provided." };
    }

     // Prevent admin from changing their own role or the role of the initial seeded admin (ID 1) to non-admin
     const isChangingOwnRole = targetUserId === adminUser.id && updates.role && updates.role !== 'admin';
     const isDemotingSeededAdmin = targetUserId === 1 && updates.role && updates.role !== 'admin'; // Assuming seeded admin ID is 1

     if (isChangingOwnRole) {
         return { success: false, error: "Administrators cannot change their own role." };
     }
     if (isDemotingSeededAdmin) {
         return { success: false, error: "The initial administrator account's role cannot be changed." };
     }

    try {
         const targetUser = db.prepare('SELECT username, email, role FROM users WHERE id = ?').get(targetUserId);
        if (!targetUser) {
            return { success: false, error: "Target user not found." };
        }

        // Check for unique constraints if username/email are being changed
        if (updates.username && updates.username !== targetUser.username) {
            const existing = db.prepare('SELECT id FROM users WHERE username = ? AND id != ?').get(updates.username, targetUserId);
            if (existing) return { success: false, error: "Username already in use." };
        }
        if (updates.email && updates.email !== targetUser.email) {
            const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(updates.email, targetUserId);
            if (existing) return { success: false, error: "Email already in use." };
        }


        // Build the SET part of the SQL query dynamically
        const setClauses: string[] = [];
        const params: (string | number)[] = [];
        const changedFieldsList: string[] = []; // For logging

        Object.entries(updates).forEach(([key, value]) => {
            if (value !== undefined) { // Only include fields that are being updated
                setClauses.push(`${key} = ?`);
                params.push(value);
                 changedFieldsList.push(key);
            }
        });

        if (setClauses.length === 0) {
             return { success: false, error: "No valid changes provided." };
        }

        params.push(targetUserId); // Add the user ID for the WHERE clause

        const sql = `UPDATE users SET ${setClauses.join(', ')} WHERE id = ?`;
        const info = db.prepare(sql).run(...params);

        if (info.changes === 0) {
             // This could happen if the provided values are the same as existing ones. Treat as success.
             console.log(`No actual DB change for user ${targetUser.username} profile update, but request was valid.`);
             return { success: true, message: `No changes detected for user '${targetUser.username}'.` };
            // return { success: false, error: "User profile was not updated (no changes detected)." };
        }

        // Create a detailed log message
        const changedFields = changedFieldsList.join(', ');
        console.log(`Admin ${adminUser.username}(${adminUser.id}) updated profile for user ${targetUser.username} (ID: ${targetUserId}). Changed fields: ${changedFields}`);

        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
              .run(adminUser.id, ipAddress, 'Profile Update', `Admin updated profile for user '${targetUser.username}' (ID: ${targetUserId}). Fields: ${changedFields}`, 'admin', targetUserId);

        revalidatePath('/dashboard/admin/users');
        revalidatePath('/dashboard/users');
        // If editing own profile, maybe revalidate more specific paths
        if (targetUserId === adminUser.id) {
             revalidatePath('/dashboard/layout'); // Update layout potentially showing user info
        }

        return { success: true, message: `Profile for user '${targetUser.username}' updated successfully.` };

    } catch (error) {
        console.error("Update profile error:", error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'Profile Update Error', `Error updating profile for user ID ${targetUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin', targetUserId);
        return { success: false, error: "Failed to update user profile." };
    }
}

// --- Delete User Action (Admin Only) ---
const DeleteUserSchema = z.object({
    targetUserId: z.number(),
});

export async function deleteUser(values: z.infer<typeof DeleteUserSchema>) {
    const ipAddress = getIpAddress();
    const adminUser = await getUserFromSession();

    if (!adminUser) return { success: false, error: "Authentication required." };
    if (adminUser.role !== 'admin') {
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to delete user without admin rights`, 'security', adminUser.id);
        return { success: false, error: "Permission denied." };
    }

    const validatedFields = DeleteUserSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid data." };
    }

    const { targetUserId } = validatedFields.data;

    // Prevent admin from deleting themselves or the initial seeded admin (ID 1)
    if (targetUserId === adminUser.id) {
        return { success: false, error: "Administrators cannot delete their own account." };
    }
    if (targetUserId === 1) { // Assuming seeded admin ID is 1
        return { success: false, error: "The initial administrator account cannot be deleted." };
    }

    try {
        const targetUser = db.prepare('SELECT username FROM users WHERE id = ?').get(targetUserId);
        if (!targetUser) {
            return { success: false, error: "Target user not found." };
        }

        // Use a transaction to ensure atomicity
        const deleteTx = db.transaction(() => {
            // Manually handle potential foreign key issues if ON DELETE SET NULL/CASCADE isn't fully covering needs
            // Example: Reassign ownership of files or delete them? Current setup uses ON DELETE SET NULL for files.

            // Delete user sessions first
            db.prepare('DELETE FROM sessions WHERE user_id = ?').run(targetUserId);

            // Delete notifications for the user
            db.prepare('DELETE FROM notifications WHERE user_id = ?').run(targetUserId);

            // Delete the user record (will trigger ON DELETE SET NULL/CASCADE for files, messages, logs)
            const info = db.prepare('DELETE FROM users WHERE id = ?').run(targetUserId);
            if (info.changes === 0) {
                throw new Error('User not found during transaction.');
            }

            // Potentially clean up related files physically if needed (outside transaction?)
            // Note: File deletion logic might need adjustment if files should remain but be unlinked.
             // Currently, files remain with uploader_id = NULL. This might require a separate cleanup task.
        });

        deleteTx();

        console.log(`Admin ${adminUser.username}(${adminUser.id}) deleted user ${targetUser.username} (ID: ${targetUserId}).`);

        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
              .run(adminUser.id, ipAddress, 'User Deletion', `Admin deleted user '${targetUser.username}' (ID: ${targetUserId})`, 'admin', targetUserId);

        revalidatePath('/dashboard/admin/users');
        revalidatePath('/dashboard/users'); // User list page
        // Revalidate other areas potentially affected by user deletion (e.g., file lists, chat if showing deleted user names)
        revalidatePath('/dashboard/files');
        revalidatePath('/dashboard/admin/files');
        revalidatePath('/dashboard/chat');

        return { success: true, message: `User '${targetUser.username}' has been deleted.` };

    } catch (error) {
        console.error("Delete user error:", error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(adminUser.id, ipAddress, 'User Deletion Error', `Error deleting user ID ${targetUserId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin', targetUserId);
        return { success: false, error: "Failed to delete user." };
    }
}

// --- Update Own Profile Action ---
const UpdateOwnProfileSchema = z.object({
    // Only allow changing email or password for self-update
    email: z.string().email("Invalid email address.").optional(),
    currentPassword: z.string().optional(), // Required if changing password
    newPassword: z.string().optional(), // Required if changing password
});

export async function updateOwnProfile(values: z.infer<typeof UpdateOwnProfileSchema>) {
    const ipAddress = getIpAddress();
    const currentUser = await getUserFromSession();

    if (!currentUser) {
        return { success: false, error: "Authentication required." };
    }

    const validatedFields = UpdateOwnProfileSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid data.", issues: validatedFields.error.flatten().fieldErrors };
    }

    const { email, currentPassword, newPassword } = validatedFields.data;
    const userId = currentUser.id;

    if (!email && !newPassword) {
        return { success: false, error: "No changes provided." };
    }

    try {
        const user = db.prepare('SELECT username, email, password_hash FROM users WHERE id = ?').get(userId);
        if (!user) {
            // Should not happen if session is valid
            return { success: false, error: "User not found." };
        }

        const updates: Record<string, string> = {};
        const logDetailsParts: string[] = [];

        // Handle Email Change
        if (email && email !== user.email) {
            const existing = db.prepare('SELECT id FROM users WHERE email = ? AND id != ?').get(email, userId);
            if (existing) {
                return { success: false, error: "Email address already in use." };
            }
            updates.email = email;
            logDetailsParts.push('email');
        }

        // Handle Password Change
        if (newPassword) {
            if (!currentPassword) {
                return { success: false, error: "Current password is required to set a new password." };
            }

            // Verify current password
            if (!verifyPassword(currentPassword, user.password_hash)) {
                 db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                    .run(userId, ipAddress, 'Profile Update Failure', `Attempted password change with incorrect current password`, 'security', userId);
                return { success: false, error: "Incorrect current password." };
            }

            // Check password policy for new password
             const minLength = parseInt(db.prepare('SELECT value FROM settings WHERE key = ?').get('passwordMinLength')?.value || '6', 10);
             if (newPassword.length < minLength) {
                 return { success: false, error: `New password must be at least ${minLength} characters.` };
             }
             // Add more policy checks here (uppercase, number, special) if implemented

            updates.password_hash = hashPassword(newPassword);
            logDetailsParts.push('password');
        }

        if (Object.keys(updates).length === 0) {
            return { success: true, message: "No changes detected." }; // No actual update needed
        }

        // Build and execute the update query
        const setClauses = Object.keys(updates).map(key => `${key} = ?`).join(', ');
        const params = [...Object.values(updates), userId];
        const sql = `UPDATE users SET ${setClauses} WHERE id = ?`;

        const info = db.prepare(sql).run(...params);

        if (info.changes > 0) {
            const changedFields = logDetailsParts.join(', ');
            console.log(`User ${user.username}(${userId}) updated their profile. Changed fields: ${changedFields}`);
             db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'Profile Self-Update', `User updated their profile. Fields: ${changedFields}`, 'auth', userId);

            // If password changed, terminate other sessions
             if (updates.password_hash) {
                  const currentSessionId = cookies().get('session_id')?.value;
                  try {
                      const sessionsDeleted = db.prepare('DELETE FROM sessions WHERE user_id = ? AND session_id != ?')
                                              .run(userId, currentSessionId ?? '').changes;
                     if (sessionsDeleted > 0) {
                         console.log(`Terminated ${sessionsDeleted} other active session(s) for user ${user.username} after password change.`);
                         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                            .run(userId, ipAddress, 'Session Termination', `Terminated ${sessionsDeleted} other session(s) due to password change`, 'security', userId);
                     }
                 } catch (sessionError) {
                     console.error(`Failed to terminate other sessions for user ${userId}:`, sessionError);
                      db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                           .run(userId, ipAddress, 'Session Termination Error', `Failed to terminate other sessions after password change: ${sessionError instanceof Error ? sessionError.message : 'Unknown error'}`, 'security', userId);
                 }
             }


            revalidatePath('/dashboard/layout'); // Update layout potentially showing user info
            revalidatePath('/dashboard/settings'); // Update settings page if that's where this happens
            return { success: true, message: "Profile updated successfully." };
        } else {
            // Should ideally not happen if changes were detected, but handle just in case
            return { success: false, error: "Profile update failed unexpectedly." };
        }

    } catch (error) {
        console.error("Update own profile error:", error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
           .run(userId, ipAddress, 'Profile Self-Update Error', `Error updating own profile: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', userId);
        return { success: false, error: "Failed to update profile due to a server error." };
    }
}
