"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ChevronLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";

export default function TradesHistoryPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("");
  const [timeframe, setTimeframe] = useState<string>("any");
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<any[]>([]);
  const router = useRouter();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const res = await fetch('/api/agents');
        const json = await res.json();
        if (json?.success) {
          setAgents(json.agents || []);
          if ((json.agents || []).length) setAgentId(json.agents[0].id);
        }
      } catch {}
    };
    loadAgents();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentId) params.set('agentId', agentId);
      if (symbol) params.set('symbol', symbol);
      if (timeframe && timeframe !== 'any') params.set('timeframe', timeframe);
      params.set('excludeStatus', 'pending');
      params.set('limit', '100');
      const res = await fetch(`/api/trades/predictions?${params.toString()}`);
      const json = await res.json();
      if (json?.success) setItems(json.predictions || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!agentId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, symbol, timeframe]);

  useEffect(() => {
    if (!socketRef.current) {
      const s = io({ path: '/api/socketio' });
      socketRef.current = s;
    }
    const s = socketRef.current!;
    const updatedHandler = (p: any) => {
      const status = String(p?.meta?.status || 'pending').toLowerCase();
      if (status === 'pending') return;
      setItems((prev) => {
        const found = prev.findIndex(it => it.id === p.id);
        if (found >= 0) {
          const next = [...prev];
          next[found] = { ...next[found], ...p };
          return next;
        }
        // if it matches current filters, prepend it
        if (agentId && p.agentId !== agentId) return prev;
        if (symbol && p.symbol !== symbol) return prev;
        if (timeframe && p.timeframe !== timeframe) return prev;
        return [p, ...prev];
      });
    };
    s.on('PREDICTION_UPDATED_EVENT', updatedHandler);
    return () => { s.off('PREDICTION_UPDATED_EVENT', updatedHandler); };
  }, [agentId, symbol, timeframe]);

  const selectedAgent = useMemo(() => agents.find(a => a.id === agentId), [agents, agentId]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>History</span>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.push('/trades')}><ChevronLeft className="h-4 w-4 mr-1"/>Back</Button>
            <Button variant="secondary" size="sm" onClick={load} disabled={loading}>Reload</Button>
          </div>
        </CardTitle>
        <CardDescription>All non-pending predictions (accepted or rejected).</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid md:grid-cols-4 gap-4 mb-4">
          <div>
            <Label className="text-xs">Agent</Label>
            <Select value={agentId} onValueChange={setAgentId}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Select agent" /></SelectTrigger>
              <SelectContent>
                {agents.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Symbol</Label>
            <Input value={symbol} onChange={(e) => setSymbol(e.target.value)} placeholder="e.g., BTC_USDT" className="mt-1" />
          </div>
          <div>
            <Label className="text-xs">Timeframe</Label>
            <Select value={timeframe} onValueChange={setTimeframe}>
              <SelectTrigger className="mt-1"><SelectValue placeholder="Any" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                {['1m','5m','15m','1h','4h','1d'].map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="border rounded-lg overflow-hidden">
          <div className="grid grid-cols-8 gap-2 p-2 text-xs font-semibold border-b bg-slate-50 dark:bg-slate-800">
            <div className="col-span-2">Agent</div>
            <div>Symbol</div>
            <div>Side</div>
            <div>Entry</div>
            <div>SL</div>
            <div>TP</div>
            <div>Status</div>
          </div>
          {loading && (
            <div className="p-4 text-sm text-slate-500">Loading…</div>
          )}
          {!loading && items.length === 0 && (
            <div className="p-6 text-sm text-slate-500">No history yet.</div>
          )}
          {!loading && items.length > 0 && (
            <div className="divide-y">
              {items.map((p) => {
                const entry = Number(p?.meta?.price ?? 0);
                const side = String(p.action || '').toUpperCase();
                const status = String(p?.meta?.status || '').toUpperCase();
                return (
                  <div key={p.id} className="grid grid-cols-8 gap-2 p-2 text-sm items-center">
                    <div className="col-span-2 truncate">
                      <div className="font-medium truncate">{p?.agent?.name || p.agentId}</div>
                      <div className="text-xs text-slate-500 truncate">{p?.strategy?.name || p.strategyId}</div>
                    </div>
                    <div className="font-mono">{p.symbol}</div>
                    <div className="flex items-center gap-2">
                      <Badge className={side === 'BUY' ? 'bg-green-600' : 'bg-red-600'}>{side}</Badge>
                    </div>
                    <div className="font-mono">{entry ? entry.toFixed(2) : '-'}</div>
                    <div className="font-mono">{p.stopLoss !== undefined && p.stopLoss !== null ? p.stopLoss.toFixed(2) : '-'}</div>
                    <div className="font-mono">{p.takeProfit !== undefined && p.takeProfit !== null ? p.takeProfit.toFixed(2) : '-'}</div>
                    <div className="font-mono"><Badge variant="secondary">{status}</Badge></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
