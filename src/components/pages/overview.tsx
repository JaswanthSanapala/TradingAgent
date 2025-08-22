"use client";

import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, ArrowDownRight, ArrowUpRight, RefreshCw } from "lucide-react";
import { io, Socket } from "socket.io-client";

type MarketItem = { key: string; label: string; symbol: string; changePct: number; marketState: string };
type MarketPayload = { success: boolean; isOpen: boolean; data: MarketItem[] };
type PerformancePayload = {
  success: boolean;
  daily: { date: string; pnl: number; trades: number }[];
  monthly: { month: string; pnl: number; trades: number }[];
};
type DashboardPayload = { success: boolean; dailyPnl: number; winRate: number; pendingPredictions: number; tradesToday: number };
type LiveTradesPayload = { success: boolean; trades: any[] };

function formatCurrency(n: number) {
  const sign = n >= 0 ? 1 : -1;
  const v = Math.abs(n);
  return `${sign < 0 ? "-" : ""}$${v.toFixed(2)}`;
}

function formatDate(d: string) {
  const dd = new Date(d);
  return dd.toLocaleDateString();
}

function monthLabel(m: string) {
  // input like 2025-07
  const [y, mo] = m.split("-");
  const dt = new Date(Number(y), Number(mo) - 1, 1);
  return dt.toLocaleString(undefined, { month: "long", year: "numeric" });
}

