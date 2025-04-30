import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, Search, AlertCircle, MessageSquare, File, Eye, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Message {
  id: string;
  content: string;
  sender: {
    id: number;
    username: string;
  };
  channel: string;
  timestamp: Date;
  flagged?: boolean;
}

interface File {
  id: string;
  name: string;
  type: string;
  size: number;
  uploader: {
    id: number;
    username: string;
  };
  uploadedAt: Date;
  isPublic: boolean;
  isFlagged?: boolean;
}

export default function ContentModeration() {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("messages");
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [deleteReason, setDeleteReason] = useState("");

  // Query for messages
  const { data: messages, isLoading: isLoadingMessages } = useQuery<Message[]>({
    queryKey: ["/api/admin/messages"],
  });

  // Query for files
  const { data: files, isLoading: isLoadingFiles } = useQuery<File[]>({
    queryKey: ["/api/admin/files"],
  });

  // Delete message mutation
  const deleteMessageMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("DELETE", `/api/admin/messages/${id}`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Message deleted",
        description: "The message has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/messages"] });
      setShowDeleteDialog(false);
      setDeleteReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting message",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete file mutation
  const deleteFileMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("DELETE", `/api/admin/files/${id}`, { reason });
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "File deleted",
        description: "The file has been removed successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/files"] });
      setShowDeleteDialog(false);
      setDeleteReason("");
    },
    onError: (error: Error) => {
      toast({
        title: "Error deleting file",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Handle delete confirmation
  const handleDelete = () => {
    if (!selectedItemId) return;
    
    if (activeTab === "messages") {
      deleteMessageMutation.mutate({ id: selectedItemId, reason: deleteReason });
    } else {
      deleteFileMutation.mutate({ id: selectedItemId, reason: deleteReason });
    }
  };

  // Open delete dialog
  const openDeleteDialog = (id: string) => {
    setSelectedItemId(id);
    setShowDeleteDialog(true);
  };

  // Filter data based on search term
  const filteredMessages = messages?.filter(message => 
    message.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.sender.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    message.channel.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  const filteredFiles = files?.filter(file => 
    file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.uploader.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
    file.type.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Generate sample data if none is loaded
  const demoMessages: Message[] = !messages ? [
    {
      id: "msg1",
      content: "Hey team, I've just uploaded the project requirements. Please take a look.",
      sender: { id: 3, username: "Sarah" },
      channel: "general",
      timestamp: new Date(Date.now() - 3600000)
    },
    {
      id: "msg2",
      content: "Does anyone know if we're allowed to share this information publicly?",
      sender: { id: 2, username: "Robert" },
      channel: "general",
      timestamp: new Date(Date.now() - 7200000),
      flagged: true
    },
    {
      id: "msg3",
      content: "Important announcement: Website will be down for maintenance tonight.",
      sender: { id: 1, username: "Admin" },
      channel: "announcements",
      timestamp: new Date(Date.now() - 86400000)
    }
  ] : messages;

  const demoFiles: File[] = !files ? [
    {
      id: "file1",
      name: "Project_Requirements.docx",
      type: "application/msword",
      size: 2300000,
      uploader: { id: 3, username: "Sarah" },
      uploadedAt: new Date(Date.now() - 3600000),
      isPublic: true
    },
    {
      id: "file2",
      name: "Confidential_Budget.xlsx",
      type: "application/vnd.ms-excel",
      size: 1500000,
      uploader: { id: 2, username: "Robert" },
      uploadedAt: new Date(Date.now() - 7200000),
      isPublic: true,
      isFlagged: true
    },
    {
      id: "file3",
      name: "Company_Logo.png",
      type: "image/png",
      size: 500000,
      uploader: { id: 4, username: "Mary" },
      uploadedAt: new Date(Date.now() - 172800000),
      isPublic: true
    }
  ] : files;

  // Format file size
  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    else if (bytes < 1048576) return (bytes / 1024).toFixed(1) + " KB";
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(1) + " MB";
    else return (bytes / 1073741824).toFixed(1) + " GB";
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Content Moderation</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-discord-light" />
          <Input 
            placeholder="Search content..." 
            className="pl-9 bg-discord-darker border-gray-700 text-white"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="bg-discord-darkest border-b border-gray-700 mb-6 w-full justify-start">
          <TabsTrigger value="messages" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
            <MessageSquare className="h-4 w-4 mr-2" />
            Messages
          </TabsTrigger>
          <TabsTrigger value="files" className="data-[state=active]:bg-discord-primary data-[state=active]:text-white">
            <File className="h-4 w-4 mr-2" />
            Files
          </TabsTrigger>
        </TabsList>

        <TabsContent value="messages" className="mt-0">
          <Card className="bg-discord-darker border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">Message Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingMessages ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
                </div>
              ) : filteredMessages.length === 0 ? (
                <div className="text-center py-8 text-discord-light">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No messages found matching your search.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-discord-darkest">
                    <TableRow>
                      <TableHead className="text-discord-light">Content</TableHead>
                      <TableHead className="text-discord-light">Sender</TableHead>
                      <TableHead className="text-discord-light">Channel</TableHead>
                      <TableHead className="text-discord-light">Date</TableHead>
                      <TableHead className="text-discord-light w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoMessages.filter(msg => 
                      msg.content.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      msg.sender.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      msg.channel.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((message) => (
                      <TableRow key={message.id} className={message.flagged ? "bg-red-900/20" : ""}>
                        <TableCell className="font-medium truncate max-w-xs">
                          {message.content}
                        </TableCell>
                        <TableCell>{message.sender.username}</TableCell>
                        <TableCell>#{message.channel}</TableCell>
                        <TableCell>{new Date(message.timestamp).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-discord-light hover:text-white hover:bg-discord-dark"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-discord-danger hover:text-red-400 hover:bg-discord-dark"
                              onClick={() => openDeleteDialog(message.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="files" className="mt-0">
          <Card className="bg-discord-darker border-gray-700">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-lg">File Moderation</CardTitle>
            </CardHeader>
            <CardContent>
              {isLoadingFiles ? (
                <div className="flex justify-center py-10">
                  <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
                </div>
              ) : filteredFiles.length === 0 ? (
                <div className="text-center py-8 text-discord-light">
                  <AlertCircle className="h-8 w-8 mx-auto mb-2" />
                  <p>No files found matching your search.</p>
                </div>
              ) : (
                <Table>
                  <TableHeader className="bg-discord-darkest">
                    <TableRow>
                      <TableHead className="text-discord-light">File Name</TableHead>
                      <TableHead className="text-discord-light">Type</TableHead>
                      <TableHead className="text-discord-light">Size</TableHead>
                      <TableHead className="text-discord-light">Uploader</TableHead>
                      <TableHead className="text-discord-light">Date</TableHead>
                      <TableHead className="text-discord-light w-[100px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {demoFiles.filter(file => 
                      file.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      file.uploader.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      file.type.toLowerCase().includes(searchTerm.toLowerCase())
                    ).map((file) => (
                      <TableRow key={file.id} className={file.isFlagged ? "bg-red-900/20" : ""}>
                        <TableCell className="font-medium truncate max-w-xs">
                          {file.name}
                        </TableCell>
                        <TableCell>{file.type.split('/')[1].toUpperCase()}</TableCell>
                        <TableCell>{formatFileSize(file.size)}</TableCell>
                        <TableCell>{file.uploader.username}</TableCell>
                        <TableCell>{new Date(file.uploadedAt).toLocaleString()}</TableCell>
                        <TableCell>
                          <div className="flex space-x-2">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-discord-light hover:text-white hover:bg-discord-dark"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-discord-danger hover:text-red-400 hover:bg-discord-dark"
                              onClick={() => openDeleteDialog(file.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="bg-discord-dark border-gray-700 text-white">
          <DialogHeader>
            <DialogTitle className="text-white">Confirm Deletion</DialogTitle>
          </DialogHeader>
          
          <div className="py-4">
            <p className="mb-4">
              Are you sure you want to delete this {activeTab === "messages" ? "message" : "file"}?
              This action cannot be undone.
            </p>
            
            <div className="space-y-2">
              <Label htmlFor="deleteReason" className="text-discord-light">Reason for deletion (optional)</Label>
              <Textarea 
                id="deleteReason" 
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                className="bg-discord-darker border-gray-700 text-white"
                placeholder="Explain why this content is being removed..."
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              className="bg-transparent hover:bg-discord-darker text-discord-light hover:text-white border-gray-700"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDelete}
              className="bg-discord-danger hover:bg-red-800"
              disabled={deleteMessageMutation.isPending || deleteFileMutation.isPending}
            >
              {deleteMessageMutation.isPending || deleteFileMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
