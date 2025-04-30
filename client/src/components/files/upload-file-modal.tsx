import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UploadCloud, X } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { useQuery } from "@tanstack/react-query";
import { User } from "@shared/schema";

interface UploadFileModalProps {
  isOpen: boolean;
  onClose: () => void;
  channel: string;
}

export default function UploadFileModal({ isOpen, onClose, channel }: UploadFileModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [visibility, setVisibility] = useState<"private" | "public">("private");
  const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get users for sharing options
  const { data: users } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (selectedFile.size > 1024 * 1024 * 1024) { // 1024MB limit
        toast({
          title: "File too large",
          description: "Maximum file size is 1024MB",
          variant: "destructive",
        });
        return;
      }
      setFile(selectedFile);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile) {
      if (droppedFile.size > 1024 * 1024 * 1024) { // 1024MB limit
        toast({
          title: "File too large",
          description: "Maximum file size is 1024MB",
          variant: "destructive",
        });
        return;
      }
      setFile(droppedFile);
    }
  };

  const handleBrowseClick = () => {
    fileInputRef.current?.click();
  };

  const handleUpload = async () => {
    if (!file) {
      toast({
        title: "No file selected",
        description: "Please select a file to upload",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);

    // In a real app, you would upload the file to the server
    // const formData = new FormData();
    // formData.append('file', file);
    // formData.append('visibility', visibility);
    // formData.append('channel', channel);
    // if (selectedUsers.length > 0) {
    //   formData.append('sharedWith', JSON.stringify(selectedUsers));
    // }
    // 
    // try {
    //   const response = await fetch('/api/files/upload', {
    //     method: 'POST',
    //     body: formData,
    //   });
    //   if (!response.ok) throw new Error('Upload failed');
    // } catch (error) {
    //   toast({ 
    //     title: "Upload failed", 
    //     description: error.message, 
    //     variant: "destructive" 
    //   });
    //   setIsUploading(false);
    //   return;
    // }

    // Simulate upload
    setTimeout(() => {
      toast({
        title: "File uploaded",
        description: `${file.name} has been uploaded successfully`,
      });
      setIsUploading(false);
      onClose();
    }, 1500);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-discord-dark border-gray-700 text-white sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-white text-xl">Upload File</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-2">
          <div 
            className="mb-4 border-2 border-dashed border-gray-700 rounded-md p-8 text-center"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {file ? (
              <div className="flex flex-col items-center">
                <div className="flex items-center justify-between w-full mb-4">
                  <div className="flex items-center">
                    <UploadCloud className="h-6 w-6 text-discord-primary" />
                    <span className="ml-2 text-sm truncate max-w-[200px]">{file.name}</span>
                  </div>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-6 w-6 rounded-full text-discord-light hover:text-white hover:bg-discord-darker"
                    onClick={() => setFile(null)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-xs text-discord-light">
                  {(file.size / (1024 * 1024)).toFixed(2)} MB
                </p>
              </div>
            ) : (
              <>
                <UploadCloud className="h-12 w-12 text-discord-light mx-auto mb-2" />
                <p className="text-discord-light mb-2">Drag and drop your file here, or click to browse</p>
                <p className="text-xs text-discord-light">Maximum file size: 1024MB</p>
              </>
            )}
            <input 
              type="file" 
              ref={fileInputRef} 
              className="hidden" 
              onChange={handleFileChange} 
            />
            <Button
              onClick={handleBrowseClick}
              className="mt-4 bg-discord-primary hover:bg-discord-primary-hover"
            >
              Select File
            </Button>
          </div>
          
          <div className="space-y-2">
            <Label className="text-discord-light">File Visibility</Label>
            <RadioGroup 
              value={visibility} 
              onValueChange={(value) => setVisibility(value as "private" | "public")}
              className="flex space-x-4"
            >
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="private" id="private" className="text-discord-primary" />
                <Label htmlFor="private" className="cursor-pointer">Private</Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="public" id="public" className="text-discord-primary" />
                <Label htmlFor="public" className="cursor-pointer">Public</Label>
              </div>
            </RadioGroup>
          </div>
          
          <div className="space-y-2">
            <Label className="text-discord-light">Share with (optional)</Label>
            <Select
              value={selectedUsers.length > 0 ? "selected" : ""}
              onValueChange={() => {}}
            >
              <SelectTrigger className="w-full bg-discord-darker border-gray-700 text-discord-light">
                <SelectValue placeholder="Select users to share with" />
              </SelectTrigger>
              <SelectContent className="bg-discord-darkest border-gray-700">
                {users ? (
                  users
                    .filter(u => u.id !== user?.id)
                    .map(u => (
                      <SelectItem key={u.id} value={String(u.id)}>
                        {u.username}
                      </SelectItem>
                    ))
                ) : (
                  <SelectItem value="loading">Loading users...</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={onClose}
            className="bg-transparent text-discord-light hover:text-white hover:bg-discord-darker border-gray-700"
          >
            Cancel
          </Button>
          <Button 
            onClick={handleUpload}
            className="bg-discord-primary hover:bg-discord-primary-hover"
            disabled={!file || isUploading}
          >
            {isUploading ? "Uploading..." : "Upload File"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
