'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Brain, Plus, Play, Pause, Trash2, Loader2, Database } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { Line, LineChart, XAxis, YAxis, CartesianGrid } from "recharts";
import { getSocket } from "@/lib/socket-client";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";

type Agent = {
  id: string;
  name: string;
  algorithm: string;
  version: number;
  performance: { progress?: number; status?: string } | null;
  strategyId: string;
  createdAt: string;
  strategy?: { id: string; name: string };
  trainingResults?: TrainingResult[];
};

type Strategy = {
  id: string;
  name: string;
};

type CoverageManifest = {
  id: string;
  symbol: string;
  timeframe: string;
  exchangeId: string;
  startDate: string;
  endDate: string;
  status: string;
  lastCoveredTo?: string | null;
};

type TrainingResult = {
  id: string;
  createdAt: string;
  episode: number;
  totalReward: number;
  steps: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  parameters: any;
  metrics: any;
};

export default function AgentTrainingPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [untrained, setUntrained] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [selectedStrategyId, setSelectedStrategyId] = useState<string>("");
  const pollRef = useRef<NodeJS.Timeout | null>(null);
  const [detailsAgent, setDetailsAgent] = useState<Agent | null>(null);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [datasetsOpen, setDatasetsOpen] = useState(false);
  const [datasets, setDatasets] = useState<CoverageManifest[]>([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [selectedDatasetIds, setSelectedDatasetIds] = useState<string[]>([]);
  const [dsForm, setDsForm] = useState({
    symbol: 'BTC_USDT',
    timeframe: '1h',
    exchangeId: 'binance',
    startDate: '2020-01-01T00:00:00Z',
    endDate: new Date().toISOString(),
  });
  const [dsResolving, setDsResolving] = useState(false);
  const [dsSuggestions, setDsSuggestions] = useState<Array<{ unified: string; storageSymbol: string; score: number }>>([]);

  const fetchData = async () => {
    try {
      const res = await fetch("/api/agents");
      const data = await res.json();
      if (data.success) {
        setAgents(data.agents || []);
        setUntrained(data.untrainedStrategies || []);
      } else {
        toast.error(data.error || "Failed to fetch agents");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to fetch agents");
    }
  };

  const loadDatasets = async () => {
    try {
      setDsLoading(true);
      const res = await fetch('/api/coverage/manifests');
      const json = await res.json();
      setDatasets(json.items || []);
    } catch (e) {
      console.error(e);
      toast.error('Failed to load datasets');
    } finally {
      setDsLoading(false);
    }
  };

  const resolveSymbol = async (raw: string, ex: string) => {
    if (!raw) return null;
    try {
      setDsResolving(true);
      const url = `/api/markets/resolve?symbol=${encodeURIComponent(raw)}&exchangeId=${encodeURIComponent(ex || 'binance')}`;
      const res = await fetch(url);
      const json = await res.json();
      if (json.ok && json.matched && json.storageSymbol) {
        setDsSuggestions([]);
        return json.storageSymbol as string;
      }
      if (json.ok && !json.matched && Array.isArray(json.suggestions)) {
        setDsSuggestions(json.suggestions);
      }
      return null;
    } catch (e) {
      console.error(e);
      return null;
    } finally {
      setDsResolving(false);
    }
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await fetchData();
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    const socket = getSocket();
    const handler = (evt: any) => {
      const { phase, epoch, loss, message } = evt || {};
      const line = [
        new Date().toLocaleTimeString(),
        phase ? String(phase).toUpperCase() : undefined,
        Number.isFinite(epoch) ? `epoch=${epoch}` : undefined,
        Number.isFinite(loss) ? `loss=${Number(loss).toFixed(6)}` : undefined,
        message,
      ].filter(Boolean).join(' · ');
      setLiveLogs((p) => [line, ...p].slice(0, 200));
    };
    socket.on('train:progress', handler);
    return () => { socket.off('train:progress', handler); };
  }, []);

  const hasActiveTraining = useMemo(
    () => agents.some(a => (a.performance?.status ?? "") === "training"),
    [agents]
  );

  useEffect(() => {
    if (hasActiveTraining) {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(fetchData, 2000);
    } else if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [hasActiveTraining]);

  const startTraining = async () => {
    if (!selectedStrategyId) {
      toast.error("Please select a strategy");
      return;
    }
    if (selectedDatasetIds.length === 0) {
      toast.error('Please select at least one dataset');
      return;
    }
    setCreating(true);
    try {
      const res = await fetch("/api/agents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ strategyId: selectedStrategyId }),
      });
      const data = await res.json();
      if (data.success) {
        const createdAgentId: string | undefined = data.agent?.id || data.agentId;
        let agentId = createdAgentId;
        if (!agentId) {
          await fetchData();
          const newly = agents.find(a => a.strategyId === selectedStrategyId);
          agentId = newly?.id;
        }
        if (!agentId) {
          toast.warning('Agent created but not found for training');
        } else {
          for (const dsId of selectedDatasetIds) {
            fetch(`/api/agents/${agentId}/rl/train`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ datasetId: dsId }),
            }).catch(() => {});
          }
        }
        toast.success("Agent created. Training started for selected dataset(s)");
        setIsDialogOpen(false);
        setSelectedStrategyId("");
        setSelectedDatasetIds([]);
        await fetchData();
      } else {
        toast.error(data.error || "Failed to start training");
      }
    } catch (e) {
      console.error(e);
      toast.error("Failed to start training");
    } finally {
      setCreating(false);
    }
  };

  const openDialog = async () => {
    await Promise.all([fetchData(), loadDatasets()]);
    setIsDialogOpen(true);
  };

  const sendAction = async (agentId: string, action: 'pause' | 'resume' | 'stop' | 'retry') => {
    try {
      const res = await fetch('/api/agents', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId, action })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Action failed');
      await fetchData();
      toast.success(`${action} successful`);
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Action failed');
    }
  };

  const deleteAgent = async (agentId: string) => {
    try {
      const confirmed = window.confirm('Delete this agent and its training results? This cannot be undone.');
      if (!confirmed) return;
      const res = await fetch('/api/agents', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Delete failed');
      toast.success('Agent deleted');
      await fetchData();
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || 'Delete failed');
    }
  };

  return (
    <Card className="mb-8">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Brain className="h-5 w-5" />
          <span>Agent Training</span>
        </CardTitle>
        <CardDescription>
          Train your AI agents, monitor their progress, and manage training pipelines.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="training">
          <div className="flex justify-between items-center mb-4">
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={openDialog} variant="outline" size="sm" className="flex items-center space-x-2">
                  <Plus className="h-4 w-4" />
                  <span>New Training</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[520px]">
                <DialogHeader>
                  <DialogTitle>Start New Training</DialogTitle>
                  <DialogDescription>Select a strategy and one or more datasets to begin training.</DialogDescription>
                </DialogHeader>
                <div className="space-y-3">
                  <Label>Strategy</Label>
                  <Select value={selectedStrategyId} onValueChange={setSelectedStrategyId}>
                    <SelectTrigger>
                      <SelectValue placeholder={untrained.length ? "Select a strategy" : "No untrained strategies"} />
                    </SelectTrigger>
                    <SelectContent>
                      {untrained.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <div className="pt-2">
                    <div className="mb-1 font-medium text-sm">Datasets</div>
                    <div className="max-h-40 overflow-auto border rounded p-2 space-y-2">
                      {dsLoading ? (
                        <div className="text-xs text-muted-foreground">Loading datasets…</div>
                      ) : datasets.length === 0 ? (
                        <div className="text-xs text-muted-foreground">No datasets yet. Create one from the Datasets button.</div>
                      ) : (
                        datasets.map(d => {
                          const checked = selectedDatasetIds.includes(d.id);
                          return (
                            <label key={d.id} className="flex items-center gap-2 text-xs cursor-pointer">
                              <Checkbox checked={checked} onCheckedChange={(v) => {
                                setSelectedDatasetIds(prev => v ? [...prev, d.id] : prev.filter(x => x !== d.id));
                              }} />
                              <span>{d.symbol} {d.timeframe} • {new Date(d.startDate).toISOString()} → {new Date(d.endDate).toISOString()}</span>
                            </label>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                  <Button variant="outline" onClick={() => setIsDialogOpen(false)} disabled={creating}>Cancel</Button>
                  <Button onClick={startTraining} disabled={creating || !selectedStrategyId}>
                    {creating ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}Start
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
            <Dialog open={datasetsOpen} onOpenChange={setDatasetsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="flex items-center space-x-2" onClick={() => { loadDatasets(); }}>
                  <Database className="h-4 w-4" />
                  <span>Datasets</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[720px]">
                <DialogHeader>
                  <DialogTitle>Datasets</DialogTitle>
                  <DialogDescription>Create and manage datasets. You can reuse datasets across strategies and agents.</DialogDescription>
                </DialogHeader>
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2 border rounded p-3">
                    <div className="font-medium text-sm">Create Dataset</div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="col-span-2">
                        <Label>Symbol</Label>
                        <Input
                          value={dsForm.symbol}
                          onChange={e => setDsForm({ ...dsForm, symbol: e.target.value })}
                          onBlur={async () => {
                            const corrected = await resolveSymbol(dsForm.symbol, dsForm.exchangeId);
                            if (corrected) {
                              // auto-correct and display corrected storage symbol (BTC_USDT)
                              setDsForm(f => ({ ...f, symbol: corrected }));
                              toast.success(`Symbol corrected to ${corrected}`);
                            } else if (dsForm.symbol) {
                              toast.message('Could not verify symbol', { description: 'Pick one of the suggestions below or adjust the input.' });
                            }
                          }}
                        />
                        {dsResolving && (
                          <div className="text-[11px] text-muted-foreground mt-1">Validating symbol…</div>
                        )}
                        {dsSuggestions.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                            {dsSuggestions.map(s => (
                              <button
                                key={s.storageSymbol}
                                type="button"
                                className="px-2 py-1 border rounded hover:bg-muted"
                                onClick={() => {
                                  setDsForm(f => ({ ...f, symbol: s.storageSymbol }));
                                  setDsSuggestions([]);
                                  toast.success(`Selected ${s.storageSymbol}`);
                                }}
                              >
                                {s.storageSymbol}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>Timeframe</Label>
                        <Input value={dsForm.timeframe} onChange={e => setDsForm({ ...dsForm, timeframe: e.target.value })} />
                      </div>
                      <div>
                        <Label>Exchange</Label>
                        <Input value={dsForm.exchangeId} onChange={e => setDsForm({ ...dsForm, exchangeId: e.target.value })} />
                      </div>
                      <div>
                        <Label>Start</Label>
                        <Input value={dsForm.startDate} onChange={e => setDsForm({ ...dsForm, startDate: e.target.value })} />
                      </div>
                      <div>
                        <Label>End</Label>
                        <Input value={dsForm.endDate} onChange={e => setDsForm({ ...dsForm, endDate: e.target.value })} />
                      </div>
                    </div>
                    <div className="flex justify-end">
                      <Button size="sm" onClick={async () => {
                        // ensure symbol is corrected before create
                        const corrected = await resolveSymbol(dsForm.symbol, dsForm.exchangeId);
                        const payload = { ...dsForm, symbol: corrected || dsForm.symbol };
                        try {
                          const res = await fetch('/api/coverage/manifests', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                          if (!res.ok) throw new Error('Create failed');
                          toast.success('Dataset created');
                          await loadDatasets();
                        } catch (e) {
                          console.error(e);
                          toast.error('Failed to create dataset');
                        }
                      }}>Create</Button>
                    </div>
                  </div>
                  <div className="space-y-2 border rounded p-3">
                    <div className="flex items-center justify-between">
                      <div className="font-medium text-sm">Existing Datasets</div>
                      <Button variant="outline" size="sm" onClick={loadDatasets} disabled={dsLoading}>{dsLoading ? 'Loading…' : 'Refresh'}</Button>
                    </div>
                    <div className="max-h-72 overflow-auto space-y-2 text-xs">
                      {datasets.length === 0 ? (
                        <div className="text-muted-foreground">No datasets found.</div>
                      ) : (
                        datasets.map(d => (
                          <div key={d.id} className="border rounded p-2">
                            <div className="flex items-center justify-between">
                              <div className="font-medium">{d.symbol} {d.timeframe} ({d.exchangeId})</div>
                              <Button
                                variant="destructive"
                                size="icon"
                                className="h-7 w-7"
                                onClick={async () => {
                                  const ok = window.confirm(`Delete dataset ${d.symbol} ${d.timeframe}? This cannot be undone.`);
                                  if (!ok) return;
                                  try {
                                    const res = await fetch(`/api/coverage/manifests?id=${encodeURIComponent(d.id)}`, { method: 'DELETE' });
                                    if (!res.ok) throw new Error('Delete failed');
                                    toast.success('Dataset deleted');
                                    await loadDatasets();
                                    // also deselect if it was selected
                                    setSelectedDatasetIds(prev => prev.filter(x => x !== d.id));
                                  } catch (e) {
                                    console.error(e);
                                    toast.error('Failed to delete dataset');
                                  }
                                }}
                                title="Delete dataset"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                            <div>Range: {new Date(d.startDate).toISOString()} → {new Date(d.endDate).toISOString()}</div>
                            <div>Status: {d.status} • Last: {d.lastCoveredTo ? new Date(d.lastCoveredTo).toISOString() : '—'}</div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
          <div className="mb-4 max-h-40 overflow-auto border rounded p-2 text-xs font-mono bg-muted/30">
            {liveLogs.length === 0 ? (
              <div className="text-muted-foreground">Live training logs will appear here…</div>
            ) : (
              <ul className="space-y-1">
                {liveLogs.map((l, i) => (<li key={i}>{l}</li>))}
              </ul>
            )}
          </div>
          <TabsContent value="training">
            {loading ? (
              <div className="flex items-center justify-center h-40"><Loader2 className="h-6 w-6 animate-spin" /></div>
            ) : agents.length === 0 ? (
              <div className="border rounded-lg p-4 text-center">
                <h4 className="font-semibold">No Agents Yet</h4>
                <p className="text-sm text-slate-600 dark:text-slate-300">Click "New Training" to start training a new agent.</p>
              </div>
            ) : (
              <div className="grid gap-4">
                {agents.map(agent => {
                  const status = agent.performance?.status || 'pending';
                  const canPause = status === 'training';
                  const canResume = status === 'paused';
                  const canRetry = status === 'failed' || status === 'stopped';
                  const latest = agent.trainingResults?.[0];
                  return (
                    <div key={agent.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-2">
                        <div>
                          <div className="font-semibold">{agent.name}</div>
                          <div className="text-xs text-muted-foreground">Strategy: {agent.strategy?.name || agent.strategyId} • Algo: {agent.algorithm}</div>
                        </div>
                        <div className="text-xs text-muted-foreground">v{agent.version}</div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Progress value={agent.performance?.progress || 0} className="w-full" />
                        <div className="text-xs w-28 text-right">{status} {agent.performance?.progress ?? 0}%</div>
                      </div>
                      <div className="flex flex-wrap gap-2 mt-3">
                        <Button size="sm" variant="outline" onClick={() => setDetailsAgent(agent)}>Details</Button>
                        <Button size="sm" variant="outline" disabled={!canPause} onClick={() => sendAction(agent.id, 'pause')}><Pause className="h-4 w-4 mr-1"/>Pause</Button>
                        <Button size="sm" variant="outline" disabled={!canResume} onClick={() => sendAction(agent.id, 'resume')}><Play className="h-4 w-4 mr-1"/>Resume</Button>
                        <Button size="sm" variant="outline" onClick={() => sendAction(agent.id, 'stop')}>Stop</Button>
                        <Button size="sm" onClick={() => sendAction(agent.id, 'retry')}>Retry</Button>
                        <Button size="sm" variant="destructive" onClick={() => deleteAgent(agent.id)}>
                          <Trash2 className="h-4 w-4 mr-1"/>Delete
                        </Button>
                      </div>
                      {latest && (
                        <div className="mt-3 text-xs text-muted-foreground">
                          Latest: Episode {latest.episode} • Reward {latest.totalReward.toFixed(2)} • WinRate {(latest.winRate*100).toFixed(1)}% • Sharpe {latest.sharpeRatio.toFixed(2)}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
      <Dialog open={!!detailsAgent} onOpenChange={(open) => !open && setDetailsAgent(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>Agent Details{detailsAgent ? ` — ${detailsAgent.name}` : ''}</DialogTitle>
            <DialogDescription>Latest training metrics and performance.</DialogDescription>
          </DialogHeader>
          {detailsAgent ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
                <div className="border rounded p-2">
                  <div className="text-muted-foreground">Status</div>
                  <div className="font-medium">{detailsAgent.performance?.status || 'pending'}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-muted-foreground">Progress</div>
                  <div className="font-medium">{detailsAgent.performance?.progress ?? 0}%</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-muted-foreground">Strategy</div>
                  <div className="font-medium">{detailsAgent.strategy?.name || detailsAgent.strategyId}</div>
                </div>
                <div className="border rounded p-2">
                  <div className="text-muted-foreground">Algo</div>
                  <div className="font-medium">{detailsAgent.algorithm} v{detailsAgent.version}</div>
                </div>
              </div>

              <div className="h-56">
                <ChartContainer
                  config={{ reward: { label: 'Total Reward', color: 'hsl(var(--primary))' } }}
                >
                  <LineChart data={(detailsAgent.trainingResults || []).map(r => ({
                    x: new Date(r.createdAt).toLocaleTimeString(),
                    reward: r.totalReward,
                  })).reverse()}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" hide={false} tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} width={40} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Line type="monotone" dataKey="reward" stroke="var(--color-reward)" dot={false} strokeWidth={2} />
                  </LineChart>
                </ChartContainer>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </Card>
  );
}
