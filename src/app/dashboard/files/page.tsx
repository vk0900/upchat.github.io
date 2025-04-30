// src/app/dashboard/files/page.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, Download, Eye, Trash2, Lock, Users, Search, Loader2, AlertCircle, File as FileIcon, Image as ImageIcon, FileText, FileSpreadsheet, FileArchive } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { listFiles, uploadFile, deleteFile, toggleFileVisibility, getDownloadFileInfo, getPreviewFileInfo } from '@/actions/files';
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { formatBytes } from "@/lib/utils"; // Assume utility function exists

interface FileData {
  id: number;
  name: string;
  type: string | null;
  size: number;
  uploaded: string; // Formatted date string
  visibility: 'private' | 'public';
  uploader: string; // Username or 'You'
  key: string; // Unique key for React list
}


export default function FilesPage() {
  const [files, setFiles] = useState<FileData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewFileType, setPreviewFileType] = useState<string | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Fetch files on component mount
  useEffect(() => {
    fetchFiles();
  }, []);

  const fetchFiles = async () => {
    setIsLoading(true);
    try {
      const result = await listFiles();
      if (result.success) {
        setFiles(result.files || []);
      } else {
        toast({ variant: "destructive", title: "Error", description: result.error });
        setFiles([]); // Clear files on error
      }
    } catch (error) {
      console.error("Failed to fetch files:", error);
      toast({ variant: "destructive", title: "Error", description: "Could not connect to the server." });
       setFiles([]);
    } finally {
      setIsLoading(false);
    }
  };

  // File Upload Logic
  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleUpload(file);
    }
     // Reset file input to allow uploading the same file again
     if (fileInputRef.current) {
       fileInputRef.current.value = "";
     }
  };

  const handleUpload = async (file: File) => {
    setIsUploading(true);
    setUploadProgress(0); // Start progress

     // Simulate progress for immediate feedback (remove if using real progress tracking)
    let currentProgress = 0;
    const progressInterval = setInterval(() => {
        currentProgress += 10;
        if (currentProgress <= 90) { // Stop simulation before 100%
            setUploadProgress(currentProgress);
        } else {
            clearInterval(progressInterval);
        }
    }, 100); // Adjust interval as needed

    const formData = new FormData();
    formData.append('file', file);
    // Add visibility setting if needed, e.g., from a dropdown
    // formData.append('visibility', 'private');

    try {
      const result = await uploadFile(formData);

       clearInterval(progressInterval); // Stop simulation
       setUploadProgress(100); // Show 100% on completion

      if (result.success) {
        toast({ title: "Success", description: result.message });
        fetchFiles(); // Refresh file list
      } else {
        toast({ variant: "destructive", title: "Upload Failed", description: result.error });
         setUploadProgress(null); // Clear progress on failure
      }
    } catch (error) {
       clearInterval(progressInterval);
       setUploadProgress(null);
      console.error("Upload error:", error);
      toast({ variant: "destructive", title: "Upload Error", description: "An unexpected error occurred." });
    } finally {
      setIsUploading(false);
       // Briefly show 100% then hide progress bar
       setTimeout(() => setUploadProgress(null), 1000);
    }
  };

    // Trigger file input click
   const triggerFileInput = () => {
        fileInputRef.current?.click();
    };


  // File Download Logic
  const handleDownload = async (fileId: number, fileName: string) => {
    toast({ title: "Preparing Download", description: `Requesting file: ${fileName}` });
    try {
      const result = await getDownloadFileInfo(fileId);
      if (result.success && result.fileInfo) {
        // Construct the download URL using the API route
        // The API route handles the actual file streaming and permissions
        const downloadUrl = `/api/files/${result.fileInfo.path.replace(/^uploads[\\/]/, '')}`; // Remove 'uploads/' prefix for API route path
        console.log("Download URL:", downloadUrl);

        // Create a temporary link and click it to trigger download
        const link = document.createElement('a');
        link.href = downloadUrl;
        // link.setAttribute('download', result.fileInfo.name); // Browser might override based on Content-Disposition
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        toast({ title: "Download Started", description: `${fileName} should begin downloading shortly.` });

      } else {
        toast({ variant: "destructive", title: "Download Failed", description: result.error });
      }
    } catch (error) {
      console.error("Download error:", error);
      toast({ variant: "destructive", title: "Download Error", description: "Could not process download request." });
    }
  };

   // File Preview Logic
   const handlePreview = async (fileId: number, fileType: string | null, fileName: string) => {
    setIsPreviewLoading(true);
    setIsPreviewOpen(true); // Open dialog immediately with loader
    setPreviewUrl(null);
    setPreviewFileType(fileType);

    try {
        const result = await getPreviewFileInfo(fileId);
        if (result.success && result.fileInfo) {
            // Construct the preview URL using the API route with a preview flag
             const previewApiUrl = `/api/files/${result.fileInfo.path.replace(/^uploads[\\/]/, '')}?preview=true`;

             // Check if browser can likely preview natively
             const isNativelyPreviewable = fileType && (fileType.startsWith('image/') || fileType === 'application/pdf' || fileType.startsWith('text/'));

            if (isNativelyPreviewable) {
                // Fetch the file blob to handle potential auth or complex scenarios if needed,
                // OR directly use the API URL if auth is cookie-based and API handles it.
                // Direct URL method (simpler if auth handled by API):
                 setPreviewUrl(previewApiUrl);

                // Blob method (more control, handles complex auth):
                // const response = await fetch(previewApiUrl);
                // if (!response.ok) throw new Error(`Failed to fetch preview: ${response.statusText}`);
                // const blob = await response.blob();
                // const objectUrl = URL.createObjectURL(blob);
                // setPreviewUrl(objectUrl);
                // Store objectUrl to revoke later: React.useEffect(() => () => { if (objectUrl) URL.revokeObjectURL(objectUrl); }, [objectUrl]);

            } else {
                 // If not natively previewable, show a message or download link
                 setPreviewUrl(null); // Ensure no previous preview shows
                 toast({ title: "Preview Unavailable", description: `Direct preview for '${fileName}' (${fileType || 'unknown type'}) is not supported. You can download the file instead.`});
                 // No need to keep dialog open if no preview is possible
                 // setIsPreviewOpen(false);
            }
        } else {
            toast({ variant: "destructive", title: "Preview Failed", description: result.error });
             setIsPreviewOpen(false); // Close dialog on error
        }
    } catch (error) {
        console.error("Preview error:", error);
        toast({ variant: "destructive", title: "Preview Error", description: "Could not load file preview." });
        setIsPreviewOpen(false);
    } finally {
        setIsPreviewLoading(false);
    }
};


   // File Delete Logic
   const handleDelete = async (fileId: number, fileName: string) => {
     if (!confirm(`Are you sure you want to delete the file "${fileName}"? This action cannot be undone.`)) {
            return;
        }

     // Optimistic UI update (optional)
     const originalFiles = files;
     setFiles(files.filter(f => f.id !== fileId));

    try {
        const result = await deleteFile(fileId);
        if (result.success) {
            toast({ title: "Success", description: result.message });
            // No need to fetchFiles again if optimistic update worked
        } else {
             toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
             setFiles(originalFiles); // Revert UI on failure
        }
    } catch (error) {
      console.error("Delete error:", error);
      toast({ variant: "destructive", title: "Deletion Error", description: "Could not delete the file." });
       setFiles(originalFiles); // Revert UI on failure
    }
  };

   // Visibility Toggle Logic
   const toggleVisibility = async (fileId: number, currentVisibility: 'private' | 'public') => {
    const newVisibility = currentVisibility === 'private' ? 'public' : 'private';
     const originalFiles = files;

    // Optimistic UI update
     setFiles(files.map(f => f.id === fileId ? { ...f, visibility: newVisibility } : f));

    try {
        const result = await toggleFileVisibility(fileId, newVisibility);
        if (result.success) {
            toast({ title: "Success", description: result.message });
        } else {
             toast({ variant: "destructive", title: "Update Failed", description: result.error });
             setFiles(originalFiles); // Revert
        }
    } catch (error) {
      console.error("Visibility toggle error:", error);
      toast({ variant: "destructive", title: "Update Error", description: "Could not change file visibility." });
        setFiles(originalFiles); // Revert
    }
  };

    // Get File Icon
    const getFileIcon = (fileType: string | null) => {
        const type = fileType?.toLowerCase() || '';
        if (type.startsWith('image/')) return <ImageIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type === 'application/pdf') return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.includes('spreadsheet') || type.includes('excel') || type.includes('xlsx')) return <FileSpreadsheet className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.includes('zip') || type.includes('rar') || type.includes('archive')) return <FileArchive className="h-4 w-4 flex-shrink-0 text-muted-foreground" />;
        if (type.startsWith('text/')) return <FileText className="h-4 w-4 flex-shrink-0 text-muted-foreground" />; // Simple text icon
        // Add more specific icons if needed (e.g., Word, PowerPoint)
        return <FileIcon className="h-4 w-4 flex-shrink-0 text-muted-foreground" />; // Default file icon
    };


  const filteredFiles = files.filter(file =>
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.uploader.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (file.type && file.type.toLowerCase().includes(searchTerm.toLowerCase()))
  );


  return (
    <div className="space-y-6">
      {/* Hidden File Input */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileSelect}
        style={{ display: 'none' }}
        // Consider adding 'accept' attribute based on allowed file types
      />

       {/* Upload Progress */}
      {isUploading && uploadProgress !== null && (
        <div className="mb-4">
          <Progress value={uploadProgress} className="w-full h-2" />
          <p className="text-sm text-muted-foreground mt-1 text-center">Uploading... {uploadProgress}%</p>
        </div>
      )}


      <Card>
         <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <CardTitle>File Management</CardTitle>
              <CardDescription>Upload, download, and manage your shared files (Max 10MB).</CardDescription>
            </div>
             <div className="flex items-center gap-2">
                {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search files..."
                        className="pl-8 w-full md:w-64 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isLoading}
                     />
                </div>
                <Button onClick={triggerFileInput} disabled={isUploading || isLoading}>
                   {isUploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                   ) : (
                    <Upload className="mr-2 h-4 w-4" />
                   )}
                   Upload File
                </Button>
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
                {searchTerm ? "No files match your search." : "No files uploaded yet. Click 'Upload File' to get started."}
             </p>
          ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                 <TableHead className="hidden sm:table-cell">Uploader</TableHead>
                <TableHead className="hidden md:table-cell">Size</TableHead>
                <TableHead className="hidden lg:table-cell">Uploaded</TableHead>
                <TableHead>Visibility</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredFiles.map((file) => (
                <TableRow key={file.key}>
                  <TableCell className="font-medium flex items-center gap-2 truncate">
                     {getFileIcon(file.type)}
                      <span className="truncate" title={file.name}>{file.name}</span>
                  </TableCell>
                   <TableCell className="hidden sm:table-cell">{file.uploader}</TableCell>
                  <TableCell className="hidden md:table-cell">{formatBytes(file.size)}</TableCell>
                  <TableCell className="hidden lg:table-cell">{file.uploaded}</TableCell>
                   <TableCell>
                     <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleVisibility(file.id, file.visibility)}
                        className="flex items-center gap-1 px-2 h-8"
                         disabled={file.uploader !== 'You'} // Disable if not the owner (adjust if admins can toggle here)
                        >
                        {file.visibility === 'private' ? (
                            <>
                            <Lock className="h-3 w-3" /> Private
                            </>
                        ) : (
                            <>
                            <Users className="h-3 w-3" /> Public
                            </>
                        )}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                       <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePreview(file.id, file.type, file.name)} title="Preview">
                        <Eye className="h-4 w-4" />
                        <span className="sr-only">Preview</span>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDownload(file.id, file.name)} title="Download">
                        <Download className="h-4 w-4" />
                         <span className="sr-only">Download</span>
                      </Button>
                      {/* Show delete only for own files or if admin */}
                       {file.uploader === 'You' && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(file.id, file.name)} title="Delete">
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete</span>
                        </Button>
                       )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          )}
           {/* TODO: Add pagination if there are many files */}
        </CardContent>
      </Card>

        {/* Preview Dialog */}
        <Dialog open={isPreviewOpen} onOpenChange={setIsPreviewOpen}>
            <DialogContent className="max-w-3xl max-h-[80vh] flex flex-col p-0">
                <DialogHeader className="p-4 border-b">
                    <DialogTitle>File Preview</DialogTitle>
                    {/* <DialogDescription>Previewing: {fileName}</DialogDescription> */}
                </DialogHeader>
                <div className="flex-1 overflow-auto p-4">
                    {isPreviewLoading ? (
                        <div className="flex justify-center items-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    ) : previewUrl ? (
                        previewFileType?.startsWith('image/') ? (
                             <img src={previewUrl} alt="File preview" className="max-w-full max-h-full object-contain mx-auto" />
                        ) : previewFileType === 'application/pdf' ? (
                            <iframe src={previewUrl} title="PDF Preview" className="w-full h-[60vh] border-0"></iframe>
                        ) : previewFileType?.startsWith('text/') ? (
                            // For text, we might need to fetch and display content differently if API returns text
                            <iframe src={previewUrl} title="Text Preview" className="w-full h-[60vh] border-0"></iframe> // Basic iframe, might not render nicely
                            // Or fetch text content and display in a <pre> tag
                        ) : (
                             <div className="flex flex-col items-center justify-center h-full text-center">
                                 <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                                <p className="text-muted-foreground">Direct preview not available for this file type.</p>
                                <Button onClick={() => { /* Trigger download from preview */ }} className="mt-4">Download File</Button>
                            </div>
                        )
                    ) : (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <AlertCircle className="h-10 w-10 text-muted-foreground mb-2" />
                            <p className="text-muted-foreground">Could not load preview.</p>
                        </div>
                    )}
                </div>
                 {/* Optional Footer for actions like download from preview */}
                 {/* <DialogFooter className="p-4 border-t"> ... </DialogFooter> */}
            </DialogContent>
        </Dialog>


    </div>
  );
}
