"use client";

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, Smile, Loader2 } from 'lucide-react'; // Added icons
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { sendMessage, getMessages } from '@/actions/chat'; // Import chat actions

// Define Message type matching the backend structure
interface MessageWithSender {
  id: number;
  sender_id: number;
  recipient_id: number | null;
  text: string;
  timestamp: string; // Formatted time string
  room_type: 'public' | 'private';
  sender_username: string;
  sender_avatar?: string;
  is_own: boolean;
}

// Mock current user (replace with actual fetched data)
interface CurrentUser {
    id: number;
    username: string;
    avatar?: string;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<MessageWithSender[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null); // Will be fetched
  const [isLoadingMessages, setIsLoadingMessages] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [lastFetchedTimestamp, setLastFetchedTimestamp] = useState<string | undefined>(undefined);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

   // Fetch current user info (replace with proper auth context/hook later)
    useEffect(() => {
        // Simulate fetching user data - replace with actual API call
        const fetchUser = async () => {
            // In real app, fetch from /api/auth/me or similar
            await new Promise(resolve => setTimeout(resolve, 200)); // Simulate delay
             const simulatedUser: CurrentUser = { id: 4, username: "AdminUser", avatar: "https://github.com/shadcn.png" };
            setCurrentUser(simulatedUser);
        };
        fetchUser();
    }, []);

