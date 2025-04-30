import { useState, useRef } from "react";
import { PaperclipIcon, SmileIcon, SendIcon, PlusIcon } from "lucide-react";

interface MessageInputProps {
  onSendMessage: (message: string) => void;
}

export default function MessageInput({ onSendMessage }: MessageInputProps) {
  const [message, setMessage] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
    }
  };
  
  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="p-3 border-t border-gray-700">
      <form onSubmit={handleSubmit} className="relative">
        <button 
          type="button"
          className="absolute left-4 top-2.5 text-discord-light hover:text-white"
          onClick={() => inputRef.current?.focus()}
        >
          <PlusIcon className="h-5 w-5" />
        </button>
        
        <input 
          ref={inputRef}
          type="text" 
          placeholder="Message #general" 
          className="w-full bg-discord-darker text-white rounded-md py-2 pl-10 pr-24 focus:outline-none focus:ring-1 focus:ring-discord-primary"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
        />
        
        <div className="absolute right-3 top-2 flex space-x-2 text-discord-light">
          <button type="button" title="Attach File">
            <PaperclipIcon className="h-5 w-5 hover:text-white" />
          </button>
          <button type="button" title="Emoji">
            <SmileIcon className="h-5 w-5 hover:text-white" />
          </button>
          <button 
            type="submit" 
            title="Send"
            className={message.trim() ? "text-discord-primary" : ""}
          >
            <SendIcon className="h-5 w-5 hover:text-white" />
          </button>
        </div>
      </form>
    </div>
  );
}
