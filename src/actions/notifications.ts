// src/actions/notifications.ts
'use server';

import db from '@/lib/db';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers'; // Import headers
import * as z from 'zod';

// Helper to get user ID from session (copy from other action files)
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

// Helper to get IP Address
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    return cfIp || forwarded || realIp || '::1'; // Fallback for local
}


// --- Create Notification Action ---
// This is typically called internally by other actions (e.g., sendMessage, shareFile)
const CreateNotificationSchema = z.object({
    userId: z.number(),
    type: z.string().min(1), // e.g., 'message', 'file_share', 'system'
    text: z.string().min(1).max(255), // Limit text length
    resourceId: z.number().optional().nullable(), // Optional ID of related item
});

export async function createNotification(values: z.infer<typeof CreateNotificationSchema>) {
     const validatedFields = CreateNotificationSchema.safeParse(values);
    if (!validatedFields.success) {
        console.error("Invalid notification data:", validatedFields.error.flatten().fieldErrors);
        // Don't return error to client, just log internal issue
        return;
    }
    const { userId, type, text, resourceId } = validatedFields.data;
    // IP might not be relevant here, but included for logging consistency if called from a request context
    // const ipAddress = getIpAddress();

     try {
         // Avoid creating duplicate notifications too quickly (optional)
         const recentNotification = db.prepare(`
            SELECT id FROM notifications
            WHERE user_id = ? AND type = ? AND text = ? AND resource_id ${resourceId ? '= ?' : 'IS NULL'}
            AND created_at > datetime('now', '-5 minutes')
            LIMIT 1
         `).get(userId, type, text, ...(resourceId ? [resourceId] : []));

         if (recentNotification) {
             console.log(`Skipping duplicate notification for user ${userId}`);
             return;
         }


        const stmt = db.prepare(`
            INSERT INTO notifications (user_id, type, text, resource_id)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(userId, type, text, resourceId ?? null);
        const notificationId = info.lastInsertRowid as number;
        console.log(`Notification created (ID: ${notificationId}) for user ${userId}`);

        // Log notification creation (optional, can be noisy)
        // db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
        //        .run(null, 'N/A', 'Notification Created', `Created notification for user ${userId}: ${text}`, 'notification', notificationId);

        // Revalidate the notifications page for the target user
        // Note: Revalidating a specific user's path might be complex if not structured that way.
        // Revalidating the general path might be sufficient.
        revalidatePath('/dashboard/notifications');

    } catch (error) {
        console.error(`Error creating notification for user ${userId}:`, error);
         // Consider logging this error to the main logs table
         // db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
         //       .run(null, 'N/A', 'Notification Creation Error', `Error for user ${userId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
    }
}


// --- Fetch Notifications Action ---
interface NotificationData {
    id: number;
    type: string;
    text: string;
    resource_id: number | null;
    read_status: boolean;
    created_at: string; // ISO 8601 string
    time_ago: string; // Formatted time string
}

export async function getNotifications(): Promise<{ success: boolean; notifications?: NotificationData[]; unreadCount?: number; error?: string }> {
    const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }

    try {
        const stmt = db.prepare(`
            SELECT id, type, text, resource_id, read_status, created_at
            FROM notifications
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT 50 -- Limit the number of notifications fetched
        `);
        const rawNotifications: Omit<NotificationData, 'time_ago'>[] = stmt.all(userId) as any;

         // Get unread count separately (more efficient than filtering in JS)
        const unreadResult = db.prepare('SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND read_status = 0').get(userId) as { count: number };
        const unreadCount = unreadResult.count;


        // Format timestamp into a readable "time ago" format
        const notifications = rawNotifications.map(n => ({
            ...n,
            read_status: Boolean(n.read_status), // Ensure boolean
            time_ago: formatTimeAgo(n.created_at),
        }));


        return { success: true, notifications, unreadCount };

    } catch (error) {
        console.error(`Error fetching notifications for user ${userId}:`, error);
         const ipAddress = getIpAddress();
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(userId, ipAddress, 'Notification Fetch Error', `Error fetching notifications: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', userId);
        return { success: false, error: 'Failed to fetch notifications.' };
    }
}


// --- Mark Notification As Read Action ---
const MarkReadSchema = z.object({
    notificationId: z.number().optional(), // If provided, mark specific one
    markAll: z.boolean().optional(), // If true, mark all as read
});

export async function markNotificationsRead(values: z.infer<typeof MarkReadSchema>): Promise<{ success: boolean; error?: string }> {
    const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }

     const validatedFields = MarkReadSchema.safeParse(values);
    if (!validatedFields.success || (!validatedFields.data.notificationId && !validatedFields.data.markAll)) {
        return { success: false, error: "Invalid request." };
    }

    const { notificationId, markAll } = validatedFields.data;
    const ipAddress = getIpAddress();

    try {
        let stmt;
        let info;
        let logDetails;
        let resourceId: number | null = null;

        if (markAll) {
            stmt = db.prepare('UPDATE notifications SET read_status = 1 WHERE user_id = ? AND read_status = 0');
            info = stmt.run(userId);
            logDetails = `Marked all unread notifications as read (${info.changes} updated)`;
            resourceId = null; // Not specific to one resource
        } else if (notificationId) {
            stmt = db.prepare('UPDATE notifications SET read_status = 1 WHERE id = ? AND user_id = ? AND read_status = 0');
            info = stmt.run(notificationId, userId);
             logDetails = `Marked notification ID ${notificationId} as read`;
             resourceId = notificationId;
        } else {
             return { success: false, error: "No specific notification ID or 'markAll' flag provided." };
        }

        if (info.changes > 0) {
             console.log(`Mark notifications read for user ${userId}: ${logDetails}.`);

            db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                .run(userId, ipAddress, 'Notification Read', logDetails, 'notification', resourceId);

            // Revalidate the notifications page
            revalidatePath('/dashboard/notifications');
        }


        return { success: true };

    } catch (error) {
        console.error(`Error marking notifications read for user ${userId}:`, error);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(userId, ipAddress, 'Notification Read Error', `Error marking notifications read: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', userId);
        return { success: false, error: 'Failed to update notification status.' };
    }
}

// --- Delete Notification Action ---
const DeleteNotificationSchema = z.object({
    notificationId: z.number(),
});

export async function deleteNotification(values: z.infer<typeof DeleteNotificationSchema>): Promise<{ success: boolean; error?: string }> {
     const userId = await getUserIdFromSession();
    if (!userId) {
        return { success: false, error: 'Authentication required.' };
    }

    const validatedFields = DeleteNotificationSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid request." };
    }

    const { notificationId } = validatedFields.data;
    const ipAddress = getIpAddress();

     try {
         const stmt = db.prepare('DELETE FROM notifications WHERE id = ? AND user_id = ?');
         const info = stmt.run(notificationId, userId);

         if (info.changes === 0) {
             // Could be already deleted, or belong to another user. Don't treat as error.
             console.log(`Notification ID ${notificationId} not found or not owned by user ${userId} for deletion.`);
             // return { success: false, error: 'Notification not found or permission denied.' };
             return { success: true }; // Return success even if not found/deleted
         }

        console.log(`Deleted notification ID ${notificationId} for user ${userId}`);
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(userId, ipAddress, 'Notification Delete', `Deleted notification ID ${notificationId}`, 'notification', notificationId);

        revalidatePath('/dashboard/notifications');
        return { success: true };

    } catch (error) {
        console.error(`Error deleting notification ID ${notificationId} for user ${userId}:`, error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(userId, ipAddress, 'Notification Delete Error', `Error deleting notification ID ${notificationId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system', notificationId);
        return { success: false, error: 'Failed to delete notification.' };
    }
}


// --- Helper: Format Time Ago ---
// Simple time ago formatter (can be replaced with a library like date-fns if preferred)
function formatTimeAgo(isoTimestamp: string): string {
    const date = new Date(isoTimestamp);
    const now = new Date();
    const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

    if (isNaN(seconds) || seconds < 0) { // Handle invalid or future dates
        return "just now";
    }

    let interval = seconds / 31536000; // years
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000; // months
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400; // days
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600; // hours
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60; // minutes
    if (interval > 1) return Math.floor(interval) + "m ago";
    if (seconds < 10) return "just now";
    return Math.floor(seconds) + "s ago";
}
