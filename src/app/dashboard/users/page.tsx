import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { MessageCircle, Mail } from 'lucide-react'; // Added icons
import { Button } from "@/components/ui/button";


// Mock user data
const users = [
  { id: 1, username: "Alice", email: "alice@example.com", role: "user", status: "active", online: true, avatar: "https://i.pravatar.cc/150?img=1" },
  { id: 2, username: "Bob", email: "bob@example.com", role: "user", status: "active", online: false, avatar: "https://i.pravatar.cc/150?img=2" },
  { id: 3, username: "Charlie", email: "charlie@example.com", role: "user", status: "inactive", online: false, avatar: "https://i.pravatar.cc/150?img=3" },
  { id: 4, username: "AdminUser", email: "admin@example.com", role: "admin", status: "active", online: true, avatar: "https://github.com/shadcn.png" },
  { id: 5, username: "David", email: "david@example.com", role: "user", status: "active", online: true, avatar: "https://i.pravatar.cc/150?img=4" },
];

export default function UsersPage() {

    // TODO: Implement private message functionality
    const handlePrivateMessage = (username: string) => {
        alert(`Starting private message with ${username} - not implemented yet.`);
    }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Users</CardTitle>
          <CardDescription>List of registered users on the platform.</CardDescription>
        </CardHeader>
        <CardContent>
           {/* TODO: Add search/filter for users */}
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
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                        <div className="relative">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={user.avatar} alt={user.username} />
                                <AvatarFallback>{user.username.substring(0, 1)}</AvatarFallback>
                            </Avatar>
                            {user.online && (
                                <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-green-500 ring-2 ring-background" />
                            )}
                        </div>
                        <span className="font-medium">{user.username}</span>
                    </div>
                  </TableCell>
                  <TableCell className="hidden md:table-cell">{user.email}</TableCell>
                  <TableCell className="hidden lg:table-cell capitalize">{user.role}</TableCell>
                  <TableCell>
                    <Badge variant={user.status === 'active' ? 'secondary' : 'outline'} className={user.status === 'active' ? 'bg-green-500/20 text-green-400' : ''}>
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                    <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handlePrivateMessage(user.username)}>
                            <MessageCircle className="h-4 w-4" />
                            <span className="sr-only">Send private message</span>
                        </Button>
                         {/* // TODO: Link to user profile page if implemented */}
                         {/* <Button variant="ghost" size="icon" className="h-8 w-8">
                            <Mail className="h-4 w-4" />
                            <span className="sr-only">View Profile</span>
                        </Button> */}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
            {/* TODO: Add pagination if there are many users */}
        </CardContent>
      </Card>
    </div>
  );
}
