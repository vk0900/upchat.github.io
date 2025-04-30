"use client";

import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MoreHorizontal, UserPlus, Search, Edit, Trash2, RotateCcw, ShieldOff, ShieldCheck, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { registerUser, updateUserStatus, resetUserPassword, updateUserProfile, deleteUser } from "@/actions/auth"; // Import user management actions

// Define User type (could be moved to a types file)
interface User {
  id: number;
  username: string;
  email: string;
  role: 'user' | 'admin';
  status: 'active' | 'inactive';
  online?: boolean; // Optional online status from mock data
  avatar?: string; // Optional avatar URL
}

// Mock user data for initial display (replace with API fetch)
const initialUsers: User[] = [
  { id: 1, username: "Alice", email: "alice@example.com", role: "user", status: "active", online: true, avatar: "https://i.pravatar.cc/150?img=1" },
  { id: 2, username: "Bob", email: "bob@example.com", role: "user", status: "active", online: false, avatar: "https://i.pravatar.cc/150?img=2" },
  { id: 3, username: "Charlie", email: "charlie@example.com", role: "user", status: "inactive", online: false, avatar: "https://i.pravatar.cc/150?img=3" },
  { id: 4, username: "AdminUser", email: "admin@example.com", role: "admin", status: "active", online: true, avatar: "https://github.com/shadcn.png" },
  { id: 5, username: "David", email: "david@example.com", role: "user", status: "active", online: true, avatar: "https://i.pravatar.cc/150?img=4" },
];

