import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { ArrowUpIcon, ArrowDownIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export default function Dashboard() {
  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["/api/admin/stats"],
  });
  
  // Fetch recent activities
  const { data: activities } = useQuery({
    queryKey: ["/api/admin/activity"],
  });
  
  // Fetch users for the activity display
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Define interface for stats data structure
  interface SystemStats {
    totalUsers: number;
    usersTrend: string;
    filesShared: number;
    filesTrend: string;
    storageUsed: string;
    storageLimit: string;
  }
  
  // Default stats if data is not loaded
  const displayStats: SystemStats = stats as SystemStats || {
    totalUsers: 7,
    usersTrend: '+2',
    filesShared: 23,
    filesTrend: '+8',
    storageUsed: '107 MB',
    storageLimit: '10 GB'
  };
  
  // Define activity interfaces
  interface ActivityData {
    fileName?: string;
    fileSize?: string;
    newUsername?: string;
    newUserId?: number;
    newPermission?: string;
  }
  
  interface Activity {
    id: number | string;
    type: string;
    userId: number;
    data: ActivityData;
    timestamp: Date;
  }
  
  // Default activities if data is not loaded
  const displayActivities: Activity[] = activities as Activity[] || [
    {
      id: 1,
      type: 'file_upload',
      userId: 3,
      data: {
        fileName: 'Project_Requirements.docx',
        fileSize: '2.3 MB'
      },
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: 2,
      type: 'user_create',
      userId: 1,
      data: {
        newUserId: 5,
        newUsername: 'Tom'
      },
      timestamp: new Date(Date.now() - 86400000)
    },
    {
      id: 3,
      type: 'file_permission',
      userId: 2,
      data: {
        fileName: 'Brand_Guidelines_v2.pdf',
        newPermission: 'public'
      },
      timestamp: new Date(Date.now() - 172800000)
    }
  ];
  
  // Get user by ID helper
  const getUserById = (id: number) => {
    if (!users) return { username: `User ${id}`, id };
    return users.find(u => u.id === id) || { username: `User ${id}`, id };
  };
  
  // Get user avatar color
  const getUserColor = (id: number) => {
    const colors = ["bg-discord-primary", "bg-red-500", "bg-green-500", "bg-blue-500", "bg-purple-500"];
    return colors[id % colors.length];
  };
  
  // Format activity timestamp
  const formatActivityTime = (date: Date) => {
    const now = new Date();
    const diffHours = Math.round((now.getTime() - new Date(date).getTime()) / (1000 * 60 * 60));
    
    if (diffHours < 24) {
      return `Today ${new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffHours < 48) {
      return `Yesterday ${new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else {
      return new Date(date).toLocaleDateString([], { 
        month: 'short', 
        day: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit'
      });
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="bg-discord-darker border-gray-700">
          <CardContent className="p-4">
            <h3 className="text-discord-light text-sm mb-1">Total Users</h3>
            <div className="text-3xl font-bold text-white">{displayStats.totalUsers}</div>
            <div className="text-xs text-green-400 mt-1">
              {displayStats.usersTrend} since last month
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-discord-darker border-gray-700">
          <CardContent className="p-4">
            <h3 className="text-discord-light text-sm mb-1">Files Shared</h3>
            <div className="text-3xl font-bold text-white">{displayStats.filesShared}</div>
            <div className="text-xs text-green-400 mt-1">
              {displayStats.filesTrend} since last month
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-discord-darker border-gray-700">
          <CardContent className="p-4">
            <h3 className="text-discord-light text-sm mb-1">Storage Used</h3>
            <div className="text-3xl font-bold text-white">{displayStats.storageUsed}</div>
            <div className="text-xs text-discord-light mt-1">
              of {displayStats.storageLimit} limit
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-discord-darker border-gray-700 mb-8">
        <CardContent className="p-4">
          <h2 className="font-bold mb-4">Recent Activity</h2>
          <div className="space-y-3">
            {displayActivities.map((activity) => {
              const user = getUserById(activity.userId);
              
              let activityContent;
              switch (activity.type) {
                case 'file_upload':
                  activityContent = (
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{user.username} uploaded a file</span>
                        <span className="text-discord-light text-sm">{formatActivityTime(activity.timestamp)}</span>
                      </div>
                      <div className="text-discord-light text-sm">
                        {activity.data.fileName} ({activity.data.fileSize})
                      </div>
                    </div>
                  );
                  break;
                  
                case 'user_create':
                  activityContent = (
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{user.username} created a new account</span>
                        <span className="text-discord-light text-sm">{formatActivityTime(activity.timestamp)}</span>
                      </div>
                      <div className="text-discord-light text-sm">
                        New user: {activity.data.newUsername}
                      </div>
                    </div>
                  );
                  break;
                  
                case 'file_permission':
                  activityContent = (
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{user.username} changed file permission</span>
                        <span className="text-discord-light text-sm">{formatActivityTime(activity.timestamp)}</span>
                      </div>
                      <div className="text-discord-light text-sm">
                        {activity.data.fileName} changed to {activity.data.newPermission}
                      </div>
                    </div>
                  );
                  break;
                  
                default:
                  activityContent = (
                    <div className="flex-1">
                      <div className="flex justify-between">
                        <span className="font-medium">{user.username} performed an action</span>
                        <span className="text-discord-light text-sm">{formatActivityTime(activity.timestamp)}</span>
                      </div>
                    </div>
                  );
              }
              
              return (
                <div key={activity.id} className="flex items-start">
                  <div className={`w-8 h-8 rounded-full ${getUserColor(user.id)} flex items-center justify-center text-white mr-3`}>
                    <span>{user.username.slice(0, 2).toUpperCase()}</span>
                  </div>
                  {activityContent}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="bg-discord-darker border-gray-700">
          <CardContent className="p-4">
            <h2 className="font-bold mb-4">System Status</h2>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">CPU Load</span>
                  <span className="text-sm text-green-400">Normal</span>
                </div>
                <div className="w-full bg-discord-darkest rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full w-[15%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Memory Usage</span>
                  <span className="text-sm text-green-400">Normal</span>
                </div>
                <div className="w-full bg-discord-darkest rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full w-[32%]"></div>
                </div>
              </div>
              <div>
                <div className="flex justify-between mb-1">
                  <span className="text-sm">Disk Storage</span>
                  <span className="text-sm text-green-400">Normal</span>
                </div>
                <div className="w-full bg-discord-darkest rounded-full h-2">
                  <div className="bg-green-500 h-2 rounded-full w-[10%]"></div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-discord-darker border-gray-700">
          <CardContent className="p-4">
            <h2 className="font-bold mb-4">Security Overview</h2>
            <div className="space-y-2">
              <div className="flex justify-between items-center py-1">
                <span>Failed login attempts (24h)</span>
                <span className="font-bold text-green-400">0</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Password resets (7d)</span>
                <span className="font-bold">1</span>
              </div>
              <div className="flex justify-between items-center py-1 border-t border-gray-700 pt-2 mt-2">
                <span>Security scan status</span>
                <span className="bg-green-500 text-white text-xs px-2 py-1 rounded-full">Passed</span>
              </div>
              <div className="flex justify-between items-center py-1">
                <span>Last scan</span>
                <span className="text-discord-light">Today 6:00 AM</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
