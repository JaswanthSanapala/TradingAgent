import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteLayout } from "@/components/layout/SiteLayout";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AI Trading Platform",
  description: "A platform for building, testing, and deploying AI-powered trading agents.",
  keywords: ["AI", "Trading", "Next.js", "TypeScript", "Tailwind CSS", "shadcn/ui"],
  authors: [{ name: "Your Name" }],
  openGraph: {
    title: "AI Trading Platform",
    description: "A platform for building, testing, and deploying AI-powered trading agents.",
    url: "https://your-domain.com",
    siteName: "AI Trading Platform",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "AI Trading Platform",
    description: "A platform for building, testing, and deploying AI-powered trading agents.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <SiteLayout>{children}</SiteLayout>
      </body>
    </html>
  );
}
