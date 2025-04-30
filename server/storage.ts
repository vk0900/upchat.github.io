import { users, type User, type InsertUser } from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";
import { nanoid } from 'nanoid';

// Type definition for session store
type SessionStore = session.Store;

// Memory store for sessions
const MemoryStore = createMemoryStore(session);

// Define additional interfaces for the application
interface Message {
  id: string;
  content: string;
  senderId: number;
  channelId?: string;
  recipientId?: number;
  timestamp: Date;
}

interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  uploaderId: number;
  isPublic: boolean;
  channel?: string;
  sharedWith: number[];
  uploadedAt: Date;
  data: Buffer;
}

interface LogEntry {
  id: string;
  type: 'user' | 'system' | 'file' | 'communication' | 'admin';
  action: string;
  userId?: number;
  details: string;
  ip: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error';
}

interface SystemSettings {
  maxFileSize: number;
  userStorageQuota: number;
  allowedFileTypes: string[];
  maintenanceModeEnabled: boolean;
  passwordMinLength: number;
  sessionTimeoutMinutes: number;
}

// Update the storage interface
export interface IStorage {
  // User management
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getAllUsers(): Promise<User[]>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, updates: Partial<User>): Promise<User>;
  
  // Message management
  createMessage(message: Omit<Message, 'id'>): Promise<Message>;
  getMessage(id: string): Promise<Message | undefined>;
  getChannelMessages(channelId: string): Promise<Message[]>;
  getDirectMessages(userId1: number, userId2: number): Promise<Message[]>;
  getAllMessages(): Promise<Message[]>;
  deleteMessage(id: string): Promise<void>;
  
  // File management
  createFile(file: Omit<File, 'id'>): Promise<File>;
  getFile(id: string): Promise<File | undefined>;
  getChannelFiles(channelId: string): Promise<Omit<File, 'data'>[]>;
  getUserFiles(userId: number): Promise<Omit<File, 'data'>[]>;
  getAllFiles(): Promise<Omit<File, 'data'>[]>;
  updateFileVisibility(id: string, isPublic: boolean): Promise<void>;
  deleteFile(id: string): Promise<void>;
  
  // Logs and statistics
  createLogEntry(entry: Omit<LogEntry, 'id'>): Promise<LogEntry>;
  getLogs(type?: string, period?: string): Promise<LogEntry[]>;
  getSystemStats(): Promise<any>;
  getRecentActivities(): Promise<any[]>;
  
  // System settings
  getSystemSettings(): Promise<SystemSettings>;
  updateSystemSettings(settings: Partial<SystemSettings>): Promise<void>;
  
  // Session store
  sessionStore: SessionStore;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private messages: Map<string, Message>;
  private files: Map<string, File>;
  private logs: Map<string, LogEntry>;
  private systemSettings: SystemSettings;
  public sessionStore: SessionStore;
  currentId: number;

  constructor() {
    this.users = new Map();
    this.messages = new Map();
    this.files = new Map();
    this.logs = new Map();
    this.systemSettings = {
      maxFileSize: 1024, // 1024MB
      userStorageQuota: 5120, // 5GB in MB
      allowedFileTypes: ['*'],
      maintenanceModeEnabled: false,
      passwordMinLength: 6,
      sessionTimeoutMinutes: 60
    };
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // Prune expired entries every 24h
    });
    this.currentId = 1;
    
    // Create default admin user if none exists
    this.createDefaultAdmin();
  }

  private async createDefaultAdmin() {
    // Create a default admin user if none exists
    const adminExists = await this.getUserByUsername('admin');
    if (!adminExists) {
      // Default admin with password 'admin123' (using the same hash format as our hashPassword function)
      const salt = "0123456789abcdef";
      const hashedPassword = `240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9.${salt}`;
      
      await this.createUser({
        username: 'admin',
        password: hashedPassword,
        role: 'admin'
      });
    }
  }

  // User management
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username.toLowerCase() === username.toLowerCase(),
    );
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const status = "active";
    const role = insertUser.role || "user";
    const user: User = { 
      ...insertUser, 
      id, 
      status, 
      role,
      email: null,
      createdAt: new Date(),
      lastActive: new Date()
    };
    this.users.set(id, user);
    return user;
  }

  async updateUser(id: number, updates: Partial<User>): Promise<User> {
    const user = await this.getUser(id);
    if (!user) {
      throw new Error(`User with ID ${id} not found`);
    }
    
    const updatedUser = { ...user, ...updates };
    this.users.set(id, updatedUser);
    return updatedUser;
  }

  // Message management
  async createMessage(message: Omit<Message, 'id'>): Promise<Message> {
    const id = nanoid();
    const newMessage: Message = { ...message, id };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getChannelMessages(channelId: string): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => message.channelId === channelId)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getDirectMessages(userId1: number, userId2: number): Promise<Message[]> {
    return Array.from(this.messages.values())
      .filter(message => 
        (message.senderId === userId1 && message.recipientId === userId2) ||
        (message.senderId === userId2 && message.recipientId === userId1)
      )
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  async getAllMessages(): Promise<Message[]> {
    return Array.from(this.messages.values())
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async deleteMessage(id: string): Promise<void> {
    this.messages.delete(id);
  }

  // File management
  async createFile(file: Omit<File, 'id'>): Promise<File> {
    const id = nanoid();
    const newFile: File = { ...file, id };
    this.files.set(id, newFile);
    return newFile;
  }

  async getFile(id: string): Promise<File | undefined> {
    return this.files.get(id);
  }

  async getChannelFiles(channelId: string): Promise<Omit<File, 'data'>[]> {
    return Array.from(this.files.values())
      .filter(file => file.channel === channelId && file.isPublic)
      .map(({ data, ...rest }) => rest)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getUserFiles(userId: number): Promise<Omit<File, 'data'>[]> {
    return Array.from(this.files.values())
      .filter(file => file.uploaderId === userId)
      .map(({ data, ...rest }) => rest)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async getAllFiles(): Promise<Omit<File, 'data'>[]> {
    return Array.from(this.files.values())
      .map(({ data, ...rest }) => rest)
      .sort((a, b) => b.uploadedAt.getTime() - a.uploadedAt.getTime());
  }

  async updateFileVisibility(id: string, isPublic: boolean): Promise<void> {
    const file = await this.getFile(id);
    if (file) {
      const updatedFile: File = { ...file, isPublic };
      this.files.set(id, updatedFile);
    }
  }

  async deleteFile(id: string): Promise<void> {
    this.files.delete(id);
  }

  // Logs and statistics
  async createLogEntry(entry: Omit<LogEntry, 'id'>): Promise<LogEntry> {
    const id = nanoid();
    const newEntry: LogEntry = { ...entry, id };
    this.logs.set(id, newEntry);
    return newEntry;
  }

  async getLogs(type?: string, period?: string): Promise<LogEntry[]> {
    let logs = Array.from(this.logs.values());
    
    // Filter by type if specified
    if (type && type !== 'all') {
      logs = logs.filter(log => log.type === type);
    }
    
    // Filter by period if specified
    if (period) {
      const now = new Date();
      let cutoff: Date;
      
      switch (period) {
        case '24h':
          cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
          break;
        case '7d':
          cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30d':
          cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        default:
          cutoff = new Date(0); // Beginning of time
      }
      
      logs = logs.filter(log => log.timestamp >= cutoff);
    }
    
    // Sort by timestamp, newest first
    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  async getSystemStats(): Promise<any> {
    const users = await this.getAllUsers();
    const files = await this.getAllFiles();
    
    // Calculate total storage used
    const totalStorageUsed = files.reduce((total, file) => total + file.size, 0);
    
    // Return stats
    return {
      totalUsers: users.length,
      usersTrend: '+' + (users.length > 5 ? users.length - 5 : 0),
      filesShared: files.filter(file => file.isPublic).length,
      filesTrend: '+' + (files.length > 15 ? files.length - 15 : 0),
      storageUsed: `${Math.round(totalStorageUsed / (1024 * 1024))} MB`,
      storageLimit: '10 GB'
    };
  }

  async getRecentActivities(): Promise<any[]> {
    // Get recent logs and format them as activities
    const recentLogs = await this.getLogs(undefined, '24h');
    
    return recentLogs.slice(0, 10).map(log => {
      let activityType;
      let data: any = {};
      
      switch (log.type) {
        case 'file':
          activityType = 'file_upload';
          if (log.details.includes('Uploaded file:')) {
            const fileName = log.details.replace('Uploaded file: ', '');
            const file = Array.from(this.files.values())
              .find(f => f.name === fileName);
            
            data = {
              fileName,
              fileSize: file ? `${Math.round(file.size / 1024)} KB` : 'Unknown'
            };
          } else if (log.details.includes('Changed file visibility')) {
            activityType = 'file_permission';
            const match = log.details.match(/Changed file visibility for (.*) to (.*)/);
            if (match) {
              data = {
                fileName: match[1],
                newPermission: match[2]
              };
            }
          }
          break;
          
        case 'user':
          activityType = 'user_login';
          break;
          
        case 'admin':
          if (log.details.includes('Created new user:')) {
            activityType = 'user_create';
            const username = log.details.replace('Created new user: ', '');
            data = {
              newUsername: username,
              newUserId: Array.from(this.users.values())
                .find(u => u.username === username)?.id || 0
            };
          } else {
            activityType = 'admin_action';
          }
          break;
          
        default:
          activityType = `${log.type}_${log.action}`;
      }
      
      return {
        id: log.id,
        type: activityType,
        userId: log.userId || 0,
        data,
        timestamp: log.timestamp
      };
    });
  }

  // System settings
  async getSystemSettings(): Promise<SystemSettings> {
    return this.systemSettings;
  }

  async updateSystemSettings(settings: Partial<SystemSettings>): Promise<void> {
    this.systemSettings = { ...this.systemSettings, ...settings };
  }
}

export const storage = new MemStorage();
