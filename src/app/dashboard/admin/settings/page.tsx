"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Save, AlertTriangle, Loader2 } from "lucide-react";
import { getSettings, updateSettings } from "@/actions/settings"; // Import actions
import { Skeleton } from "@/components/ui/skeleton"; // Import Skeleton

// Define setting types
type SettingValue = string | number | boolean;
type Settings = Record<string, SettingValue>;

// Define structure and types for form rendering
interface SettingConfig {
    label: string;
    type: 'number' | 'text' | 'textarea' | 'boolean'; // Removed 'password_policy' type
    description?: string;
    min?: number;
    max?: number; // Used for file size limit
    placeholder?: string;
    rows?: number;
    unit?: string; // e.g., 'MB', 'Minutes'
    constraint?: string; // e.g., Hosting limit
    section: string; // Group settings
    isPolicy?: boolean; // Keep for grouping/styling if needed, even if type is removed
}

const settingConfigs: Record<string, SettingConfig> = {
    // File Management
    fileSizeLimitMB: { label: "Max File Upload Size", type: "number", min: 1, max: 10, unit: "MB", description: "Maximum size for a single file upload.", constraint: "Cannot exceed hosting limit (10MB).", section: "File Management"},
    storageQuotaMB: { label: "Default Storage Quota per User", type: "number", min: 10, unit: "MB", description: "Storage space allocated to each new user.", section: "File Management"},
    allowedFileTypes: { label: "Allowed File Extensions", type: "textarea", rows: 2, placeholder: "e.g., jpg, png, pdf, docx", description: "Comma-separated list of allowed extensions (lowercase). Leave blank to allow all (not recommended).", section: "File Management"},

    // Security
    sessionTimeoutMinutes: { label: "Session Timeout", type: "number", min: 5, unit: "Minutes", description: "Inactive users will be logged out after this duration.", section: "Security"},

    // Password Policy (Grouped under Security)
    passwordMinLength: { label: "Min Password Length", type: "number", min: 1, section: "Security", isPolicy: true }, // Min is 1 now
    // Removed complexity settings
    // passwordRequireUppercase: { label: "Require Uppercase Letter", type: "boolean", section: "Security", isPolicy: true },
    // passwordRequireNumber: { label: "Require Number", type: "boolean", section: "Security", isPolicy: true },
    // passwordRequireSpecial: { label: "Require Special Character", type: "boolean", section: "Security", isPolicy: true },
    passwordExpiryDays: { label: "Password Expiry (Days)", type: "number", min: 0, description: "Force password change after this many days (0 to disable).", section: "Security", isPolicy: true },

    // Maintenance
    maintenanceMode: { label: "Maintenance Mode", type: "boolean", description: "Enable to prevent non-admin logins.", section: "Maintenance"},
};

