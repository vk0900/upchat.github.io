
import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

// Ensure the directory exists
const dbDir = path.resolve(process.cwd(), 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'secure_share.db');
console.log(`Database path: ${dbPath}`); // Log the path

let db: Database.Database;

try {
    db = new Database(dbPath, { verbose: console.log });
} catch (error) {
    console.error("Error opening database:", error);
     // If the database file is corrupt or has issues, try backing it up and creating a new one.
     console.log("Attempting to backup and recreate database...");
     try {
        const backupPath = path.join(dbDir, `secure_share_backup_${Date.now()}.db`);
        fs.copyFileSync(dbPath, backupPath);
        console.log(`Corrupt database backed up to ${backupPath}`);
        fs.unlinkSync(dbPath); // Delete the corrupt file
        db = new Database(dbPath, { verbose: console.log }); // Create a new one
        console.log("New database file created.");
    } catch (backupError) {
         console.error("Failed to backup/recreate database:", backupError);
         // Rethrow the original error or a new one indicating complete failure
         throw new Error(`Failed to initialize database at ${dbPath}. Previous error: ${error}. Backup/Recreate failed: ${backupError}`);
    }
}


// Enable WAL mode for better concurrency
db.pragma('journal_mode = WAL');

// IMPORTANT: If you previously ran the application and the database file 'database/secure_share.db'
// exists, but you encounter "no such column" errors related to tables below,
// you may need to MANUALLY DELETE the 'database/secure_share.db' file and restart the application.
// This ensures the latest table schemas are created correctly. This will delete all existing data.

