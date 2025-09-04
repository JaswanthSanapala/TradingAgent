"use client";
import React, { useEffect, useMemo, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function AdminPage() {
  return (
    <div className="p-6 space-y-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <BackfillCard />
        <ExportCard />
        <WindowsCard />
        <TrainingCard />
        <SupervisedAgentsCard />
        <FeedbackSuggestionsCard />
        <CoverageCard />
      </div>
    </div>
  );
}

function BackfillCard() {
  const [form, setForm] = useState({ symbol: 'BTC_USDT', timeframe: '1h', start: '2020-01-01T00:00:00Z', end: new Date().toISOString(), exchangeId: 'binance' });
  const [loading, setLoading] = useState(false);
  const onSubmit = async () => {
    setLoading(true);
    try {
      // resolve dataset id by symbol/timeframe (and optional exchangeId)
      const q = new URLSearchParams({ symbol: form.symbol, timeframe: form.timeframe, exchangeId: form.exchangeId }).toString();
      const dsRes = await fetch(`/api/datasets?${q}`);
      const dsJson = await dsRes.json();
      const ds = Array.isArray(dsJson?.items) ? dsJson.items[0] : null;
      if (!ds) {
        alert('Dataset not found. Create it first in Datasets.');
      } else {
        const body = { from: form.start, to: form.end };
        const res = await fetch(`/api/datasets/${encodeURIComponent(ds.id)}/backfill`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        alert(JSON.stringify(json));
      }
    } finally { setLoading(false); }
  };
  return (
    <Card title="Backfill OHLCV + Indicators" loading={loading} onSubmit={onSubmit}>
      <FormGrid state={form} setState={setForm} fields={[ 'symbol','timeframe','start','end','exchangeId' ]} />
    </Card>
  );
}

function ExportCard() {
  const [form, setForm] = useState({ symbol: 'BTC_USDT', timeframe: '1h', start: '2020-01-01T00:00:00Z', end: new Date().toISOString() });
  const [loading, setLoading] = useState(false);
  const onSubmit = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ symbol: form.symbol, timeframe: form.timeframe }).toString();
      const dsRes = await fetch(`/api/datasets?${q}`);
      const dsJson = await dsRes.json();
      const ds = Array.isArray(dsJson?.items) ? dsJson.items[0] : null;
      if (!ds) {
        alert('Dataset not found. Create it first in Datasets.');
      } else {
        const body = { from: form.start, to: form.end };
        const res = await fetch(`/api/datasets/${encodeURIComponent(ds.id)}/export`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        alert(JSON.stringify(json));
      }
    } finally { setLoading(false); }
  };
  return (
    <Card title="Export Parquet" loading={loading} onSubmit={onSubmit}>
      <FormGrid state={form} setState={setForm} fields={[ 'symbol','timeframe','start','end' ]} />
    </Card>
  );
}

function WindowsCard() {
  const [form, setForm] = useState({ symbol: 'BTC_USDT', timeframe: '1h', start: '2020-01-01T00:00:00Z', end: new Date().toISOString(), windowSize: 512, stride: 16, maskRatio: 0.15 });
  const [loading, setLoading] = useState(false);
  const onSubmit = async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ symbol: form.symbol, timeframe: form.timeframe }).toString();
      const dsRes = await fetch(`/api/datasets?${q}`);
      const dsJson = await dsRes.json();
      const ds = Array.isArray(dsJson?.items) ? dsJson.items[0] : null;
      if (!ds) {
        alert('Dataset not found. Create it first in Datasets.');
      } else {
        const body = { windowSize: form.windowSize, stride: form.stride, maskRatio: form.maskRatio };
        const res = await fetch(`/api/datasets/${encodeURIComponent(ds.id)}/windows`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        const json = await res.json();
        alert(JSON.stringify(json));
      }
    } finally { setLoading(false); }
  };
  return (
    <Card title="Build Windows (JSONL)" loading={loading} onSubmit={onSubmit}>
      <FormGrid state={form} setState={setForm} fields={[ 'symbol','timeframe','start','end','windowSize','stride','maskRatio' ]} />
    </Card>
  );
}

