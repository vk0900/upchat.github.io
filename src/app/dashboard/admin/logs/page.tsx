"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar as CalendarIcon, Search, Download, Filter, Eye, Loader2, ChevronLeft, ChevronRight, ListFilter, ArrowUpDown, ExternalLink } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format, parseISO, startOfDay, endOfDay } from "date-fns";
import { DateRange } from "react-day-picker";
import { cn } from "@/lib/utils";
import { getLogs, getLogTypes } from "@/actions/logs"; // Import the action to fetch logs
import { useToast } from "@/hooks/use-toast";
import Link from "next/link"; // Import Link for resource links

// Define Log type matching the backend structure
interface Log {
  id: number;
  timestamp: string; // ISO 8601 string from DB
  user_id: number | null;
  username: string | null; // Joined from users table
  ip_address: string | null;
  action: string;
  details: string | null;
  type: string;
  resource_id: number | null;
}

interface LogsResponse {
    success: boolean;
    logs?: Log[];
    totalLogs?: number;
    totalPages?: number;
    currentPage?: number;
    error?: string;
}

const LOGS_PER_PAGE = 20; // Number of logs per page

export default function AdminLogsPage() {
    const [logs, setLogs] = useState<Log[]>([]);
    const [logTypes, setLogTypes] = useState<string[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [dateRange, setDateRange] = useState<DateRange | undefined>();
    const [logTypeFilter, setLogTypeFilter] = useState<string>("all");
    const [currentPage, setCurrentPage] = useState(1);
    const [totalLogs, setTotalLogs] = useState(0);
    const [totalPages, setTotalPages] = useState(1);
    const [sortBy, setSortBy] = useState<'timestamp' | 'type' | 'username'>('timestamp');
    const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
    const { toast } = useToast();

    // Fetch Log Types Once
    useEffect(() => {
        const fetchTypes = async () => {
            try {
                const result = await getLogTypes();
                if (result.success && result.types) {
                    setLogTypes(result.types);
                } else {
                    console.warn("Could not fetch log types:", result.error);
                }
            } catch (error) {
                console.error("Failed to fetch log types:", error);
            }
        };
        fetchTypes();
    }, []);


     // Fetch logs whenever filters or page change
     const fetchLogs = useCallback(async () => {
        setIsLoading(true);
        try {
            const filters = {
                page: currentPage,
                limit: LOGS_PER_PAGE,
                search: searchTerm || undefined,
                type: logTypeFilter !== 'all' ? logTypeFilter : undefined,
                dateFrom: dateRange?.from ? startOfDay(dateRange.from).toISOString() : undefined,
                dateTo: dateRange?.to ? endOfDay(dateRange.to).toISOString() : undefined,
                sortBy: sortBy,
                sortOrder: sortOrder,
                // userId: userFilter ? parseInt(userFilter) : undefined, // Add user filter if needed
            };
             console.log("Fetching logs with filters:", filters); // Debugging
            const result: LogsResponse = await getLogs(filters);

            if (result.success) {
                setLogs(result.logs || []);
                setTotalLogs(result.totalLogs || 0);
                setTotalPages(result.totalPages || 1);
                setCurrentPage(result.currentPage || 1); // Sync page number
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error || "Could not fetch logs." });
                 setLogs([]);
                 setTotalLogs(0);
                 setTotalPages(1);
            }
        } catch (error) {
             console.error("Failed to fetch logs:", error);
             toast({ variant: "destructive", title: "Error", description: "Could not connect to the server." });
             setLogs([]);
             setTotalLogs(0);
             setTotalPages(1);
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, searchTerm, logTypeFilter, dateRange, sortBy, sortOrder, toast]);

    useEffect(() => {
        fetchLogs();
    }, [fetchLogs]);

     // Reset page to 1 when filters change (except pagination itself)
     useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, logTypeFilter, dateRange, sortBy, sortOrder]);


     const handleExportLogs = () => {
        // Basic CSV Export Example
         if (logs.length === 0) {
             toast({ variant: "destructive", title: "Export Failed", description: "No logs to export." });
             return;
         }
         setIsLoading(true); // Indicate processing
         try {
             const headers = ["ID", "Timestamp", "User ID", "Username", "IP Address", "Type", "Action", "Details", "Resource ID"];
             const rows = logs.map(log => [
                 log.id,
                 log.timestamp, // Keep ISO format for clarity
                 log.user_id ?? '',
                 log.username ?? '',
                 log.ip_address ?? '',
                 log.type,
                 log.action,
                 log.details?.replace(/"/g, '""') ?? '', // Escape double quotes
                 log.resource_id ?? '',
             ]);

             let csvContent = "data:text/csv;charset=utf-8,"
                 + headers.join(",") + "\n"
                 + rows.map(e => `"${e.join('","')}"`).join("\n"); // Enclose in quotes

             const encodedUri = encodeURI(csvContent);
             const link = document.createElement("a");
             link.setAttribute("href", encodedUri);
             const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
             link.setAttribute("download", `secure_share_logs_${timestamp}.csv`);
             document.body.appendChild(link);
             link.click();
             document.body.removeChild(link);
             toast({ title: "Export Started", description: "Your log file should begin downloading." });
         } catch (error) {
             console.error("Log export error:", error);
             toast({ variant: "destructive", title: "Export Error", description: "Failed to generate log file." });
         } finally {
             setIsLoading(false);
         }
    }

     const handleViewDetails = (log: Log) => {
         // Simple alert for now, replace with Dialog for better UX
          const formattedTimestamp = format(parseISO(log.timestamp), "yyyy-MM-dd HH:mm:ss O");
         alert(
             `Log Details (ID: ${log.id}):\n` +
             `--------------------------\n` +
             `Timestamp: ${formattedTimestamp}\n` +
             `User: ${log.username ?? (log.user_id ? `ID ${log.user_id}`: 'System')}\n` +
             `IP Address: ${log.ip_address ?? 'N/A'}\n` +
             `Type: ${log.type}\n` +
             `Action: ${log.action}\n` +
             `Details: ${log.details ?? 'N/A'}\n` +
             `Resource ID: ${log.resource_id ?? 'N/A'}`
         );
     }

    const handleSort = (column: 'timestamp' | 'type' | 'username') => {
        if (sortBy === column) {
            setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
        } else {
            setSortBy(column);
            setSortOrder('desc'); // Default to descending for new column
        }
    }


    const totalPages = Math.ceil(totalLogs / LOGS_PER_PAGE);

    const handlePreviousPage = () => {
        setCurrentPage((prev) => Math.max(prev - 1, 1));
    };

    const handleNextPage = () => {
        setCurrentPage((prev) => Math.min(prev + 1, totalPages));
    };


    const getBadgeVariant = (type: string): "default" | "secondary" | "destructive" | "outline" | "primary" => {
        switch (type?.toLowerCase()) {
            case 'auth': return 'primary'; // Blurple
            case 'file': return 'secondary'; // Grayish
            case 'chat': return 'outline'; // White outline (adjust border maybe)
            case 'system': return 'destructive'; // Reddish (for errors/important changes)
            case 'admin': return 'destructive'; // Reddish for admin actions
            case 'security': return 'destructive'; // Reddish for security events
            case 'notification': return 'default'; // Default blueish
            default: return 'secondary';
        }
    }

    // Function to get link for resource ID
    const getResourceLink = (type: string, resourceId: number | null): string | null => {
        if (!resourceId) return null;
        switch (type.toLowerCase()) {
            case 'file':
            case 'admin': // Often relates to a user or file
            case 'security':
            case 'notification':
                 // Try linking to admin user/file view? Needs adjustment based on routes
                 // Example: Link to admin file view if action involves file
                 if (['file upload', 'file deletion', 'file visibility change', 'file access'].includes(action.toLowerCase())) {
                    return `/dashboard/admin/files?search=${resourceId}`; // Link to file with search query
                 }
                 // Example: Link to admin user view if action involves user
                 if (['user creation', 'user deletion', 'user status update', 'password reset', 'profile update'].includes(action.toLowerCase())) {
                    return `/dashboard/admin/users?search=${resourceId}`; // Link to user with search query
                 }
                break;
            case 'chat': // Link to chat (if we had specific message views)
                 // return `/dashboard/chat?messageId=${resourceId}`;
                break;
            // Add more cases as needed
            default:
                return null;
        }
         return null; // Fallback
    }


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
           <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
             <div>
                <CardTitle>Activity Logs</CardTitle>
                <CardDescription>Monitor user activity, system events, and potential issues.</CardDescription>
            </div>
             <div className="flex flex-wrap items-center gap-2">
                 {/* Filters */}
                  <Popover>
                    <PopoverTrigger asChild>
                        <Button
                            id="date"
                            variant={"outline"}
                            className={cn(
                            "w-[280px] justify-start text-left font-normal h-9",
                            !dateRange && "text-muted-foreground"
                            )}
                            disabled={isLoading}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {dateRange?.from ? (
                            dateRange.to ? (
                                <>
                                {format(dateRange.from, "LLL dd, y")} -{" "}
                                {format(dateRange.to, "LLL dd, y")}
                                </>
                            ) : (
                                format(dateRange.from, "LLL dd, y")
                            )
                            ) : (
                            <span>Filter by date range</span>
                            )}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="end">
                        <Calendar
                             initialFocus
                             mode="range"
                             defaultMonth={dateRange?.from}
                             selected={dateRange}
                             onSelect={setDateRange}
                             numberOfMonths={2}
                             disabled={isLoading}
                        />
                         {(dateRange?.from || dateRange?.to) &&
                            <Button variant="ghost" size="sm" className="w-full justify-center" onClick={() => setDateRange(undefined)} disabled={isLoading}>
                                Clear Range
                            </Button>}
                    </PopoverContent>
                </Popover>

                 <Select value={logTypeFilter} onValueChange={setLogTypeFilter} disabled={isLoading}>
                    <SelectTrigger className="w-[180px] h-9">
                         <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filter by type" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Log Types</SelectItem>
                         {logTypes.map(type => (
                           <SelectItem key={type} value={type} className="capitalize">{type}</SelectItem>
                         ))}
                    </SelectContent>
                </Select>

                 {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search action, details, IP, user, resource ID..."
                        className="pl-8 w-full sm:w-48 md:w-56 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isLoading}
                     />
                </div>
                 <Button variant="outline" onClick={handleExportLogs} className="h-9" disabled={isLoading || logs.length === 0}>
                     {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                     Export CSV
                 </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[150px]">
                     <Button variant="ghost" onClick={() => handleSort('timestamp')} className="px-1 h-auto">
                        Timestamp
                        <ArrowUpDown className="ml-2 h-3 w-3" />
                     </Button>
                </TableHead>
                <TableHead className="w-[120px]">
                    <Button variant="ghost" onClick={() => handleSort('username')} className="px-1 h-auto">
                        User
                         <ArrowUpDown className="ml-2 h-3 w-3" />
                    </Button>
                </TableHead>
                <TableHead className="hidden md:table-cell w-[120px]">IP Address</TableHead>
                 <TableHead className="w-[100px]">
                    <Button variant="ghost" onClick={() => handleSort('type')} className="px-1 h-auto">
                        Type
                         <ArrowUpDown className="ml-2 h-3 w-3" />
                     </Button>
                 </TableHead>
                <TableHead>Action / Details</TableHead>
                <TableHead className="text-right w-[80px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                 <TableRow>
                    <TableCell colSpan={6} className="h-36 text-center">
                        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
                    </TableCell>
                </TableRow>
              ) : logs.length > 0 ? (
                logs.map((log) => {
                    const resourceLink = getResourceLink(log.type, log.resource_id);
                    const action = log.action || 'Unknown Action'; // Ensure action is never empty
                    return (
                    <TableRow key={log.id}>
                    <TableCell className="text-xs text-muted-foreground whitespace-nowrap" title={log.timestamp}>
                        {format(parseISO(log.timestamp), "MMM d, HH:mm:ss")}
                        </TableCell>
                    <TableCell className="font-medium truncate max-w-[120px]" title={log.username ?? ''}>
                        {log.username ?? (log.user_id ? <span className="text-muted-foreground italic">ID {log.user_id}</span> : <span className="text-muted-foreground italic">System</span>)}
                        </TableCell>
                    <TableCell className="hidden md:table-cell text-sm text-muted-foreground">{log.ip_address ?? 'N/A'}</TableCell>
                        <TableCell>
                            <Badge variant={getBadgeVariant(log.type)} className="capitalize text-xs px-1.5 py-0.5">
                            {log.type}
                            </Badge>
                        </TableCell>
                    <TableCell className="text-sm">
                        <span className="font-medium">{action}:</span>
                        <span className="text-muted-foreground ml-1 break-words" title={log.details ?? ''}> {log.details ?? 'N/A'}</span>
                         {log.resource_id && (
                             <span className="text-muted-foreground/70 text-xs ml-1">(Res. ID: {log.resource_id})</span>
                         )}
                    </TableCell>
                    <TableCell className="text-right">
                          {resourceLink ? (
                              <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                                <Link href={resourceLink} title={`View Resource ${log.resource_id}`}>
                                    <ExternalLink className="h-4 w-4" />
                                    <span className="sr-only">View Resource</span>
                                </Link>
                              </Button>
                          ) : (
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleViewDetails(log)} title="View Details">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View Details</span>
                            </Button>
                          )}
                    </TableCell>
                    </TableRow>
                    )
                })
              ) : (
                 <TableRow>
                    <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                        No logs found matching your criteria.
                    </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
           {/* Pagination Controls */}
           {totalPages > 1 && (
                <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages} ({totalLogs} total logs)
                    </span>
                    <div className="flex items-center gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handlePreviousPage}
                            disabled={currentPage === 1 || isLoading}
                        >
                            <ChevronLeft className="h-4 w-4 mr-1" /> Previous
                        </Button>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleNextPage}
                            disabled={currentPage === totalPages || isLoading}
                        >
                            Next <ChevronRight className="h-4 w-4 ml-1" />
                        </Button>
                    </div>
                </div>
            )}
        </CardContent>
      </Card>
    </div>
  );
}
