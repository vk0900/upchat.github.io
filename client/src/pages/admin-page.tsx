import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useLocation } from "wouter";
import { ArrowLeft, BarChart2, Shield, Users, Settings, List } from "lucide-react";
import Dashboard from "@/components/admin/dashboard";
import UserManagement from "@/components/admin/user-management";
import SystemConfig from "@/components/admin/system-config";
import ContentModeration from "@/components/admin/content-moderation";
import SystemLogs from "@/components/admin/system-logs";

type AdminView = "dashboard" | "user-management" | "system-config" | "content-moderation" | "logs";

export default function AdminPage() {
  const { user } = useAuth();
  const [, setLocation] = useLocation();
  const [activeView, setActiveView] = useState<AdminView>("dashboard");

  // Ensure only admins can access this page
  if (!user || user.role !== "admin") {
    setLocation("/");
    return null;
  }

  const menuItems = [
    { id: "dashboard", label: "Dashboard", icon: <BarChart2 className="w-5 h-5" /> },
    { id: "user-management", label: "User Management", icon: <Users className="w-5 h-5" /> },
    { id: "system-config", label: "System Config", icon: <Settings className="w-5 h-5" /> },
    { id: "content-moderation", label: "Content Moderation", icon: <Shield className="w-5 h-5" /> },
    { id: "logs", label: "System Logs", icon: <List className="w-5 h-5" /> }
  ];

  return (
    <div className="h-screen flex flex-col bg-discord-dark text-white">
      <header className="bg-discord-darkest p-3 flex justify-between items-center">
        <div className="flex items-center">
          <button 
            onClick={() => setLocation("/")} 
            className="mr-3 text-discord-light hover:text-white"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="font-bold text-xl">Admin Panel</span>
        </div>
        <div>
          <span className="text-sm text-discord-light">
            Logged in as <span className="text-white font-medium">{user.username}</span>
          </span>
        </div>
      </header>
      
      <div className="flex flex-1 overflow-hidden">
        {/* Admin sidebar */}
        <aside className="w-56 bg-discord-darker border-r border-gray-700">
          <div className="p-3">
            <nav>
              <ul className="space-y-1">
                {menuItems.map((item) => (
                  <li key={item.id}>
                    <button
                      onClick={() => setActiveView(item.id as AdminView)}
                      className={`flex items-center px-3 py-2 rounded w-full text-left ${
                        activeView === item.id 
                          ? "bg-discord-primary text-white" 
                          : "text-discord-light hover:bg-discord-dark hover:text-white"
                      }`}
                    >
                      <span className="w-5 text-center mr-2">{item.icon}</span>
                      <span className="ml-2">{item.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </nav>
          </div>
        </aside>

        {/* Admin content area */}
        <main className="flex-1 overflow-y-auto p-6">
          {activeView === "dashboard" && <Dashboard />}
          {activeView === "user-management" && <UserManagement />}
          {activeView === "system-config" && <SystemConfig />}
          {activeView === "content-moderation" && <ContentModeration />}
          {activeView === "logs" && <SystemLogs />}
        </main>
      </div>
    </div>
  );
}
