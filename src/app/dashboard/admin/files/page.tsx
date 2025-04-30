// src/app/dashboard/admin/files/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, Download, Trash2, Lock, Users, Search, Eye, Filter, Loader2, AlertCircle, File as FileIcon, Image as ImageIcon, FileText, FileSpreadsheet, FileArchive, ListFilter } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { listFiles, deleteFile, toggleFileVisibility, getDownloadFileInfo, getPreviewFileInfo } from '@/actions/files'; // Use the same actions
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/utils"; // Assume utility function exists
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"; // Added Select


interface AdminFileData {
  id: number;
  name: string;
  type: string | null;
  size: number;
  uploaded: string; // Formatted date string
  uploader: string; // Username or 'Deleted User'
  uploader_id: number | null; // Original uploader ID
  visibility: 'private' | 'public';
  key: string; // Unique key for React list
}


export default function AdminFilesPage() {
    const [files, setFiles] = useState<AdminFileData[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [previewUrl, setPreviewUrl] = useState<string | null>(null);
    const [previewFileType, setPreviewFileType] = useState<string | null>(null);
    const [isPreviewLoading, setIsPreviewLoading] = useState(false);
    const [isPreviewOpen, setIsPreviewOpen] = useState(false);
    const [visibilityFilter, setVisibilityFilter] = useState<string>("all"); // 'all', 'public', 'private'
    const [userFilter, setUserFilter] = useState<string>(""); // User ID or username to filter
    const { toast } = useToast();

    useEffect(() => {
        fetchAdminFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Fetch only once on mount

    const fetchAdminFiles = async () => {
        setIsLoading(true);
        try {
            // Pass true to indicate admin view is requested
            const result = await listFiles(true);
            if (result.success && result.files) {
                // Ensure files have the uploader_id
                const filesWithId = result.files.map((f: any) => ({
                    ...f,
                    uploader_id: f.uploader_id ?? null // Ensure it exists, even if null
                }));
                setFiles(filesWithId || []);
            } else {
                toast({ variant: "destructive", title: "Error", description: result.error });
                setFiles([]);
            }
        } catch (error) {
            console.error("Failed to fetch admin files:", error);
            toast({ variant: "destructive", title: "Error", description: "Could not connect to the server." });
            setFiles([]);
        } finally {
            setIsLoading(false);
        }
    };


    const handleDownloadFile = async (file: AdminFileData) => {
         toast({ title: "Preparing Download", description: `Requesting file: ${file.name}` });
        try {
            const result = await getDownloadFileInfo(file.id);
            if (result.success && result.fileInfo) {
                 // Ensure the path doesn't have leading slash for API route construction
                 const apiPath = result.fileInfo.path.startsWith('/') ? result.fileInfo.path.substring(1) : result.fileInfo.path;
                 const downloadUrl = `/api/files/${apiPath.replace(/^uploads[\\/]/, '')}`;
                 console.log("Admin Download URL:", downloadUrl);

                const link = document.createElement('a');
                link.href = downloadUrl;
                link.style.display = 'none';
                 // Set filename for download prompt (optional, API sets Content-Disposition)
                 // link.download = file.name;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                 toast({ title: "Download Started", description: `${file.name} should begin downloading shortly.` });
            } else {
                toast({ variant: "destructive", title: "Download Failed", description: result.error });
            }
        } catch (error) {
            console.error("Admin download error:", error);
            toast({ variant: "destructive", title: "Download Error", description: "Could not process download request." });
        }
    };

     const handlePreviewFile = async (file: AdminFileData) => {
         setIsPreviewLoading(true);
        setIsPreviewOpen(true);
        setPreviewUrl(null);
        setPreviewFileType(file.type);

        try {
            const result = await getPreviewFileInfo(file.id);
            if (result.success && result.fileInfo) {
                 const apiPath = result.fileInfo.path.startsWith('/') ? result.fileInfo.path.substring(1) : result.fileInfo.path;
                 const previewApiUrl = `/api/files/${apiPath.replace(/^uploads[\\/]/, '')}?preview=true`;
                 const isNativelyPreviewable = file.type && (file.type.startsWith('image/') || file.type === 'application/pdf' || file.type.startsWith('text/'));

                if (isNativelyPreviewable) {
                    setPreviewUrl(previewApiUrl);
                } else {
                     setPreviewUrl(null);
                     toast({ title: "Preview Unavailable", description: `Direct preview for '${file.name}' (${file.type || 'unknown type'}) is not supported. Admins can download the file.`});
                }
            } else {
                toast({ variant: "destructive", title: "Preview Failed", description: result.error });
                 setIsPreviewOpen(false);
            }
        } catch (error) {
            console.error("Admin preview error:", error);
            toast({ variant: "destructive", title: "Preview Error", description: "Could not load file preview." });
            setIsPreviewOpen(false);
        } finally {
            setIsPreviewLoading(false);
        }
    };


    const handleDeleteFile = async (file: AdminFileData) => {
        if (!confirm(`ADMIN ACTION: Are you sure you want to permanently delete the file "${file.name}" uploaded by ${file.uploader}? This action cannot be undone.`)) {
             return;
         }

        const originalFiles = files;
        setFiles(files.filter(f => f.id !== file.id)); // Optimistic UI

        try {
            const result = await deleteFile(file.id); // Use the shared action
            if (result.success) {
                toast({ title: "File Deleted (Admin)", description: `${file.name} has been removed.` });
                 fetchAdminFiles(); // Refresh to ensure consistency after deletion
            } else {
                toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
                setFiles(originalFiles); // Revert
            }
        } catch (error) {
             console.error("Admin delete error:", error);
             toast({ variant: "destructive", title: "Deletion Error", description: "Could not delete the file." });
             setFiles(originalFiles); // Revert
        }
    };

    const handleToggleVisibility = async (file: AdminFileData) => {
        const newVisibility = file.visibility === 'private' ? 'public' : 'private';
        const originalFiles = files;
        setFiles(files.map(f => f.id === file.id ? { ...f, visibility: newVisibility } : f)); // Optimistic UI

        try {
            const result = await toggleFileVisibility(file.id, newVisibility); // Use the shared action
            if (result.success) {
                toast({ title: "Visibility Changed (Admin)", description: `Visibility of ${file.name} set to ${newVisibility}.` });
                 // No full refresh needed, optimistic update is likely correct
            } else {
                toast({ variant: "destructive", title: "Update Failed", description: result.error });
                setFiles(originalFiles); // Revert
            }
        } catch (error) {
            console.error("Admin visibility toggle error:", error);
            toast({ variant: "destructive", title: "Update Error", description: "Could not change file visibility." });
            setFiles(originalFiles); // Revert
        }
    };

    // Get File Icon (copied from files/page.tsx)
    const getFileIcon = (fileType: string | null) => {
        const type = fileType?.toLowerCase() || '';
        if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type === 'application/pdf') return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx') || type.includes('csv')) return <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.includes('word') || type.includes('docx')) return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.includes('presentation') || type.includes('ppt')) return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.includes('zip') || type.includes('rar') || type.includes('archive') || type.includes('7z')) return <FileArchive className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.startsWith('text/')) return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        return <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
    };


     const filteredFiles = files.filter(file => {
         const matchesSearch =
            file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            file.uploader.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (file.type && file.type.toLowerCase().includes(searchTerm.toLowerCase())) ||
            file.id.toString() === searchTerm; // Allow searching by ID

         const matchesVisibility = visibilityFilter === 'all' || file.visibility === visibilityFilter;

         // Basic user filter (can be expanded) - checks uploader name
         const matchesUser = !userFilter || file.uploader.toLowerCase().includes(userFilter.toLowerCase());

         return matchesSearch && matchesVisibility && matchesUser;
     });

     // Unique uploaders for filter dropdown (example)
      const uniqueUploaders = Array.from(new Set(files.map(f => f.uploader))).sort();


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
           <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
             <div>
                <CardTitle>File Management (Admin)</CardTitle>
                <CardDescription>View, manage, and moderate all files on the platform.</CardDescription>
            </div>
             <div className="flex flex-wrap items-center gap-2">
                 {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search by name, uploader, type, ID..."
                        className="pl-8 w-full sm:w-56 md:w-64 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isLoading}
                     />
                </div>
                 {/* Visibility Filter */}
                 <Select value={visibilityFilter} onValueChange={setVisibilityFilter} disabled={isLoading}>
                    <SelectTrigger className="w-[150px] h-9">
                         <ListFilter className="mr-2 h-4 w-4 text-muted-foreground" />
                        <SelectValue placeholder="Filter visibility" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">All Visibilities</SelectItem>
                        <SelectItem value="public">Public</SelectItem>
                        <SelectItem value="private">Private</SelectItem>
                    </SelectContent>
                </Select>
                 {/* TODO: Add User Filter Dropdown (potentially with search) */}
                 {/* <Input
                        placeholder="Filter by uploader"
                        className="w-full sm:w-40 h-9"
                        value={userFilter}
                        onChange={(e) => setUserFilter(e.target.value)}
                        disabled={isLoading}
                     /> */}
            </div>
          </div>
        </CardHeader>
        <CardContent>
           {isLoading ? (
             <div className="flex justify-center items-center py-10">
                 <Loader2 className="h-8 w-8 animate-spin text-primary" />
             </div>
          ) : filteredFiles.length === 0 ? (
              <p className="text-muted-foreground text-center py-10">
                {files.length === 0 ? "No files found on the platform." : "No files match the current filters."}
             </p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[40%]">Name</TableHead>
                <TableHead className="hidden sm:table-cell w-[15%]">Uploader</TableHead>
                <TableHead className="hidden md:table-cell w-[10%]">Size</TableHead>
                <TableHead className="hidden lg:table-cell w-[15%]">Uploaded</TableHead>
                <TableHead className="w-[10%]">Visibility</TableHead>
                <TableHead className="text-right w-[10%]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.key}>
                  <TableCell className="font-medium flex items-center gap-2 max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg">
                      {getFileIcon(file.type)}
                      <span className="truncate" title={file.name}>{file.name}</span>
                      <Badge variant="outline" className="ml-auto text-xs font-mono px-1.5">ID: {file.id}</Badge>
                  </TableCell>
                   <TableCell className="hidden sm:table-cell truncate" title={file.uploader}>
                       {file.uploader === 'Deleted User' ? <span className="italic text-muted-foreground">{file.uploader}</span> : file.uploader}
                       </TableCell>
                  <TableCell className="hidden md:table-cell">{formatBytes(file.size)}</TableCell>
                  <TableCell className="hidden lg:table-cell text-xs">{file.uploaded}</TableCell>
                  <TableCell>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleToggleVisibility(file)}
                        className="flex items-center gap-1 px-2 h-8 text-xs"
                        >
                         {file.visibility === 'private' ? (
                            <><Lock className="h-3 w-3" /> Private</>
                         ): (
                            <><Users className="h-3 w-3" /> Public</>
                         )}
                     </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0">
                          <span className="sr-only">Open menu</span>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Admin Actions</DropdownMenuLabel>
                         <DropdownMenuItem onClick={() => handlePreviewFile(file)}>
                            <Eye className="mr-2 h-4 w-4" />
                            Preview
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDownloadFile(file)}>
                            <Download className="mr-2 h-4 w-4" />
                            Download
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleVisibility(file)}>
                             {file.visibility === 'private' ? (
                                <><Users className="mr-2 h-4 w-4" /> Make Public</>
                            ) : (
                                <><Lock className="mr-2 h-4 w-4" /> Make Private</>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDeleteFile(file)}>
                             <Trash2 className="mr-2 h-4 w-4" />
                            Delete File
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
           )}
          {/* TODO: Add pagination */}
        </CardContent>
      </Card>

        {/* Preview Dialog (identical to files/page.tsx) */}
       <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>File Preview (Admin)</DialogTitle>
                     {/* Optionally show file name here */}
                     {/* <DialogDescription>Previewing: {fileName}</DialogDescription> */}
                </DialogHeader>
                <div className="flex-1 overflow-auto p-4 bg-muted/30"> {/* Added background */}
                    {isPreviewLoading ? (
                        <div className="flex justify-center items-center h-full min-h-[200px]">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : previewUrl ? (
                        previewFileType?.startsWith('image/') ? (
                             <img src={previewUrl} alt="File preview" className="max-w-full max-h-full object-contain mx-auto" />
                        ) : previewFileType === 'application/pdf' ? (
                            <iframe src={previewUrl} title="PDF Preview" className="w-full h-[60vh] border-0"></iframe>
                        ) : previewFileType?.startsWith('text/') ? (
                            <iframe src={previewUrl} title="Text Preview" className="w-full h-[60vh] border-0 bg-background"></iframe>
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center min-h-[200px]">
                                 <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">Direct preview not available for this file type.</p>
                                {/* Admin might still want to download */}
                                {/* <Button onClick={() => handleDownloadFile(previewFileId)} className="mt-4">Download File</Button> */}
                            </div>
                        )
                    ) : (
                         <div className="flex flex-col items-center justify-center h-full text-center min-h-[200px]">
                            <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Could not load preview or preview not supported.</p>
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>

    </div>
  );
}

