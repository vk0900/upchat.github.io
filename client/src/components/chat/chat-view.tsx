import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import ChatMessage, { MessageProps } from "./chat-message";
import MessageInput from "./message-input";
import { User } from "@shared/schema";
import { Loader2 } from "lucide-react";

interface ChatViewProps {
  channel: string;
  directMessageUser: User | null;
}

export default function ChatView({ channel, directMessageUser }: ChatViewProps) {
  const { user } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<MessageProps[]>([]);
  const [isLoadingMoreMessages, setIsLoadingMoreMessages] = useState(false);
  
  // Fetch messages for this channel or DM conversation
  const queryKey = directMessageUser 
    ? ["/api/messages/direct", directMessageUser.id] 
    : ["/api/messages/channel", channel];
  
  const { data: fetchedMessages, isLoading } = useQuery<MessageProps[]>({
    queryKey,
    // Adding a fake poll every 5 seconds to simulate real-time updates
    refetchInterval: 5000,
  });
  
  // Update messages when data changes
  useEffect(() => {
    if (fetchedMessages) {
      setMessages(fetchedMessages);
    }
  }, [fetchedMessages]);
  
  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);
  
  // Simulate loading more messages when scrolling to top
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const { scrollTop } = e.currentTarget;
    if (scrollTop === 0 && !isLoadingMoreMessages) {
      setIsLoadingMoreMessages(true);
      setTimeout(() => {
        setIsLoadingMoreMessages(false);
      }, 1000);
    }
  };

  const sendMessage = async (content: string) => {
    if (!content.trim()) return;
    
    // Add a temporary message to the UI
    const tempMessage: MessageProps = {
      id: `temp-${Date.now()}`,
      content,
      sender: user!,
      timestamp: new Date(),
    };
    
    setMessages([...messages, tempMessage]);
    
    // In a real app, you would send the message to the API
    // const response = await apiRequest('POST', '/api/messages', {
    //   content,
    //   channelId: channel,
    //   recipientId: directMessageUser?.id,
    // });
  };

  // Generate demo messages if none are loaded
  useEffect(() => {
    if (!fetchedMessages && !isLoading) {
      const demoMessages: MessageProps[] = [];
      
      // System message
      demoMessages.push({
        id: "system-1",
        content: directMessageUser 
          ? "This is the beginning of your direct message history with this user." 
          : `Welcome to #${channel}!`,
        sender: { id: 0, username: "System", role: "system" },
        timestamp: new Date(Date.now() - 3600000),
        isSystemMessage: true
      });
      
      if (channel === "general" && !directMessageUser) {
        // Sample messages for general channel
        demoMessages.push({
          id: "msg-1",
          content: "Hey team, I've just uploaded the project requirements. Please take a look and let me know if you have any questions.",
          sender: { id: 3, username: "Sarah", role: "user" },
          timestamp: new Date(Date.now() - 2400000),
          fileAttachment: {
            id: "file-1",
            name: "Project_Requirements.docx",
            type: "application/msword",
            size: 2400000,
            url: "#"
          }
        });
        
        demoMessages.push({
          id: "msg-2",
          content: "Thanks for sharing Sarah! I'll review it this afternoon.",
          sender: { id: 2, username: "Mary", role: "user" },
          timestamp: new Date(Date.now() - 2200000)
        });
        
        demoMessages.push({
          id: "msg-3",
          content: "I'm working on the design mockups right now. @4 can you share the brand guidelines again?",
          sender: { id: 1, username: "John", role: "admin" },
          timestamp: new Date(Date.now() - 1500000),
          mentions: [4]
        });
      }
      
      setMessages(demoMessages);
    }
  }, [channel, directMessageUser, fetchedMessages, isLoading]);

  return (
    <>
      <div 
        className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide"
        onScroll={handleScroll}
      >
        {isLoadingMoreMessages && (
          <div className="flex justify-center py-2">
            <Loader2 className="h-5 w-5 animate-spin text-discord-light" />
          </div>
        )}
        
        {/* Welcome/intro message */}
        <div className="bg-discord-darker bg-opacity-50 p-4 rounded-md mb-4 text-center">
          <h3 className="text-lg font-bold">
            {directMessageUser 
              ? `Direct Messages with ${directMessageUser.username}` 
              : `Welcome to #${channel}!`}
          </h3>
          <p className="text-discord-light">
            {directMessageUser 
              ? "This is the start of your direct message history." 
              : `This is the start of the #${channel} channel. ${
                channel === "general" 
                  ? "Share files and chat with your team." 
                  : channel === "announcements" 
                    ? "Important announcements will be posted here." 
                    : "Share and discuss files with your team."
              }`}
          </p>
        </div>
        
        {/* Messages */}
        {isLoading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
          </div>
        ) : (
          messages.map((message) => (
            <ChatMessage
              key={message.id}
              {...message}
            />
          ))
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <MessageInput onSendMessage={sendMessage} />
    </>
  );
}