function TrainingCard() {
  const [form, setForm] = useState({
    symbol: 'BTC_USDT', timeframe: '1h', windowSize: 512, maskRatio: 0.15, epochs: 2, limit: 2000
  });
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<string[]>([]);
  useEffect(() => {
    const socket: Socket = io({ path: '/api/socketio' });
    const handler = (evt: any) => {
      const { phase, epoch, loss, message } = evt || {};
      const line = [
        new Date().toLocaleTimeString(),
        phase?.toUpperCase?.(),
        epoch ? `epoch=${epoch}` : undefined,
        Number.isFinite(loss) ? `loss=${Number(loss).toFixed(6)}` : undefined,
        message,
      ].filter(Boolean).join(' · ');
      setProgress((p) => [line, ...p].slice(0, 200));
    };
    socket.on('train:progress', handler);
    return () => {
      socket.off('train:progress', handler);
      socket.close();
    };
  }, []);
  const onSubmit = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/train', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      const json = await res.json();
      alert(JSON.stringify(json));
    } finally { setLoading(false); }
  };
  return (
    <Card title="Unsupervised Training" loading={loading} onSubmit={onSubmit}>
      <FormGrid state={form} setState={setForm} fields={[ 'symbol','timeframe','windowSize','maskRatio','epochs','limit' ]} />
      <div className="mt-3 max-h-48 overflow-auto border rounded p-2 text-xs font-mono bg-gray-50">
        {progress.length === 0 ? (
          <div className="text-gray-500">No progress yet. Start training to see updates…</div>
        ) : (
          <ul className="space-y-1">
            {progress.map((l, i) => (<li key={i}>{l}</li>))}
          </ul>
        )}
      </div>
    </Card>
  );
}

function SupervisedAgentsCard() {
  const [form, setForm] = useState({
    agentId: '',
    symbol: 'BTC_USDT',
    timeframe: '1h',
    lookback: 128,
    lookahead: 8,
    epochs: 6,
    batchSize: 64,
    limit: 4000,
  });
  const [loading, setLoading] = useState<'train' | 'predict' | null>(null);
  const train = async () => {
    if (!form.agentId) return alert('Enter agentId');
    setLoading('train');
    try {
      const res = await fetch(`/api/agents/${form.agentId}/train`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form)
      });
      const json = await res.json();
      alert(JSON.stringify(json));
    } finally { setLoading(null); }
  };
  const predict = async () => {
    if (!form.agentId) return alert('Enter agentId');
    setLoading('predict');
    try {
      const q = new URLSearchParams({ symbol: form.symbol, timeframe: form.timeframe, lookback: String(form.lookback) }).toString();
      const res = await fetch(`/api/agents/${form.agentId}/predict?${q}`);
      const json = await res.json();
      alert(JSON.stringify(json));
    } finally { setLoading(null); }
  };
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Supervised Agents</h2>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" onClick={train} disabled={loading=== 'train'}>
            {loading === 'train' ? 'Training…' : 'Train'}
          </button>
          <button className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50" onClick={predict} disabled={loading=== 'predict'}>
            {loading === 'predict' ? 'Predicting…' : 'Predict'}
          </button>
        </div>
      </div>
      <FormGrid state={form} setState={setForm} fields={[ 'agentId','symbol','timeframe','lookback','lookahead','epochs','batchSize','limit' ]} />
    </div>
  );
}

