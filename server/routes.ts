import type { Express } from "express";
import { createServer, type Server } from "http";
import { setupAuth } from "./auth";
import { storage } from "./storage";
import { createReadStream } from "fs";
import { createHash } from "crypto";
import path from "path";
import multer from "multer";
import { User, InsertUser } from "@shared/schema";

// Helper function to ensure a string is not undefined
function ensureString(value: string | undefined): string {
  return value ?? '';
}

// Setup multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 1024 * 1024 * 1024, // 1024MB limit
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Setup authentication
  setupAuth(app);
  
  // User routes
  app.get("/api/users", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const users = await storage.getAllUsers();
    res.json(users);
  });
  
  // Create user (admin only)
  app.post("/api/admin/users", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    const { username, password, role } = req.body;
    
    // Check if username already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }
    
    // Create new user
    try {
      // Hash the password using SHA256
      const hashedPassword = createHash('sha256').update(password).digest('hex');
      
      const newUser: InsertUser = {
        username,
        password: hashedPassword,
        role: role || "user"
      };
      
      const user = await storage.createUser(newUser);
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "admin",
        action: "user_create",
        userId: (req.user as User).id,
        details: `Created new user: ${username}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "info"
      });
      
      res.status(201).json(user);
    } catch (error) {
      console.error("Error creating user:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  // Deactivate user (admin only)
  app.post("/api/admin/users/:id/deactivate", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    const userId = parseInt(req.params.id);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }
    
    try {
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).send("User not found");
      }
      
      // In a real app, you would update the user status here
      // await storage.updateUser(userId, { status: "inactive" });
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "admin",
        action: "user_deactivate",
        userId: (req.user as User).id,
        details: `Deactivated user: ${user.username}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "warning"
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  // Chat routes
  app.post("/api/messages", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const { content, channelId, recipientId } = req.body;
    
    if (!content) {
      return res.status(400).send("Message content is required");
    }
    
    try {
      const message = await storage.createMessage({
        content,
        senderId: (req.user as User).id,
        channelId,
        recipientId: recipientId ? parseInt(recipientId) : undefined,
        timestamp: new Date()
      });
      
      res.status(201).json(message);
    } catch (error) {
      console.error("Error creating message:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/messages/channel/:channelId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const channelId = req.params.channelId;
    
    try {
      const messages = await storage.getChannelMessages(channelId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching channel messages:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/messages/direct/:userId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const userId = parseInt(req.params.userId);
    if (isNaN(userId)) {
      return res.status(400).send("Invalid user ID");
    }
    
    try {
      const messages = await storage.getDirectMessages((req.user as User).id, userId);
      res.json(messages);
    } catch (error) {
      console.error("Error fetching direct messages:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  // File routes
  app.post("/api/files/upload", upload.single("file"), async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    if (!req.file) {
      return res.status(400).send("No file uploaded");
    }
    
    const { visibility, channel, sharedWith } = req.body;
    
    try {
      // In a real app, you would save the file to a storage system
      const file = await storage.createFile({
        name: req.file.originalname,
        type: req.file.mimetype,
        size: req.file.size,
        uploaderId: (req.user as User).id,
        isPublic: visibility === "public",
        channel: channel || "general",
        sharedWith: sharedWith ? JSON.parse(sharedWith) : [],
        uploadedAt: new Date(),
        data: req.file.buffer
      });
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "file",
        action: "upload",
        userId: (req.user as User).id,
        details: `Uploaded file: ${req.file.originalname}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "info"
      });
      
      res.status(201).json({
        id: file.id,
        name: file.name,
        type: file.type,
        size: file.size,
        uploaderId: file.uploaderId,
        isPublic: file.isPublic,
        uploadedAt: file.uploadedAt
      });
    } catch (error) {
      console.error("Error uploading file:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/files/channel/:channelId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const channelId = req.params.channelId;
    
    try {
      const files = await storage.getChannelFiles(channelId);
      res.json(files);
    } catch (error) {
      console.error("Error fetching channel files:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/files/user", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    try {
      const files = await storage.getUserFiles((req.user as User).id);
      res.json(files);
    } catch (error) {
      console.error("Error fetching user files:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/files/:fileId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const fileId = req.params.fileId;
    
    try {
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).send("File not found");
      }
      
      // Check if the user has permission to access the file
      if (!file.isPublic && 
          file.uploaderId !== (req.user as User).id && 
          !file.sharedWith.includes((req.user as User).id)) {
        return res.status(403).send("You don't have permission to access this file");
      }
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "file",
        action: "download",
        userId: (req.user as User).id,
        details: `Downloaded file: ${file.name}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "info"
      });
      
      // Set appropriate headers
      res.setHeader("Content-Type", file.type);
      res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
      
      // Send the file
      res.send(file.data);
    } catch (error) {
      console.error("Error downloading file:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.put("/api/files/:fileId/visibility", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const fileId = req.params.fileId;
    const { isPublic } = req.body;
    
    if (isPublic === undefined) {
      return res.status(400).send("Visibility setting is required");
    }
    
    try {
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).send("File not found");
      }
      
      // Check if the user is the owner of the file
      if (file.uploaderId !== (req.user as User).id) {
        return res.status(403).send("You don't have permission to modify this file");
      }
      
      // Update file visibility
      await storage.updateFileVisibility(fileId, isPublic);
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "file",
        action: "permission_change",
        userId: (req.user as User).id,
        details: `Changed file visibility for ${file.name} to ${isPublic ? 'public' : 'private'}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "info"
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating file visibility:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.delete("/api/files/:fileId", async (req, res) => {
    if (!req.isAuthenticated()) return res.status(401).send("Unauthorized");
    
    const fileId = req.params.fileId;
    
    try {
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).send("File not found");
      }
      
      // Check if the user is the owner of the file or an admin
      if (file.uploaderId !== (req.user as User).id && (req.user as User).role !== "admin") {
        return res.status(403).send("You don't have permission to delete this file");
      }
      
      // Delete the file
      await storage.deleteFile(fileId);
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "file",
        action: "delete",
        userId: (req.user as User).id,
        details: `Deleted file: ${file.name}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "warning"
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  // Admin routes
  app.get("/api/admin/stats", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    try {
      const stats = await storage.getSystemStats();
      res.json(stats);
    } catch (error) {
      console.error("Error fetching system stats:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/admin/activity", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    try {
      const activities = await storage.getRecentActivities();
      res.json(activities);
    } catch (error) {
      console.error("Error fetching recent activities:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/admin/messages", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    try {
      const messages = await storage.getAllMessages();
      res.json(messages);
    } catch (error) {
      console.error("Error fetching messages:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/admin/files", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    try {
      const files = await storage.getAllFiles();
      res.json(files);
    } catch (error) {
      console.error("Error fetching files:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.delete("/api/admin/messages/:messageId", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    const messageId = req.params.messageId;
    const { reason } = req.body;
    
    try {
      const message = await storage.getMessage(messageId);
      
      if (!message) {
        return res.status(404).send("Message not found");
      }
      
      // Delete the message
      await storage.deleteMessage(messageId);
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "communication",
        action: "message_deleted",
        userId: (req.user as User).id,
        details: `Admin deleted message: ${reason || 'No reason provided'}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "warning"
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting message:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.delete("/api/admin/files/:fileId", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    const fileId = req.params.fileId;
    const { reason } = req.body;
    
    try {
      const file = await storage.getFile(fileId);
      
      if (!file) {
        return res.status(404).send("File not found");
      }
      
      // Delete the file
      await storage.deleteFile(fileId);
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "file",
        action: "delete",
        userId: (req.user as User).id,
        details: `Admin deleted file ${file.name}: ${reason || 'No reason provided'}`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "warning"
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error deleting file:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.post("/api/admin/system-settings", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    const settings = req.body;
    
    try {
      // Update system settings
      await storage.updateSystemSettings(settings);
      
      // Add to activity logs
      await storage.createLogEntry({
        type: "admin",
        action: "config_update",
        userId: (req.user as User).id,
        details: `Updated system settings`,
        ip: ensureString(req.ip),
        timestamp: new Date(),
        severity: "info"
      });
      
      res.status(200).json({ success: true });
    } catch (error) {
      console.error("Error updating system settings:", error);
      res.status(500).send("Internal Server Error");
    }
  });
  
  app.get("/api/admin/logs", async (req, res) => {
    if (!req.isAuthenticated() || (req.user as User).role !== "admin") {
      return res.status(403).send("Forbidden: Admin access required");
    }
    
    const { type, period } = req.query;
    
    try {
      const logs = await storage.getLogs(type as string, period as string);
      res.json(logs);
    } catch (error) {
      console.error("Error fetching logs:", error);
      res.status(500).send("Internal Server Error");
    }
  });

  // Create HTTP server
  const httpServer = createServer(app);

  return httpServer;
}
