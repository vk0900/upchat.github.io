import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"; // Import Toaster
import { cn } from '@/lib/utils'; // Import cn utility

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans', // Use standard '--font-sans' variable
});


export const metadata: Metadata = {
  title: 'SecureShare Chat', // Updated title
  description: 'Secure file sharing and chat platform', // Updated description
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // Added suppressHydrationWarning to html as well, standard practice
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans antialiased flex flex-col",
          inter.variable // Apply the font variable class name
        )}
        // Add suppressHydrationWarning here to handle body attribute mismatches
        suppressHydrationWarning
      >
        {children}
        <Toaster /> {/* Add Toaster component */}
      </body>
    </html>
  );
}
