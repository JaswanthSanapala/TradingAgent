"use client";

import { useState } from "react";
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger 
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { 
  Brain, 
  TrendingUp, 
  BarChart3, 
  Settings, 
  Newspaper, 
  Users, 
  Zap,
  Shield,
  Target,
  Menu,
  Plus,
  Edit,
  Trash2,
  Play,
  Pause,
  Loader2,
  CheckCircle,
  AlertCircle,
  Activity,
  Cpu,
  XCircle
} from "lucide-react";

export default function Home() {
  const [activePage, setActivePage] = useState("overview");

  const menuItems = [
    { id: "overview", label: "Overview", icon: BarChart3 },
    { id: "features", label: "Features", icon: Brain },
    { id: "strategies", label: "Strategies", icon: Target },
    { id: "agent-training", label: "Agent Training", icon: Brain },
    { id: "live-charts", label: "Live Charts", icon: BarChart3 },
    { id: "backtest", label: "Backtest", icon: TrendingUp },
    { id: "trades", label: "Trades", icon: Zap },
    { id: "brokers", label: "Brokers", icon: Users },
    { id: "news", label: "News", icon: Newspaper },
  ];

  const features = [
    {
      title: "AI-Powered Trading Agents",
      description: "Create and train intelligent trading agents based on your strategies",
      icon: Brain,
      color: "text-blue-600"
    },
    {
      title: "Real-time Market Analysis",
      description: "Live charts with pattern recognition and technical indicators",
      icon: BarChart3,
      color: "text-green-600"
    },
    {
      title: "Automated Trading",
      description: "Execute trades automatically with integrated broker connections",
      icon: Zap,
      color: "text-purple-600"
    },
    {
      title: "Risk Management",
      description: "Advanced risk and money management as per your strategy",
      icon: Shield,
      color: "text-red-600"
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm dark:bg-slate-900/80">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="relative w-10 h-10">
              <img
                src="/logo.svg"
                alt="AI Trading Platform"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                AI Trading Platform
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Intelligent Trading Powered by AI
              </p>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <Menu className="h-4 w-4" />
                <span>Explore</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <DropdownMenuItem 
                    key={item.id}
                    onClick={() => setActivePage(item.id)}
                    className="flex items-center space-x-3 cursor-pointer"
                  >
                    <Icon className="h-4 w-4" />
                    <span>{item.label}</span>
                  </DropdownMenuItem>
                );
              })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Overview Content */}
        {activePage === "overview" && (
          <>
            {/* Hero Section */}
            <div className="text-center mb-12">
              <Badge variant="secondary" className="mb-4">
                Next Generation Trading Platform
              </Badge>
              <h2 className="text-4xl md:text-6xl font-bold text-slate-900 dark:text-white mb-6">
                AI-Powered
                <span className="text-blue-600 dark:text-blue-400"> Trading </span>
                Platform
              </h2>
              <p className="text-xl text-slate-600 dark:text-slate-300 max-w-3xl mx-auto mb-8">
                Create intelligent trading agents, train them with your strategies, and let AI execute trades 
                with advanced risk management and continuous learning capabilities.
              </p>

            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card key={index} className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className={`w-12 h-12 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4`}>
                        <Icon className={`h-6 w-6 ${feature.color}`} />
                      </div>
                      <CardTitle className="text-lg">{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <CardDescription className="text-base">
                        {feature.description}
                      </CardDescription>
                    </CardContent>
                  </Card>
                );
              })}
            </div>

            {/* Stats Section */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Active Agents
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">1,234</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    +12% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Trades Executed
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">45,678</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    +23% from last month
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Success Rate
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">87.5%</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    +2.1% improvement
                  </p>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-slate-600 dark:text-slate-400">
                    Total Volume
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">$2.4M</div>
                  <p className="text-xs text-slate-600 dark:text-slate-400">
                    +15% from last month
                  </p>
                </CardContent>
              </Card>
            </div>
          </>
        )}

        {/* Features Page */}
        {activePage === "features" && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-4">
                Platform Features
              </h2>
              <p className="text-lg text-slate-600 dark:text-slate-300 max-w-2xl mx-auto">
                Discover the powerful features that make our AI trading platform the ultimate solution for intelligent trading.
              </p>
            </div>

            {/* Core Features */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg bg-blue-100 dark:bg-blue-900/20 flex items-center justify-center">
                      <Brain className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">AI Trading Agents</CardTitle>
                      <CardDescription className="text-base">
                        Intelligent agents that learn and adapt to market conditions
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span>Create agents from your trading strategies</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span>Train with historical market data</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span>Continuous learning from market patterns</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                      <span>Adaptive strategy optimization</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
                      <BarChart3 className="h-8 w-8 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Live Market Analysis</CardTitle>
                      <CardDescription className="text-base">
                        Real-time charts with advanced technical analysis
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span>Real-time price charts and indicators</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span>Automated chart pattern recognition</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span>Technical analysis indicators</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                      <span>Market sentiment analysis</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg bg-purple-100 dark:bg-purple-900/20 flex items-center justify-center">
                      <Zap className="h-8 w-8 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Automated Trading</CardTitle>
                      <CardDescription className="text-base">
                        Execute trades automatically with precision
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      <span>Direct broker integration</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      <span>Lightning-fast order execution</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      <span>Custom trading schedules</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                      <span>Real-time position monitoring</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-center space-x-4">
                    <div className="w-16 h-16 rounded-lg bg-red-100 dark:bg-red-900/20 flex items-center justify-center">
                      <Shield className="h-8 w-8 text-red-600 dark:text-red-400" />
                    </div>
                    <div>
                      <CardTitle className="text-xl">Risk Management</CardTitle>
                      <CardDescription className="text-base">
                        Advanced risk and money management systems
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-slate-600 dark:text-slate-300">
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      <span>Customizable risk parameters</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      <span>Position sizing algorithms</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      <span>Stop-loss and take-profit automation</span>
                    </li>
                    <li className="flex items-center space-x-2">
                      <div className="w-2 h-2 bg-red-600 rounded-full"></div>
                      <span>Portfolio risk monitoring</span>
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            {/* Additional Features */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <TrendingUp className="h-5 w-5 text-orange-600" />
                    <span>Backtesting Engine</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Test your strategies against historical data with comprehensive performance metrics and detailed analytics.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Newspaper className="h-5 w-5 text-cyan-600" />
                    <span>News Impact Analysis</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Real-time news analysis with impact scoring and market sentiment tracking for informed decision making.
                  </CardDescription>
                </CardContent>
              </Card>

              <Card className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="h-5 w-5 text-indigo-600" />
                    <span>Multi-Broker Support</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription>
                    Connect with multiple brokers simultaneously for diversified trading and risk distribution.
                  </CardDescription>
                </CardContent>
              </Card>
            </div>

            {/* Call to Action */}
            <div className="text-center">
              <Card className="bg-gradient-to-r from-blue-600 to-purple-600 text-white border-0">
                <CardHeader>
                  <CardTitle className="text-2xl">Ready to Get Started?</CardTitle>
                  <CardDescription className="text-blue-100">
                    Join thousands of traders already using AI to optimize their trading strategies
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap justify-center gap-4">
                    <Button size="lg" variant="secondary">
                      Create Your First Agent
                    </Button>
                    <Button size="lg" variant="outline" className="border-white text-white hover:bg-white hover:text-blue-600">
                      Schedule a Demo
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {/* Strategies Page */}
        {activePage === "strategies" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  Trading Strategies
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Create and manage your trading strategies
                </p>
              </div>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Strategy</span>
              </Button>
            </div>

            <Tabs defaultValue="my-strategies" className="w-full">
              <TabsList>
                <TabsTrigger value="my-strategies">My Strategies</TabsTrigger>
                <TabsTrigger value="create">Create Strategy</TabsTrigger>
                <TabsTrigger value="templates">Templates</TabsTrigger>
              </TabsList>

              <TabsContent value="my-strategies" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Strategy Card 1 */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Momentum Breakout</CardTitle>
                        <Switch />
                      </div>
                      <CardDescription>
                        High-frequency momentum trading strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Created:</span>
                        <span>2 days ago</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Agents:</span>
                        <Badge variant="secondary">3 Active</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Performance:</span>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">+12.5%</Badge>
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Strategy Card 2 */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Mean Reversion</CardTitle>
                        <Switch />
                      </div>
                      <CardDescription>
                        Statistical arbitrage based on mean reversion
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Created:</span>
                        <span>1 week ago</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Agents:</span>
                        <Badge variant="secondary">2 Active</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Performance:</span>
                        <Badge className="bg-green-100 text-green-800 hover:bg-green-200">+8.3%</Badge>
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Strategy Card 3 */}
                  <Card className="hover:shadow-lg transition-shadow opacity-60">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Trend Following</CardTitle>
                        <Switch />
                      </div>
                      <CardDescription>
                        Long-term trend following strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Created:</span>
                        <span>2 weeks ago</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Agents:</span>
                        <Badge variant="outline">1 Inactive</Badge>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600 dark:text-slate-400">Performance:</span>
                        <Badge className="bg-red-100 text-red-800 hover:bg-red-200">-2.1%</Badge>
                      </div>
                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Play className="h-3 w-3 mr-1" />
                          Test
                        </Button>
                        <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="create" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Create New Trading Strategy</CardTitle>
                    <CardDescription>
                      Define your trading strategy with detailed parameters, risk management, and money management rules.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="strategy-name">Strategy Name</Label>
                        <Input id="strategy-name" placeholder="Enter strategy name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="strategy-type">Strategy Type</Label>
                        <Input id="strategy-type" placeholder="e.g., Momentum, Mean Reversion" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="strategy-description">Description</Label>
                      <Textarea 
                        id="strategy-description" 
                        placeholder="Describe your trading strategy..."
                        rows={3}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="strategy-details">Detailed Strategy</Label>
                      <Textarea 
                        id="strategy-details" 
                        placeholder="Provide detailed strategy rules, entry/exit conditions, indicators used, etc."
                        rows={6}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="risk-management">Risk Management Rules</Label>
                      <Textarea 
                        id="risk-management" 
                        placeholder="Define risk management rules (stop loss, position sizing, max drawdown, etc.)"
                        rows={4}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="money-management">Money Management</Label>
                      <Textarea 
                        id="money-management" 
                        placeholder="Define money management rules (capital allocation, risk per trade, etc.)"
                        rows={4}
                      />
                    </div>

                    <div className="flex space-x-4">
                      <Button className="flex-1">
                        Create Strategy
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Save as Draft
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="templates" className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {/* Template Card 1 */}
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">Scalping Strategy</CardTitle>
                      <CardDescription>
                        High-frequency trading with small profits
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <p>• Timeframe: 1-5 minutes</p>
                        <p>• Risk: Low per trade</p>
                        <p>• Capital: High frequency</p>
                      </div>
                      <Button className="w-full mt-4" variant="outline">
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Template Card 2 */}
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">Swing Trading</CardTitle>
                      <CardDescription>
                        Medium-term trading based on price swings
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <p>• Timeframe: 1-4 hours</p>
                        <p>• Risk: Medium</p>
                        <p>• Capital: Moderate</p>
                      </div>
                      <Button className="w-full mt-4" variant="outline">
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>

                  {/* Template Card 3 */}
                  <Card className="hover:shadow-lg transition-shadow cursor-pointer">
                    <CardHeader>
                      <CardTitle className="text-lg">Position Trading</CardTitle>
                      <CardDescription>
                        Long-term trading based on major trends
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 text-sm text-slate-600 dark:text-slate-400">
                        <p>• Timeframe: Daily+ </p>
                        <p>• Risk: High per trade</p>
                        <p>• Capital: Long-term</p>
                      </div>
                      <Button className="w-full mt-4" variant="outline">
                        Use Template
                      </Button>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Agent Training Page */}
        {activePage === "agent-training" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  AI Agent Training
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Create and train AI agents based on your trading strategies
                </p>
              </div>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Create Agent</span>
              </Button>
            </div>

            <Tabs defaultValue="my-agents" className="w-full">
              <TabsList>
                <TabsTrigger value="my-agents">My Agents</TabsTrigger>
                <TabsTrigger value="create-agent">Create Agent</TabsTrigger>
                <TabsTrigger value="training-status">Training Status</TabsTrigger>
              </TabsList>

              <TabsContent value="my-agents" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Agent Card 1 - Training */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-lg">Momentum Master v1</CardTitle>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Training
                        </Badge>
                      </div>
                      <CardDescription>
                        Based on Momentum Breakout strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Training Progress</span>
                          <span>68%</span>
                        </div>
                        <Progress value={68} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Epoch:</span>
                          <span className="ml-1 font-medium">142/200</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Accuracy:</span>
                          <span className="ml-1 font-medium">84.3%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Loss:</span>
                          <span className="ml-1 font-medium">0.234</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">ETA:</span>
                          <span className="ml-1 font-medium">2h 15m</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Activity className="h-3 w-3 mr-1" />
                          Monitor
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Agent Card 2 - Trained */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-5 w-5 text-green-600" />
                          <CardTitle className="text-lg">Mean Reverter Pro</CardTitle>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Trained
                        </Badge>
                      </div>
                      <CardDescription>
                        Based on Mean Reversion strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Performance:</span>
                          <span className="ml-1 font-medium text-green-600">+12.5%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Accuracy:</span>
                          <span className="ml-1 font-medium">89.7%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Trained:</span>
                          <span className="ml-1 font-medium">2 days ago</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Trades:</span>
                          <span className="ml-1 font-medium">1,247</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                        <div className="text-sm font-medium mb-2">Recent Performance</div>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>Last 24h</span>
                          <span className="text-green-600">+2.3%</span>
                        </div>
                        <div className="flex justify-between text-xs text-slate-600 dark:text-slate-400">
                          <span>Last 7d</span>
                          <span className="text-green-600">+8.1%</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" className="flex-1">
                          <Play className="h-3 w-3 mr-1" />
                          Deploy
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Activity className="h-3 w-3 mr-1" />
                          Analytics
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Agent Card 3 - Error */}
                  <Card className="hover:shadow-lg transition-shadow border-red-200 dark:border-red-800">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-5 w-5 text-red-600" />
                          <CardTitle className="text-lg">Trend Follower X</CardTitle>
                        </div>
                        <Badge className="bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Error
                        </Badge>
                      </div>
                      <CardDescription>
                        Based on Trend Following strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                          Training Failed
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-300">
                          Gradient explosion at epoch 89. Please check learning rate and data preprocessing.
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Progress:</span>
                          <span className="ml-1 font-medium">44.5%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Failed:</span>
                          <span className="ml-1 font-medium">1 hour ago</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Activity className="h-3 w-3 mr-1" />
                          View Logs
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Loader2 className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Agent Card 4 - Pending */}
                  <Card className="hover:shadow-lg transition-shadow opacity-60">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Cpu className="h-5 w-5 text-slate-400" />
                          <CardTitle className="text-lg">Scalping Bot Alpha</CardTitle>
                        </div>
                        <Badge variant="outline">
                          Pending
                        </Badge>
                      </div>
                      <CardDescription>
                        Based on Scalping strategy template
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-8">
                        <Cpu className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Ready to start training
                        </p>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" className="flex-1">
                          <Play className="h-3 w-3 mr-1" />
                          Start Training
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="create-agent" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Create New AI Agent</CardTitle>
                    <CardDescription>
                      Configure and create a new AI agent based on your trading strategy
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="agent-name">Agent Name</Label>
                        <Input id="agent-name" placeholder="Enter agent name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="strategy-select">Select Strategy</Label>
                        <select 
                          id="strategy-select" 
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Choose a strategy...</option>
                          <option value="momentum-breakout">Momentum Breakout</option>
                          <option value="mean-reversion">Mean Reversion</option>
                          <option value="trend-following">Trend Following</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Training Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="epochs">Epochs</Label>
                          <Input id="epochs" type="number" defaultValue="200" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="batch-size">Batch Size</Label>
                          <Input id="batch-size" type="number" defaultValue="32" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="learning-rate">Learning Rate</Label>
                          <Input id="learning-rate" type="number" step="0.001" defaultValue="0.001" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Data Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-date">Start Date</Label>
                          <Input id="start-date" type="date" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-date">End Date</Label>
                          <Input id="end-date" type="date" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="symbols">Trading Symbols</Label>
                        <Input id="symbols" placeholder="e.g., AAPL,GOOGL,MSFT" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Advanced Settings</h4>
                      <div className="space-y-2">
                        <Label htmlFor="model-architecture">Model Architecture</Label>
                        <select 
                          id="model-architecture" 
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="lstm">LSTM</option>
                          <option value="transformer">Transformer</option>
                          <option value="cnn-lstm">CNN-LSTM Hybrid</option>
                          <option value="ensemble">Ensemble Model</option>
                        </select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="features">Technical Indicators</Label>
                        <Textarea 
                          id="features" 
                          placeholder="RSI, MACD, Bollinger Bands, Moving Averages, etc."
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <Button className="flex-1">
                        Create Agent
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Save Configuration
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="training-status" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Active Training Jobs */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                        <span>Active Training Jobs</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="border-l-4 border-blue-500 pl-4">
                          <div className="flex justify-between items-start">
                            <div>
                              <h5 className="font-medium">Momentum Master v1</h5>
                              <p className="text-sm text-slate-600 dark:text-slate-400">Epoch 142/200</p>
                            </div>
                            <Badge className="bg-blue-100 text-blue-800">68%</Badge>
                          </div>
                          <Progress value={68} className="h-2 mt-2" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Training Queue */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Activity className="h-5 w-5 text-orange-600" />
                        <span>Training Queue</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <h5 className="font-medium">Scalping Bot Alpha</h5>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Queued</p>
                          </div>
                          <div className="text-sm text-slate-500">
                            Est. start: 2h 30m
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Training History */}
                <Card>
                  <CardHeader>
                    <CardTitle>Training History</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <CheckCircle className="h-5 w-5 text-green-600" />
                          <div>
                            <h5 className="font-medium">Mean Reverter Pro</h5>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Completed 2 days ago</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-green-100 text-green-800">89.7% Acc</Badge>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">12.5% Return</p>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <AlertCircle className="h-5 w-5 text-red-600" />
                          <div>
                            <h5 className="font-medium">Trend Follower X</h5>
                            <p className="text-sm text-slate-600 dark:text-slate-400">Failed 1 hour ago</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge className="bg-red-100 text-red-800">Error</Badge>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-1">44.5% Progress</p>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

    {/* Backtest Page */}
        {activePage === "backtest" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  Backtesting
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Test your strategies against historical data
                </p>
              </div>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>New Backtest</span>
              </Button>
            </div>

            <Tabs defaultValue="my-backtests" className="w-full">
              <TabsList>
                <TabsTrigger value="my-backtests">My Backtests</TabsTrigger>
                <TabsTrigger value="run-backtest">Run Backtest</TabsTrigger>
                <TabsTrigger value="results">Results</TabsTrigger>
              </TabsList>

              <TabsContent value="my-backtests" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Backtest Card 1 - Completed */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-green-600" />
                          <CardTitle className="text-lg">Momentum Breakout Test</CardTitle>
                        </div>
                        <Badge className="bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Completed
                        </Badge>
                      </div>
                      <CardDescription>
                        Backtest for Momentum Breakout strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Period:</span>
                          <span className="ml-1 font-medium">2023-2024</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Trades:</span>
                          <span className="ml-1 font-medium">1,847</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Return:</span>
                          <span className="ml-1 font-medium text-green-600">+34.7%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Win Rate:</span>
                          <span className="ml-1 font-medium">68.2%</span>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Sharpe Ratio:</span>
                          <span className="font-medium">1.84</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Max Drawdown:</span>
                          <span className="font-medium">-12.3%</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Profit Factor:</span>
                          <span className="font-medium">2.14</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <BarChart3 className="h-3 w-3 mr-1" />
                          View Report
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Activity className="h-3 w-3 mr-1" />
                          Analytics
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Backtest Card 2 - Running */}
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-blue-600" />
                          <CardTitle className="text-lg">Mean Reversion Test</CardTitle>
                        </div>
                        <Badge className="bg-blue-100 text-blue-800">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Running
                        </Badge>
                      </div>
                      <CardDescription>
                        Backtest for Mean Reversion strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Progress</span>
                          <span>45%</span>
                        </div>
                        <Progress value={45} className="h-2" />
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Processed:</span>
                          <span className="ml-1 font-medium">450/1000 days</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Trades:</span>
                          <span className="ml-1 font-medium">892</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Current Return:</span>
                          <span className="ml-1 font-medium text-green-600">+18.4%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">ETA:</span>
                          <span className="ml-1 font-medium">1h 20m</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Pause className="h-3 w-3 mr-1" />
                          Pause
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Activity className="h-3 w-3 mr-1" />
                          Monitor
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Backtest Card 3 - Scheduled */}
                  <Card className="hover:shadow-lg transition-shadow opacity-60">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-orange-600" />
                          <CardTitle className="text-lg">Trend Following Test</CardTitle>
                        </div>
                        <Badge variant="outline">
                          Scheduled
                        </Badge>
                      </div>
                      <CardDescription>
                        Backtest for Trend Following strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="text-center py-8">
                        <TrendingUp className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-2" />
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          Scheduled to start in 2 hours
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Start Time:</span>
                          <span className="ml-1 font-medium">14:00 UTC</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Duration:</span>
                          <span className="ml-1 font-medium">~3 hours</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" className="flex-1">
                          <Play className="h-3 w-3 mr-1" />
                          Start Now
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Edit className="h-3 w-3 mr-1" />
                          Configure
                        </Button>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Backtest Card 4 - Failed */}
                  <Card className="hover:shadow-lg transition-shadow border-red-200 dark:border-red-800">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <TrendingUp className="h-5 w-5 text-red-600" />
                          <CardTitle className="text-lg">Scalping Strategy Test</CardTitle>
                        </div>
                        <Badge className="bg-red-100 text-red-800">
                          <AlertCircle className="h-3 w-3 mr-1" />
                          Failed
                        </Badge>
                      </div>
                      <CardDescription>
                        Backtest for Scalping strategy
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                        <div className="text-sm font-medium text-red-800 dark:text-red-200 mb-1">
                          Backtest Failed
                        </div>
                        <div className="text-xs text-red-600 dark:text-red-300">
                          Insufficient data for 1-minute timeframe. Please use longer timeframe or different date range.
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Progress:</span>
                          <span className="ml-1 font-medium">12%</span>
                        </div>
                        <div>
                          <span className="text-slate-600 dark:text-slate-400">Failed:</span>
                          <span className="ml-1 font-medium">30 min ago</span>
                        </div>
                      </div>

                      <div className="flex space-x-2 pt-2">
                        <Button size="sm" variant="outline" className="flex-1">
                          <Activity className="h-3 w-3 mr-1" />
                          View Logs
                        </Button>
                        <Button size="sm" variant="outline" className="flex-1">
                          <Loader2 className="h-3 w-3 mr-1" />
                          Retry
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="run-backtest" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Run New Backtest</CardTitle>
                    <CardDescription>
                      Configure and run a backtest for your trading strategy
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="backtest-name">Backtest Name</Label>
                        <Input id="backtest-name" placeholder="Enter backtest name" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="strategy-select-backtest">Select Strategy</Label>
                        <select 
                          id="strategy-select-backtest" 
                          className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Choose a strategy...</option>
                          <option value="momentum-breakout">Momentum Breakout</option>
                          <option value="mean-reversion">Mean Reversion</option>
                          <option value="trend-following">Trend Following</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Date Range</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-date-backtest">Start Date</Label>
                          <Input id="start-date-backtest" type="date" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-date-backtest">End Date</Label>
                          <Input id="end-date-backtest" type="date" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Trading Configuration</h4>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="initial-capital">Initial Capital ($)</Label>
                          <Input id="initial-capital" type="number" defaultValue="100000" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="position-size">Position Size (%)</Label>
                          <Input id="position-size" type="number" defaultValue="2" step="0.1" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="max-risk">Max Risk (%)</Label>
                          <Input id="max-risk" type="number" defaultValue="1" step="0.1" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Symbols & Timeframe</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="symbols-backtest">Trading Symbols</Label>
                          <Input id="symbols-backtest" placeholder="e.g., AAPL,GOOGL,MSFT" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="timeframe">Timeframe</Label>
                          <select 
                            id="timeframe" 
                            className="w-full px-3 py-2 border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="1m">1 Minute</option>
                            <option value="5m">5 Minutes</option>
                            <option value="15m">15 Minutes</option>
                            <option value="1h">1 Hour</option>
                            <option value="4h">4 Hours</option>
                            <option value="1d">1 Day</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Advanced Settings</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="commission">Commission (%)</Label>
                          <Input id="commission" type="number" step="0.01" defaultValue="0.1" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="slippage">Slippage (%)</Label>
                          <Input id="slippage" type="number" step="0.01" defaultValue="0.05" />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="risk-management">Risk Management Rules</Label>
                        <Textarea 
                          id="risk-management" 
                          placeholder="Stop loss, take profit, max drawdown rules..."
                          rows={3}
                        />
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <Button className="flex-1">
                        Start Backtest
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Save Configuration
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="results" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance Summary */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Summary</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-lg font-bold text-green-600">+34.7%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Total Return</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">68.2%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Win Rate</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">1.84</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Sharpe Ratio</div>
                        </div>
                        <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
                          <div className="text-lg font-bold text-red-600">-12.3%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Max Drawdown</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Trade Statistics */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Trade Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Total Trades:</span>
                          <span className="font-medium">1,847</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Winning Trades:</span>
                          <span className="font-medium text-green-600">1,259</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Losing Trades:</span>
                          <span className="font-medium text-red-600">588</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Avg Win:</span>
                          <span className="font-medium text-green-600">$247.50</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Avg Loss:</span>
                          <span className="font-medium text-red-600">$156.30</span>
                        </div>
                        <div className="flex justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Profit Factor:</span>
                          <span className="font-medium">2.14</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Equity Curve */}
                <Card>
                  <CardHeader>
                    <CardTitle>Equity Curve</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Equity curve chart will be displayed here
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Monthly Returns */}
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Returns</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                      {[
                        { month: "Jan", return: "+2.3%" },
                        { month: "Feb", return: "+4.1%" },
                        { month: "Mar", return: "-1.2%" },
                        { month: "Apr", return: "+5.7%" },
                        { month: "May", return: "+3.4%" },
                        { month: "Jun", return: "+2.8%" },
                        { month: "Jul", return: "+6.2%" },
                        { month: "Aug", return: "-0.8%" },
                        { month: "Sep", return: "+4.5%" },
                        { month: "Oct", return: "+3.1%" },
                        { month: "Nov", return: "+2.9%" },
                        { month: "Dec", return: "+1.7%" },
                      ].map((item, index) => (
                        <div key={index} className="text-center p-2 bg-slate-50 dark:bg-slate-800 rounded">
                          <div className="text-xs text-slate-600 dark:text-slate-400">{item.month}</div>
                          <div className={`text-sm font-medium ${
                            item.return.startsWith("+") 
                              ? "text-green-600" 
                              : "text-red-600"
                          }`}>
                            {item.return}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

    {/* Trades Page */}
        {activePage === "trades" && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-3xl font-bold text-slate-900 dark:text-white mb-2">
                  Trading & Auto-Trading
                </h2>
                <p className="text-lg text-slate-600 dark:text-slate-300">
                  Manage your trades and configure automated trading
                </p>
              </div>
              <Button className="flex items-center space-x-2">
                <Plus className="h-4 w-4" />
                <span>Manual Trade</span>
              </Button>
            </div>

            <Tabs defaultValue="active-trades" className="w-full">
              <TabsList>
                <TabsTrigger value="active-trades">Active Trades</TabsTrigger>
                <TabsTrigger value="trade-history">Trade History</TabsTrigger>
                <TabsTrigger value="auto-trading">Auto-Trading</TabsTrigger>
                <TabsTrigger value="performance">Performance</TabsTrigger>
              </TabsList>

              <TabsContent value="active-trades" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {/* Active Positions */}
                  <div className="lg:col-span-2 space-y-4">
                    <h3 className="text-lg font-semibold">Active Positions</h3>
                    
                    {/* Position Card 1 */}
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                              <Zap className="h-4 w-4 text-green-600" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">AAPL Long</CardTitle>
                              <CardDescription>Apple Inc.</CardDescription>
                            </div>
                          </div>
                          <Badge className="bg-green-100 text-green-800">Long</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Quantity:</span>
                            <span className="ml-1 font-medium">100 shares</span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Entry Price:</span>
                            <span className="ml-1 font-medium">$175.20</span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Current Price:</span>
                            <span className="ml-1 font-medium">$182.45</span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">P&L:</span>
                            <span className="ml-1 font-medium text-green-600">+$725.00</span>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" className="flex-1">
                            <Shield className="h-3 w-3 mr-1" />
                            Set Stop Loss
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Target className="h-3 w-3 mr-1" />
                            Take Profit
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                            Close Position
                          </Button>
                        </div>
                      </CardContent>
                    </Card>

                    {/* Position Card 2 */}
                    <Card className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                              <Zap className="h-4 w-4 text-red-600" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">TSLA Short</CardTitle>
                              <CardDescription>Tesla Inc.</CardDescription>
                            </div>
                          </div>
                          <Badge className="bg-red-100 text-red-800">Short</Badge>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Quantity:</span>
                            <span className="ml-1 font-medium">50 shares</span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Entry Price:</span>
                            <span className="ml-1 font-medium">$238.90</span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">Current Price:</span>
                            <span className="ml-1 font-medium">$235.20</span>
                          </div>
                          <div>
                            <span className="text-slate-600 dark:text-slate-400">P&L:</span>
                            <span className="ml-1 font-medium text-green-600">+$185.00</span>
                          </div>
                        </div>

                        <div className="flex space-x-2">
                          <Button size="sm" variant="outline" className="flex-1">
                            <Shield className="h-3 w-3 mr-1" />
                            Set Stop Loss
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1">
                            <Target className="h-3 w-3 mr-1" />
                            Take Profit
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 hover:text-red-700">
                            Close Position
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Quick Stats */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold">Portfolio Summary</h3>
                    
                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Today's Performance</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        <div className="text-center">
                          <div className="text-2xl font-bold text-green-600">+$910.00</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">Total P&L</div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-sm">
                          <div className="text-center">
                            <div className="font-medium">+2.3%</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">Return</div>
                          </div>
                          <div className="text-center">
                            <div className="font-medium">2</div>
                            <div className="text-xs text-slate-600 dark:text-slate-400">Positions</div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-base">Quick Actions</CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-2">
                        <Button size="sm" className="w-full justify-start">
                          <Plus className="h-3 w-3 mr-2" />
                          New Trade
                        </Button>
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          <BarChart3 className="h-3 w-3 mr-2" />
                          View Charts
                        </Button>
                        <Button size="sm" variant="outline" className="w-full justify-start">
                          <Settings className="h-3 w-3 mr-2" />
                          Trading Settings
                        </Button>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trade-history" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Trade History</CardTitle>
                    <CardDescription>
                      View your complete trading history and performance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {/* Trade History Item 1 */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-green-100 dark:bg-green-900/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                          </div>
                          <div>
                            <div className="font-medium">AAPL Long</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Buy 100 @ $175.20 → Sell @ $182.45</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">+$725.00</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">2 hours ago</div>
                        </div>
                      </div>

                      {/* Trade History Item 2 */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                            <CheckCircle className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">GOOGL Short</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Sell 50 @ $142.80 → Buy @ $140.20</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-green-600">+$130.00</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">5 hours ago</div>
                        </div>
                      </div>

                      {/* Trade History Item 3 */}
                      <div className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-red-100 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                            <XCircle className="h-4 w-4 text-red-600" />
                          </div>
                          <div>
                            <div className="font-medium">MSFT Long</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">Buy 75 @ $378.50 → Sell @ $375.20</div>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-medium text-red-600">-$247.50</div>
                          <div className="text-sm text-slate-600 dark:text-slate-400">1 day ago</div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="auto-trading" className="space-y-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Auto-Trading Status */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Zap className="h-5 w-5 text-blue-600" />
                        <span>Auto-Trading Status</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="flex items-center justify-between">
                        <span className="font-medium">Auto-Trading</span>
                        <Switch />
                      </div>
                      
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Status:</span>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Active Agents:</span>
                          <span>3</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Today's Trades:</span>
                          <span>47</span>
                        </div>
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-slate-600 dark:text-slate-400">Success Rate:</span>
                          <span className="text-green-600">78.7%</span>
                        </div>
                      </div>

                      <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg">
                        <div className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-1">
                          Auto-Trading Enabled
                        </div>
                        <div className="text-xs text-blue-600 dark:text-blue-300">
                          AI agents are actively trading based on your strategies. All trades are subject to risk management rules.
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Active Trading Agents */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center space-x-2">
                        <Brain className="h-5 w-5 text-purple-600" />
                        <span>Active Trading Agents</span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <div className="font-medium">Momentum Master v1</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">23 trades today</div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                            <div className="text-sm text-green-600 mt-1">+12.4%</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <div className="font-medium">Mean Reverter Pro</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">15 trades today</div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                            <div className="text-sm text-green-600 mt-1">+8.1%</div>
                          </div>
                        </div>

                        <div className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
                          <div>
                            <div className="font-medium">Scalping Bot Alpha</div>
                            <div className="text-sm text-slate-600 dark:text-slate-400">9 trades today</div>
                          </div>
                          <div className="text-right">
                            <Badge className="bg-green-100 text-green-800">Active</Badge>
                            <div className="text-sm text-red-600 mt-1">-2.3%</div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Auto-Trading Configuration */}
                <Card>
                  <CardHeader>
                    <CardTitle>Auto-Trading Configuration</CardTitle>
                    <CardDescription>
                      Configure auto-trading parameters and risk management
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-daily-trades">Max Daily Trades</Label>
                        <Input id="max-daily-trades" type="number" defaultValue="100" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-position-size">Max Position Size (%)</Label>
                        <Input id="max-position-size" type="number" defaultValue="5" step="0.1" />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="max-daily-loss">Max Daily Loss (%)</Label>
                        <Input id="max-daily-loss" type="number" defaultValue="3" step="0.1" />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="max-drawdown">Max Drawdown (%)</Label>
                        <Input id="max-drawdown" type="number" defaultValue="10" step="0.1" />
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Trading Schedule</h4>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label htmlFor="start-time">Start Time</Label>
                          <Input id="start-time" type="time" defaultValue="09:30" />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="end-time">End Time</Label>
                          <Input id="end-time" type="time" defaultValue="16:00" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h4 className="font-medium">Allowed Symbols</h4>
                      <div className="space-y-2">
                        <Input id="allowed-symbols" placeholder="e.g., AAPL,GOOGL,MSFT,TSLA" />
                      </div>
                    </div>

                    <div className="flex space-x-4">
                      <Button className="flex-1">
                        Save Configuration
                      </Button>
                      <Button variant="outline" className="flex-1">
                        Reset to Default
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="performance" className="space-y-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Performance Metrics */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Metrics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <div className="text-lg font-bold text-green-600">+18.7%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Total Return</div>
                        </div>
                        <div className="text-center p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                          <div className="text-lg font-bold text-blue-600">76.3%</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Win Rate</div>
                        </div>
                        <div className="text-center p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
                          <div className="text-lg font-bold text-purple-600">2.34</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Profit Factor</div>
                        </div>
                        <div className="text-center p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
                          <div className="text-lg font-bold text-orange-600">1.67</div>
                          <div className="text-xs text-slate-600 dark:text-slate-400">Sharpe Ratio</div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Monthly Performance */}
                  <Card>
                    <CardHeader>
                      <CardTitle>Monthly Performance</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {[
                          { month: "January 2024", return: "+5.2%", trades: 342 },
                          { month: "February 2024", return: "+3.8%", trades: 298 },
                          { month: "March 2024", return: "+7.1%", trades: 415 },
                          { month: "April 2024", return: "+2.4%", trades: 267 },
                        ].map((item, index) => (
                          <div key={index} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                            <div className="text-sm font-medium">{item.month}</div>
                            <div className="flex items-center space-x-2">
                              <span className={`text-sm font-medium ${
                                item.return.startsWith("+") 
                                  ? "text-green-600" 
                                  : "text-red-600"
                              }`}>
                                {item.return}
                              </span>
                              <span className="text-xs text-slate-600 dark:text-slate-400">
                                {item.trades} trades
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Trading Activity Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle>Trading Activity</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="h-64 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                      <div className="text-center">
                        <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                        <p className="text-sm text-slate-600 dark:text-slate-400">
                          Trading activity chart will be displayed here
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        )}

        {/* Other Pages Placeholder */}
        {activePage !== "overview" && activePage !== "features" && activePage !== "strategies" && activePage !== "agent-training" && activePage !== "backtest" && activePage !== "trades" && (
          <Card className="mb-8">
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Settings className="h-5 w-5" />
                <span>Current Page: {menuItems.find(m => m.id === activePage)?.label}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-slate-600 dark:text-slate-300">
                You've selected the {menuItems.find(m => m.id === activePage)?.label} page. 
                This section is under development and will be available soon.
              </p>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t bg-white/80 backdrop-blur-sm dark:bg-slate-900/80 mt-16">
        <div className="container mx-auto px-4 py-8">
          <div className="flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-4 mb-4 md:mb-0">
              <div className="relative w-8 h-8">
                <img
                  src="/logo.svg"
                  alt="AI Trading Platform"
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="text-lg font-semibold">AI Trading Platform</span>
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              © 2024 AI Trading Platform. Powered by Z.ai
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}