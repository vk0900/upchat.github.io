import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Save } from "lucide-react";

interface SystemSettings {
  maxFileSize: number;
  userStorageQuota: number;
  allowedFileTypes: string[];
  maintenanceModeEnabled: boolean;
  passwordMinLength: number;
  sessionTimeoutMinutes: number;
}

export default function SystemConfig() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [settings, setSettings] = useState<SystemSettings>({
    maxFileSize: 1024,
    userStorageQuota: 5120, // 5GB in MB
    allowedFileTypes: ['*'],
    maintenanceModeEnabled: false,
    passwordMinLength: 6,
    sessionTimeoutMinutes: 60
  });
  
  // Simulating loading system settings from API
  useState(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  });

  // Save settings mutation
  const saveSettingsMutation = useMutation({
    mutationFn: async (updatedSettings: SystemSettings) => {
      const res = await apiRequest("POST", "/api/admin/system-settings", updatedSettings);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Settings saved",
        description: "System settings have been updated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/system-settings"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to save settings",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleSaveSettings = () => {
    saveSettingsMutation.mutate(settings);
  };

  // Handle input changes
  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>, field: keyof SystemSettings) => {
    const value = parseInt(e.target.value, 10);
    setSettings({
      ...settings,
      [field]: isNaN(value) ? 0 : value
    });
  };

  // Handle toggle changes
  const handleToggleChange = (checked: boolean, field: keyof SystemSettings) => {
    setSettings({
      ...settings,
      [field]: checked
    });
  };

  // Handle allowed file types
  const handleFileTypesChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const types = e.target.value.split(',').map(type => type.trim());
    setSettings({
      ...settings,
      allowedFileTypes: types
    });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">System Configuration</h1>
        <Button 
          onClick={handleSaveSettings} 
          className="bg-discord-primary hover:bg-discord-primary-hover"
          disabled={saveSettingsMutation.isPending}
        >
          {saveSettingsMutation.isPending ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Settings
            </>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* File Configuration */}
        <Card className="bg-discord-darker border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">File Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="maxFileSize" className="text-discord-light">Maximum File Size (MB)</Label>
              <Input 
                id="maxFileSize" 
                type="number" 
                value={settings.maxFileSize}
                onChange={(e) => handleNumberChange(e, 'maxFileSize')}
                className="bg-discord-darkest border-gray-700 text-white"
              />
              <p className="text-xs text-discord-light">
                Maximum size for uploaded files (in MB). Current: {settings.maxFileSize}MB
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="userStorageQuota" className="text-discord-light">User Storage Quota (MB)</Label>
              <Input 
                id="userStorageQuota" 
                type="number" 
                value={settings.userStorageQuota}
                onChange={(e) => handleNumberChange(e, 'userStorageQuota')}
                className="bg-discord-darkest border-gray-700 text-white"
              />
              <p className="text-xs text-discord-light">
                Storage space allocated per user (in MB). Current: {settings.userStorageQuota}MB
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="allowedFileTypes" className="text-discord-light">Allowed File Types</Label>
              <Input 
                id="allowedFileTypes" 
                value={settings.allowedFileTypes.join(', ')}
                onChange={handleFileTypesChange}
                className="bg-discord-darkest border-gray-700 text-white"
              />
              <p className="text-xs text-discord-light">
                Comma-separated list of allowed file extensions. Use * for all types.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* System Settings */}
        <Card className="bg-discord-darker border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">System Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="maintenanceMode" className="text-discord-light">Maintenance Mode</Label>
                <p className="text-xs text-discord-light">
                  When enabled, only admins can access the system
                </p>
              </div>
              <Switch 
                id="maintenanceMode" 
                checked={settings.maintenanceModeEnabled}
                onCheckedChange={(checked) => handleToggleChange(checked, 'maintenanceModeEnabled')}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="passwordMinLength" className="text-discord-light">Minimum Password Length</Label>
              <Input 
                id="passwordMinLength" 
                type="number" 
                value={settings.passwordMinLength}
                onChange={(e) => handleNumberChange(e, 'passwordMinLength')}
                className="bg-discord-darkest border-gray-700 text-white"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="sessionTimeout" className="text-discord-light">Session Timeout (minutes)</Label>
              <Input 
                id="sessionTimeout" 
                type="number" 
                value={settings.sessionTimeoutMinutes}
                onChange={(e) => handleNumberChange(e, 'sessionTimeoutMinutes')}
                className="bg-discord-darkest border-gray-700 text-white"
              />
              <p className="text-xs text-discord-light">
                Session will expire after this period of inactivity
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Storage Statistics */}
        <Card className="bg-discord-darker border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Storage Statistics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm">Total Storage Used</span>
                <span className="text-sm">107MB / 10GB</span>
              </div>
              <div className="w-full bg-discord-darkest rounded-full h-2">
                <div className="bg-discord-primary h-2 rounded-full" style={{ width: '1%' }}></div>
              </div>
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div className="bg-discord-darkest p-3 rounded-md">
                <p className="text-sm text-discord-light">Total Files</p>
                <p className="text-2xl font-bold">23</p>
              </div>
              <div className="bg-discord-darkest p-3 rounded-md">
                <p className="text-sm text-discord-light">Active Users</p>
                <p className="text-2xl font-bold">7</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Database Maintenance */}
        <Card className="bg-discord-darker border-gray-700">
          <CardHeader className="pb-2">
            <CardTitle className="text-white text-lg">Database Maintenance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-discord-light text-sm">
              Perform maintenance operations on the database to optimize performance.
            </p>
            
            <div className="space-y-2">
              <Button className="w-full bg-discord-darker hover:bg-discord-dark border border-gray-700">
                Optimize Database
              </Button>
              <Button className="w-full bg-discord-darker hover:bg-discord-dark border border-gray-700">
                Clear Expired Sessions
              </Button>
              <Button className="w-full bg-discord-darker hover:bg-discord-dark border border-gray-700">
                Backup System Data
              </Button>
            </div>
            
            <p className="text-xs text-discord-light">
              Last maintenance performed: Today at 6:00 AM
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
