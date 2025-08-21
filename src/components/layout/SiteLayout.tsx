"use client";

import { ThemeProvider } from "@/components/theme-provider";
import Header from "@/components/layout/Header";
import { Toaster } from "@/components/ui/toaster";

export function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
    >
      <div className="relative flex min-h-screen flex-col">
        <Header />
        <main className="container flex-1 py-8">{children}</main>
        <Toaster />
      </div>
    </ThemeProvider>
  );
}
