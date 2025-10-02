'use client'

import { useEffect, useMemo, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { BarChart3, Play, Square } from "lucide-react";
import { getSocket } from '@/lib/socket-client';

type Agent = { id: string; name: string; strategyId: string; algorithm: string; };

declare global {
  interface Window { TradingView?: any }
}

export default function LiveChartsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState<string>('');
  const [symbol, setSymbol] = useState<string>('BINANCE:BTCUSDT');
  const [timeframe, setTimeframe] = useState<string>('60'); // TradingView resolution (e.g., 60 = 1h)
  const [autoTrade, setAutoTrade] = useState<boolean>(false);
  const [minConf, setMinConf] = useState<string>('0.5');
  const [riskPct, setRiskPct] = useState<string>('1');
  const [loading, setLoading] = useState<boolean>(false);
  const widgetRef = useRef<any | null>(null);
  const containerId = 'tv_chart_container';
  const tvChartRef = useRef<any | null>(null);
  const tvReadyRef = useRef<boolean>(false);

  function getChart(): any | null {
    const w: any = widgetRef.current;
    if (!w) return null;
    // Different builds expose chart() or activeChart()
    return (typeof w.activeChart === 'function' ? w.activeChart() : (typeof w.chart === 'function' ? w.chart() : null));
  }

  function timeToSec(t: number | string | Date): number {
    if (typeof t === 'number') return Math.floor(t / 1000);
    const ms = typeof t === 'string' ? Date.parse(t) : (t as Date).getTime();
    return Math.floor(ms / 1000);
    }

  function drawPredictionMarker(p: any) {
    try {
      if (!tvReadyRef.current) return;
      const chart = getChart();
      if (!chart || typeof chart.createShape !== 'function') return;
      const time = timeToSec(p.timestamp || (p.meta?.now || Date.now()));
      const price = Number(p.meta?.price ?? 0);
      if (!price || !Number.isFinite(price)) return;
      const isBuy = String(p.action).toLowerCase() === 'buy';
      const color = isBuy ? '#00BFFF' : '#FF1493'; // cyan for buy, pink for sell
      chart.createShape({ time, price }, { shape: isBuy ? 'arrow_up' : 'arrow_down', text: `Pred ${p.action} ${(p.confidence*100).toFixed(0)}%`, lock: false, overrides: { color } });
    } catch {}
  }

  function drawTradeMarker(evt: any) {
    try {
      if (!tvReadyRef.current) return;
      const chart = getChart();
      if (!chart || typeof chart.createShape !== 'function') return;
      const type = String(evt.type || '');
      if (type === 'opened') {
        const time = timeToSec(evt.ts || Date.now());
        const price = Number(evt.entryPrice ?? evt.price ?? 0);
        if (!price) return;
        chart.createShape({ time, price }, { shape: 'arrow_up', text: 'Entry', lock: false, overrides: { color: '#22c55e' } });
        // Optionally draw SL/TP markers at entry time to avoid cluttering the whole chart
        const sl = Number(evt.stopLoss ?? 0);
        const tp = Number(evt.takeProfit ?? 0);
        if (sl > 0 && Number.isFinite(sl)) {
          chart.createShape({ time, price: sl }, { shape: 'price_label', text: 'SL', lock: false, overrides: { color: '#ef4444' } });
        }
        if (tp > 0 && Number.isFinite(tp)) {
          chart.createShape({ time, price: tp }, { shape: 'price_label', text: 'TP', lock: false, overrides: { color: '#22c55e' } });
        }
      } else if (type === 'closed') {
        const time = timeToSec(evt.ts || Date.now());
        const price = Number(evt.exitPrice ?? evt.price ?? 0);
        if (!price) return;
        const pnl = Number(evt.pnl ?? 0);
        const color = pnl > 0 ? '#22c55e' : pnl < 0 ? '#ef4444' : '#000000'; // green/red/black
        chart.createShape({ time, price }, { shape: 'square', text: `Exit ${pnl.toFixed(2)}` , lock: false, overrides: { color } });
      }
    } catch {}
  }

  // Load agents minimal list
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/agents', { cache: 'no-store' });
        const json = await res.json();
        if (json?.success) setAgents((json.agents || []).map((a: any) => ({ id: a.id, name: a.name, strategyId: a.strategyId, algorithm: a.algorithm })));
      } catch {}
    })();
  }, []);

  // Load selected agent policy
  useEffect(() => {
    (async () => {
      if (!selectedAgentId) return;
      try {
        const res = await fetch(`/api/agents/${selectedAgentId}/policy`, { cache: 'no-store' });
        const json = await res.json();
        const p = json?.policy || {};
        setAutoTrade(!!p.enabled);
        if (p.minConfidence != null) setMinConf(String(p.minConfidence));
        if (p.riskPct != null) setRiskPct(String(p.riskPct));
      } catch {}
    })();
  }, [selectedAgentId]);

  // TradingView widget init
  useEffect(() => {
    // load tv.js once
    let canceled = false;
    const ensureScript = async () => {
      if (window.TradingView) return;
      await new Promise<void>((resolve, reject) => {
        const s = document.createElement('script');
        s.src = 'https://s3.tradingview.com/tv.js';
        s.async = true;
        s.onload = () => resolve();
        s.onerror = () => reject(new Error('Failed to load TradingView'));
        document.body.appendChild(s);
      });
    };
    const init = async () => {
      try {
        await ensureScript();
        if (canceled) return;
        // Destroy previous widget if any
        if (widgetRef.current && typeof widgetRef.current.remove === 'function') {
          widgetRef.current.remove();
        }
        widgetRef.current = new (window as any).TradingView.widget({
          symbol,
          interval: timeframe, // resolution
          container_id: containerId,
          timezone: 'Etc/UTC',
          theme: 'dark',
          locale: 'en',
          style: '1',
          toolbar_bg: '#0b0f1a',
          withdateranges: true,
          hide_side_toolbar: false,
          allow_symbol_change: true,
          studies: [],
          details: false,
          hotlist: false,
          calendar: false,
          autosize: true,
        });
        // Wait for widget/chart ready to draw shapes
        widgetRef.current.onChartReady?.(() => {
          tvReadyRef.current = true;
          tvChartRef.current = getChart();
        });
      } catch (e) {
        console.error(e);
      }
    };
    init();
    return () => { canceled = true; };
  }, [symbol, timeframe]);

  // Socket subscription for future overlays (market:ohlcv, predictions, trades)
  useEffect(() => {
    const socket = getSocket();
    const onOhlcv = (p: any) => {
      // In a future iteration, we can feed custom series via the UDF API or draw shapes/marks on updates.
      // For now, we just keep it wired and ready.
      // console.debug('ohlcv', p);
    };
    const onPred = (p: any) => { drawPredictionMarker(p); };
    const onTradeUpdated = (p: any) => { drawTradeMarker(p); };
    const onOrderUpdated = (p: any) => {
      // When OCO submitted with tp/sl, draw compact markers once
      if (!tvReadyRef.current) return;
      const chart = getChart();
      if (!chart || typeof chart.createShape !== 'function') return;
      if (String(p.phase) !== 'oco_submitted') return;
      const time = timeToSec(p.ts || Date.now());
      const tp = Number(p.tp ?? 0);
      const sl = Number(p.sl ?? 0);
      if (sl > 0) chart.createShape({ time, price: sl }, { shape: 'price_label', text: 'SL', lock: false, overrides: { color: '#ef4444' } });
      if (tp > 0) chart.createShape({ time, price: tp }, { shape: 'price_label', text: 'TP', lock: false, overrides: { color: '#22c55e' } });
    };
    socket.on('market:ohlcv', onOhlcv);
    socket.on('PREDICTION_CREATED_EVENT', onPred);
    socket.on('TRADE_CREATED_EVENT', onTradeUpdated);
    socket.on('trade:updated', onTradeUpdated);
    socket.on('order:updated', onOrderUpdated);
    return () => {
      socket.off('market:ohlcv', onOhlcv);
      socket.off('PREDICTION_CREATED_EVENT', onPred);
      socket.off('TRADE_CREATED_EVENT', onTradeUpdated);
      socket.off('trade:updated', onTradeUpdated);
      socket.off('order:updated', onOrderUpdated);
    };
  }, []);

  const startAuto = async () => {
    setLoading(true);
    try {
      if (!selectedAgentId) return;
      const res = await fetch(`/api/agents/${selectedAgentId}/policy`, { method: 'POST', body: JSON.stringify({ enabled: true, minConfidence: Number(minConf), riskPct: Number(riskPct) }) });
      const json = await res.json();
      if (json?.success) setAutoTrade(true);
    } finally { setLoading(false); }
  };
  const stopAuto = async () => {
    setLoading(true);
    try {
      if (!selectedAgentId) return;
      const res = await fetch(`/api/agents/${selectedAgentId}/policy`, { method: 'POST', body: JSON.stringify({ enabled: false }) });
      const json = await res.json();
      if (json?.success) setAutoTrade(false);
    } finally { setLoading(false); }
  };

  const agentOptions = useMemo(() => agents.map(a => ({ value: a.id, label: a.name })), [agents]);

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <BarChart3 className="h-5 w-5" />
            <span>Live Charts</span>
          </div>
          <div className="flex items-center gap-3 text-xs">
            <div className="flex items-center gap-2">
              <Label className="text-xs">Agent</Label>
              <Select value={selectedAgentId} onValueChange={setSelectedAgentId}>
                <SelectTrigger className="w-48 h-8">
                  <SelectValue placeholder={agentOptions.length ? 'Select agent' : 'No agents'} />
                </SelectTrigger>
                <SelectContent>
                  {agentOptions.map(o => (<SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Symbol</Label>
              <Input className="h-8 w-44" value={symbol} onChange={e => setSymbol(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">TF</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="w-24 h-8">
                  <SelectValue placeholder="60" />
                </SelectTrigger>
                <SelectContent>
                  {['1','3','5','15','30','60','120','240','D','W'].map(tf => (
                    <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Auto</Label>
              <Switch checked={autoTrade} onCheckedChange={(v) => v ? startAuto() : stopAuto()} />
              {autoTrade ? (
                <Button size="sm" variant="outline" disabled={loading} onClick={stopAuto}><Square className="h-3.5 w-3.5 mr-1"/>Stop</Button>
              ) : (
                <Button size="sm" disabled={loading || !selectedAgentId} onClick={startAuto}><Play className="h-3.5 w-3.5 mr-1"/>Start</Button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">MinConf</Label>
              <Input className="h-8 w-20" value={minConf} onChange={e => setMinConf(e.target.value)} />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs">Risk%</Label>
              <Input className="h-8 w-16" value={riskPct} onChange={e => setRiskPct(e.target.value)} />
            </div>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div id={containerId} className="w-full" style={{ height: 560 }} />
        <div className="text-[11px] text-muted-foreground mt-2">
          Tip: Use BINANCE:BTCUSDT, BINANCE:ETHUSDT, etc. Resolution values: 60 (1h), 240 (4h), D (1d).
        </div>
      </CardContent>
    </Card>
  );
}
