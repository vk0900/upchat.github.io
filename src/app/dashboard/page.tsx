// src/app/dashboard/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileText, Users, MessageSquare, Activity, AlertTriangle, Database } from "lucide-react";
import { getSystemStats } from "@/actions/logs"; // Import stats action
import { useState, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/lib/utils";

interface SystemStats {
    totalUsers: number;
    activeUsers: number;
    totalFiles: number;
    totalStorageUsedBytes: number;
    publicFiles: number;
    privateFiles: number;
    logCount: number;
}

export default function DashboardPage() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const { toast } = useToast();

    useEffect(() => {
        const fetchStats = async () => {
            setIsLoading(true);
            try {
                const result = await getSystemStats();
                if (result.success && result.stats) {
                    setStats(result.stats);
                } else {
                    toast({ variant: "destructive", title: "Error", description: result.error || "Could not load system stats." });
                }
            } catch (error) {
                 console.error("Dashboard fetchStats error:", error);
                 toast({ variant: "destructive", title: "Error", description: "Could not connect to server for stats." });
            } finally {
                setIsLoading(false);
            }
        };
        fetchStats();
    }, [toast]);

    const StatCard = ({ title, value, description, icon: Icon, isLoading }: { title: string, value: string | number | JSX.Element, description?: string, icon: React.ElementType, isLoading: boolean }) => (
        <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{title}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
                {isLoading ? (
                    <>
                        <Skeleton className="h-8 w-1/2 mb-1" />
                        {description && <Skeleton className="h-4 w-3/4" />}
                    </>
                ) : (
                    <>
                        <div className="text-2xl font-bold">{value}</div>
                        {description && <p className="text-xs text-muted-foreground">{description}</p>}
                    </>
                )}
            </CardContent>
        </Card>
    );


  return (
    <div className="space-y-6">
       <h1 className="text-2xl font-bold">Welcome to SecureShare Chat!</h1>
       <p className="text-muted-foreground">Here's a quick overview of your workspace.</p>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
             <StatCard
                title="Total Users"
                value={stats?.totalUsers ?? 0}
                description={`${stats?.activeUsers ?? 0} active`}
                icon={Users}
                isLoading={isLoading}
            />
            <StatCard
                title="Total Files"
                value={stats?.totalFiles ?? 0}
                description={`${stats?.publicFiles ?? 0} public / ${stats?.privateFiles ?? 0} private`}
                icon={FileText}
                isLoading={isLoading}
            />
             <StatCard
                title="Storage Used"
                value={formatBytes(stats?.totalStorageUsedBytes ?? 0)}
                description="Across all users"
                icon={Database}
                isLoading={isLoading}
            />
             {/* Add more relevant stats like Recent Messages, Log Count etc. */}
            {/* <StatCard
                title="New Messages"
                value={"N/A"} // Placeholder - fetch if needed
                description="in the last 24h"
                icon={MessageSquare}
                isLoading={isLoading}
            /> */}
            <StatCard
                title="Total Logs"
                value={stats?.logCount ?? 0}
                description="System & user activities"
                icon={Activity}
                isLoading={isLoading}
            />
             {/* Placeholder for Errors */}
            {/* <StatCard
                title="System Errors"
                value={0} // Placeholder - fetch error logs count
                description="in the last 24h"
                icon={AlertTriangle}
                isLoading={isLoading}
            /> */}

        </div>

         {/* Placeholder for recent activity feed or other widgets */}
        <Card>
            <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
                {/* Fetch recent logs here */}
                <p className="text-muted-foreground">Recent activity feed coming soon... (Requires fetching latest logs)</p>
                {/* Example Items (replace with dynamic data) */}
                {/* <ul className="space-y-2 mt-4 text-sm">
                    <li>User 'Alice' uploaded 'report.pdf'.</li>
                    <li>User 'Bob' sent a message in Public Chat.</li>
                    <li>Admin updated system settings.</li>
                </ul> */}
            </CardContent>
        </Card>

    </div>
  );
}
