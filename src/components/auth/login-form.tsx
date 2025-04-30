"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import * as z from "zod";
import { useRouter } from 'next/navigation';
import React from "react";
import { Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

// Import server action for login
import { loginUser } from '@/actions/auth'; // Assuming you create this server action


const formSchema = z.object({
  username: z.string().min(2, {
    message: "Username must be at least 2 characters.",
  }),
  password: z.string(), // No minimum length check here, handled by server/logic if needed
});

export function LoginForm() {
  const router = useRouter();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = React.useState(false);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      username: "",
      password: "",
    },
  });

  async function onSubmit(values: z.infer<typeof formSchema>) {
    setIsLoading(true);
    console.log("Login attempt:", values.username); // Don't log password

    try {
        const result = await loginUser(values);

        if (result.success) {
            toast({
                title: "Login Successful",
                description: `Welcome back, ${values.username}!`,
            });
            // Simulate setting auth state (e.g., storing token in localStorage/cookie)
            // For now, just redirect
             // TODO: Implement proper session handling (e.g., set cookie)
            router.push('/dashboard');
        } else {
             toast({
                variant: "destructive",
                title: "Login Failed",
                description: result.error || "Invalid username or password.",
            });
            setIsLoading(false);
        }

    } catch (error) {
        console.error("Login error:", error);
        toast({
            variant: "destructive",
            title: "Login Error",
            description: "An unexpected error occurred. Please try again.",
        });
        setIsLoading(false);
    }
    // Don't turn off loading on success because we are redirecting
  }

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle className="text-2xl">Login</CardTitle>
        <CardDescription>
          Enter your username and password below to login.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <FormField
              control={form.control}
              name="username"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Username</FormLabel>
                  <FormControl>
                    <Input placeholder="username" {...field} disabled={isLoading} autoComplete="username" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <FormControl>
                    <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} autoComplete="current-password" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Login
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
