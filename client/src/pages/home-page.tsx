import { useEffect, useState } from "react";
import Header from "@/components/header";
import ChannelSidebar from "@/components/channel-sidebar";
import UserSidebar from "@/components/user-sidebar";
import ChatView from "@/components/chat/chat-view";
import FileView from "@/components/files/file-view";
import UploadFileModal from "@/components/files/upload-file-modal";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

export default function HomePage() {
  const { user } = useAuth();
  const [view, setView] = useState<"chat" | "files">("chat");
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [activeChannel, setActiveChannel] = useState("general");
  const [directMessageUser, setDirectMessageUser] = useState<User | null>(null);

  // Get all users for the userlist
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Example of polling for new messages
  useEffect(() => {
    const interval = setInterval(() => {
      // Poll for new messages
    }, 5000);
    
    return () => clearInterval(interval);
  }, []);

  const handleFileUpload = () => {
    setShowUploadModal(true);
  };

  const handleDirectMessage = (selectedUser: User) => {
    setDirectMessageUser(selectedUser);
    setView("chat");
  };

  return (
    <div className="h-screen flex flex-col overflow-hidden bg-discord-dark text-white">
      <Header 
        user={user} 
        onViewChange={setView} 
        currentView={view} 
      />
      
      <div className="flex flex-1 overflow-hidden">
        <ChannelSidebar 
          activeChannel={activeChannel} 
          setActiveChannel={setActiveChannel}
          onFileUpload={handleFileUpload}
          setDirectMessageUser={handleDirectMessage}
        />
        
        <main className="flex-1 flex flex-col bg-discord-dark overflow-hidden">
          <div className="border-b border-gray-700 p-3 flex items-center">
            <div>
              <h2 className="font-bold flex items-center">
                {directMessageUser ? (
                  <>
                    <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center text-white text-xs mr-2">
                      {directMessageUser.username.slice(0, 2).toUpperCase()}
                    </div>
                    {directMessageUser.username}
                  </>
                ) : (
                  <>
                    <i className="fa-solid fa-hashtag mr-2 text-discord-light"></i>
                    {activeChannel}
                  </>
                )}
              </h2>
              <p className="text-xs text-discord-light">
                {directMessageUser 
                  ? "Direct Message" 
                  : activeChannel === "general" 
                    ? "Team-wide discussions and updates" 
                    : activeChannel === "announcements" 
                      ? "Important team announcements" 
                      : "Share and discuss files"}
              </p>
            </div>
            <div className="ml-auto flex space-x-3">
              <button 
                className={`${view === "files" ? "text-white" : "text-discord-light hover:text-white"}`} 
                onClick={() => setView("files")} 
                title="Files View"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path>
                  <polyline points="13 2 13 9 20 9"></polyline>
                </svg>
              </button>
              <button 
                className={`${view === "chat" ? "text-white" : "text-discord-light hover:text-white"}`} 
                onClick={() => setView("chat")} 
                title="Chat View"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
                </svg>
              </button>
              <button className="text-discord-light hover:text-white" title="More Options">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="1"></circle>
                  <circle cx="12" cy="5" r="1"></circle>
                  <circle cx="12" cy="19" r="1"></circle>
                </svg>
              </button>
            </div>
          </div>

          {view === "chat" ? (
            <ChatView 
              channel={activeChannel} 
              directMessageUser={directMessageUser} 
            />
          ) : (
            <FileView 
              channel={activeChannel} 
              onUploadFile={handleFileUpload} 
            />
          )}
        </main>
        
        {/* Desktop only: Users sidebar */}
        <UserSidebar users={users || []} onSelectUser={handleDirectMessage} />
      </div>

      {showUploadModal && (
        <UploadFileModal 
          isOpen={showUploadModal} 
          onClose={() => setShowUploadModal(false)} 
          channel={activeChannel}
        />
      )}
    </div>
  );
}
