import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Play, CheckCircle, BarChart3 } from "lucide-react";

export default function BacktestPage() {
  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Backtest</span>
        </CardTitle>
        <CardDescription>
          Test your strategies against historical market data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-3 gap-6 mb-6">
          <div>
            <Label htmlFor="backtest-strategy">Strategy</Label>
            <Input id="backtest-strategy" defaultValue="Momentum Scalper" />
          </div>
          <div>
            <Label htmlFor="backtest-dataset">Dataset</Label>
            <Input id="backtest-dataset" defaultValue="BTC_USDT 1-min (2023)" />
          </div>
          <div className="flex items-end">
            <Button className="w-full flex items-center space-x-2">
              <Play className="h-4 w-4" />
              <span>Run Backtest</span>
            </Button>
          </div>
        </div>

        <Tabs defaultValue="results">
          <TabsList>
            <TabsTrigger value="results">Results</TabsTrigger>
            <TabsTrigger value="trades">Trade Log</TabsTrigger>
            <TabsTrigger value="chart">Chart</TabsTrigger>
          </TabsList>
          <TabsContent value="results">
            <div className="border rounded-lg p-4 mt-4">
              <div className="flex justify-between items-center mb-4">
                <h4 className="font-semibold">Backtest Results: Momentum Scalper</h4>
                <Badge variant="secondary" className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Completed</span>
                </Badge>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-600 dark:text-slate-400">Total Return</p>
                  <p className="font-semibold text-green-600">+25.8%</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-600 dark:text-slate-400">Max Drawdown</p>
                  <p className="font-semibold text-red-600">-8.2%</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-600 dark:text-slate-400">Sharpe Ratio</p>
                  <p className="font-semibold">1.75</p>
                </div>
                <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                  <p className="text-slate-600 dark:text-slate-400">Total Trades</p>
                  <p className="font-semibold">1,287</p>
                </div>
              </div>
            </div>
          </TabsContent>
          <TabsContent value="trades">
            <div className="text-center py-8">
              <p>Trade log will be displayed here.</p>
            </div>
          </TabsContent>
          <TabsContent value="chart">
            <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mt-4">
              <div className="text-center">
                <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                <p className="text-sm text-slate-600 dark:text-slate-400">
                  Equity curve chart will be displayed here
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
