'use client'

import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Play, CheckCircle, BarChart3 } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
} from "recharts";

export default function BacktestPage() {
  const [agents, setAgents] = useState<Array<any>>([]);
  const [loadingAgents, setLoadingAgents] = useState(false);
  const [selectedAgentId, setSelectedAgentId] = useState<string>("");
  const selectedAgent = useMemo(() => agents.find(a => a.id === selectedAgentId), [agents, selectedAgentId]);
  const completedAgents = useMemo(() => agents.filter(a => (a.performance?.status ?? "") === "completed"), [agents]);

  const [symbol, setSymbol] = useState<string>("BTC/USDT");
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [startDate, setStartDate] = useState<string>(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 3); // default last 3 months
    return d.toISOString().slice(0, 16);
  });
  const [endDate, setEndDate] = useState<string>(() => new Date().toISOString().slice(0, 16));

  const [running, setRunning] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string>("");
  const [result, setResult] = useState<any | null>(null);
  const [suggestions, setSuggestions] = useState<any | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        setLoadingAgents(true);
        const res = await fetch("/api/agents");
        const data = await res.json();
        if (data?.success) {
          setAgents(data.agents || []);
          // preselect first completed agent
          const first = (data.agents || []).find((a: any) => (a.performance?.status ?? "") === "completed") || (data.agents || [])[0];
          if (first) setSelectedAgentId(first.id);
        }
      } catch (e) {
        // noop
      } finally {
        setLoadingAgents(false);
      }
    };
    load();
  }, []);

  const runBacktest = async () => {
    if (!selectedAgent) return;
    setRunning(true);
    setSuggestions(null);
    setResult(null);
    setStatusMsg("Backfilling market data...");
    try {
      // Ensure data exists for chosen period/timeframe
      const backfillRes = await fetch("/api/data/backfill", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          timeframe,
          start: new Date(startDate).toISOString(),
          end: new Date(endDate).toISOString(),
          exchangeId: "binance",
        }),
      });
      await backfillRes.json().catch(() => ({}));

      setStatusMsg("Running backtest...");
      const runRes = await fetch("/api/backtest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: selectedAgent.id,
          strategyId: selectedAgent.strategyId,
          config: {
            startDate: new Date(startDate).toISOString(),
            endDate: new Date(endDate).toISOString(),
            symbol,
            timeframe,
            initialBalance: 10000,
            maxRiskPerTrade: 0.01,
            maxTradesPerDay: 2,
            minRewardRiskRatio: 3,
          },
        }),
      });
      const runJson = await runRes.json();
      if (!runJson?.success) throw new Error(runJson?.error || "Backtest failed");
      setResult(runJson.data);

      // If win rate is low, fetch suggestions
      const wr = Number(runJson?.data?.winRate || 0);
      if (wr > 0 && wr < 0.45) {
        setStatusMsg("Analyzing and preparing suggestions...");
        const sugRes = await fetch(`/api/agents/${selectedAgent.id}/suggestions?window=200`);
        const sugJson = await sugRes.json().catch(() => null);
        if (sugJson?.success) setSuggestions(sugJson);
      }
      setStatusMsg("");
    } catch (e: any) {
      setStatusMsg(e?.message || "Backtest failed");
    } finally {
      setRunning(false);
    }
  };

  const metrics = useMemo(() => {
    if (!result) return null;
    return [
      { label: "Total Return", value: `${(result.totalPnlPercent ?? 0).toFixed(2)}%`, color: (result.totalPnlPercent ?? 0) >= 0 ? "text-green-600" : "text-red-600" },
      { label: "Max Drawdown", value: `${(result.maxDrawdownPercent ?? 0).toFixed(2)}%`, color: "text-red-600" },
      { label: "Sharpe Ratio", value: `${(result.sharpeRatio ?? 0).toFixed(2)}` },
      { label: "Total Trades", value: `${result.totalTrades ?? 0}` },
      { label: "Win Rate", value: `${((result.winRate ?? 0) * 100).toFixed(2)}%` },
      { label: "Profit Factor", value: `${(result.profitFactor ?? 0).toFixed(2)}` },
      { label: "Avg Win", value: `${(result.avgWin ?? 0).toFixed(2)}` },
      { label: "Avg Loss", value: `${(result.avgLoss ?? 0).toFixed(2)}` },
    ];
  }, [result]);

  // Reference line uses the initial balance: prefer result.initialBalance if available, else fallback to 10,000 used in the request
  const initialBalanceRef = useMemo(() => Number(result?.initialBalance ?? 10000), [result]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <TrendingUp className="h-5 w-5" />
          <span>Backtest</span>
        </CardTitle>
        <CardDescription>
          Test trained agents on historical data and review detailed results.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-4 gap-6 mb-6">
          <div>
            <Label htmlFor="agent">Agent</Label>
            <Select
              value={selectedAgentId}
              onValueChange={setSelectedAgentId}
              disabled={loadingAgents || running || completedAgents.length === 0}
            >
              <SelectTrigger id="agent" className="mt-1">
                <SelectValue placeholder={loadingAgents ? "Loading agents..." : (completedAgents.length ? "Select an agent" : "No completed agents") } />
              </SelectTrigger>
              <SelectContent>
                {completedAgents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {selectedAgentId ? (
            <div>
              <Label htmlFor="symbol">Asset (Symbol)</Label>
              <Input id="symbol" value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g., BTC/USDT" disabled={running} />
            </div>
          ) : null}
          {selectedAgentId ? (
            <div>
              <Label htmlFor="timeframe">Timeframe</Label>
              <Select value={timeframe} onValueChange={setTimeframe} disabled={running}>
                <SelectTrigger id="timeframe" className="mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {['1m','5m','15m','1h','4h','1d'].map(tf => (
                    <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : null}
          <div className="flex items-end">
            <Button className="w-full flex items-center space-x-2" onClick={runBacktest} disabled={!selectedAgentId || running || completedAgents.length === 0}>
              <Play className="h-4 w-4" />
              <span>{running ? (statusMsg || "Running...") : "Run Backtest"}</span>
            </Button>
          </div>
          {selectedAgentId ? (
            <div>
              <Label htmlFor="start">From</Label>
              <Input id="start" type="datetime-local" value={startDate} onChange={(e) => setStartDate(e.target.value)} disabled={running} />
            </div>
          ) : null}
          {selectedAgentId ? (
            <div>
              <Label htmlFor="end">To</Label>
              <Input id="end" type="datetime-local" value={endDate} onChange={(e) => setEndDate(e.target.value)} disabled={running} />
            </div>
          ) : null}
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
                <h4 className="font-semibold">{selectedAgent ? `Backtest: ${selectedAgent.name}` : "Backtest Results"}</h4>
                <Badge variant="secondary" className="flex items-center space-x-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>{result ? "Completed" : running ? "Running" : "Ready"}</span>
                </Badge>
              </div>
              {!result && !running && (
                <p className="text-sm text-slate-600 dark:text-slate-400">Run a backtest to see results here.</p>
              )}
              {result && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  {metrics?.map((m) => (
                    <div key={m.label} className="bg-slate-50 dark:bg-slate-800 p-3 rounded-lg">
                      <p className="text-slate-600 dark:text-slate-400">{m.label}</p>
                      <p className={`font-semibold ${m.color || ""}`}>{m.value}</p>
                    </div>
                  ))}
                </div>
              )}
              {result && suggestions && (
                <div className="mt-6">
                  <h5 className="font-semibold mb-2">Suggestions to Improve Strategy (low win rate)</h5>
                  <ul className="list-disc pl-6 text-sm space-y-1">
                    {(suggestions?.suggestions || []).map((s: any, idx: number) => (
                      <li key={idx}>
                        <span className="font-medium">{s.path}</span>: {s.op} {s.value} — {s.rationale} ({Math.round((s.confidence||0)*100)}% conf)
                      </li>
                    ))}
                    {(!suggestions?.suggestions || suggestions.suggestions.length === 0) && (
                      <li>No specific suggestions generated. Consider adjusting risk settings or entry filters.</li>
                    )}
                  </ul>
                </div>
              )}
            </div>
          </TabsContent>
          <TabsContent value="trades">
            {!result ? (
              <div className="text-center py-8">
                <p className="text-sm text-slate-600 dark:text-slate-400">No trades yet. Run a backtest first.</p>
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b">
                      <th className="py-2 pr-4">Entry</th>
                      <th className="py-2 pr-4">Exit</th>
                      <th className="py-2 pr-4">Action</th>
                      <th className="py-2 pr-4">Entry Px</th>
                      <th className="py-2 pr-4">Exit Px</th>
                      <th className="py-2 pr-4">Size</th>
                      <th className="py-2 pr-4">SL</th>
                      <th className="py-2 pr-4">TP</th>
                      <th className="py-2 pr-4">PnL</th>
                      <th className="py-2 pr-4">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(result?.trades || []).map((t: any) => (
                      <tr key={t.id} className="border-b hover:bg-slate-50/50">
                        <td className="py-2 pr-4 whitespace-nowrap">{new Date(t.entryTime).toLocaleString()}</td>
                        <td className="py-2 pr-4 whitespace-nowrap">{t.exitTime ? new Date(t.exitTime).toLocaleString() : "-"}</td>
                        <td className="py-2 pr-4 uppercase">{t.action}</td>
                        <td className="py-2 pr-4">{t.entryPrice?.toFixed(2)}</td>
                        <td className="py-2 pr-4">{t.exitPrice !== undefined && t.exitPrice !== null ? t.exitPrice.toFixed(2) : "-"}</td>
                        <td className="py-2 pr-4">{t.positionSize?.toFixed(4)}</td>
                        <td className="py-2 pr-4">{t.stopLoss?.toFixed(2)}</td>
                        <td className="py-2 pr-4">{t.takeProfit?.toFixed(2)}</td>
                        <td className={`py-2 pr-4 ${t.pnl >= 0 ? "text-green-600" : "text-red-600"}`}>{t.pnl !== undefined && t.pnl !== null ? t.pnl.toFixed(2) : "-"}</td>
                        <td className="py-2 pr-4 capitalize">{t.status?.replace("_", " ")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </TabsContent>
          <TabsContent value="chart">
            {!result || !Array.isArray(result?.equityCurve) || result.equityCurve.length === 0 ? (
              <div className="h-96 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mt-4">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">Run a backtest to view the equity curve.</p>
                </div>
              </div>
            ) : (
              <div className="h-96 mt-4 bg-white dark:bg-slate-900 border rounded-lg p-3">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={(result.equityCurve || []).map((p: any) => ({
                      time: new Date(p.timestamp).getTime(),
                      balance: Number(p.balance ?? 0),
                    }))}
                    margin={{ top: 10, right: 20, bottom: 10, left: 0 }}
                  >
                    <defs>
                      <linearGradient id="eqCurve" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.4} />
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis
                      dataKey="time"
                      tickFormatter={(v: number) => new Date(v).toLocaleDateString()}
                      minTickGap={24}
                    />
                    <YAxis tickFormatter={(v: number) => v.toFixed(0)} domain={['auto', 'auto']} />
                    <Tooltip
                      labelFormatter={(label: number) => new Date(label).toLocaleString()}
                      formatter={(value: number) => [`$${value.toFixed(2)}`, 'Balance']}
                    />
                    <ReferenceLine y={initialBalanceRef} stroke="#94a3b8" strokeDasharray="4 4" ifOverflow="extendDomain" />
                    <Line type="monotone" dataKey="balance" stroke="#0ea5e9" strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
