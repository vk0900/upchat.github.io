// src/app/dashboard/notifications/page.tsx
"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, X, MessageSquare, File, Loader2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import React, { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { getNotifications, markNotificationsRead, deleteNotification as deleteNotificationAction } from "@/actions/notifications"; // Renamed action import
import { cn } from "@/lib/utils";


// Define Notification type matching the backend structure
interface NotificationData {
    id: number;
    type: string;
    text: string;
    resource_id: number | null;
    read_status: boolean;
    created_at: string; // ISO string from DB
    time_ago: string; // Formatted string from action
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Fetch notifications on mount
  useEffect(() => {
    fetchNotifications();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchNotifications = async () => {
    setIsLoading(true);
    try {
        const result = await getNotifications();
        if (result.success && result.notifications) {
            setNotifications(result.notifications);
        } else {
             toast({ variant: "destructive", title: "Error", description: result.error || "Could not fetch notifications." });
             setNotifications([]);
        }
    } catch (error) {
        console.error("Failed to fetch notifications:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not connect to server." });
        setNotifications([]);
    } finally {
        setIsLoading(false);
    }
  };


  const handleMarkAsRead = async (id: number) => {
    // Optimistic UI update
    setNotifications(notifications.map(n => n.id === id ? { ...n, read_status: true } : n));

    try {
        const result = await markNotificationsRead({ notificationId: id });
        if (!result.success) {
            toast({ variant: "destructive", title: "Error", description: result.error || "Failed to mark as read." });
            // Revert UI
            setNotifications(notifications.map(n => n.id === id ? { ...n, read_status: false } : n));
        }
         // No success toast needed, UI change is enough feedback
    } catch (error) {
        console.error("Mark as read error:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not update notification." });
        // Revert UI
         setNotifications(notifications.map(n => n.id === id ? { ...n, read_status: false } : n));
    }
  };

  const handleMarkAllAsRead = async () => {
      const originalNotifications = [...notifications];
      // Optimistic UI update
      setNotifications(notifications.map(n => ({ ...n, read_status: true })));

      try {
          const result = await markNotificationsRead({ markAll: true });
          if (!result.success) {
              toast({ variant: "destructive", title: "Error", description: result.error || "Failed to mark all as read." });
              // Revert UI
              setNotifications(originalNotifications);
          } else {
              toast({ title: "Success", description: "All notifications marked as read." });
          }
      } catch (error) {
          console.error("Mark all as read error:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not update notifications." });
          // Revert UI
          setNotifications(originalNotifications);
      }
  }

  const handleDeleteNotification = async (id: number) => {
      const originalNotifications = [...notifications];
      // Optimistic UI update
      setNotifications(notifications.filter(n => n.id !== id));

      try {
           const result = await deleteNotificationAction({ notificationId: id }); // Use renamed action
          if (!result.success) {
              toast({ variant: "destructive", title: "Error", description: result.error || "Failed to delete notification." });
              // Revert UI
              setNotifications(originalNotifications);
          }
           // No success toast needed, UI change is enough feedback
      } catch (error) {
          console.error("Delete notification error:", error);
          toast({ variant: "destructive", title: "Error", description: "Could not delete notification." });
           // Revert UI
          setNotifications(originalNotifications);
      }
  }

  // Get Icon based on notification type
  const getIcon = (type: string) => {
    switch (type.toLowerCase()) { // Normalize type
      case 'message': return <MessageSquare className="h-4 w-4" />;
      case 'file':
      case 'file_share': // Handle potential variations
         return <File className="h-4 w-4" />;
      case 'system': return <Bell className="h-4 w-4" />;
      default: return <Bell className="h-4 w-4" />;
    }
  };

    const unreadCount = notifications.filter(n => !n.read_status).length;

  return (
    <div className="space-y-6">
       <Card>
         <CardHeader className="flex flex-row items-center justify-between">
           <div>
            <CardTitle className="flex items-center gap-2">
                Notifications
                {unreadCount > 0 && (
                    <Badge variant="primary" className="h-5 px-1.5 text-xs">{unreadCount}</Badge>
                )}
                </CardTitle>
            <CardDescription>Recent updates and alerts.</CardDescription>
           </div>
           <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isLoading || unreadCount === 0}
            >
                <Check className="mr-2 h-4 w-4"/> Mark all as read
            </Button>
        </CardHeader>
        <CardContent>
            {isLoading ? (
                 <div className="flex justify-center items-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-primary" />
                 </div>
            ) : notifications.length === 0 ? (
                 <p className="text-muted-foreground text-center py-8">No notifications.</p>
            ) : (
            <ul className="space-y-3">
                {notifications.map((notification) => (
                <li
                    key={notification.id}
                    className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        notification.read_status ? 'bg-card/50 border-border' : 'bg-card border-primary/30 shadow-sm'
                        )}
                >
                    <span className={cn("mt-1 flex-shrink-0", notification.read_status ? 'text-muted-foreground' : 'text-primary')}>
                        {getIcon(notification.type)}
                    </span>
                    <div className="flex-1 overflow-hidden">
                        <p className={cn("text-sm break-words", notification.read_status ? 'text-muted-foreground' : 'font-medium text-foreground')}>
                            {notification.text}
                        </p>
                        <span className="text-xs text-muted-foreground">{notification.time_ago}</span>
                    </div>
                    <div className="flex gap-1 items-center flex-shrink-0">
                        {!notification.read_status && (
                            <Button variant="ghost" size="sm" onClick={() => handleMarkAsRead(notification.id)} className="h-7 px-2 text-xs">
                                <Check className="h-3 w-3 mr-1"/> Read
                            </Button>
                        )}
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => handleDeleteNotification(notification.id)}>
                             <X className="h-4 w-4" />
                             <span className="sr-only">Dismiss</span>
                        </Button>
                    </div>
                </li>
                ))}
            </ul>
            )}
        </CardContent>
       </Card>
    </div>
  );
}