export default function AdminUsersPage() {
    const [users, setUsers] = useState<User[]>(initialUsers);
    const [searchTerm, setSearchTerm] = useState("");
    const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
    const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
    const [isResetPasswordDialogOpen, setIsResetPasswordDialogOpen] = useState(false);
    const [editingUser, setEditingUser] = useState<User | null>(null);
    const [resettingUser, setResettingUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const { toast } = useToast();

    // TODO: Replace mock data with actual API fetch in useEffect
     useEffect(() => {
        // fetchUsers(); // Call function to fetch users from backend
         console.log("Initial users (mock):", users);
    }, []);

    // const fetchUsers = async () => {
    //     setIsLoading(true);
    //     try {
    //         // const result = await getUsers(); // Example API call
    //         // if (result.success) setUsers(result.users);
    //         // else toast({ variant: "destructive", title: "Error", description: result.error });
    //     } catch (error) {
    //         toast({ variant: "destructive", title: "Error", description: "Could not fetch users." });
    //     } finally {
    //         setIsLoading(false);
    //     }
    // };


    // --- CRUD Handlers ---

    const handleCreateUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setIsLoading(true);
        const formData = new FormData(event.currentTarget);
        const userData = {
            username: formData.get("username") as string,
            email: formData.get("email") as string,
            password: formData.get("password") as string,
            role: (formData.get("role") as 'user' | 'admin') || 'user',
        };

        // Basic client-side validation (more robust on server)
        if (!userData.username || !userData.email || !userData.password) {
             toast({ variant: "destructive", title: "Validation Error", description: "Please fill all required fields." });
             setIsLoading(false);
             return;
        }
         if (userData.password.length < 6) {
             toast({ variant: "destructive", title: "Validation Error", description: "Password must be at least 6 characters." });
             setIsLoading(false);
             return;
        }


        try {
            const result = await registerUser(userData);
            if (result.success && result.newUser) {
                setUsers([...users, result.newUser]); // Add new user to state
                toast({ title: "Success", description: result.message });
                setIsCreateDialogOpen(false); // Close dialog
            } else {
                 toast({ variant: "destructive", title: "Creation Failed", description: result.error });
            }
        } catch (error) {
             console.error("Create user error:", error);
             toast({ variant: "destructive", title: "Error", description: "Could not create user." });
        } finally {
            setIsLoading(false);
        }
    };

    const openEditDialog = (user: User) => {
        setEditingUser(user);
        setIsEditDialogOpen(true);
    };

    const handleEditUserSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!editingUser) return;
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const updatedData: { targetUserId: number; username?: string; email?: string; role?: 'user' | 'admin' } = {
            targetUserId: editingUser.id,
            // Only include fields if they have changed and are not empty
            username: formData.get("username") as string !== editingUser.username ? formData.get("username") as string : undefined,
            email: formData.get("email") as string !== editingUser.email ? formData.get("email") as string : undefined,
            role: formData.get("role") as string !== editingUser.role ? (formData.get("role") as 'user' | 'admin') : undefined,
        };

        // Remove undefined fields
        Object.keys(updatedData).forEach(key => updatedData[key as keyof typeof updatedData] === undefined && delete updatedData[key as keyof typeof updatedData]);

        if (Object.keys(updatedData).length <= 1) { // Only targetUserId means no changes
            toast({ variant: "default", title: "No Changes", description: "No profile information was modified." });
            setIsLoading(false);
            setIsEditDialogOpen(false);
            return;
        }


        try {
            const result = await updateUserProfile(updatedData);
            if (result.success) {
                setUsers(users.map(u => u.id === editingUser.id ? { ...u, ...updatedData } : u));
                toast({ title: "Success", description: result.message });
                setIsEditDialogOpen(false);
                setEditingUser(null);
            } else {
                toast({ variant: "destructive", title: "Update Failed", description: result.error });
            }
        } catch (error) {
             console.error("Edit user error:", error);
             toast({ variant: "destructive", title: "Error", description: "Could not update user profile." });
        } finally {
            setIsLoading(false);
        }
    };

     const handleDeleteUser = async (user: User) => {
         if (!confirm(`Are you sure you want to permanently delete user "${user.username}"? This action CANNOT be undone.`)) {
            return;
        }
        setIsLoading(true); // Use a general loading state or specific deleting state

        try {
            const result = await deleteUser({ targetUserId: user.id });
            if (result.success) {
                setUsers(users.filter(u => u.id !== user.id)); // Remove from state
                toast({ title: "Success", description: result.message });
            } else {
                toast({ variant: "destructive", title: "Deletion Failed", description: result.error });
            }
        } catch (error) {
             console.error("Delete user error:", error);
             toast({ variant: "destructive", title: "Error", description: "Could not delete user." });
        } finally {
             setIsLoading(false);
        }
    };

    const openResetPasswordDialog = (user: User) => {
        setResettingUser(user);
        setIsResetPasswordDialogOpen(true);
    };

     const handleResetPasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (!resettingUser) return;
        setIsLoading(true);

        const formData = new FormData(event.currentTarget);
        const newPassword = formData.get("newPassword") as string;

         if (!newPassword || newPassword.length < 6) {
             toast({ variant: "destructive", title: "Validation Error", description: "New password must be at least 6 characters." });
             setIsLoading(false);
             return;
        }

         try {
            const result = await resetUserPassword({ targetUserId: resettingUser.id, newPassword });
            if (result.success) {
                toast({ title: "Success", description: result.message });
                setIsResetPasswordDialogOpen(false);
                setResettingUser(null);
            } else {
                toast({ variant: "destructive", title: "Reset Failed", description: result.error });
            }
        } catch (error) {
             console.error("Reset password error:", error);
             toast({ variant: "destructive", title: "Error", description: "Could not reset password." });
        } finally {
             setIsLoading(false);
        }
    };


    const handleToggleUserStatus = async (user: User) => {
        const newStatus = user.status === 'active' ? 'inactive' : 'active';
        // Optimistic UI update (optional, can cause flicker if request fails)
        // setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u));

         setIsLoading(true); // Indicate loading state

         try {
             const result = await updateUserStatus({ targetUserId: user.id, status: newStatus });
             if (result.success) {
                 setUsers(users.map(u => u.id === user.id ? { ...u, status: newStatus } : u)); // Update state on success
                 toast({ title: "Success", description: result.message });
             } else {
                 toast({ variant: "destructive", title: "Update Failed", description: result.error });
                  // Revert optimistic update if it was used
                 // setUsers(users.map(u => u.id === user.id ? { ...u, status: user.status } : u));
             }
         } catch (error) {
              console.error("Toggle status error:", error);
              toast({ variant: "destructive", title: "Error", description: "Could not update user status." });
               // Revert optimistic update if it was used
         } finally {
            setIsLoading(false);
         }
    };


    const filteredUsers = users.filter(user =>
        user.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
        user.email.toLowerCase().includes(searchTerm.toLowerCase())
    );


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
             <div>
                <CardTitle>User Management</CardTitle>
                <CardDescription>Create, edit, and manage user accounts.</CardDescription>
             </div>
             <div className="flex items-center gap-2">
                 {/* Search Input */}
                <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                        placeholder="Search users..."
                        className="pl-8 w-full md:w-64 h-9"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={isLoading}
                     />
                </div>
                 <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
                    <DialogTrigger asChild>
                        <Button disabled={isLoading}>
                            {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <UserPlus className="mr-2 h-4 w-4" />}
                             Create User
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[425px]">
                        <DialogHeader>
                        <DialogTitle>Create New User</DialogTitle>
                        <DialogDescription>
                            Fill in the details for the new user account.
                        </DialogDescription>
                        </DialogHeader>
                        <form onSubmit={handleCreateUserSubmit} className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="username" className="text-right">Username</Label>
                                <Input id="username" name="username" className="col-span-3" required disabled={isLoading} />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="email" className="text-right">Email</Label>
                                <Input id="email" name="email" type="email" className="col-span-3" required disabled={isLoading} />
                            </div>
                             <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="password" className="text-right">Password</Label>
                                <Input id="password" name="password" type="password" className="col-span-3" required placeholder="Min 6 characters" disabled={isLoading}/>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                                <Label htmlFor="role" className="text-right">Role</Label>
                                <Select name="role" defaultValue="user" disabled={isLoading}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                                </Select>
                            </div>
                             <DialogFooter>
                                <DialogClose asChild>
                                    <Button type="button" variant="outline" disabled={isLoading}>Cancel</Button>
                                </DialogClose>
                                <Button type="submit" disabled={isLoading}>
                                    {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Create User
                                </Button>
                            </DialogFooter>
                        </form>
                    </DialogContent>
                </Dialog>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead className="hidden md:table-cell">Email</TableHead>
                <TableHead className="hidden lg:table-cell">Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={user.avatar} alt={user.username} />
                        <AvatarFallback>{user.username.substring(0, 1).toUpperCase()}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{user.username}</span>
                      {user.online && <span className="h-2 w-2 rounded-full bg-green-500" title="Online"></span>}
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                  <TableCell className="hidden lg:table-cell capitalize">{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'secondary' : 'outline'} className={user.status === 'active' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'border-red-500/30 text-red-400'}>
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" className="h-8 w-8 p-0" disabled={isLoading}>
                          <span className="sr-only">Open menu</span>
                           {isLoading ? <Loader2 className="h-4 w-4 animate-spin"/> : <MoreHorizontal className="h-4 w-4" />}
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuItem onClick={() => openEditDialog(user)}>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit Profile
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => openResetPasswordDialog(user)}>
                             <RotateCcw className="mr-2 h-4 w-4" />
                             Reset Password
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleToggleUserStatus(user)}>
                            {user.status === 'active' ? (
                                <><ShieldOff className="mr-2 h-4 w-4" /> Deactivate</>
                            ) : (
                                <><ShieldCheck className="mr-2 h-4 w-4" /> Activate</>
                            )}
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive focus:text-destructive focus:bg-destructive/10" onClick={() => handleDeleteUser(user)}>
                             <Trash2 className="mr-2 h-4 w-4" />
                            Delete User
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
                {filteredUsers.length === 0 && (
                    <TableRow>
                        <TableCell colSpan={5} className="text-center h-24 text-muted-foreground">
                            {isLoading ? <Loader2 className="mx-auto h-6 w-6 animate-spin"/> : (searchTerm ? 'No users match your search.' : 'No users found.')}
                        </TableCell>
                    </TableRow>
                )}
            </TableBody>
          </Table>
          {/* TODO: Add pagination */}
        </CardContent>
      </Card>

        {/* Edit User Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
             <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit User: {editingUser?.username}</DialogTitle>
                    <DialogDescription>Modify user details below. Leave fields unchanged to keep current values.</DialogDescription>
                </DialogHeader>
                {editingUser && (
                     <form onSubmit={handleEditUserSubmit} className="grid gap-4 py-4">
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-username" className="text-right">Username</Label>
                            <Input id="edit-username" name="username" defaultValue={editingUser.username} className="col-span-3" required disabled={isLoading} />
                        </div>
                        <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-email" className="text-right">Email</Label>
                            <Input id="edit-email" name="email" type="email" defaultValue={editingUser.email} className="col-span-3" required disabled={isLoading} />
                        </div>
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="edit-role" className="text-right">Role</Label>
                            <Select name="role" defaultValue={editingUser.role} disabled={isLoading}>
                                <SelectTrigger className="col-span-3">
                                    <SelectValue placeholder="Select a role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="user">User</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                         <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isLoading} onClick={() => setEditingUser(null)}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isLoading}>
                                 {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>

        {/* Reset Password Dialog */}
         <Dialog open={isResetPasswordDialogOpen} onOpenChange={setIsResetPasswordDialogOpen}>
             <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Reset Password: {resettingUser?.username}</DialogTitle>
                    <DialogDescription>Enter a new password for the user. The user will be notified (not really implemented).</DialogDescription>
                </DialogHeader>
                {resettingUser && (
                    <form onSubmit={handleResetPasswordSubmit} className="grid gap-4 py-4">
                         <div className="grid grid-cols-4 items-center gap-4">
                            <Label htmlFor="newPassword" className="text-right">New Password</Label>
                            <Input id="newPassword" name="newPassword" type="password" className="col-span-3" required placeholder="Min 6 characters" disabled={isLoading} />
                        </div>
                        <DialogFooter>
                            <DialogClose asChild>
                                <Button type="button" variant="outline" disabled={isLoading} onClick={() => setResettingUser(null)}>Cancel</Button>
                            </DialogClose>
                            <Button type="submit" disabled={isLoading}>
                                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Reset Password
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>


    </div>
  );
}

