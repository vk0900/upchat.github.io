import React from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import db from "@/lib/db"; // Import db for role check

// Helper to get user role directly (server-side only)
async function checkAdminRole(): Promise<boolean> {
  const sessionId = cookies().get('session_id')?.value;
  if (!sessionId) return false;

  try {
    // Directly query the session and user role
    const session = db.prepare(`
        SELECT u.role
        FROM sessions s
        JOIN users u ON s.user_id = u.id
        WHERE s.session_id = ? AND s.expires_at > CURRENT_TIMESTAMP
        `).get(sessionId);

    return session?.role === 'admin';
  } catch (error) {
    console.error('Error checking admin role in layout:', error);
    return false;
  }
}


export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {

   const isAdmin = await checkAdminRole();

  if (!isAdmin) {
    console.log("AdminLayout: User is not admin, redirecting...");
     // Redirect non-admin users away from admin sections
     redirect('/dashboard'); // Or show an unauthorized page component
  }

   // If admin, render the admin section children
  return <>{children}</>;
}
