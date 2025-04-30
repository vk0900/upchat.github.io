# **App Name**: SecureShare Chat

## Core Features:

- User Management: Admin-controlled user registration and role management (admin/regular user).
- File Management: File sharing with visibility control (private/public), file previews, and metadata tracking within 10MB limits.
- Communication Features: Discord-inspired public chat room and private messaging with notification system.
- Security Features: Authentication using SHA256 password hashing, session management, and XSS protection.
- Activity Logs: Comprehensive logging of user activity, system events, communication, and file management.
- Admin Panel: Admin panel with user management, system configuration, content moderation, statistics & reporting, and security controls.

## Style Guidelines:

- Primary color: Dark gray (#36393F), similar to Discord's dark theme.
- Secondary color: Light gray (#DCDDDE) for text and accents.
- Accent: Blurple (#5865F2) for interactive elements and highlights.
- Discord-like layout with a left sidebar for navigation, a central content area for file sharing/chat, and a right sidebar for user lists or file details.
- Use simple, outlined icons for file types and actions.

## Original User Request:
build a website with this Core Functionality
The FileChat Platform is a web-based application that combines secure file sharing with chat capabilities, designed for small teams or organizations. Here's what it does in detail:
please only admin can create account for users
1. File Management System
Upload files of various types with size limits (currently 1024MB per file)
Download shared files from other users
Control file visibility (private or public)
File previews for compatible file types
File metadata tracking (upload date, size, type)
2. Communication Features
Public chat room for all users to communicate
Private messaging between individual users
Notification system for new messages and file shares
Real-time updates using AJAX polling (not websockets)
3. User Management
Role-based permissions (admin vs. regular users)
User registration controlled by admins only
Account management (password changes, profile updates)
Activity logs for security auditing
4. Security Features
Authentication system using SHA256 password hashing
Session management with timeout functionality
File access control based on sharing permissions
XSS protection and input sanitization
Technical Limitations (Things We Can't Add/Change)
1. External Service Limitations
No external API integrations due to InfinityFree hosting limitations
No CORS support for cross-domain requests (AJAX requests must be same-domain)
No SSL/TLS certificates from Let's Encrypt (not supported by InfinityFree)
No access through mobile apps (only web browsers are supported)
2. Technical Constraints
No real-time WebSockets (must use polling for updates)
No server-side background tasks (cron jobs limited on free hosting)
No server-side image/file processing (limitations on CPU usage)
File size restricted to 10MB due to hosting limitations
Database limitations based on InfinityFree's MySQL restrictions
3. Framework Restrictions
Vanilla JavaScript only php and html css (no frameworks like React, Vue, Angular)
No third-party authentication systems (OAuth, LDAP, etc.)
No CDN integration for file delivery (all files served from same domain)
No custom domains unless upgraded from free InfinityFree plan
4. Performance Considerations
Limited concurrent users due to shared hosting environment
Possible database connection limits on the free tier
Limited server resources (CPU/memory constraints)
No heavy data processing capabilities
5.
password in palin sah256
please only use mysql
chat ui based on discord
login page simple only aske for username and password

mysql info 
host = sql212.infinityfree.com
user = if0_37749899
pass = vishnukumar900
name = if0_37749899_secure_share
port = 3306
6.admin
Additional Admin Panel Features Needed
Beyond the logging capabilities, the admin panel should include these essential features:

User Management
Create new user accounts with predefined roles
Edit existing user profiles (name, email, contact details)
Reset user passwords without knowing the current one
Deactivate/reactivate user accounts without deletion
Set user permissions and roles (admin, regular user)
System Configuration
File size limitations settings
Storage quota management per user
File type restrictions (allow/block specific extensions)
System maintenance mode toggle
Content Moderation
View and delete inappropriate messages from chat
Ban problematic file types platform-wide
Search and filter through all files and messages
Statistics & Reporting
System usage dashboard (active users, storage used)
User activity reports (most active users, inactive accounts)
File usage statistics (popular downloads, upload frequency)
Error rate monitoring (failed operations, system errors)
Data export capabilities for custom reporting
Security Controls
Session management (view/terminate active sessions)
Password policy settings (complexity, expiration)
Access restriction settings (time-based, location-based)
Optimize database performance
Error log viewer for quick troubleshooting
7.log
User Activity Logs
Login attempts (successful and failed)
File uploads and deletions
User account creations and modifications
IP addresses of all admin actions
System Events
Database errors or connection issues
Suspicious activity (multiple failed login attempts)
File permission changes
Communication Monitoring
Message deletions (who deleted what and when)
Public chat moderation actions
Bulk message operations
File Management Logs
File visibility changes (private to public or vice versa)
File sharing activities (who shared what with whom)
Large file transfers (files approaching size limits)
File download statistics
Admin Actions
User account suspensions or activations
Configuration changes to the platform
Mass actions affecting multiple users
Admin privilege assignments or removals
All logs include:
Timestamp (date and time of action)
User ID and username of who performed the action
Specific action details
Affected resources (file IDs, user IDs, etc.)
IP address of origin
The application is designed with these limitations in mind, focusing on core functionality that works well within the constraints of free hosting while still providing a useful file sharing and communication platform for teams.
  