export default function AdminSettingsPage() {
    const { toast } = useToast();
    const [settings, setSettings] = useState<Settings>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const loadSettings = async () => {
            setIsLoading(true);
            try {
                const result = await getSettings();
                if (result.success && result.settings) {
                     // Convert fetched string values to correct types based on config
                     const typedSettings: Settings = {};
                     for (const key in result.settings) {
                         if (key in settingConfigs) {
                             const config = settingConfigs[key];
                             const value = result.settings[key];
                             if (config.type === 'number') {
                                 // Handle potential NaN from parseInt
                                 const parsedValue = parseInt(value, 10);
                                 typedSettings[key] = isNaN(parsedValue) ? (config.min ?? 0) : parsedValue; // Default to min or 0 if parse fails
                             } else if (config.type === 'boolean') {
                                 typedSettings[key] = value === 'true';
                             } else {
                                 typedSettings[key] = value;
                             }
                         } else {
                             typedSettings[key] = result.settings[key]; // Keep unknown settings as string
                         }
                     }
                    setSettings(typedSettings);
                } else {
                    toast({ variant: "destructive", title: "Error", description: result.error || "Could not load settings." });
                }
            } catch (error) {
                console.error("Failed to load settings:", error);
                toast({ variant: "destructive", title: "Error", description: "Could not connect to server." });
            } finally {
                setIsLoading(false);
            }
        };
        loadSettings();
    }, [toast]);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        const config = settingConfigs[name];
        // Ensure numeric inputs are treated as numbers, defaulting to min or 0 if invalid
         let processedValue: string | number = value;
         if (config?.type === 'number') {
             const numValue = parseInt(value, 10);
             processedValue = isNaN(numValue) ? (config.min ?? 0) : numValue;
             // Optionally enforce max value client-side too
             if (config.max !== undefined && processedValue > config.max) {
                 processedValue = config.max;
             }
              if (config.min !== undefined && processedValue < config.min) {
                 processedValue = config.min;
             }
         }

        setSettings(prev => ({
            ...prev,
            [name]: processedValue
        }));
    };

     const handleSwitchChange = (checked: boolean, name: string) => {
         setSettings(prev => ({ ...prev, [name]: checked }));
     }

    const handleSaveChanges = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        console.log("Saving settings:", settings);

         // Convert values back to strings for DB storage
         const settingsToSave: Record<string, string> = {};
         for (const key in settings) {
             if (key in settingConfigs) { // Only save known settings
                 settingsToSave[key] = String(settings[key]);
             }
         }

        try {
            const result = await updateSettings(settingsToSave);
            if (result.success) {
                toast({ title: "Settings Saved", description: "System configuration has been updated." });
                // Optionally refetch settings to confirm changes, though optimistic update is usually fine
                // setSettings(settings); // Already optimistically updated
            } else {
                 toast({ variant: "destructive", title: "Save Failed", description: result.error || "Could not save settings." });
            }
        } catch (error) {
             console.error("Failed to save settings:", error);
             toast({ variant: "destructive", title: "Error", description: "Could not connect to server to save settings." });
        } finally {
            setIsSaving(false);
        }
    };

    // Group settings by section
    const groupedSettings = Object.entries(settingConfigs).reduce((acc, [key, config]) => {
        if (!acc[config.section]) {
            acc[config.section] = [];
        }
        acc[config.section].push({ key, ...config });
        return acc;
    }, {} as Record<string, (SettingConfig & { key: string })[]>);

    // Explicitly define section order
     const sectionOrder = ["File Management", "Security", "Maintenance"];


  return (
    <form onSubmit={handleSaveChanges} className="space-y-6">
       <Card>
        <CardHeader>
            <CardTitle>System Configuration</CardTitle>
            <CardDescription>Adjust platform-wide settings and security policies.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
            {isLoading ? (
                <div className="space-y-6">
                    {/* Skeleton loaders */}
                    <Skeleton className="h-8 w-1/4" />
                    <Skeleton className="h-10 w-full" />
                    <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-16 w-full" />
                    <Skeleton className="h-8 w-1/4 mt-4" />
                    <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                     <Skeleton className="h-10 w-full" />
                 </div>
            ) : (
                sectionOrder.map(sectionName => groupedSettings[sectionName] && (
                 <div key={sectionName} className={`space-y-4 border p-4 rounded-lg ${sectionName === 'Maintenance' ? 'bg-destructive/10 border-destructive' : ''}`}>
                    <h3 className={`text-lg font-medium mb-2 ${sectionName === 'Maintenance' ? 'text-destructive flex items-center gap-2' : ''}`}>
                        {sectionName === 'Maintenance' && <AlertTriangle className="h-5 w-5"/>}
                        {sectionName}
                        {sectionName === 'Security' && (
                            <span className="text-sm text-muted-foreground font-normal ml-2">(Password & Session)</span>
                         )}
                     </h3>

                    {groupedSettings[sectionName].map(({ key, label, type, description, min, max, placeholder, unit, constraint, rows, isPolicy }) => (
                         <div key={key} className={`grid grid-cols-1 ${type !== 'textarea' && type !== 'boolean' ? 'md:grid-cols-3' : ''} gap-2 items-start md:items-center`}>
                            <Label htmlFor={key} className="md:col-span-1 mt-2 md:mt-0">{label}</Label>
                             <div className="md:col-span-2 space-y-1">
                                {type === 'number' && (
                                    <div className="flex items-center gap-2">
                                        <Input
                                            id={key}
                                            name={key}
                                            type="number"
                                             // Ensure value is a number, default to 0 or min if undefined/NaN
                                             value={settings[key] as number ?? (min ?? 0)}
                                            onChange={handleInputChange}
                                            min={min}
                                            max={max} // Apply max constraint
                                            className="w-32"
                                            disabled={isSaving}
                                        />
                                        {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
                                    </div>
                                )}
                                {type === 'text' && (
                                    <Input
                                        id={key}
                                        name={key}
                                        type="text"
                                         value={settings[key] as string ?? ''}
                                        onChange={handleInputChange}
                                        placeholder={placeholder}
                                        disabled={isSaving}
                                    />
                                )}
                                 {type === 'textarea' && (
                                     <Textarea
                                        id={key}
                                        name={key}
                                         value={settings[key] as string ?? ''}
                                        onChange={handleInputChange}
                                        placeholder={placeholder}
                                        rows={rows}
                                        disabled={isSaving}
                                     />
                                )}
                                 {type === 'boolean' && (
                                    <div className="flex items-center space-x-2 pt-2"> {/* Added padding top for alignment */}
                                        <Switch
                                            id={key}
                                            name={key}
                                             checked={settings[key] as boolean ?? false}
                                            onCheckedChange={(checked) => handleSwitchChange(checked, key)}
                                            disabled={isSaving}
                                        />
                                         {/* Special label for maintenance mode */}
                                         {key === 'maintenanceMode' ? (
                                              <Label htmlFor={key} className={settings[key] ? 'text-destructive font-medium' : ''}>
                                                {settings[key] ? 'Platform is currently OFFLINE' : 'Platform is ONLINE'}
                                            </Label>
                                         ) : (
                                            <Label htmlFor={key}>Enable</Label>
                                         )}
                                     </div>
                                )}
                                {description && <p className="text-xs text-muted-foreground">{description}</p>}
                                 {constraint && <p className="text-xs text-destructive">{constraint}</p>}
                            </div>
                        </div>
                    ))}
                     {sectionName === 'Maintenance' && (
                         <p className="text-sm text-destructive/80">Enabling maintenance mode will prevent non-admin users from accessing the platform. Admins can still log in.</p>
                     )}
                </div>
            )))}
        </CardContent>
        </Card>

        <div className="flex justify-end">
             <Button type="submit" disabled={isLoading || isSaving}>
                {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Save Changes
            </Button>
        </div>
    </form>
  );
}
