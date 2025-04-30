import { forwardRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { User } from "@shared/schema";
import { DownloadCloud, Eye } from "lucide-react";

interface FileAttachment {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
}

export interface MessageProps {
  id: string;
  content: string;
  sender: User | { username: string; id: number; role: string };
  timestamp: Date;
  fileAttachment?: FileAttachment;
  isSystemMessage?: boolean;
  mentions?: number[];
}

const ChatMessage = forwardRef<HTMLDivElement, MessageProps>(
  ({ content, sender, timestamp, fileAttachment, isSystemMessage, mentions = [] }, ref) => {
    // Generate color based on user id
    const getUserColor = (id: number) => {
      const colors = ["bg-red-500", "bg-green-500", "bg-blue-500", "bg-purple-500", "bg-yellow-500", "bg-discord-primary"];
      return colors[id % colors.length];
    };
    
    // Handle file icon based on file type
    const getFileIcon = (type: string) => {
      if (type.includes("pdf")) return "fa-file-pdf text-red-400";
      if (type.includes("word") || type.includes("doc")) return "fa-file-word text-blue-400";
      if (type.includes("excel") || type.includes("sheet") || type.includes("csv")) return "fa-file-excel text-green-400";
      if (type.includes("image")) return "fa-file-image text-purple-400";
      if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz")) return "fa-file-zipper text-yellow-400";
      return "fa-file text-discord-light";
    };
    
    // Format file size
    const formatFileSize = (bytes: number) => {
      if (bytes < 1024) return bytes + " B";
      else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
      else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
      else return (bytes / 1073741824).toFixed(1) + " GB";
    };
    
    // Replace mentions with styled spans
    const renderContentWithMentions = (text: string) => {
      if (!mentions || mentions.length === 0) return text;
      
      // This is a simple implementation - in a real app, you'd want to use regex with proper escaping
      let formattedContent = text;
      mentions.forEach((userId) => {
        formattedContent = formattedContent.replace(
          `@${userId}`,
          `<span class="bg-discord-mention text-discord-warning px-1 rounded">@${userId}</span>`
        );
      });
      
      return <span dangerouslySetInnerHTML={{ __html: formattedContent }} />;
    };
    
    return (
      <div ref={ref} className="flex items-start mb-4">
        <div className={`flex-shrink-0 w-10 h-10 rounded-full ${
          isSystemMessage 
            ? "bg-discord-darkest text-discord-light flex items-center justify-center" 
            : getUserColor(sender.id)
        } flex items-center justify-center text-white`}>
          {isSystemMessage ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
          ) : (
            <span>{sender.username.slice(0, 2).toUpperCase()}</span>
          )}
        </div>
        <div className="ml-3 flex-1">
          <div className="flex items-baseline">
            <span className={`font-medium ${
              isSystemMessage ? "text-discord-success" : "text-white"
            }`}>
              {sender.username}
            </span>
            <span className="ml-2 text-xs text-discord-light">
              {formatDistanceToNow(new Date(timestamp), { addSuffix: true })}
            </span>
          </div>
          <div className="mt-1 text-sm">
            <p>{renderContentWithMentions(content)}</p>
            {fileAttachment && (
              <div className="mt-2 border border-gray-700 rounded-md p-3 bg-discord-darker flex items-center">
                <div className="mr-3 text-2xl">
                  <i className={`fa-solid ${getFileIcon(fileAttachment.type)}`}></i>
                </div>
                <div className="flex-1">
                  <div className="font-medium">{fileAttachment.name}</div>
                  <div className="text-xs text-discord-light">
                    {fileAttachment.type.split("/")[1].toUpperCase()} • {formatFileSize(fileAttachment.size)}
                  </div>
                </div>
                <div className="flex space-x-2">
                  <button className="text-discord-light hover:text-white p-1" title="Download">
                    <DownloadCloud className="h-4 w-4" />
                  </button>
                  <button className="text-discord-light hover:text-white p-1" title="Preview">
                    <Eye className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

ChatMessage.displayName = "ChatMessage";

export default ChatMessage;
