// src/actions/chat.ts
'use server';

import * as z from 'zod';
import db from '@/lib/db';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';
import { createNotification } from './notifications'; // Import notification action
import { headers } from 'next/headers'; // Import headers

// Helper to get user ID and Role from session
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
        return { id: session.user_id, role: session.role };
    }
    return null;
  } catch (error) {
    console.error('Error fetching session user data:', error);
    return null;
  }
}

// Helper to get Username from User ID
async function getUsernameById(userId: number): Promise<string | null> {
    try {
        const user = db.prepare('SELECT username FROM users WHERE id = ?').get(userId);
        return user?.username ?? `User ${userId}`; // Fallback
    } catch (error) {
        console.error(`Error fetching username for ID ${userId}:`, error);
        return `User ${userId}`;
    }
}


// Helper to get IP Address
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    return cfIp || forwarded || realIp || '::1'; // Fallback for local
}


// --- Send Message Action ---
const SendMessageSchema = z.object({
  text: z.string().min(1, "Message cannot be empty.").max(1000, "Message is too long."), // Increased max length
  roomType: z.enum(['public', 'private']),
  recipientId: z.number().optional(), // Required if roomType is 'private'
});

export async function sendMessage(values: z.infer<typeof SendMessageSchema>) {
    const senderSession = await getUserFromSession();
    if (!senderSession) {
        return { success: false, error: 'Authentication required.' };
    }
    const senderId = senderSession.id;

    const validatedFields = SendMessageSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid message data.", issues: validatedFields.error.flatten().fieldErrors };
    }

    const { text, roomType, recipientId } = validatedFields.data;
    const ipAddress = getIpAddress();

    // Sanitize input text (basic example, consider a library like DOMPurify if rendering HTML)
    const sanitizedText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");


    if (roomType === 'private' && !recipientId) {
        return { success: false, error: 'Recipient ID is required for private messages.' };
    }

     if (roomType === 'private' && recipientId === senderId) {
        return { success: false, error: 'Cannot send private message to yourself.' };
    }

    // Check if recipient exists and is active for private messages
     if (roomType === 'private' && recipientId) {
         try {
             const recipient = db.prepare('SELECT status FROM users WHERE id = ?').get(recipientId);
             if (!recipient) {
                 return { success: false, error: 'Recipient user not found.' };
             }
             if (recipient.status !== 'active') {
                 return { success: false, error: 'Recipient user is currently inactive.' };
             }
         } catch (e) {
             return { success: false, error: 'Could not verify recipient.' };
         }
     }


    try {
        const stmt = db.prepare(`
            INSERT INTO messages (sender_id, recipient_id, text, room_type)
            VALUES (?, ?, ?, ?)
        `);
        const info = stmt.run(senderId, roomType === 'private' ? recipientId : null, sanitizedText, roomType);
        const messageId = info.lastInsertRowid as number;

        console.log(`Message sent (ID: ${messageId}), Type: ${roomType}, Sender: ${senderId}${roomType === 'private' ? `, Recipient: ${recipientId}` : ''}`);

        // Log the message action
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
               .run(senderId, ipAddress, 'Message Sent', `Sent message in ${roomType === 'public' ? 'Public Chat' : `Private Chat with user ${recipientId}`}`, 'chat', messageId);


        // Create notification for recipient in private messages
        if (roomType === 'private' && recipientId) {
            const senderUsername = await getUsernameById(senderId); // Use await here
            await createNotification({
                userId: recipientId,
                type: 'message',
                text: `${senderUsername} sent you a private message.`,
                resourceId: messageId, // Pass message ID
            });
        }

        // Revalidate chat paths (can be specific if needed)
        revalidatePath('/dashboard/chat'); // Revalidate public chat
        if (roomType === 'private') {
             // TODO: Refine revalidation for private chats if using dynamic routes like /dashboard/chat/[userId]
             revalidatePath(`/dashboard/chat/${recipientId}`); // Example if using user ID route
             revalidatePath(`/dashboard/chat/${senderId}`); // Revalidate sender's view too
             revalidatePath('/dashboard/notifications'); // Revalidate notifications page
        }

        return { success: true, messageId: messageId };

    } catch (error) {
        console.error("Send message error:", error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
               .run(senderId, ipAddress, 'Message Send Error', `Error sending message in ${roomType}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
        return { success: false, error: 'Failed to send message.' };
    }
}

// --- Fetch Messages Action (supports polling) ---
const GetMessagesSchema = z.object({
    roomType: z.enum(['public', 'private']),
    otherUserId: z.number().optional(), // Required if roomType is 'private'
    sinceTimestamp: z.string().datetime({ offset: true }).optional(), // ISO 8601 timestamp string
});

interface MessageWithSender extends Message {
    sender_username: string;
    sender_avatar?: string; // Optional
    is_own: boolean; // Flag if message is from the current user
    formatted_timestamp: string; // User-friendly time
    iso_timestamp: string; // Original ISO timestamp for polling
}

// Define Message type based on DB schema (adjust if necessary)
interface Message {
    id: number;
    sender_id: number;
    recipient_id: number | null;
    text: string;
    timestamp: string; // ISO 8601 string from DB
    room_type: 'public' | 'private';
}

export async function getMessages(values: z.infer<typeof GetMessagesSchema>): Promise<{ success: boolean; messages?: MessageWithSender[]; error?: string }> {
    const currentUserSession = await getUserFromSession();
    if (!currentUserSession) {
        return { success: false, error: 'Authentication required.' };
    }
    const currentUserId = currentUserSession.id;

    const validatedFields = GetMessagesSchema.safeParse(values);
    if (!validatedFields.success) {
        console.error("GetMessages validation error:", validatedFields.error);
        return { success: false, error: "Invalid request parameters." };
    }

    const { roomType, otherUserId, sinceTimestamp } = validatedFields.data;

    if (roomType === 'private' && !otherUserId) {
        return { success: false, error: 'Other user ID is required for private messages.' };
    }

    try {
        let query: string;
        const params: (string | number)[] = [];

         const baseSelect = `
            SELECT m.id, m.sender_id, m.recipient_id, m.text, m.timestamp, m.room_type, COALESCE(u.username, 'Deleted User') as sender_username, u.avatar as sender_avatar
            FROM messages m
            LEFT JOIN users u ON m.sender_id = u.id
        `;

        if (roomType === 'public') {
            query = `${baseSelect} WHERE m.room_type = 'public'`;
            if (sinceTimestamp) {
                query += " AND m.timestamp > ?";
                params.push(sinceTimestamp);
            }
            query += " ORDER BY m.timestamp ASC LIMIT 100"; // Limit messages fetched
        } else { // roomType === 'private'
            if (!otherUserId) return { success: false, error: "Invalid request for private messages."}; // Should be caught earlier, but safe check
            query = `${baseSelect}
                     WHERE m.room_type = 'private'
                     AND ((m.sender_id = ? AND m.recipient_id = ?) OR (m.sender_id = ? AND m.recipient_id = ?))`;
            params.push(currentUserId, otherUserId, otherUserId, currentUserId);
            if (sinceTimestamp) {
                query += " AND m.timestamp > ?";
                params.push(sinceTimestamp);
            }
            query += " ORDER BY m.timestamp ASC LIMIT 100"; // Limit messages fetched
        }

        const messages: (Message & { sender_username: string; sender_avatar?: string })[] = db.prepare(query).all(...params) as any;


        // Add 'is_own' flag and formatted timestamp
        const messagesWithDetails: MessageWithSender[] = messages.map(msg => ({
            ...msg,
            is_own: msg.sender_id === currentUserId,
            formatted_timestamp: new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), // Format time for display
            iso_timestamp: msg.timestamp, // Keep original ISO timestamp
        }));

        return { success: true, messages: messagesWithDetails };

    } catch (error) {
        console.error("Get messages error:", error);
        const ipAddress = getIpAddress();
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
               .run(currentUserId, ipAddress, 'Message Fetch Error', `Error fetching messages in ${roomType}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
        return { success: false, error: 'Failed to fetch messages.' };
    }
}


// --- Delete Message Action (Admin Only) ---
const DeleteMessageSchema = z.object({
    messageId: z.number(),
});

export async function deleteMessage(values: z.infer<typeof DeleteMessageSchema>) {
    const adminUser = await getUserFromSession();
    const ipAddress = getIpAddress();

    if (!adminUser) {
        return { success: false, error: "Authentication required." };
    }
    if (adminUser.role !== 'admin') {
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Unauthorized Action', `User attempted to delete message without admin rights`, 'security', adminUser.id);
        return { success: false, error: "Permission denied. Only administrators can delete messages." };
    }

    const validatedFields = DeleteMessageSchema.safeParse(values);
    if (!validatedFields.success) {
        return { success: false, error: "Invalid data." };
    }

    const { messageId } = validatedFields.data;

    try {
        const message = db.prepare('SELECT sender_id, text, room_type FROM messages WHERE id = ?').get(messageId);
        if (!message) {
            return { success: false, error: "Message not found." };
        }

        const info = db.prepare('DELETE FROM messages WHERE id = ?').run(messageId);

        if (info.changes === 0) {
            return { success: false, error: "Message could not be deleted (already removed?)." };
        }

        const senderUsername = message.sender_id ? await getUsernameById(message.sender_id) : 'Deleted User';
        const truncatedText = message.text.substring(0, 50) + (message.text.length > 50 ? '...' : '');

        console.log(`Admin ${adminUser.id} deleted message ${messageId} from ${senderUsername} in ${message.room_type}.`);

        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(adminUser.id, ipAddress, 'Message Deletion', `Admin deleted message (ID: ${messageId}) from user '${senderUsername}'. Content: "${truncatedText}"`, 'admin', messageId);

        // Revalidate relevant chat views
        revalidatePath('/dashboard/chat'); // Revalidate public chat
        // Revalidate private chats if applicable - more complex without knowing participants
         revalidatePath('/dashboard/admin/moderation'); // If such a page exists

        return { success: true, message: "Message deleted successfully." };

    } catch (error) {
        console.error("Delete message error:", error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
            .run(adminUser.id, ipAddress, 'Message Deletion Error', `Error deleting message ID ${messageId}: ${error instanceof Error ? error.message : 'Unknown error'}`, 'admin', messageId);
        return { success: false, error: "Failed to delete message." };
    }
}


// TODO: Action to get list of private chat partners
// TODO: Add actions for editing messages if required (consider permissions)
