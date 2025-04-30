import { FileIcon, Share2Icon, MoreVerticalIcon, DownloadIcon, EyeIcon, TrashIcon, GlobeIcon, LockIcon } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export interface FileProps {
  id: string;
  name: string;
  type: string;
  size: number;
  url: string;
  uploadedBy: {
    id: number;
    username: string;
  };
  uploadedAt: Date;
  isPrivate: boolean;
  onDelete?: (id: string) => void;
  onToggleVisibility?: (id: string, isPrivate: boolean) => void;
  onShare?: (id: string) => void;
  isOwner?: boolean;
}

export default function FileCard({
  id,
  name,
  type,
  size,
  url,
  uploadedBy,
  uploadedAt,
  isPrivate,
  onDelete,
  onToggleVisibility,
  onShare,
  isOwner = false
}: FileProps) {
  // Handle file icon based on file type
  const getFileIcon = () => {
    if (type.includes("pdf")) return "text-red-400";
    if (type.includes("word") || type.includes("doc")) return "text-blue-400";
    if (type.includes("excel") || type.includes("sheet") || type.includes("csv")) return "text-green-400";
    if (type.includes("image")) return "text-purple-400";
    if (type.includes("zip") || type.includes("rar") || type.includes("tar") || type.includes("gz")) return "text-yellow-400";
    return "text-discord-light";
  };
  
  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  };
  
  const handleDownload = () => {
    // In a real app, this would trigger a download
    window.open(url, "_blank");
  };
  
  return (
    <div className="bg-discord-darker rounded-md overflow-hidden border border-gray-700">
      <div className="p-4 flex items-center">
        <div className={`text-3xl ${getFileIcon()} mr-3`}>
          <FileIcon className="h-8 w-8" />
        </div>
        <div className="flex-1 overflow-hidden">
          <div className="font-medium text-white truncate">{name}</div>
          <div className="text-xs text-discord-light">
            {formatFileSize(size)} • Shared {formatDistanceToNow(new Date(uploadedAt), { addSuffix: true })}
          </div>
        </div>
      </div>
      <div className="bg-discord-darkest px-4 py-2 flex justify-between items-center">
        <span className="text-xs text-discord-light">By: {uploadedBy.username}</span>
        <div className="flex space-x-2">
          <button 
            title="Download" 
            className="text-discord-light hover:text-white"
            onClick={handleDownload}
          >
            <DownloadIcon className="h-4 w-4" />
          </button>
          
          <Dialog>
            <DialogTrigger asChild>
              <button title="Preview" className="text-discord-light hover:text-white">
                <EyeIcon className="h-4 w-4" />
              </button>
            </DialogTrigger>
            <DialogContent className="bg-discord-darker border-gray-700 text-white">
              <DialogHeader>
                <DialogTitle className="text-white">{name}</DialogTitle>
              </DialogHeader>
              <div className="mt-4">
                <div className="bg-discord-darkest p-6 rounded-md flex items-center justify-center">
                  <div className={`text-5xl ${getFileIcon()}`}>
                    <FileIcon className="h-16 w-16" />
                  </div>
                </div>
                <div className="mt-4">
                  <p className="text-sm text-discord-light">File Type: {type.split("/")[1].toUpperCase()}</p>
                  <p className="text-sm text-discord-light">Size: {formatFileSize(size)}</p>
                  <p className="text-sm text-discord-light">Uploaded By: {uploadedBy.username}</p>
                  <p className="text-sm text-discord-light">Date: {new Date(uploadedAt).toLocaleString()}</p>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {onShare && (
            <button 
              title="Share" 
              className="text-discord-light hover:text-white"
              onClick={() => onShare(id)}
            >
              <Share2Icon className="h-4 w-4" />
            </button>
          )}
          
          {isOwner && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button title="More options" className="text-discord-light hover:text-white">
                  <MoreVerticalIcon className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="bg-discord-darkest border-gray-700 text-white">
                {onToggleVisibility && (
                  <DropdownMenuItem 
                    onClick={() => onToggleVisibility(id, !isPrivate)}
                    className="hover:bg-discord-primary cursor-pointer"
                  >
                    {isPrivate ? (
                      <>
                        <GlobeIcon className="h-4 w-4 mr-2" />
                        <span>Make Public</span>
                      </>
                    ) : (
                      <>
                        <LockIcon className="h-4 w-4 mr-2" />
                        <span>Make Private</span>
                      </>
                    )}
                  </DropdownMenuItem>
                )}
                {onDelete && (
                  <DropdownMenuItem 
                    onClick={() => onDelete(id)}
                    className="hover:bg-red-600 cursor-pointer text-discord-danger hover:text-white"
                  >
                    <TrashIcon className="h-4 w-4 mr-2" />
                    <span>Delete</span>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>
    </div>
  );
}
