import type { Metadata, Viewport } from "next";
import { DriverAuthProvider } from "@/components/auth-context";
import "./globals.css";

export const metadata: Metadata = {
  title: "Driver Terminal | Hill Transit Partner",
  description: "Driver dispatch terminal, trip navigator and earnings ledger.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1e3a2b",
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
      <body className="min-h-screen bg-[#f4f7f4] text-[#1a211a]">
        <DriverAuthProvider>{children}</DriverAuthProvider>
      </body>
    </html>
  );
}
