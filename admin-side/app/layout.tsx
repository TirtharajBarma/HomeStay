import type { Metadata } from "next";
import { AdminAuthProvider } from "@/components/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Super Admin Tower | Platform Operations",
  description: "Global operations control tower, property verification, driver settlements and revenue analytics.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap"
        />
      </head>
      <body className="min-h-screen bg-slate-50 text-slate-900">
        <AdminAuthProvider>{children}</AdminAuthProvider>
      </body>
    </html>
  );
}
