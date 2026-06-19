import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Traffic Command Center | AI Operations Platform",
  description: "AI-powered real-time traffic operations command center with predictive analytics, incident management, and intelligent resource allocation.",
  keywords: "traffic operations, AI, incident management, command center, real-time analytics",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="min-h-full flex flex-col bg-[#0a0f1e] text-slate-200 antialiased">
        {children}
      </body>
    </html>
  );
}
