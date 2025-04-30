'use server';

import db from '@/lib/db';
import { cookies, headers } from 'next/headers';
import { z } from 'zod';

// Helper to get IP Address
function getIpAddress(): string {
    const forwarded = headers().get('x-forwarded-for');
    const realIp = headers().get('x-real-ip');
    const cfIp = headers().get('cf-connecting-ip');
    return cfIp || forwarded || realIp || '::1'; // Fallback for local
}


// Helper to get user ID and Role from Session (securely)
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
    console.error('Error fetching session user data for logs:', error);
    return null;
  }
}

// --- Get Logs Action (Admin Only) ---
const GetLogsSchema = z.object({
    page: z.number().int().positive().default(1),
    limit: z.number().int().positive().default(20), // Increased default limit
    search: z.string().optional(),
    type: z.string().optional(), // e.g., 'auth', 'file', 'system'
    userId: z.number().int().positive().optional(), // Filter by specific user ID
    dateFrom: z.string().datetime({ offset: true }).optional(), // ISO 8601 string
    dateTo: z.string().datetime({ offset: true }).optional(), // ISO 8601 string
    sortBy: z.enum(['timestamp', 'type', 'username']).default('timestamp'),
    sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

interface Log {
  id: number;
  timestamp: string; // ISO 8601 string
  user_id: number | null;
  username: string | null; // Joined from users table
  ip_address: string | null;
  action: string;
  details: string | null;
  type: string;
  resource_id: number | null;
}

interface LogsResponse {
    success: boolean;
    logs?: Log[];
    totalLogs?: number;
    totalPages?: number;
    currentPage?: number;
    error?: string;
}

export async function getLogs(filters: z.infer<typeof GetLogsSchema>): Promise<LogsResponse> {
    const adminUser = await getUserFromSession();
    const ipAddress = getIpAddress();

    if (!adminUser) {
        return { success: false, error: "Authentication required." };
    }
    if (adminUser.role !== 'admin') {
        // No need to log this attempt usually, just deny access
        return { success: false, error: "Permission denied. Administrator access required." };
    }

    const validatedFilters = GetLogsSchema.safeParse(filters);
    if (!validatedFilters.success) {
        console.error("Log filter validation error:", validatedFilters.error);
        return { success: false, error: "Invalid filter parameters." };
    }

    const { page, limit, search, type, userId, dateFrom, dateTo, sortBy, sortOrder } = validatedFilters.data;
    const offset = (page - 1) * limit;

    try {
        let baseQuery = `
            SELECT
                l.id, l.timestamp, l.user_id, COALESCE(u.username, 'Deleted User') AS username, l.ip_address, l.action, l.details, l.type, l.resource_id
            FROM logs l
            LEFT JOIN users u ON l.user_id = u.id
        `;
        let countQuery = `SELECT COUNT(*) as total FROM logs l LEFT JOIN users u ON l.user_id = u.id`;

        const conditions: string[] = [];
        const params: (string | number)[] = [];
        const countParams: (string | number)[] = []; // Separate params for count query

        // Apply filters
        if (search) {
            conditions.push(`(l.action LIKE ? OR l.details LIKE ? OR l.ip_address LIKE ? OR u.username LIKE ? OR l.resource_id = ?)`);
            const searchTerm = `%${search}%`;
            const searchNum = parseInt(search, 10); // Try parsing as number for resource_id
             params.push(searchTerm, searchTerm, searchTerm, searchTerm, isNaN(searchNum) ? -1 : searchNum); // Use -1 if not a number
             countParams.push(searchTerm, searchTerm, searchTerm, searchTerm, isNaN(searchNum) ? -1 : searchNum);
        }
        if (type) {
            conditions.push(`l.type = ?`);
            params.push(type);
            countParams.push(type);
        }
        if (userId) {
            conditions.push(`l.user_id = ?`);
            params.push(userId);
            countParams.push(userId);
        }
        if (dateFrom) {
            conditions.push(`l.timestamp >= ?`);
            params.push(dateFrom);
             countParams.push(dateFrom);
        }
         if (dateTo) {
             // Add 1 day to dateTo to include the whole day if only date part is provided?
             // Assuming dateTo is precise or the end of the desired day
            conditions.push(`l.timestamp <= ?`);
            params.push(dateTo);
            countParams.push(dateTo);
        }

        // Append WHERE clause if conditions exist
        if (conditions.length > 0) {
            const whereClause = ` WHERE ${conditions.join(' AND ')}`;
            baseQuery += whereClause;
            countQuery += whereClause;
        }

        // Get total count before pagination/sorting
        const { total } = db.prepare(countQuery).get(...countParams) as { total: number };
        const totalPages = Math.ceil(total / limit);

         // Add sorting
         let orderByClause = 'l.timestamp'; // Default sort
         if (sortBy === 'type') orderByClause = 'l.type';
         else if (sortBy === 'username') orderByClause = 'username'; // Use the joined alias
         baseQuery += ` ORDER BY ${orderByClause} ${sortOrder.toUpperCase()}`;


        // Add pagination
        baseQuery += ` LIMIT ? OFFSET ?`;
        params.push(limit, offset);

        // Execute queries
        const logs: Log[] = db.prepare(baseQuery).all(...params) as Log[];


        return {
            success: true,
            logs,
            totalLogs: total,
            totalPages,
            currentPage: page,
        };

    } catch (error) {
        console.error("Get logs error:", error);
        // Log this error internally
         db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Log Fetch Error', `Admin failed to fetch logs: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');

        return { success: false, error: 'Failed to retrieve logs.' };
    }
}

// --- Get Log Types Action (Admin Only) ---
export async function getLogTypes(): Promise<{ success: boolean; types?: string[]; error?: string }> {
    const adminUser = await getUserFromSession();
     if (!adminUser || adminUser.role !== 'admin') {
        return { success: false, error: "Permission denied." };
    }
    try {
        const result = db.prepare('SELECT DISTINCT type FROM logs ORDER BY type ASC').all() as { type: string }[];
        const types = result.map(row => row.type);
        return { success: true, types };
    } catch (error) {
        console.error("Error fetching log types:", error);
        return { success: false, error: "Failed to fetch log types." };
    }
}


// --- Get System Stats (Admin Only) ---
interface SystemStats {
    totalUsers: number;
    activeUsers: number;
    totalFiles: number;
    totalStorageUsedBytes: number; // In bytes
    publicFiles: number;
    privateFiles: number;
    logCount: number;
    // Add more stats as needed
}

export async function getSystemStats(): Promise<{ success: boolean; stats?: SystemStats; error?: string }> {
     const adminUser = await getUserFromSession();
     if (!adminUser || adminUser.role !== 'admin') {
        return { success: false, error: "Permission denied." };
    }
     const ipAddress = getIpAddress();

    try {
        const users = db.prepare('SELECT COUNT(*) as total, SUM(CASE WHEN status = ? THEN 1 ELSE 0 END) as active FROM users').get('active') as { total: number, active: number };
        const files = db.prepare('SELECT COUNT(*) as total, SUM(size) as totalSize, SUM(CASE WHEN visibility = ? THEN 1 ELSE 0 END) as publicCount FROM files').get('public') as { total: number, totalSize: number | null, publicCount: number };
        const logs = db.prepare('SELECT COUNT(*) as total FROM logs').get() as { total: number };

        const stats: SystemStats = {
            totalUsers: users.total,
            activeUsers: users.active || 0,
            totalFiles: files.total,
            totalStorageUsedBytes: files.totalSize || 0,
            publicFiles: files.publicCount || 0,
            privateFiles: files.total - (files.publicCount || 0),
            logCount: logs.total,
        };

        return { success: true, stats };

    } catch (error) {
        console.error("Error fetching system stats:", error);
        db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
           .run(adminUser.id, ipAddress, 'Stats Fetch Error', `Admin failed to fetch system stats: ${error instanceof Error ? error.message : 'Unknown error'}`, 'system');
        return { success: false, error: "Failed to fetch system statistics." };
    }

}