// Create Users Table
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user', -- 'user' or 'admin'
    status TEXT NOT NULL DEFAULT 'active', -- 'active' or 'inactive'
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_username ON users (username);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_email ON users (email);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);`);


// Create Files Table
db.exec(`
  CREATE TABLE IF NOT EXISTS files (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT,
    size INTEGER NOT NULL,
    upload_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    uploader_id INTEGER, -- Changed to allow NULL on user deletion
    visibility TEXT NOT NULL DEFAULT 'private', -- 'private' or 'public'
    path TEXT UNIQUE NOT NULL, -- Store the relative path to the file
    FOREIGN KEY (uploader_id) REFERENCES users (id) ON DELETE SET NULL -- Set uploader to NULL if user is deleted
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_files_uploader_id ON files (uploader_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_files_visibility ON files (visibility);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_files_path ON files (path);`);

// Create Messages Table
// Ensure sender_id and recipient_id are defined here before creating indexes.
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sender_id INTEGER, -- Allow NULL on user deletion
    recipient_id INTEGER, -- NULL for public messages, allow NULL on user deletion
    text TEXT NOT NULL,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    room_type TEXT NOT NULL DEFAULT 'public', -- 'public' or 'private'
    FOREIGN KEY (sender_id) REFERENCES users (id) ON DELETE SET NULL,
    FOREIGN KEY (recipient_id) REFERENCES users (id) ON DELETE SET NULL
  );
`);
// Create indexes *after* the table is guaranteed to have the columns (due to IF NOT EXISTS)
// If the table pre-existed without these columns, this might still fail. See IMPORTANT note above.
try {
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages (sender_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_recipient_id ON messages (recipient_id);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_room_type ON messages (room_type);`);
    db.exec(`CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages (timestamp);`);
} catch (indexError) {
     console.error("Error creating indexes for 'messages' table. The table might exist with an older schema. See IMPORTANT note in db.ts.", indexError);
     // Consider manual deletion of the DB file if this error persists.
}


// Create Logs Table
db.exec(`
  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    user_id INTEGER,
    ip_address TEXT,
    action TEXT NOT NULL,
    details TEXT,
    type TEXT NOT NULL, -- e.g., 'auth', 'file', 'chat', 'system', 'admin', 'notification', 'security'
    resource_id INTEGER, -- ID of related file, user, message etc.
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE SET NULL -- Keep logs even if user is deleted
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs (timestamp);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_user_id ON logs (user_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_type ON logs (type);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_logs_action ON logs (action);`);


// Create Sessions Table
db.exec(`
  CREATE TABLE IF NOT EXISTS sessions (
    session_id TEXT PRIMARY KEY NOT NULL,
    user_id INTEGER NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address TEXT,
    user_agent TEXT,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions (user_id);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires_at ON sessions (expires_at);`);


// Create Settings Table
db.exec(`
  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT
  );
`);

// Create Notifications Table
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL, -- The user receiving the notification
    type TEXT NOT NULL, -- 'message', 'file_share', 'system', etc.
    text TEXT NOT NULL,
    resource_id INTEGER, -- ID of the related message, file, etc. (optional)
    read_status BOOLEAN NOT NULL DEFAULT 0, -- 0 for unread, 1 for read
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE
  );
`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user_id_read_status ON notifications (user_id, read_status);`);
db.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications (created_at);`);


// --- Seeding Initial Data ---
const seedData = () => {
    // Seed initial admin user if not exists
    const adminUser = db.prepare('SELECT id FROM users WHERE username = ?').get('AdminUser');
    let adminId: number | bigint | null = adminUser?.id ?? null;

    if (!adminUser) {
        console.log("Seeding initial admin user...");
        try {
            // Dynamically require hashPassword here if needed, or ensure it's available
            const { hashPassword } = require('./auth'); // Adjust path if necessary
            const adminPasswordHash = hashPassword('adminpassword'); // Replace with a secure default or env var

            const adminInfo = db.prepare(`
            INSERT INTO users (username, email, password_hash, role, status)
            VALUES (?, ?, ?, ?, ?)
            `).run('AdminUser', 'admin@example.com', adminPasswordHash, 'admin', 'active');
            adminId = adminInfo.lastInsertRowid;
            console.log(`Admin user seeded successfully (ID: ${adminId}).`);

            // Log admin creation
             try {
                 db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type, resource_id) VALUES (?, ?, ?, ?, ?, ?)')
                   .run(adminId, '::1', 'Initial Admin Seed', `Admin user 'AdminUser' created during setup.`, 'system', adminId as number);
             } catch (logError) {
                 console.warn("Could not log admin seeding (logs table might not exist yet or schema issue):", logError);
             }

        } catch (error) {
            console.error("Error seeding admin user:", error);
             // If admin seeding fails, it might indicate a deeper DB issue. Stop seeding?
             return; // Stop seeding if admin creation failed
        }
    } else {
         console.log("Admin user already exists.");
    }


     // Seed default settings (only if they don't exist)
    console.log("Seeding default settings...");
    const settingsStmt = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
    const settingsToSeed = [
        { key: 'fileSizeLimitMB', value: '10' },
        { key: 'storageQuotaMB', value: '500' },
        { key: 'allowedFileTypes', value: 'jpg, jpeg, png, gif, webp, pdf, txt, doc, docx, xls, xlsx, ppt, pptx, zip, rar, 7z' },
        { key: 'maintenanceMode', value: 'false' },
        { key: 'sessionTimeoutMinutes', value: '30' },
        { key: 'passwordMinLength', value: '1' }, // Updated min length
        { key: 'passwordExpiryDays', value: '0' }, // 0 means disabled
    ];

    let settingsSeededCount = 0;
    settingsToSeed.forEach(setting => {
        const info = settingsStmt.run(setting.key, setting.value);
        if (info.changes > 0) {
            settingsSeededCount++;
        }
    });
    console.log(`${settingsSeededCount} default settings added (ignored if already exist).`);

     // Log settings seeding only if settings were actually added and adminId is known
     if (settingsSeededCount > 0 && adminId !== null) {
         try {
            db.prepare('INSERT INTO logs (user_id, ip_address, action, details, type) VALUES (?, ?, ?, ?, ?)')
             .run(adminId as number, '::1', 'Initial Settings Seed', `${settingsSeededCount} default system settings seeded/verified during setup.`, 'system');
         } catch (logError) {
             console.warn("Could not log settings seeding (logs table might not exist yet or schema issue):", logError);
         }
     }

};

// Wrap seeding in a transaction for atomicity
try {
    db.transaction(seedData)();
} catch (seedError) {
     console.error("Database seeding transaction failed:", seedError);
     // Depending on the error, might need manual intervention
}


console.log("Database schema initialization and seeding completed.");

// --- Graceful Shutdown ---
// Close the database connection when the app exits
function closeDb() {
  if (db && db.open) {
    db.close((err) => {
      if (err) {
        console.error('Error closing database:', err.message);
      } else {
        console.log('Database connection closed.');
      }
    });
  }
}

process.on('exit', closeDb);
process.on('SIGINT', () => {
  closeDb();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDb();
  process.exit(0);
});


export default db;

    