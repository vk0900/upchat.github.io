import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { User } from "@shared/schema";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, UserPlus, Edit, Key, Ban } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function UserManagement() {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState("");
  const [filter, setFilter] = useState("all");
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ username: "", password: "", role: "user" });
  
  // Fetch users
  const { data: users, isLoading } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  
  // Create user mutation
  const createUserMutation = useMutation({
    mutationFn: async (userData: typeof newUser) => {
      const res = await apiRequest("POST", "/api/admin/users", userData);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "User created",
        description: `User ${newUser.username} created successfully`,
      });
      setNewUser({ username: "", password: "", role: "user" });
      setShowCreateUserModal(false);
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to create user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  // Deactivate user mutation
  const deactivateUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest("POST", `/api/admin/users/${userId}/deactivate`, {});
      return await res.json();
    },
    onSuccess: (_, userId) => {
      toast({
        title: "User deactivated",
        description: "User has been deactivated successfully",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Failed to deactivate user",
        description: error.message,
        variant: "destructive",
      });
    },
  });
  
  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.username || !newUser.password) {
      toast({
        title: "Missing fields",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    try {
      await createUserMutation.mutateAsync(newUser);
    } catch (error) {
      console.error("Error creating user:", error);
    }
  };
  
  // Filter and search users
  const filteredUsers = users?.filter(user => {
    // Apply role filter
    if (filter !== "all" && user.role !== filter) return false;
    
    // Apply search
    if (searchTerm && !user.username.toLowerCase().includes(searchTerm.toLowerCase())) return false;
    
    return true;
  }) || [];
  
  // Sample user statuses and colors for UI demo
  const getUserStatus = (userId: number) => {
    const statuses = ["active", "active", "active", "inactive"];
    return statuses[userId % statuses.length];
  };
  
  const getUserColor = (userId: number) => {
    const colors = ["bg-discord-primary", "bg-red-500", "bg-green-500", "bg-purple-500", "bg-orange-500"];
    return colors[userId % colors.length];
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">User Management</h1>
        <Dialog open={showCreateUserModal} onOpenChange={setShowCreateUserModal}>
          <DialogTrigger asChild>
            <Button className="bg-discord-primary hover:bg-discord-primary-hover">
              <UserPlus className="h-4 w-4 mr-2" />
              Create New User
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-discord-dark border-gray-700 text-white">
            <DialogHeader>
              <DialogTitle className="text-white">Create New User</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser}>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <label htmlFor="username" className="text-sm text-discord-light">Username</label>
                  <Input 
                    id="username" 
                    value={newUser.username} 
                    onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                    className="bg-discord-darker border-gray-700 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm text-discord-light">Password</label>
                  <Input 
                    id="password" 
                    type="password" 
                    value={newUser.password} 
                    onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                    className="bg-discord-darker border-gray-700 text-white"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="role" className="text-sm text-discord-light">Role</label>
                  <Select 
                    value={newUser.role} 
                    onValueChange={(value) => setNewUser({...newUser, role: value})}
                  >
                    <SelectTrigger className="bg-discord-darker border-gray-700 text-white">
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent className="bg-discord-darkest border-gray-700">
                      <SelectItem value="admin">Admin</SelectItem>
                      <SelectItem value="user">Regular User</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              <DialogFooter className="mt-4">
                <Button type="button" variant="outline" onClick={() => setShowCreateUserModal(false)}
                  className="bg-transparent hover:bg-discord-darker text-discord-light hover:text-white border-gray-700"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  className="bg-discord-primary hover:bg-discord-primary-hover"
                  disabled={createUserMutation.isPending}
                >
                  {createUserMutation.isPending ? "Creating..." : "Create User"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="bg-discord-darker rounded-lg overflow-hidden mb-6">
        <div className="p-4 flex justify-between items-center border-b border-gray-700">
          <h2 className="font-bold">User Accounts</h2>
          <div className="flex space-x-4">
            <div className="relative">
              <Input 
                type="text" 
                placeholder="Search users..." 
                className="bg-discord-darkest text-discord-light rounded-md py-1 px-3 pr-8 text-sm focus:outline-none w-48 md:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              <svg xmlns="http://www.w3.org/2000/svg" className="absolute right-3 top-2 h-4 w-4 text-discord-light" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle>
                <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="bg-discord-darkest text-discord-light border-gray-700 w-40">
                <SelectValue placeholder="All Users" />
              </SelectTrigger>
              <SelectContent className="bg-discord-darkest border-gray-700">
                <SelectItem value="all">All Users</SelectItem>
                <SelectItem value="admin">Admins</SelectItem>
                <SelectItem value="user">Regular Users</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-8 w-8 animate-spin text-discord-light" />
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="text-center py-10 text-discord-light">
            <p>No users found matching your criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-discord-darkest text-left">
                <tr>
                  <th className="py-3 px-4 text-discord-light font-medium">User</th>
                  <th className="py-3 px-4 text-discord-light font-medium">Role</th>
                  <th className="py-3 px-4 text-discord-light font-medium">Last Active</th>
                  <th className="py-3 px-4 text-discord-light font-medium">Status</th>
                  <th className="py-3 px-4 text-discord-light font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {filteredUsers.map(user => {
                  const userStatus = getUserStatus(user.id);
                  const userColor = getUserColor(user.id);
                  
                  return (
                    <tr key={user.id}>
                      <td className="py-3 px-4">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-full ${userColor} flex items-center justify-center text-white mr-3`}>
                            <span>{user.username.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <div>
                            <div className="font-medium">{user.username}</div>
                            <div className="text-discord-light text-xs">{user.email || `user${user.id}@example.com`}</div>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4">
                        <span className={`text-xs px-2 py-1 rounded-full ${
                          user.role === "admin" 
                            ? "bg-discord-primary text-white" 
                            : "bg-discord-darker text-discord-light border border-gray-700"
                        }`}>
                          {user.role === "admin" ? "Admin" : "Regular"}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-discord-light">
                        {userStatus === "active" ? "Now" : "2 days ago"}
                      </td>
                      <td className="py-3 px-4">
                        <span className={`flex items-center ${
                          userStatus === "active" ? "text-discord-success" : "text-gray-500"
                        }`}>
                          <span className={`inline-block w-2 h-2 rounded-full mr-1 ${
                            userStatus === "active" ? "bg-discord-success" : "bg-gray-500"
                          }`}></span>
                          {userStatus === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex space-x-2">
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-discord-light hover:text-white hover:bg-discord-dark"
                            title="Edit User"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-discord-light hover:text-white hover:bg-discord-dark"
                            title="Reset Password"
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          <Button 
                            size="icon" 
                            variant="ghost" 
                            className="h-8 w-8 text-discord-danger hover:text-red-400 hover:bg-discord-dark"
                            title="Deactivate User"
                            onClick={() => deactivateUserMutation.mutate(user.id)}
                            disabled={deactivateUserMutation.isPending}
                          >
                            <Ban className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
