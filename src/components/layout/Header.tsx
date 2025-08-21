"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bot, Sun, Moon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

const menuItems = [
  { id: "overview", label: "Overview", href: "/" },
  { id: "features", label: "Features", href: "/features" },
  { id: "strategies", label: "Strategies", href: "/strategies" },
  { id: "agent-training", label: "Agent Training", href: "/agent-training" },
  { id: "backtest", label: "Backtest", href: "/backtest" },
  { id: "trades", label: "Trades", href: "/trades" },
  { id: "brokers", label: "Brokers", href: "/brokers" },
  { id: "news", label: "News", href: "/news" },
  { id: "live-charts", label: "Live Charts", href: "/live-charts" },
];

export default function Header() {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center">
        <div className="mr-4 flex items-center">
          <Link href="/" className="flex items-center space-x-2">
            <Bot className="h-6 w-6" />
            <span className="font-bold">AI Trading</span>
          </Link>
        </div>
        <nav className="flex items-center space-x-6 text-sm font-medium">
          {menuItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className={`transition-colors hover:text-foreground/80 ${
                pathname === item.href ? "text-foreground" : "text-foreground/60"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="flex flex-1 items-center justify-end space-x-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
          </Button>
        </div>
      </div>
    </header>
  );
}
