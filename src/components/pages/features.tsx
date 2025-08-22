import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Activity, FunctionSquare, Database, Radio, Shield, Server, Settings, Palette, Layers } from "lucide-react";

const features = [
  {
    title: "Strategy-Driven AI Agents",
    description: "Design agent logic around your rules. Training stubs provided and ready to plug real ML models.",
    icon: Brain,
    color: "text-blue-600"
  },
  {
    title: "Backtest Engine",
    description: "Robust simulation with PnL, drawdown, win-rate, and risk metrics to validate strategies.",
    icon: Activity,
    color: "text-emerald-600"
  },
  {
    title: "Technical Indicators & Patterns",
    description: "RSI, MACD, Bollinger Bands, ATR, CCI and common candlestick patterns built-in.",
    icon: FunctionSquare,
    color: "text-indigo-600"
  },
  {
    title: "Data Pipeline",
    description: "Pluggable market data pipeline with indicator calculation (ships with mock data by default).",
    icon: Database,
    color: "text-orange-600"
  },
  {
    title: "Real-time Updates",
    description: "Socket.IO powered event channel for streaming status and results across the app.",
    icon: Radio,
    color: "text-green-600"
  },
  {
    title: "Risk & Money Management",
    description: "Position sizing, stop-loss/TP logic, and capital rules integrated into simulations.",
    icon: Shield,
    color: "text-red-600"
  },
  {
    title: "API-First Architecture",
    description: "Comprehensive Next.js API routes to orchestrate agents, backtests, data, and results.",
    icon: Server,
    color: "text-purple-600"
  },
  {
    title: "Admin & Project Management",
    description: "Admin tools and organized uploads to manage strategies, runs, and artifacts.",
    icon: Settings,
    color: "text-slate-600"
  },
  {
    title: "Modern UI/UX",
    description: "Responsive interface with shadcn/ui, Tailwind CSS, and dark mode-ready components.",
    icon: Palette,
    color: "text-pink-600"
  },
  {
    title: "Modular TypeScript Stack",
    description: "Next.js 15, Prisma ORM, and a layered codebase for easy extension and maintenance.",
    icon: Layers,
    color: "text-cyan-600"
  }
];

export default function FeaturesPage() {
  return (
    <div>
      <Card className="mb-8">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Brain className="h-5 w-5" />
            <span>Features</span>
          </CardTitle>
          <CardDescription>
            Explore the powerful features of the AI Trading Platform.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid md:grid-cols-2 gap-6">
            {features.map((feature, index) => (
              <Card key={index}>
                <CardHeader className="flex flex-row items-center space-x-4">
                  <feature.icon className={`h-8 w-8 ${feature.color}`} />
                  <div>
                    <CardTitle>{feature.title}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-slate-600 dark:text-slate-300">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
