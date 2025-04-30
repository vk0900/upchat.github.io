import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { User } from "@shared/schema";
import { useQuery } from "@tanstack/react-query";
import { Search, Plus, Settings } from "lucide-react";
import { Input } from "@/components/ui/input";

interface ChannelSidebarProps {
  activeChannel: string;
  setActiveChannel: (channel: string) => void;
  onFileUpload: () => void;
  setDirectMessageUser: (user: User) => void;
}

export default function ChannelSidebar({ 
  activeChannel, 
  setActiveChannel,
  onFileUpload,
  setDirectMessageUser
}: ChannelSidebarProps) {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  
  // Get all users for direct messages
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Get user's files
  const { data: userFiles } = useQuery({
    queryKey: ["/api/files", "user"],
  });

  const channels = [
    { id: "general", name: "general", unread: false },
    { id: "announcements", name: "announcements", unread: false },
    { id: "file-sharing", name: "file-sharing", unread: true }
  ];

  // Filter direct message users based on search
  const filteredUsers = users?.filter(u => 
    u.id !== user?.id && 
    u.username.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <aside className="bg-discord-darker w-16 md:w-60 flex flex-col">
      <div className="p-4 border-b border-gray-700">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-discord-light" />
          <Input 
            type="text" 
            placeholder="Search..." 
            className="w-full bg-discord-darkest text-discord-light py-1 pl-9 pr-3 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-discord-primary"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1 scrollbar-hide">
        <div className="p-2">
          <div className="flex items-center justify-between text-discord-light text-xs uppercase font-semibold px-2 py-2">
            <span>Channels</span>
            {user?.role === "admin" && (
              <button className="hover:text-white" title="Create Channel">
                <Plus className="h-4 w-4" />
              </button>
            )}
          </div>
          <ul className="space-y-1">
            {channels.map(channel => (
              <li 
                key={channel.id}
                className={activeChannel === channel.id ? "bg-discord-dark rounded" : ""}
              >
                <button 
                  onClick={() => setActiveChannel(channel.id)}
                  className={`flex items-center px-2 py-1 ${
                    activeChannel === channel.id 
                      ? "text-white font-medium" 
                      : "text-discord-light hover:text-white hover:bg-discord-dark"
                  } rounded w-full text-left`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-discord-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M7 20l4-16m2 16l4-16" />
                  </svg>
                  <span className="hidden md:inline">{channel.name}</span>
                  {channel.unread && (
                    <span className="ml-auto flex h-2 w-2 rounded-full bg-discord-danger"/>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="p-2">
          <div className="flex items-center justify-between text-discord-light text-xs uppercase font-semibold px-2 py-2">
            <span>Direct Messages</span>
            <button className="hover:text-white" title="New Message">
              <Plus className="h-4 w-4" />
            </button>
          </div>
          <ul className="space-y-1">
            {filteredUsers.map(dmUser => {
              // Generate a color based on user id for the avatar
              const colors = ["bg-red-500", "bg-blue-500", "bg-green-500", "bg-purple-500", "bg-yellow-500"];
              const userColor = colors[dmUser.id % colors.length];
              
              return (
                <li key={dmUser.id}>
                  <button 
                    onClick={() => setDirectMessageUser(dmUser)}
                    className="flex items-center px-2 py-1 text-discord-light hover:text-white hover:bg-discord-dark rounded w-full text-left"
                  >
                    <div className={`w-6 h-6 rounded-full ${userColor} flex items-center justify-center text-white text-xs mr-2`}>
                      <span>{dmUser.username.slice(0, 2).toUpperCase()}</span>
                    </div>
                    <span className="hidden md:inline truncate">{dmUser.username}</span>
                    {/* Example notification indicator */}
                    {dmUser.id % 3 === 0 && (
                      <span className="ml-auto bg-discord-danger rounded-full w-5 h-5 flex items-center justify-center text-white text-xs">
                        2
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="p-2 md:block hidden">
          <div className="flex items-center justify-between text-discord-light text-xs uppercase font-semibold px-2 py-2">
            <span>My Files</span>
            <button 
              onClick={onFileUpload}
              className="hover:text-white" 
              title="Upload File"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="17 8 12 3 7 8" />
                <line x1="12" y1="3" x2="12" y2="15" />
              </svg>
            </button>
          </div>
          <ul className="space-y-1">
            {userFiles ? (
              userFiles.slice(0, 3).map((file, index) => (
                <li key={index}>
                  <a href="#" className="flex items-center px-2 py-1 text-discord-light hover:text-white hover:bg-discord-dark rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                      <line x1="16" y1="13" x2="8" y2="13" />
                      <line x1="16" y1="17" x2="8" y2="17" />
                      <polyline points="10 9 9 9 8 9" />
                    </svg>
                    <span className="truncate">{file.name}</span>
                  </a>
                </li>
              ))
            ) : (
              <>
                {/* Placeholder file items */}
                <li>
                  <a href="#" className="flex items-center px-2 py-1 text-discord-light hover:text-white hover:bg-discord-dark rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-red-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate">Project_Report.pdf</span>
                  </a>
                </li>
                <li>
                  <a href="#" className="flex items-center px-2 py-1 text-discord-light hover:text-white hover:bg-discord-dark rounded">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                      <polyline points="14 2 14 8 20 8" />
                    </svg>
                    <span className="truncate">Design_mockup.png</span>
                  </a>
                </li>
              </>
            )}
            <li>
              <a href="#" className="flex items-center px-2 py-1 text-discord-light hover:text-white hover:bg-discord-dark rounded text-xs">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
                </svg>
                <span>View all files</span>
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="p-3 bg-discord-darkest flex items-center mt-auto">
        <div className="w-8 h-8 rounded-full bg-discord-primary flex items-center justify-center text-white">
          <span className="text-sm font-medium">{user?.username.slice(0, 2).toUpperCase()}</span>
        </div>
        <div className="ml-2 hidden md:block">
          <div className="text-sm font-medium text-white">{user?.username}</div>
          <div className="text-xs text-discord-light">Online</div>
        </div>
        <div className="ml-auto hidden md:flex space-x-2 text-discord-light">
          <button className="hover:text-white" title="Settings">
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
