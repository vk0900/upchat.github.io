import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { Bell, ChevronDown, UserCircle, Key, LogOut, Shield } from "lucide-react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuSeparator, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { User } from "@shared/schema";

interface HeaderProps {
  user: User | null;
  onViewChange: (view: "chat" | "files") => void;
  currentView: "chat" | "files";
}

export default function Header({ user, onViewChange, currentView }: HeaderProps) {
  const { logoutMutation } = useAuth();
  const [, setLocation] = useLocation();
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  
  const handleLogout = async () => {
    try {
      await logoutMutation.mutateAsync();
      setLocation("/auth");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };
  
  const navigateToAdmin = () => {
    setLocation("/admin");
  };

  return (
    <header className="bg-discord-darkest text-white p-3 flex justify-between items-center">
      <div className="flex items-center">
        <span className="font-bold text-xl">FileChat</span>
      </div>
      <div className="flex items-center space-x-4">
        <button className="relative text-discord-light hover:text-white">
          <Bell className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 bg-discord-danger text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
            3
          </span>
        </button>
        
        <DropdownMenu open={showUserDropdown} onOpenChange={setShowUserDropdown}>
          <DropdownMenuTrigger asChild>
            <button 
              className="flex items-center space-x-2 text-discord-light hover:text-white"
              onClick={() => setShowUserDropdown(true)}
            >
              <div className="w-8 h-8 rounded-full bg-discord-primary flex items-center justify-center text-white">
                <span className="text-sm font-medium">{user?.username.slice(0, 2).toUpperCase()}</span>
              </div>
              <span className="font-medium hidden md:inline">{user?.username}</span>
              <ChevronDown className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-48 bg-discord-darker border-gray-700 text-white">
            <DropdownMenuItem className="flex items-center cursor-pointer hover:bg-discord-dark">
              <UserCircle className="mr-2 h-4 w-4" />
              <span>Profile Settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className="flex items-center cursor-pointer hover:bg-discord-dark">
              <Key className="mr-2 h-4 w-4" />
              <span>Change Password</span>
            </DropdownMenuItem>
            
            {user?.role === "admin" && (
              <>
                <DropdownMenuSeparator className="bg-gray-700" />
                <DropdownMenuItem 
                  className="flex items-center cursor-pointer hover:bg-discord-dark"
                  onClick={navigateToAdmin}
                >
                  <Shield className="mr-2 h-4 w-4" />
                  <span>Admin Panel</span>
                </DropdownMenuItem>
              </>
            )}
            
            <DropdownMenuSeparator className="bg-gray-700" />
            <DropdownMenuItem 
              className="flex items-center text-discord-danger cursor-pointer hover:bg-discord-dark"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Log Out</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
