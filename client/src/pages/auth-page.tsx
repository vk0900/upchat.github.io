import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLocation } from "wouter";
import { AlertCircle, Lock, User } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function AuthPage() {
  const [loginCredentials, setLoginCredentials] = useState({ username: "", password: "" });
  const { loginMutation, user } = useAuth();
  const [, setLocation] = useLocation();

  // Redirect if already logged in
  if (user) {
    setLocation("/");
    return null;
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      await loginMutation.mutateAsync(loginCredentials);
    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div className="min-h-screen bg-discord-darker flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        <Card className="bg-discord-dark border-discord-darker">
          <CardHeader className="space-y-1 text-center">
            <CardTitle className="text-2xl font-bold text-white">Welcome to UpChat</CardTitle>
            <CardDescription className="text-discord-light">
              Secure file sharing with chat capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLoginSubmit}>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="username" className="text-discord-light">Username</Label>
                  <div className="relative">
                    <User className="absolute left-3 top-3 h-4 w-4 text-discord-light" />
                    <Input 
                      id="username" 
                      placeholder="Enter your username" 
                      className="pl-10 bg-discord-darkest border-gray-700 text-white" 
                      value={loginCredentials.username}
                      onChange={(e) => setLoginCredentials({...loginCredentials, username: e.target.value})}
                      required
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-discord-light">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-3 h-4 w-4 text-discord-light" />
                    <Input 
                      id="password" 
                      type="password" 
                      placeholder="Enter your password" 
                      className="pl-10 bg-discord-darkest border-gray-700 text-white" 
                      value={loginCredentials.password}
                      onChange={(e) => setLoginCredentials({...loginCredentials, password: e.target.value})}
                      required
                    />
                  </div>
                </div>
                
                {loginMutation.error && (
                  <Alert variant="destructive" className="bg-red-900/20 border-red-800 text-white">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      {loginMutation.error.message || "Invalid username or password"}
                    </AlertDescription>
                  </Alert>
                )}
                
                <Button 
                  type="submit" 
                  className="w-full bg-discord-primary hover:bg-discord-primary-hover"
                  disabled={loginMutation.isPending}
                >
                  {loginMutation.isPending ? "Logging in..." : "Login"}
                </Button>
              </div>
            </form>
            
            <div className="mt-6 text-center text-sm text-discord-light">
              <p>
                Don't have an account? Please contact your administrator.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