    // Fetch initial messages and start polling
    useEffect(() => {
        if (!currentUser) return; // Don't fetch until user is loaded

        const fetchInitialAndPoll = async () => {
            await fetchAndSetMessages(); // Fetch initial messages
            startPolling(); // Start polling for new messages
        };

        fetchInitialAndPoll();

        // Cleanup interval on component unmount
        return () => {
            stopPolling();
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentUser]); // Depend on currentUser

     const fetchAndSetMessages = useCallback(async (since?: string) => {
        if (!since) setIsLoadingMessages(true); // Show loader only for initial load
        try {
             // Fetching only public messages for this page
            const result = await getMessages({
                roomType: 'public',
                sinceTimestamp: since,
            });

            if (result.success && result.messages) {
                if (since) {
                    // Append new messages
                     setMessages(prev => [...prev, ...result.messages!]);
                } else {
                    // Set initial messages
                    setMessages(result.messages || []);
                }
                // Update last fetched timestamp if messages were received
                if (result.messages.length > 0) {
                    // Find the latest timestamp *from the DB* before formatting
                    // Assuming the backend returns ISO strings originally
                    // This needs adjustment if backend sends formatted time directly
                    // For simplicity, let's assume the last message is the latest
                     // **IMPORTANT**: Need original ISO timestamp from backend for accurate polling
                     // Let's assume backend adds an `iso_timestamp` field for this purpose
                     // const latestIsoTimestamp = result.messages[result.messages.length - 1].iso_timestamp;
                     // setLastFetchedTimestamp(latestIsoTimestamp);

                     // Workaround: If no ISO timestamp, polling might fetch duplicates or miss messages
                     // Using Date.now() as a rough approximation, less reliable
                     setLastFetchedTimestamp(new Date().toISOString());

                }
            } else {
                if (!since) { // Show error only on initial load failure
                     toast({ variant: "destructive", title: "Error", description: result.error || "Could not fetch messages." });
                } else {
                    console.warn("Polling failed:", result.error); // Log polling errors silently
                }
            }
        } catch (error) {
             if (!since) {
                console.error("Failed to fetch messages:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not connect to the server." });
             } else {
                console.warn("Polling connection error:", error);
             }
        } finally {
            if (!since) setIsLoadingMessages(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [toast]); // Removed lastFetchedTimestamp dependency to avoid potential issues

    const pollMessages = useCallback(() => {
        // console.log("Polling for new messages since:", lastFetchedTimestamp);
        fetchAndSetMessages(lastFetchedTimestamp);
    }, [fetchAndSetMessages, lastFetchedTimestamp]);

    const startPolling = () => {
        stopPolling(); // Clear existing interval if any
        pollIntervalRef.current = setInterval(pollMessages, 5000); // Poll every 5 seconds
    };

    const stopPolling = () => {
        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }
    };

    // Scroll to bottom when messages change or component loads
    useEffect(() => {
        if (scrollAreaRef.current) {
            // Delay scroll slightly to allow rendering
            setTimeout(() => {
                 if (scrollAreaRef.current) {
                    scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
                 }
            }, 100);
        }
    }, [messages]);


  const handleSendMessage = async (e: React.FormEvent) => {
     e.preventDefault();
    if (newMessage.trim() === "" || !currentUser || isSending) return;

    setIsSending(true);
    const tempMessageText = newMessage.trim(); // Store text before clearing
    setNewMessage(""); // Clear input immediately

    // Optimistic UI update (optional but improves perceived performance)
    const optimisticMessage: MessageWithSender = {
        id: Date.now(), // Temporary unique ID
        sender_id: currentUser.id,
        recipient_id: null,
        text: tempMessageText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        room_type: 'public',
        sender_username: currentUser.username,
        sender_avatar: currentUser.avatar,
        is_own: true,
    };
    setMessages(prev => [...prev, optimisticMessage]);

    try {
         const result = await sendMessage({
            text: tempMessageText,
            roomType: 'public',
            // No recipientId for public chat
        });

        if (!result.success) {
            toast({ variant: "destructive", title: "Error", description: result.error || "Failed to send message." });
            // Revert optimistic update if needed, or mark message as failed
             setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id)); // Simple revert
             setNewMessage(tempMessageText); // Restore input
        } else {
            // Message sent successfully. Optionally update the optimistic message ID if backend returns it
             // If polling is working, the message will arrive via polling, so remove optimistic one
             // setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
             // OR, if backend returns the final message, update the optimistic one:
             // setMessages(prev => prev.map(msg => msg.id === optimisticMessage.id ? { ...msg, id: result.messageId } : msg));

             // For simplicity with polling, let polling handle adding the confirmed message.
              setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id));
              // Immediately poll after sending to get the message faster
              pollMessages();

        }
    } catch (error) {
        console.error("Send message error:", error);
        toast({ variant: "destructive", title: "Error", description: "Could not send message due to a network issue." });
         setMessages(prev => prev.filter(msg => msg.id !== optimisticMessage.id)); // Revert
         setNewMessage(tempMessageText); // Restore input
    } finally {
        setIsSending(false);
    }
  };

   // TODO: Implement file attachment logic
   const handleAttachFile = () => {
        toast({ title: "Coming Soon", description: "File attachment in chat is not yet implemented." });
   }

  return (
    // Removed fixed height, let dashboard layout handle scrolling
    <div className="flex flex-col h-[calc(100vh-10rem)]"> {/* Adjust based on surrounding layout */}
        {/* Chat Messages Area */}
        {isLoadingMessages ? (
            <div className="flex-1 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        ) : (
            <ScrollArea className="flex-1 p-4 space-y-4 bg-background" ref={scrollAreaRef as any}>
                {messages.length === 0 && (
                    <p className="text-center text-muted-foreground py-10">No messages yet. Start the conversation!</p>
                )}
                {messages.map((msg, index) => {
                    // Group consecutive messages from the same user
                    const prevMsg = index > 0 ? messages[index - 1] : null;
                    const showHeader = !prevMsg || prevMsg.sender_id !== msg.sender_id || (new Date(msg.timestamp).getTime() - new Date(prevMsg.timestamp).getTime() > 5 * 60 * 1000) ; // Show header if different user or > 5 min gap

                    return (
                        <div
                        key={msg.id} // Use real ID from DB
                        className={cn(
                            "flex items-start gap-3",
                            !showHeader && "mt-1", // Reduced margin for consecutive messages
                            msg.is_own ? "justify-end" : "justify-start"
                        )}
                        >
                        {!msg.is_own && (
                            <Avatar className={cn("h-10 w-10 flex-shrink-0", !showHeader && "invisible")}>
                            <AvatarImage src={msg.sender_avatar || `https://avatar.vercel.sh/${msg.sender_username}.png`} alt={msg.sender_username} />
                            <AvatarFallback>{msg.sender_username.substring(0, 1)}</AvatarFallback>
                            </Avatar>
                        )}
                        <div className={cn("flex flex-col max-w-[75%]", msg.is_own ? "items-end" : "items-start")}>
                            {showHeader && !msg.is_own && (
                            <div className="flex items-baseline gap-2 mb-1">
                                <span className="text-sm font-medium">{msg.sender_username}</span>
                                <span className="text-xs text-muted-foreground">{msg.timestamp}</span>
                            </div>
                            )}
                             {!showHeader && !msg.is_own && <div className="h-5"/> /* Placeholder for alignment */}

                            <div
                            className={cn(
                                "p-2 px-3 rounded-lg break-words",
                                msg.is_own
                                ? "bg-primary text-primary-foreground rounded-br-none"
                                : "bg-card rounded-bl-none",
                                // msg.id < 1000000 ? "" : "opacity-70" // Style optimistic messages differently (optional)
                            )}
                            >
                            {msg.text}
                            </div>
                            {/* Show timestamp below own messages */}
                            {msg.is_own && (
                                <span className="text-xs text-muted-foreground mt-1">{msg.timestamp}</span>
                            )}
                        </div>
                        {msg.is_own && (
                            <Avatar className={cn("h-10 w-10 flex-shrink-0", !showHeader && "invisible")}>
                             <AvatarImage src={currentUser?.avatar || `https://avatar.vercel.sh/${currentUser?.username}.png`} alt={currentUser?.username || 'User'} />
                             <AvatarFallback>{currentUser?.username.substring(0, 1) || 'U'}</AvatarFallback>
                            </Avatar>
                        )}

                        </div>
                    );
                })}
            </ScrollArea>
        )}

        {/* Message Input Area */}
        <div className="p-4 border-t border-border bg-card">
            <form onSubmit={handleSendMessage} className="flex items-center gap-2">
                <Button variant="ghost" size="icon" type="button" onClick={handleAttachFile} className="flex-shrink-0" disabled={isSending}>
                    <Paperclip className="h-5 w-5" />
                    <span className="sr-only">Attach file</span>
                </Button>
                <Input
                    type="text"
                    placeholder="Type a message..."
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 bg-background focus-visible:ring-1 focus-visible:ring-primary ring-offset-0"
                    autoComplete="off"
                    disabled={isSending || isLoadingMessages || !currentUser}
                />
                 <Button variant="ghost" size="icon" type="button" className="flex-shrink-0" disabled={isSending}>
                    <Smile className="h-5 w-5" />
                     <span className="sr-only">Add emoji</span>
                </Button>
                <Button type="submit" size="icon" className="flex-shrink-0 bg-primary hover:bg-primary/90" disabled={isSending || newMessage.trim() === ""}>
                    {isSending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                    <span className="sr-only">Send message</span>
                </Button>
            </form>
        </div>
    </div>
  );
}
