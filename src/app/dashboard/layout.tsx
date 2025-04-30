// src/app/dashboard/layout.tsx
"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Home,
  File,
  Users,
  Settings,
  LogOut,
  MessageSquare,
  ShieldCheck, // Activity Log Icon
  Bell,
  UserPlus, // Manage Users Icon
  FilePlus, // Manage Files Icon
  Search,
  ChevronsLeft,
  ChevronsRight,
  Loader2,
  DatabaseZap, // System Settings Icon
  LayoutList, // Logs Icon
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { usePathname, useRouter } from "next/navigation"; // Import usePathname
import { logoutUser } from "@/actions/auth"; // Import logout action
import { useToast } from "@/hooks/use-toast"; // Import toast
import { getNotifications } from "@/actions/notifications"; // Import notification action
import { Badge } from "@/components/ui/badge"; // Import Badge

const SIDEBAR_WIDTH_EXPANDED = "w-64";
const SIDEBAR_WIDTH_COLLAPSED = "w-16";
const USERLIST_WIDTH = "w-60";

// Define User type (can be moved to a types file)
interface User {
    id: number;
    username: string;
    role: 'admin' | 'user';
    avatar?: string; // Optional avatar URL
    online?: boolean; // Optional online status
}

// Mock online users list (replace with actual data fetch/polling later)
// TODO: Fetch actual user list
const mockOnlineUsers: User[] = [
    { id: 1, username: "Alice", role: 'user', online: true, avatar: "https://i.pravatar.cc/150?img=1" },
    { id: 3, username: "Charlie", role: 'user', online: true, avatar: "https://i.pravatar.cc/150?img=3" },
    { id: 5, username: "David", role: 'user', online: true, avatar: "https://i.pravatar.cc/150?img=4" },
];
const mockOfflineUsers: User[] = [
    { id: 2, username: "Bob", role: 'user', online: false, avatar: "https://i.pravatar.cc/150?img=2" },
     { id: 6, username: "Eve", role: 'user', online: false, avatar: "https://i.pravatar.cc/150?img=5" },
];

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null); // State for current user
  const [isLoggingOut, setIsLoggingOut] = useState(false);
   const [onlineUsers, setOnlineUsers] = useState<User[]>([]); // State for online users
   const [offlineUsers, setOfflineUsers] = useState<User[]>([]); // State for offline users
   const [isLoadingUser, setIsLoadingUser] = useState(true); // Loading state for user data
   const [unreadNotifications, setUnreadNotifications] = useState(0); // State for unread count
   const notificationIntervalRef = React.useRef<NodeJS.Timeout | null>(null);

  const router = useRouter();
  const pathname = usePathname(); // Get current path
  const { toast } = useToast();


   // Fetch initial notifications
   const fetchInitialNotifications = useCallback(async () => {
     try {
       const notificationResult = await getNotifications();
       if (notificationResult.success && notificationResult.unreadCount !== undefined) {
         setUnreadNotifications(notificationResult.unreadCount);
       }
     } catch (error) {
       console.warn("Initial notification fetch failed:", error);
     }
   }, []);


  // Fetch current user data and start polling
   useEffect(() => {
     const fetchInitialData = async () => {
         setIsLoadingUser(true);
         try {
             // Replace with actual fetch from an API endpoint or server component prop
             // const userResponse = await fetch('/api/auth/me'); // Example API endpoint
             // if (!userResponse.ok) throw new Error('Not authenticated');
             // const userData: User = await userResponse.json();

             // Simulate fetching based on session (placeholder)
             await new Promise(resolve => setTimeout(resolve, 300)); // Simulate delay
              // In a real app, fetch the actual logged-in user based on the session cookie
              // For now, assume AdminUser is logged in if testing admin features
              // const userData: User = { id: 4, username: "AdminUser", role: "admin", avatar: "https://github.com/shadcn.png" };
              // Or a regular user
              const userData: User = { id: 1, username: "Alice", role: "user", avatar: "https://i.pravatar.cc/150?img=1" };


             if (userData) {
                 setCurrentUser(userData);
                 await fetchInitialNotifications(); // Fetch notifications after user is set
                  startPolling(); // Start polling after initial setup
             } else {
                  throw new Error('User data not found'); // Should trigger catch block
             }


         } catch (error) {
             console.error("Failed to fetch user data:", error);
              toast({ variant: 'destructive', title: 'Authentication Error', description: 'Please log in again.'});
             router.replace('/login'); // Force redirect if user data fails
         } finally {
             setIsLoadingUser(false);
         }
     };
     fetchInitialData();

     // TODO: Implement polling/WebSocket for user list updates
     // Fetch mock users for now
     setOnlineUsers(mockOnlineUsers.filter(u => u.id !== currentUser?.id));
     setOfflineUsers(mockOfflineUsers);


     // Cleanup polling on unmount
     return () => {
       stopPolling();
     };
   // eslint-disable-next-line react-hooks/exhaustive-deps
   }, [router, fetchInitialNotifications]); // Added fetchInitialNotifications


    // --- Polling Logic ---
   const pollNotifications = useCallback(async () => {
       if (document.hidden || !currentUser) return; // Don't poll if tab not visible or user not loaded
       try {
           const notificationResult = await getNotifications();
           if (notificationResult.success && notificationResult.unreadCount !== undefined) {
               setUnreadNotifications(notificationResult.unreadCount);
           }
       } catch (error) {
           console.warn("Notification poll failed:", error);
       }
   }, [currentUser]);

   const startPolling = () => {
       stopPolling(); // Clear existing interval
       notificationIntervalRef.current = setInterval(pollNotifications, 15000); // Poll every 15 seconds
   };

   const stopPolling = () => {
       if (notificationIntervalRef.current) {
           clearInterval(notificationIntervalRef.current);
           notificationIntervalRef.current = null;
       }
   };

    // Restart polling if user changes (though unlikely in this setup)
    useEffect(() => {
        if (currentUser) {
            startPolling();
        }
        return () => stopPolling();
     }, [currentUser]);



  const toggleSidebar = () => {
    setIsSidebarCollapsed(!isSidebarCollapsed);
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    stopPolling(); // Stop polling on logout
    try {
      const result = await logoutUser();
      if (result.success) {
        toast({ title: "Logout Successful", description: "You have been logged out." });
        setCurrentUser(null); // Clear user state
        router.replace('/login'); // Redirect to login page
      } else {
        toast({ variant: "destructive", title: "Logout Failed", description: result.error });
        setIsLoggingOut(false);
         startPolling(); // Resume polling if logout fails
      }
    } catch (error) {
      console.error("Logout error:", error);
      toast({ variant: "destructive", title: "Logout Error", description: "An unexpected error occurred." });
      setIsLoggingOut(false);
       startPolling(); // Resume polling on error
    }
    // No need to set isLoggingOut to false on success because of redirect
  };

  const isUserAdmin = currentUser?.role === 'admin';


  // Display loading spinner while fetching user data
   if (isLoadingUser) {
        return (
            <div className="flex h-screen w-screen items-center justify-center bg-background">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
            </div>
        );
    }

    // If user data failed to load (should have been redirected, but safety check)
    if (!currentUser) {
         // Optional: Show an error message before redirect (though redirect should happen quickly)
         return (
             <div className="flex h-screen w-screen items-center justify-center bg-background text-destructive">
                 Authentication Error. Redirecting to login...
            </div>
        );
    }


  return (
    <TooltipProvider delayDuration={0}>
      <div className="flex h-screen bg-background text-foreground overflow-hidden">
        {/* Left Sidebar */}
        <nav
          className={cn(
            "flex flex-col justify-between border-r border-border transition-all duration-300 ease-in-out bg-card", // Use card background for sidebar
            isSidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED
          )}
        >
          {/* Top Section: Navigation */}
           <ScrollArea className="flex-1">
             <div className="flex flex-col space-y-1 p-2">
                 {/* Logo/Brand */}
                 <div className={cn("flex items-center h-14 mb-2", isSidebarCollapsed ? 'justify-center' : 'justify-start px-2')}>
                    <MessageSquare className="h-7 w-7 text-primary" />
                    {!isSidebarCollapsed && <span className="ml-2 font-semibold text-xl">SecureShare</span>}
                </div>

                {/* Search Bar Placeholder */}
                 {/* {!isSidebarCollapsed && (
                    <div className="relative px-2 mb-2">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input placeholder="Search..." className="pl-8 h-8" />
                    </div>
                 )} */}


                <NavItem
                  href="/dashboard"
                  icon={Home}
                  label="Dashboard"
                  isCollapsed={isSidebarCollapsed}
                  isActive={pathname === '/dashboard'}
                />
                <NavItem
                  href="/dashboard/files"
                  icon={File}
                  label="Files"
                  isCollapsed={isSidebarCollapsed}
                  isActive={pathname.startsWith('/dashboard/files')}
                />
                 <NavItem
                  href="/dashboard/chat"
                  icon={MessageSquare}
                  label="Public Chat"
                  isCollapsed={isSidebarCollapsed}
                  isActive={pathname.startsWith('/dashboard/chat')}
                />
                <NavItem
                  href="/dashboard/users"
                  icon={Users}
                  label="Users List" // Renamed for clarity vs Manage Users
                  isCollapsed={isSidebarCollapsed}
                   isActive={pathname === '/dashboard/users'} // Exact match for general users list
                />
                <NavItem
                  href="/dashboard/notifications"
                  icon={Bell}
                  label="Notifications"
                  isCollapsed={isSidebarCollapsed}
                   isActive={pathname.startsWith('/dashboard/notifications')}
                   badgeCount={unreadNotifications} // Pass unread count
                />

                {/* Admin Section */}
                 {isUserAdmin && (
                    <>
                         <Separator className="my-2" />
                         <p className={cn("px-3 text-xs font-semibold text-muted-foreground tracking-wider uppercase", isSidebarCollapsed && "text-center text-[10px] px-0")}>
                           {!isSidebarCollapsed ? "Admin Panel" : "Adm"}
                        </p>
                        <NavItem
                        href="/dashboard/admin/users"
                        icon={UserPlus}
                        label="Manage Users"
                        isCollapsed={isSidebarCollapsed}
                         isActive={pathname.startsWith('/dashboard/admin/users')}
                        isAdmin
                        />
                        <NavItem
                        href="/dashboard/admin/files"
                        icon={FilePlus}
                        label="Manage Files"
                        isCollapsed={isSidebarCollapsed}
                        isActive={pathname.startsWith('/dashboard/admin/files')}
                        isAdmin
                        />
                        <NavItem
                        href="/dashboard/admin/settings"
                        icon={DatabaseZap} // Changed icon
                        label="System Config" // Shortened label
                        isCollapsed={isSidebarCollapsed}
                         isActive={pathname.startsWith('/dashboard/admin/settings')}
                        isAdmin
                        />
                        <NavItem
                        href="/dashboard/admin/logs"
                        icon={LayoutList} // Changed icon
                        label="Activity Logs"
                        isCollapsed={isSidebarCollapsed}
                        isActive={pathname.startsWith('/dashboard/admin/logs')}
                        isAdmin
                        />
                         {/* TODO: Add links for Content Moderation, Statistics, Security Controls if implemented */}
                         {/* <NavItem
                            href="/dashboard/admin/moderation"
                            icon={ShieldCheck} // Placeholder icon
                            label="Moderation"
                            isCollapsed={isSidebarCollapsed}
                            isActive={pathname.startsWith('/dashboard/admin/moderation')}
                            isAdmin
                        /> */}
                    </>
                )}
             </div>
           </ScrollArea>

          {/* Bottom Section: User Profile & Collapse Button */}
          <div className="p-2 border-t border-border">
             <Button variant="ghost" onClick={toggleSidebar} className="w-full justify-center mb-2 h-9">
              {isSidebarCollapsed ? (
                <ChevronsRight className="h-5 w-5" />
              ) : (
                 <ChevronsLeft className="h-5 w-5" />
              )}
               <span className="sr-only">{isSidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}</span>
            </Button>
            <Separator className="mb-2" />
            <div className={cn("flex items-center space-x-2", isSidebarCollapsed ? 'justify-center' : 'justify-between')}>
                 <div className="flex items-center space-x-2 overflow-hidden">
                    <Avatar className="h-8 w-8">
                         {/* Use a placeholder/fallback pattern */}
                         <AvatarImage src={currentUser.avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${currentUser.username}`} alt={currentUser.username} />
                         <AvatarFallback>{currentUser.username.substring(0, 1).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    {!isSidebarCollapsed && (
                        <div className="flex flex-col overflow-hidden">
                            <span className="text-sm font-medium truncate">{currentUser.username}</span>
                            <span className="text-xs text-muted-foreground capitalize truncate">{currentUser.role}</span>
                        </div>
                    )}
                </div>

                 {/* Logout Button */}
                <Tooltip>
                    <TooltipTrigger asChild>
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 flex-shrink-0"
                        onClick={handleLogout}
                        disabled={isLoggingOut}
                        >
                        {isLoggingOut ? <Loader2 className="h-4 w-4 animate-spin" /> : <LogOut className="h-4 w-4" />}
                    </Button>
                    </TooltipTrigger>
                    <TooltipContent side={isSidebarCollapsed ? "right" : "top"}>Logout</TooltipContent>
                </Tooltip>

            </div>
          </div>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 flex flex-col overflow-hidden">
           {/* Optional Header Bar - Could be useful for breadcrumbs or page titles */}
           {/* <header className="h-12 flex items-center justify-between border-b border-border px-4 shrink-0">
                <h1 className="text-lg font-semibold">Dashboard</h1> // Dynamic title needed
                <div className="flex items-center gap-2"> // Example actions
                    <Button variant="outline" size="sm">Action 1</Button>
                    <Button size="sm">Action 2</Button>
                </div>
           </header> */}
           <ScrollArea className="flex-1">
               <div className="p-4 md:p-6">
                 {children}
               </div>
           </ScrollArea>
        </main>

        {/* Right User List Sidebar */}
         {/* Conditionally render User List based on screen size or preference? */}
        <aside className={cn("border-l border-border flex-shrink-0 bg-card hidden md:block", USERLIST_WIDTH)}>
          <ScrollArea className="h-full p-3">
             {/* TODO: Add Search/Filter for User List */}
             {/* <div className="relative mb-3">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input placeholder="Search users..." className="pl-8 h-7 text-xs" />
            </div> */}

            <h2 className="text-xs font-semibold text-muted-foreground mb-3 px-1 uppercase tracking-wider">Online — {onlineUsers.length}</h2>
            <div className="space-y-1">
              {onlineUsers.map((user) => (
                <UserItem key={`online-${user.id}`} user={user} currentUser={currentUser} />
              ))}
            </div>

            <h2 className="text-xs font-semibold text-muted-foreground mt-4 mb-3 px-1 uppercase tracking-wider">Offline — {offlineUsers.length}</h2>
             <div className="space-y-1">
               {offlineUsers.map((user) => (
                <UserItem key={`offline-${user.id}`} user={user} currentUser={currentUser} />
              ))}
            </div>
          </ScrollArea>
        </aside>
      </div>
    </TooltipProvider>
  );
}

// Helper component for Navigation Items
interface NavItemProps {
  href: string;
  icon: React.ElementType;
  label: string;
  isCollapsed: boolean;
  isActive: boolean; // Added for active state styling
  isAdmin?: boolean;
  badgeCount?: number; // Optional badge count
}

const NavItem: React.FC<NavItemProps> = ({
  href,
  icon: Icon,
  label,
  isCollapsed,
  isActive,
  isAdmin = false,
  badgeCount,
}) => {

  const itemContent = (
    <Link
      href={href}
      className={cn(
        "flex items-center rounded-md text-sm font-medium transition-colors h-9 relative", // Added relative positioning
        "hover:bg-accent hover:text-accent-foreground",
        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover:text-foreground",
        isCollapsed ? "justify-center w-10" : "px-3 justify-start",
         isAdmin && !isActive && "text-muted-foreground/80 hover:text-foreground", // Style admin items slightly differently if desired
         isAdmin && isActive && "text-primary", // Ensure active admin items use primary color
      )}
      aria-current={isActive ? "page" : undefined}
    >
      <Icon className={cn("h-5 w-5 flex-shrink-0", isCollapsed ? "" : "mr-3")} />
      {!isCollapsed && <span className="truncate flex-1">{label}</span>}
       {/* Badge for notification count */}
      {!isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
        <Badge variant="primary" className="ml-auto h-5 px-1.5 text-xs">
            {badgeCount > 9 ? '9+' : badgeCount}
        </Badge>
      )}
      {/* Smaller badge for collapsed view */}
       {isCollapsed && badgeCount !== undefined && badgeCount > 0 && (
         <Badge
             variant="primary"
             className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
            >
            {badgeCount > 9 ? '!' : badgeCount} {/* Show '!' if > 9 */}
        </Badge>
      )}
    </Link>
  );

  if (isCollapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>{itemContent}</TooltipTrigger>
        <TooltipContent side="right">{label}{badgeCount ? ` (${badgeCount})` : ''}</TooltipContent>
      </Tooltip>
    );
  }

  return itemContent;
};


// Helper component for User Items in the right sidebar
interface UserItemProps {
  user: User;
  currentUser: User | null; // Pass current user to disable messaging self
}

const UserItem: React.FC<UserItemProps> = ({ user, currentUser }) => {
    const router = useRouter(); // Use router for navigation

    // TODO: Implement proper private messaging navigation
    const handlePrivateMessageClick = () => {
         if (user.id === currentUser?.id) return; // Don't message self
        console.log(`Initiate private chat with ${user.username} (ID: ${user.id})`);
        // Example navigation (needs corresponding page structure e.g., /dashboard/chat/[userId])
        // router.push(`/dashboard/chat/${user.id}`);
         alert(`Starting private chat with ${user.username} - Navigation not implemented.`);
    }

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                 <Button
                    variant="ghost"
                    className="w-full justify-start h-10 px-2"
                    onClick={handlePrivateMessageClick}
                    disabled={user.id === currentUser?.id || !user.online} // Disable messaging self or offline users
                    >
                    <div className="flex items-center space-x-2 w-full">
                        <div className="relative flex-shrink-0">
                            <Avatar className="h-7 w-7">
                                 <AvatarImage src={user.avatar || `https://api.dicebear.com/8.x/initials/svg?seed=${user.username}`} alt={user.username} />
                                <AvatarFallback>{user.username.substring(0, 1).toUpperCase()}</AvatarFallback>
                            </Avatar>
                            {user.online && (
                                <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-1 ring-background" />
                            )}
                        </div>
                        <span className={cn("text-sm truncate", !user.online && "opacity-50")}>
                            {user.username} {user.id === currentUser?.id && "(You)"}
                        </span>
                    </div>
                </Button>
            </TooltipTrigger>
             <TooltipContent side="left" align="center">
                 {user.id === currentUser?.id ? "You" : (user.online ? `Message ${user.username}` : `${user.username} (Offline)`)}
            </TooltipContent>
        </Tooltip>

    )
}
