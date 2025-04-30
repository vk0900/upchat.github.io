import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import FileCard, { FileProps } from "./file-card";
import { UploadCloud, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface FileViewProps {
  channel: string;
  onUploadFile: () => void;
}

export default function FileView({ channel, onUploadFile }: FileViewProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [fileTypeFilter, setFileTypeFilter] = useState<string>("all");
  
  // Fetch shared files for the current channel
  const { data: channelFiles, isLoading: isLoadingChannelFiles } = useQuery<FileProps[]>({
    queryKey: ["/api/files/channel", channel],
  });
  
  // Fetch user's private files
  const { data: userFiles, isLoading: isLoadingUserFiles } = useQuery<FileProps[]>({
    queryKey: ["/api/files/user"],
  });
  
  const handleFileDelete = (fileId: string) => {
    // In a real app, you would call an API to delete the file
    toast({
      title: "File deleted",
      description: "The file has been successfully deleted",
    });
  };
  
  const handleToggleVisibility = (fileId: string, isPrivate: boolean) => {
    // In a real app, you would call an API to toggle visibility
    toast({
      title: isPrivate ? "File is now private" : "File is now public",
      description: isPrivate 
        ? "Only you can see this file now" 
        : "The file is now visible to everyone",
    });
  };
  
  const handleShareFile = (fileId: string) => {
    // In a real app, this would open a sharing dialog
    toast({
      title: "Share link copied",
      description: "Link copied to clipboard. Anyone with this link can view the file.",
    });
  };
  
  // Filter files based on the selected type
  const filterFiles = (files: FileProps[] | undefined) => {
    if (!files) return [];
    
    if (fileTypeFilter === "all") return files;
    
    return files.filter(file => {
      if (fileTypeFilter === "documents") {
        return file.type.includes("pdf") || 
               file.type.includes("doc") || 
               file.type.includes("text");
      }
      if (fileTypeFilter === "images") {
        return file.type.includes("image");
      }
      if (fileTypeFilter === "videos") {
        return file.type.includes("video");
      }
      return file.type.includes(fileTypeFilter);
    });
  };
  
  // Sample files if none are loaded from API
  const sampleFiles: FileProps[] = [
    {
      id: "file-1",
      name: "Brand_Guidelines_v2.pdf",
      type: "application/pdf",
      size: 5700000,
      url: "#",
      uploadedBy: { id: 2, username: "Robert" },
      uploadedAt: new Date(Date.now() - 2 * 3600000),
      isPrivate: false
    },
    {
      id: "file-2",
      name: "Project_Requirements.docx",
      type: "application/msword",
      size: 2300000,
      url: "#",
      uploadedBy: { id: 3, username: "Sarah" },
      uploadedAt: new Date(Date.now() - 5 * 3600000),
      isPrivate: false
    },
    {
      id: "file-3",
      name: "Budget_Q3.xlsx",
      type: "application/vnd.ms-excel",
      size: 1500000,
      url: "#",
      uploadedBy: { id: 1, username: user?.username || "John" },
      uploadedAt: new Date(Date.now() - 24 * 3600000),
      isPrivate: false,
      isOwner: true
    },
    {
      id: "file-4",
      name: "Product_Photo.png",
      type: "image/png",
      size: 3800000,
      url: "#",
      uploadedBy: { id: 4, username: "Mary" },
      uploadedAt: new Date(Date.now() - 48 * 3600000),
      isPrivate: false
    },
    {
      id: "file-5",
      name: "Meeting_Notes.txt",
      type: "text/plain",
      size: 28000,
      url: "#",
      uploadedBy: { id: 1, username: user?.username || "John" },
      uploadedAt: new Date(Date.now() - 72 * 3600000),
      isPrivate: true,
      isOwner: true
    }
  ];
  
  const displayedChannelFiles = channelFiles || (channel === "general" ? sampleFiles.filter(f => !f.isPrivate) : []);
  const displayedUserFiles = userFiles || sampleFiles.filter(f => f.isOwner);
  
  return (
    <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-bold">Recently Shared Files</h3>
          <div className="flex space-x-2">
            <Select 
              value={fileTypeFilter} 
              onValueChange={setFileTypeFilter}
            >
              <SelectTrigger className="bg-discord-darker text-discord-light border-gray-700 w-40">
                <SelectValue placeholder="All Files" />
              </SelectTrigger>
              <SelectContent className="bg-discord-darkest text-white border-gray-700">
                <SelectItem value="all">All Files</SelectItem>
                <SelectItem value="documents">Documents</SelectItem>
                <SelectItem value="images">Images</SelectItem>
                <SelectItem value="videos">Videos</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
              </SelectContent>
            </Select>
            
            <Button 
              onClick={onUploadFile}
              className="bg-discord-primary hover:bg-discord-primary-hover"
            >
              <UploadCloud className="h-4 w-4 mr-2" />
              Upload
            </Button>
          </div>
        </div>

        {isLoadingChannelFiles ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
          </div>
        ) : filterFiles(displayedChannelFiles).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterFiles(displayedChannelFiles).map((file) => (
              <FileCard 
                key={file.id} 
                {...file} 
                onShare={handleShareFile}
                onDelete={file.isOwner ? handleFileDelete : undefined}
                onToggleVisibility={file.isOwner ? handleToggleVisibility : undefined}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-discord-light">
            <div className="mb-4">
              <UploadCloud className="h-12 w-12 mx-auto opacity-50" />
            </div>
            <h3 className="text-lg font-medium mb-2">No files found</h3>
            <p className="text-sm">
              {fileTypeFilter !== "all" 
                ? `No ${fileTypeFilter} files have been shared in this channel yet.` 
                : "No files have been shared in this channel yet."}
            </p>
            <Button 
              onClick={onUploadFile}
              className="mt-4 bg-discord-primary hover:bg-discord-primary-hover"
            >
              Upload Your First File
            </Button>
          </div>
        )}
      </div>

      <div>
        <h3 className="text-lg font-bold mb-4">My Files</h3>
        
        {isLoadingUserFiles ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
          </div>
        ) : filterFiles(displayedUserFiles).length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filterFiles(displayedUserFiles).map((file) => (
              <FileCard 
                key={file.id} 
                {...file} 
                isOwner={true}
                onDelete={handleFileDelete}
                onToggleVisibility={handleToggleVisibility}
                onShare={handleShareFile}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-10 text-discord-light">
            <p className="text-sm">You haven't uploaded any files yet.</p>
            <Button 
              onClick={onUploadFile}
              className="mt-4 bg-discord-primary hover:bg-discord-primary-hover"
            >
              Upload File
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