function FeedbackSuggestionsCard() {
  const [agentId, setAgentId] = useState('');
  const [strategyId, setStrategyId] = useState('');
  const [fb, setFb] = useState({ predictionId: '', tradeId: '', symbol: 'BTC_USDT', timeframe: '1h', result: 'sl', pnlPct: 0, reason: '' });
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selected, setSelected] = useState<Record<number, boolean>>({});
  const [loading, setLoading] = useState<'feedback'|'get'|'apply'|null>(null);

  const sendFeedback = async () => {
    if (!agentId) return alert('Enter agentId');
    if (!fb.predictionId && !fb.tradeId) return alert('Enter predictionId or tradeId');
    setLoading('feedback');
    try {
      const body: any = {
        predictionId: fb.predictionId || undefined,
        tradeId: fb.tradeId || undefined,
        outcome: { result: fb.result, pnlPct: Number(fb.pnlPct) },
        reason: fb.reason || undefined,
        symbol: fb.symbol,
        timeframe: fb.timeframe,
      };
      const res = await fetch(`/api/agents/${agentId}/feedback`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const json = await res.json();
      alert(JSON.stringify(json));
    } finally { setLoading(null); }
  };

  const getAgg = async () => {
    if (!agentId) return alert('Enter agentId');
    setLoading('get');
    try {
      const res = await fetch(`/api/agents/${agentId}/suggestions`);
      const json = await res.json();
      setSuggestions(json.suggestions || []);
      setSelected({});
    } finally { setLoading(null); }
  };

  const apply = async () => {
    if (!strategyId) return alert('Enter strategyId');
    const chosen = suggestions.filter((_, i) => selected[i]);
    if (chosen.length === 0) return alert('Select at least one suggestion');
    setLoading('apply');
    try {
      const res = await fetch(`/api/strategies/${strategyId}/apply-suggestions`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ suggestions: chosen })
      });
      const json = await res.json();
      alert(JSON.stringify(json));
    } finally { setLoading(null); }
  };

  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">Feedback & Suggestions</h2>
        <div className="flex gap-2">
          <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" onClick={sendFeedback} disabled={loading==='feedback'}>
            {loading==='feedback' ? 'Sending…' : 'Send Feedback'}
          </button>
          <button className="px-3 py-1 bg-indigo-600 text-white rounded disabled:opacity-50" onClick={getAgg} disabled={loading==='get'}>
            {loading==='get' ? 'Loading…' : 'Get Suggestions'}
          </button>
          <button className="px-3 py-1 bg-amber-600 text-white rounded disabled:opacity-50" onClick={apply} disabled={loading==='apply'}>
            {loading==='apply' ? 'Applying…' : 'Apply Selected'}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="text-sm">
          <div className="text-gray-600 mb-1">agentId</div>
          <input className="w-full border rounded px-2 py-1" value={agentId} onChange={(e)=>setAgentId(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">strategyId</div>
          <input className="w-full border rounded px-2 py-1" value={strategyId} onChange={(e)=>setStrategyId(e.target.value)} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">predictionId</div>
          <input className="w-full border rounded px-2 py-1" value={fb.predictionId} onChange={(e)=>setFb({...fb, predictionId: e.target.value})} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">tradeId</div>
          <input className="w-full border rounded px-2 py-1" value={fb.tradeId} onChange={(e)=>setFb({...fb, tradeId: e.target.value})} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">symbol</div>
          <input className="w-full border rounded px-2 py-1" value={fb.symbol} onChange={(e)=>setFb({...fb, symbol: e.target.value})} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">timeframe</div>
          <input className="w-full border rounded px-2 py-1" value={fb.timeframe} onChange={(e)=>setFb({...fb, timeframe: e.target.value})} />
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">result</div>
          <select className="w-full border rounded px-2 py-1" value={fb.result} onChange={(e)=>setFb({...fb, result: e.target.value as any})}>
            <option value="sl">sl</option>
            <option value="tp">tp</option>
            <option value="closed">closed</option>
          </select>
        </label>
        <label className="text-sm">
          <div className="text-gray-600 mb-1">pnlPct</div>
          <input className="w-full border rounded px-2 py-1" value={String(fb.pnlPct)} onChange={(e)=>setFb({...fb, pnlPct: Number(e.target.value)})} />
        </label>
        <label className="col-span-2 text-sm">
          <div className="text-gray-600 mb-1">reason</div>
          <input className="w-full border rounded px-2 py-1" value={fb.reason} onChange={(e)=>setFb({...fb, reason: e.target.value})} />
        </label>
      </div>

      {suggestions.length > 0 && (
        <div className="mt-4">
          <div className="text-sm font-medium mb-2">Suggestions</div>
          <div className="max-h-56 overflow-auto border rounded">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="p-2 text-left">Select</th>
                  <th className="p-2 text-left">Path</th>
                  <th className="p-2 text-left">Op</th>
                  <th className="p-2 text-left">Value</th>
                  <th className="p-2 text-left">Confidence</th>
                  <th className="p-2 text-left">Rationale</th>
                </tr>
              </thead>
              <tbody>
                {suggestions.map((s, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2"><input type="checkbox" checked={!!selected[i]} onChange={(e)=>setSelected({...selected, [i]: e.target.checked})} /></td>
                    <td className="p-2 font-mono">{s.path}</td>
                    <td className="p-2">{s.op}</td>
                    <td className="p-2">{s.value}</td>
                    <td className="p-2">{(s.confidence*100).toFixed(0)}%</td>
                    <td className="p-2">{s.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function CoverageCard() {
  const [items, setItems] = useState<any[]>([]);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ symbol: 'BTC_USDT', timeframe: '1h', exchangeId: 'binance', startDate: '2018-01-01T00:00:00Z', endDate: '2099-01-01T00:00:00Z' });
  const load = async () => {
    const res = await fetch('/api/datasets');
    const json = await res.json();
    setItems(json.items || []);
  };
  useEffect(() => { load(); }, []);
  const create = async () => {
    setCreating(true);
    try {
      await fetch('/api/datasets', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
      await load();
    } finally { setCreating(false); }
  };
  return (
    <Card title="Coverage Manifests" onSubmit={create} loading={creating}>
      <FormGrid state={form} setState={setForm} fields={[ 'symbol','timeframe','exchangeId','startDate','endDate' ]} />
      <div className="mt-3 flex gap-2">
        <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={create} disabled={creating}>Create Manifest</button>
      </div>
      <ul className="mt-4 space-y-2 max-h-64 overflow-auto">
        {items.map((m:any) => (
          <li key={m.id} className="border rounded p-2 text-sm">
            <div className="font-medium">{m.symbol} {m.timeframe} ({m.exchangeId})</div>
            <div>Range: {new Date(m.startDate).toISOString()} → {new Date(m.endDate).toISOString()}</div>
            <div>Status: {m.status} • Coverage: {m.coverage}% • Last: {m.lastCoveredTo ? new Date(m.lastCoveredTo).toISOString() : '—'}</div>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function Card({ title, children, onSubmit, loading }: { title: string; children?: React.ReactNode; onSubmit?: () => void; loading?: boolean }) {
  return (
    <div className="border rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-semibold">{title}</h2>
        {onSubmit && (
          <button className="px-3 py-1 bg-green-600 text-white rounded disabled:opacity-50" onClick={onSubmit} disabled={loading}>
            {loading ? 'Working…' : 'Run'}
          </button>
        )}
      </div>
      {children}
    </div>
  );
}

function FormGrid<T extends Record<string, any>>({ state, setState, fields }: { state: T; setState: (v: T) => void; fields: (keyof T)[] }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {fields.map((k) => (
        <label key={String(k)} className="text-sm">
          <div className="text-gray-600 mb-1">{String(k)}</div>
          <input
            className="w-full border rounded px-2 py-1"
            value={String(state[k] ?? '')}
            onChange={(e) => setState({ ...state, [k]: parseMaybeNumber(e.target.value) } as T)}
          />
        </label>
      ))}
    </div>
  );
}

function parseMaybeNumber(v: string) {
  if (v === '') return v;
  const n = Number(v);
  return Number.isFinite(n) && v.trim() !== '' && /^(\d|\.|-)+$/.test(v) ? n : v;
}
