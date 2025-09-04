"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Zap, RefreshCw, BarChart3 } from "lucide-react";
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, ReferenceLine } from "recharts";
import { Switch } from "@/components/ui/switch";
import { io, Socket } from "socket.io-client";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import Link from "next/link";

type Prediction = {
  id: string;
  agentId: string;
  strategyId: string;
  symbol: string;
  timeframe: string;
  timestamp: string;
  action: "buy" | "sell" | string;
  confidence: number;
  stopLoss?: number | null;
  takeProfit?: number | null;
  meta?: any;
  agent?: any;
  strategy?: any;
};

function formatTs(ts: string | Date) {
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toLocaleString();
}

function TradeChart({ symbol, timeframe, to, entry, sl, tp }: { symbol: string; timeframe: string; to: string; entry?: number; sl?: number | null; tp?: number | null; }) {
  const [data, setData] = useState<any[] | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        // Resolve dataset by symbol/timeframe
        const q = new URLSearchParams({ symbol, timeframe }).toString();
        const dsRes = await fetch(`/api/datasets?${q}`);
        const dsJson = await dsRes.json();
        const ds = Array.isArray(dsJson?.items) ? dsJson.items[0] : null;
        if (!ds) {
          setData([]);
        } else {
          const ohlcvUrl = `/api/datasets/${encodeURIComponent(ds.id)}/ohlcv?to=${encodeURIComponent(to)}&limit=150`;
          const res = await fetch(ohlcvUrl);
          const json = await res.json();
          if (json?.success) setData(json.data || []);
          else setData([]);
        }
      } catch {}
      setLoading(false);
    };
    load();
  }, [symbol, timeframe, to]);

  if (loading) return <div className="h-48 flex items-center justify-center text-sm text-slate-500">Loading chart…</div>;
  if (!data || data.length === 0) return <div className="h-48 bg-slate-100 dark:bg-slate-800 rounded flex items-center justify-center text-sm text-slate-500">No data</div>;

  const chartData = data.map((d: any) => ({ t: new Date(d.timestamp).getTime(), close: Number(d.close || 0) }));

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 6, right: 16, bottom: 6, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
          <XAxis dataKey="t" tickFormatter={(v: number) => new Date(v).toLocaleTimeString()} minTickGap={24} />
          <YAxis domain={["auto", "auto"]} width={50} tickFormatter={(v: number) => v.toFixed(0)} />
          <Tooltip labelFormatter={(v: number) => new Date(v).toLocaleString()} formatter={(val: number) => [val.toFixed(2), "Close"]} />
          {typeof entry === "number" ? <ReferenceLine y={entry} stroke="#0ea5e9" strokeDasharray="4 4" label={{ value: "Entry", position: "insideTopRight", fill: "#0ea5e9" }} /> : null}
          {typeof sl === "number" ? <ReferenceLine y={sl} stroke="#ef4444" strokeDasharray="4 4" label={{ value: "SL", position: "insideTopRight", fill: "#ef4444" }} /> : null}
          {typeof tp === "number" ? <ReferenceLine y={tp} stroke="#22c55e" strokeDasharray="4 4" label={{ value: "TP", position: "insideTopRight", fill: "#22c55e" }} /> : null}
          <Line type="monotone" dataKey="close" stroke="#64748b" dot={false} strokeWidth={1.5} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function TradesPage() {
  const [agents, setAgents] = useState<any[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [symbol, setSymbol] = useState<string>("BTC_USDT"); // storage format
  const [timeframe, setTimeframe] = useState<string>("1h");
  const [loading, setLoading] = useState(false);
  const [preds, setPreds] = useState<Prediction[]>([]);
  const [latestOnly, setLatestOnly] = useState<boolean>(true);
  const [pendingOnly, setPendingOnly] = useState<boolean>(false);
  const socketRef = useRef<Socket | null>(null);
  const [chatOpen, setChatOpen] = useState<boolean>(false);
  const [chatFor, setChatFor] = useState<Prediction | null>(null);
  const [chatInput, setChatInput] = useState<string>("");
  const [chatMessages, setChatMessages] = useState<Array<{sender: string; text: string; ts: string}>>([]);
  const [notesOpen, setNotesOpen] = useState<boolean>(false);
  const [notesFor, setNotesFor] = useState<Prediction | null>(null);
  const [noteText, setNoteText] = useState<string>("");

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

  const loadPredictions = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (agentId) params.set('agentId', agentId);
      if (symbol) params.set('symbol', symbol);
      if (timeframe) params.set('timeframe', timeframe);
      params.set('limit', '50');
      if (latestOnly) params.set('latestOnly', 'true');
      const res = await fetch(`/api/trades/predictions?${params.toString()}`);
      const json = await res.json();
      if (json?.success) setPreds(json.predictions || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => {
    if (!agentId) return;
    loadPredictions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [agentId, symbol, timeframe, latestOnly]);

  // Socket.IO live updates
  useEffect(() => {
    // connect once
    if (!socketRef.current) {
      const s = io({ path: '/api/socketio' });
      socketRef.current = s;
    }
    const s = socketRef.current!;
    const createdHandler = (p: any) => {
      // basic filter match
      if (agentId && p.agentId !== agentId) return;
      if (symbol && p.symbol !== symbol) return;
      if (timeframe && p.timeframe !== timeframe) return;
      setPreds((prev) => {
        const next = [
          {
            id: p.id,
            agentId: p.agentId,
            strategyId: p.strategyId,
            symbol: p.symbol,
            timeframe: p.timeframe,
            timestamp: p.timestamp,
            action: p.action,
            confidence: p.confidence,
            stopLoss: p.stopLoss ?? null,
            takeProfit: p.takeProfit ?? null,
            meta: p.meta,
          } as Prediction,
          ...prev,
        ];
        if (!latestOnly) return next;
        // latestOnly: dedupe by (agentId|strategyId|symbol|timeframe)
        const seen = new Set<string>();
        const filtered: Prediction[] = [];
        for (const item of next) {
          const key = `${item.agentId}|${item.strategyId}|${item.symbol}|${item.timeframe}`;
          if (seen.has(key)) continue;
          seen.add(key);
          filtered.push(item);
        }
        return filtered;
      });
    };
    const updatedHandler = (p: any) => {
      setPreds((prev) => prev.map(it => it.id === p.id ? { ...it, ...p } : it));
    };
    s.on('PREDICTION_CREATED_EVENT', createdHandler);
    s.on('PREDICTION_UPDATED_EVENT', updatedHandler);
    return () => {
      s.off('PREDICTION_CREATED_EVENT', createdHandler);
      s.off('PREDICTION_UPDATED_EVENT', updatedHandler);
    };
  }, [agentId, symbol, timeframe, latestOnly]);

  // Chat echo wiring
  useEffect(() => {
    const s = socketRef.current;
    if (!s) return;
    const messageHandler = (payload: any) => {
      if (!chatOpen) return;
      setChatMessages((m) => [...m, { sender: payload?.senderId || 'system', text: payload?.text || '', ts: payload?.timestamp || new Date().toISOString() }]);
    };
    s.on('message', messageHandler);
    return () => { s.off('message', messageHandler); };
  }, [chatOpen]);

  const acceptPrediction = async (id: string) => {
    await fetch(`/api/trades/predictions/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'accept' }) });
  };
  const rejectPrediction = async (id: string) => {
    await fetch(`/api/trades/predictions/${id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'reject' }) });
  };
  const openChat = (p: Prediction) => {
    setChatFor(p);
    setChatMessages([]);
    setChatInput("");
    setChatOpen(true);
  };
  const sendChat = () => {
    if (!chatInput.trim()) return;
    const s = socketRef.current;
    if (!s) return;
    s.emit('message', { text: chatInput, senderId: 'user' });
    setChatMessages((m) => [...m, { sender: 'you', text: chatInput, ts: new Date().toISOString() }]);
    setChatInput("");
  };

  const openNotes = (p: Prediction) => {
    setNotesFor(p);
    setNoteText(String(p?.meta?.notes || ""));
    setNotesOpen(true);
  };
  const saveNotes = async () => {
    if (!notesFor) return;
    await fetch(`/api/trades/predictions/${notesFor.id}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'note', note: noteText }) });
    // optimistic local update
    setPreds((prev) => prev.map(it => it.id === notesFor.id ? { ...it, meta: { ...(it.meta||{}), notes: noteText } } : it));
    setNotesOpen(false);
  };

  const selectedAgent = useMemo(() => agents.find(a => a.id === agentId), [agents, agentId]);

  return (
    <>
    <Card className="mb-8">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <Zap className="h-5 w-5" />
            <span>Trades</span>
          </CardTitle>
          <Button asChild size="sm">
            <Link href="/trades-history">History</Link>
          </Button>
        </div>
        <CardDescription>
          Predictions generated by trained agents. Each item shows the action, entry, SL/TP, and rationale. Expand to view chart.
        </CardDescription>
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
              <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {["1m","5m","15m","1h","4h","1d"].map(tf => <SelectItem key={tf} value={tf}>{tf}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end justify-between gap-2">
            <div className="flex items-center gap-2 py-2">
              <Switch id="latestOnly" checked={latestOnly} onCheckedChange={setLatestOnly} />
              <Label htmlFor="latestOnly" className="text-xs">Latest only</Label>
            </div>
            <div className="flex items-center gap-2 py-2">
              <Switch id="pendingOnly" checked={pendingOnly} onCheckedChange={setPendingOnly} />
              <Label htmlFor="pendingOnly" className="text-xs">Pending only</Label>
            </div>
            <Button variant="secondary" onClick={loadPredictions} disabled={loading}>
              <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </Button>
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
            <div>Time</div>
          </div>
          {loading && (
            <div className="p-4 text-sm text-slate-500">Loading predictions…</div>
          )}
          {!loading && preds.length === 0 && (
            <div className="p-6 text-sm text-slate-500">No predictions yet. Train an agent and run predictions.</div>
          )}
          {!loading && preds.length > 0 && (
            <Accordion type="single" collapsible className="divide-y">
              {preds.filter(p => !pendingOnly || (p?.meta?.status || 'pending') === 'pending').map((p) => {
                const entry = Number(p?.meta?.price ?? 0);
                const side = (p.action || '').toUpperCase();
                const status = (p?.meta?.status || 'pending') as string;
                return (
                  <AccordionItem key={p.id} value={p.id} className="px-2">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="grid grid-cols-8 gap-2 w-full text-sm items-center">
                        <div className="col-span-2 truncate">
                          <div className="font-medium truncate">{p?.agent?.name || selectedAgent?.name || p.agentId}</div>
                          <div className="text-xs text-slate-500 truncate">{p?.strategy?.name || p.strategyId}</div>
                        </div>
                        <div className="font-mono">{p.symbol}</div>
                        <div className="flex items-center gap-2">
                          <Badge className={side === 'BUY' ? 'bg-green-600' : 'bg-red-600'}>{side}</Badge>
                          <Badge variant="secondary" className="uppercase">{status}</Badge>
                        </div>
                        <div className="font-mono">{entry ? entry.toFixed(2) : '-'}</div>
                        <div className="font-mono">{p.stopLoss !== undefined && p.stopLoss !== null ? p.stopLoss.toFixed(2) : '-'}</div>
                        <div className="font-mono">{p.takeProfit !== undefined && p.takeProfit !== null ? p.takeProfit.toFixed(2) : '-'}</div>
                        <div className="text-xs text-slate-600">{formatTs(p.timestamp)}</div>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2 grid md:grid-cols-3 gap-4">
                        <div className="md:col-span-2">
                          <TradeChart symbol={p.symbol} timeframe={p.timeframe} to={p.timestamp} entry={entry} sl={p.stopLoss} tp={p.takeProfit} />
                        </div>
                        <div className="space-y-2">
                          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                            <div className="text-xs uppercase text-slate-500 mb-1">Rationale</div>
                            <div className="text-sm">{p?.meta?.rationale || '—'}</div>
                          </div>
                          <div className="bg-slate-50 dark:bg-slate-800 p-3 rounded">
                            <div className="text-xs uppercase text-slate-500 mb-1">Details</div>
                            <ul className="text-sm space-y-1">
                              <li><span className="text-slate-500">Confidence:</span> {(Number(p.confidence || 0) * 100).toFixed(0)}%</li>
                              {p?.meta?.indicators?.rsi !== undefined && <li><span className="text-slate-500">RSI:</span> {Number(p.meta.indicators.rsi).toFixed(1)}</li>}
                              {p?.meta?.indicators?.macd !== undefined && p?.meta?.indicators?.macdSignal !== undefined && (
                                <li><span className="text-slate-500">MACD:</span> {Number(p.meta.indicators.macd).toFixed(3)} / {Number(p.meta.indicators.macdSignal).toFixed(3)}</li>
                              )}
                              {p?.meta?.indicators?.atr !== undefined && <li><span className="text-slate-500">ATR:</span> {Number(p.meta.indicators.atr).toFixed(2)}</li>}
                            </ul>
                          </div>
                          <div className="flex gap-2">
                            {status === 'pending' && (
                              <>
                                <Button size="sm" onClick={() => acceptPrediction(p.id)}>Accept</Button>
                                <Button size="sm" variant="destructive" onClick={() => rejectPrediction(p.id)}>Reject</Button>
                              </>
                            )}
                            <Button size="sm" variant="secondary" onClick={() => openChat(p)}>Chat</Button>
                            <Button size="sm" variant="outline" onClick={() => openNotes(p)}>Notes</Button>
                          </div>
                          <div className="text-xs text-slate-500 flex items-center"><BarChart3 className="h-3.5 w-3.5 mr-1" /> Chart at prediction time</div>
                        </div>
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          )}
        </div>
      </CardContent>
    </Card>

    {/* Chat dialog */}
    <Dialog open={chatOpen} onOpenChange={setChatOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chat with Agent {chatFor?.agentId}</DialogTitle>
        </DialogHeader>
        <div className="h-48 overflow-y-auto border rounded p-2 space-y-1 text-sm">
          {chatMessages.map((m, idx) => (
            <div key={idx} className="flex items-start gap-2">
              <span className="text-slate-500">[{new Date(m.ts).toLocaleTimeString()}]</span>
              <span className="font-medium">{m.sender}:</span>
              <span>{m.text}</span>
            </div>
          ))}
          {chatMessages.length === 0 && <div className="text-slate-500">Ask anything about this trade. The agent will reply here.</div>}
        </div>
        <div className="flex gap-2">
          <Input placeholder="Type your question…" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') sendChat(); }} />
          <Button onClick={sendChat}>Send</Button>
        </div>
        <DialogFooter>
          <div className="text-xs text-slate-500">Agent: {chatFor?.agentId} • Symbol: {chatFor?.symbol} • Timeframe: {chatFor?.timeframe}</div>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    {/* Notes dialog */}
    <Dialog open={notesOpen} onOpenChange={setNotesOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notes for {notesFor?.symbol} ({notesFor?.timeframe})</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label className="text-xs">Note</Label>
          <Input value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder="Add your note…" />
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => setNotesOpen(false)}>Cancel</Button>
          <Button onClick={saveNotes}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
