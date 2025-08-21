import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, TrendingUp } from "lucide-react";

export default function OverviewPage() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {/* Main Dashboard Section */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Trading Dashboard</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Total P/L</p>
                <p className="text-2xl font-bold text-green-600">+$12,450.78</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Win Rate</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">68%</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Active Agents</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">3</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Trades Today</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">14</p>
              </div>
            </div>
          </CardContent>
        </Card>

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
      </div>

      {/* Side Panel */}
      <div>
        {/* Market Status */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Market Status</span>
              <Badge variant={true ? "secondary" : "destructive"} className="text-xs">
                {true ? "Open" : "Closed"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">NASDAQ</span>
                <span className="font-medium text-green-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" /> +1.25%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">S&P 500</span>
                <span className="font-medium text-green-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" /> +0.98%
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-600 dark:text-slate-400">BTC/USD</span>
                <span className="font-medium text-red-600 flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1 scale-y-[-1]" /> -2.31%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Performance */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
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
    </div>
  );
}