export default function OverviewPage() {
  const [market, setMarket] = useState<MarketPayload | null>(null);
  const [perf, setPerf] = useState<PerformancePayload | null>(null);
  const [dash, setDash] = useState<DashboardPayload | null>(null);
  const [live, setLive] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [perfTab, setPerfTab] = useState<'daily' | 'monthly'>('daily');
  const socketRef = useRef<Socket | null>(null);

  const loadAll = async () => {
    setLoading(true);
    try {
      const [m, p, d, l] = await Promise.all([
        fetch("/api/overview/market", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/overview/performance", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/overview/dashboard", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
        fetch("/api/overview/live", { cache: "no-store" }).then((r) => r.json()).catch(() => null),
      ]);
      if (m?.success) setMarket(m);
      if (p?.success) setPerf(p);
      if (d?.success) setDash(d);
      if (l?.success) setLive(l.trades || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAll();
  }, []);

  // Socket.IO: live trade created updates
  useEffect(() => {
    if (!socketRef.current) {
      socketRef.current = io({ path: "/api/socketio" });
    }
    const s = socketRef.current;
    const onCreated = (t: any) => {
      setLive((prev) => [{
        id: t.id,
        agentId: t.agentId,
        strategyId: t.strategyId,
        entryTime: t.entryTime,
        entryPrice: t.entryPrice,
        stopLoss: t.stopLoss,
        takeProfit: t.takeProfit,
        action: t.action,
        symbol: t.symbol,
        timeframe: t.timeframe,
        status: 'open',
      }, ...prev]);
      // also refresh dashboard quick metrics
      fetch("/api/overview/dashboard", { cache: "no-store" }).then(r => r.json()).then(j => { if (j?.success) setDash(j); }).catch(() => {});
    };
    s.on('TRADE_CREATED_EVENT', onCreated);
    return () => { s.off('TRADE_CREATED_EVENT', onCreated); };
  }, []);

  const isMarketOpen = market?.isOpen ?? false;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2">
        {/* Main Dashboard Section */}
        <Card className="mb-8">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Trading Dashboard</CardTitle>
              <button onClick={loadAll} className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1">
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-center">
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Daily P/L</p>
                <p className={`text-2xl font-bold ${Number(dash?.dailyPnl || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>{formatCurrency(Number(dash?.dailyPnl || 0))}</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Win Rate</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{((Number(dash?.winRate || 0)) * 100).toFixed(0)}%</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Pending Trades</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{Number(dash?.pendingPredictions || 0)}</p>
              </div>
              <div className="p-4 bg-slate-100 dark:bg-slate-800 rounded-lg">
                <p className="text-sm text-slate-600 dark:text-slate-400">Trades Today</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{Number(dash?.tradesToday || 0)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Trading Activity: Live Open Trades */}
        <Card>
          <CardHeader>
            <CardTitle>Trading Activity</CardTitle>
          </CardHeader>
          <CardContent>
            {live.length === 0 ? (
              <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="h-12 w-12 text-slate-400 mx-auto mb-2" />
                  <p className="text-sm text-slate-600 dark:text-slate-400">No live trades. Accepted predictions will appear here.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="grid grid-cols-7 gap-2 p-2 text-xs font-semibold border-b bg-slate-50 dark:bg-slate-800 rounded">
                  <div>Time</div>
                  <div>Symbol</div>
                  <div>TF</div>
                  <div>Side</div>
                  <div>Entry</div>
                  <div>SL</div>
                  <div>TP</div>
                </div>
                {live.slice(0, 20).map((t) => {
                  const up = (t?.action || '').toLowerCase() === 'buy';
                  return (
                    <div key={t.id} className="grid grid-cols-7 gap-2 p-2 text-sm items-center hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                      <div className="text-xs text-slate-600">{new Date(t.entryTime).toLocaleString()}</div>
                      <div className="font-mono">{t.symbol}</div>
                      <div className="uppercase text-xs">{t.timeframe}</div>
                      <div className="flex items-center gap-1">
                        <Badge className={up ? 'bg-green-600' : 'bg-red-600'}>{up ? 'BUY' : 'SELL'}</Badge>
                      </div>
                      <div className="font-mono">{Number(t.entryPrice).toFixed(2)}</div>
                      <div className="font-mono">{t.stopLoss !== undefined && t.stopLoss !== null ? Number(t.stopLoss).toFixed(2) : '-'}</div>
                      <div className="font-mono">{t.takeProfit !== undefined && t.takeProfit !== null ? Number(t.takeProfit).toFixed(2) : '-'}</div>
                    </div>
                  );
                })}
              </div>
            )}
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
              <Badge variant={isMarketOpen ? "secondary" : "destructive"} className="text-xs">
                {isMarketOpen ? "Open" : "Closed"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(market?.data || []).map((row) => {
                const up = Number(row.changePct || 0) >= 0;
                return (
                  <div key={row.key} className="flex justify-between text-sm">
                    <span className="text-slate-600 dark:text-slate-400">{row.label}</span>
                    <span className={`font-medium flex items-center ${up ? 'text-green-600' : 'text-red-600'}`}>
                      {up ? <ArrowUpRight className="h-4 w-4 mr-1" /> : <ArrowDownRight className="h-4 w-4 mr-1" />} {up ? '+' : ''}{Number(row.changePct || 0).toFixed(2)}%
                    </span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Recent Performance with Tabs */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>Recent Performance</span>
              <div className="inline-flex items-center rounded-md border p-0.5 text-xs">
                <button
                  className={`px-2 py-1 rounded ${perfTab === 'daily' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}
                  onClick={() => setPerfTab('daily')}
                >
                  Daily
                </button>
                <button
                  className={`px-2 py-1 rounded ${perfTab === 'monthly' ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-700 dark:text-slate-300'}`}
                  onClick={() => setPerfTab('monthly')}
                >
                  Monthly
                </button>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {perfTab === 'daily' ? (
              <div className="space-y-1">
                {(perf?.daily || []).slice(0,5).map((d, idx) => {
                  const up = Number(d.pnl) >= 0;
                  return (
                    <div key={`${d.date}-${idx}`} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                      <div className="text-sm font-medium">{formatDate(d.date)}</div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>{up ? '+' : ''}{Number(d.pnl).toFixed(2)}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{Number(d.trades)} trades</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-1">
                {(perf?.monthly || []).slice(0,5).map((m, idx) => {
                  const up = Number(m.pnl) >= 0;
                  return (
                    <div key={`${m.month}-${idx}`} className="flex justify-between items-center p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded">
                      <div className="text-sm font-medium">{monthLabel(m.month)}</div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-sm font-medium ${up ? 'text-green-600' : 'text-red-600'}`}>{up ? '+' : ''}{Number(m.pnl).toFixed(2)}</span>
                        <span className="text-xs text-slate-600 dark:text-slate-400">{Number(m.trades)} trades</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
