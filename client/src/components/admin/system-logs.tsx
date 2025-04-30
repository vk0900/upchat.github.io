import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Loader2, UserCircle, Search, Download, RefreshCcw, ShieldAlert, Database, File, MessageSquare } from "lucide-react";

interface LogEntry {
  id: string;
  type: 'user' | 'system' | 'file' | 'communication' | 'admin';
  action: string;
  user?: {
    id: number;
    username: string;
  };
  details: string;
  ip: string;
  timestamp: Date;
  severity: 'info' | 'warning' | 'error';
}

export default function SystemLogs() {
  const [activeTab, setActiveTab] = useState("user");
  const [period, setPeriod] = useState("24h");
  const [searchTerm, setSearchTerm] = useState("");
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Get logs from API
  useEffect(() => {
    // In a real app, we would fetch logs from the API
    // const fetchLogs = async () => {
    //   try {
    //     const response = await fetch(`/api/admin/logs?type=${activeTab}&period=${period}`);
    //     const data = await response.json();
    //     setLogs(data);
    //     setIsLoading(false);
    //   } catch (error) {
    //     console.error('Error fetching logs:', error);
    //     setIsLoading(false);
    //   }
    // };
    
    // Simulate API call
    setIsLoading(true);
    const timer = setTimeout(() => {
      // Generate sample logs data
      const sampleLogs: LogEntry[] = [];
      
      for (let i = 0; i < 20; i++) {
        let logType: LogEntry['type'];
        let action = '';
        let details = '';
        let severity: LogEntry['severity'] = 'info';
        
        if (activeTab === 'all' || Math.random() > 0.8) {
          // Random log type
          const types: LogEntry['type'][] = ['user', 'system', 'file', 'communication', 'admin'];
          logType = types[Math.floor(Math.random() * types.length)];
        } else {
          logType = activeTab as LogEntry['type'];
        }
        
        // Generate action and details based on log type
        switch (logType) {
          case 'user':
            const userActions = ['login', 'logout', 'password_change', 'account_created', 'failed_login'];
            action = userActions[Math.floor(Math.random() * userActions.length)];
            details = action === 'failed_login' 
              ? 'Invalid password attempt' 
              : action === 'account_created' 
                ? 'New user account created' 
                : `User ${action} action`;
            severity = action === 'failed_login' ? 'warning' : 'info';
            break;
          case 'system':
            const systemActions = ['startup', 'shutdown', 'error', 'database_backup', 'config_change'];
            action = systemActions[Math.floor(Math.random() * systemActions.length)];
            details = action === 'error' 
              ? 'Database connection error' 
              : `System ${action}`;
            severity = action === 'error' ? 'error' : 'info';
            break;
          case 'file':
            const fileActions = ['upload', 'download', 'delete', 'permission_change', 'share'];
            action = fileActions[Math.floor(Math.random() * fileActions.length)];
            details = `File ${action}: Project_Document_${i}.docx`;
            break;
          case 'communication':
            const commActions = ['message_sent', 'message_deleted', 'bulk_delete'];
            action = commActions[Math.floor(Math.random() * commActions.length)];
            details = action === 'bulk_delete' 
              ? 'Admin deleted 5 messages from #general' 
              : `Message ${action} in #general`;
            break;
          case 'admin':
            const adminActions = ['user_suspension', 'config_update', 'privilege_change'];
            action = adminActions[Math.floor(Math.random() * adminActions.length)];
            details = `Admin ${action}`;
            break;
        }
        
        // Random timestamp within selected period
        let timestamp = new Date();
        if (period === '24h') {
          timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
        } else if (period === '7d') {
          timestamp = new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000);
        } else if (period === '30d') {
          timestamp = new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000);
        }
        
        sampleLogs.push({
          id: `log-${i}`,
          type: logType,
          action,
          user: {
            id: Math.floor(Math.random() * 5) + 1,
            username: ['Admin', 'John', 'Mary', 'Sarah', 'Robert'][Math.floor(Math.random() * 5)]
          },
          details,
          ip: `192.168.1.${Math.floor(Math.random() * 255)}`,
          timestamp,
          severity
        });
      }
      
      // Sort logs by timestamp (newest first)
      sampleLogs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      
      setLogs(sampleLogs);
      setIsLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, [activeTab, period]);
  
  // Filter logs based on search term
  const filteredLogs = logs.filter(log => 
    log.details.toLowerCase().includes(searchTerm.toLowerCase()) ||
    log.action.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (log.user?.username.toLowerCase().includes(searchTerm.toLowerCase()) || '')
  );
  
  // Get icon for log type
  const getLogTypeIcon = (type: LogEntry['type']) => {
    switch (type) {
      case 'user':
        return <UserCircle className="h-4 w-4" />;
      case 'system':
        return <Database className="h-4 w-4" />;
      case 'file':
        return <File className="h-4 w-4" />;
      case 'communication':
        return <MessageSquare className="h-4 w-4" />;
      case 'admin':
        return <ShieldAlert className="h-4 w-4" />;
    }
  };
  
  // Get color for severity
  const getSeverityColor = (severity: LogEntry['severity']) => {
    switch (severity) {
      case 'info':
        return 'text-blue-400';
      case 'warning':
        return 'text-yellow-400';
      case 'error':
        return 'text-red-400';
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">System Logs</h1>
        <div className="flex space-x-2">
          <Button className="bg-discord-darker hover:bg-discord-dark border border-gray-700">
            <Download className="h-4 w-4 mr-2" />
            Export Logs
          </Button>
          <Button className="bg-discord-primary hover:bg-discord-primary-hover">
            <RefreshCcw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex justify-between items-center mb-4">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="bg-discord-darkest border-b border-gray-700 mb-4 w-full justify-start">
            <TabsTrigger value="all" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
              All Logs
            </TabsTrigger>
            <TabsTrigger value="user" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
              User Activity
            </TabsTrigger>
            <TabsTrigger value="system" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
              System Events
            </TabsTrigger>
            <TabsTrigger value="file" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
              File Management
            </TabsTrigger>
            <TabsTrigger value="communication" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
              Communication
            </TabsTrigger>
            <TabsTrigger value="admin" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
              Admin Actions
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="flex justify-between items-center mb-6">
        <div className="flex space-x-4 items-center">
          <Label>Time Period:</Label>
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[180px] bg-discord-darker border-gray-700">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className="bg-discord-darkest border-gray-700">
              <SelectItem value="24h">Last 24 Hours</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="all">All Time</SelectItem>
            </SelectContent>
          </Select>
        </div>
        
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-discord-light" />
          <Input 
            placeholder="Search logs..." 
            className="pl-9 bg-discord-darker border-gray-700 text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Card className="bg-discord-darker border-gray-700">
        <CardHeader className="pb-2">
          <CardTitle className="text-white text-lg">
            {activeTab === 'all' ? 'All System Logs' : 
             activeTab === 'user' ? 'User Activity Logs' :
             activeTab === 'system' ? 'System Event Logs' :
             activeTab === 'file' ? 'File Management Logs' :
             activeTab === 'communication' ? 'Communication Logs' :
             'Admin Action Logs'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
            </div>
          ) : (
            <div className="rounded-md border border-gray-700">
              <Table>
                <TableHeader className="bg-discord-darkest">
                  <TableRow>
                    <TableHead className="text-discord-light w-[180px]">Timestamp</TableHead>
                    <TableHead className="text-discord-light w-[120px]">Type</TableHead>
                    <TableHead className="text-discord-light w-[120px]">User</TableHead>
                    <TableHead className="text-discord-light">Details</TableHead>
                    <TableHead className="text-discord-light w-[120px]">IP Address</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLogs.map((log) => (
                    <TableRow key={log.id} className="border-b border-gray-700">
                      <TableCell className="font-mono text-xs">
                        {log.timestamp.toLocaleString()}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span className={getSeverityColor(log.severity)}>
                            {getLogTypeIcon(log.type)}
                          </span>
                          <span className="capitalize">{log.type}</span>
                        </div>
                      </TableCell>
                      <TableCell>{log.user?.username || 'System'}</TableCell>
                      <TableCell>{log.details}</TableCell>
                      <TableCell className="font-mono text-xs">{log.ip}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// Helper component for the label
function Label({ children }: { children: React.ReactNode }) {
  return <span className="text-discord-light text-sm">{children}</span>;
}
