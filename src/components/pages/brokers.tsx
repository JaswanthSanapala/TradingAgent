"use client";
import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, ArrowDownRight, Banknote, Plus, Users } from "lucide-react";

type BrokerName = "Mock" | "Zerodha" | "Upstox" | "Angel One" | "Dhan" | "Fyers";

type BrokerConnection = {
  id: string;
  broker: BrokerName;
  clientId: string;
  maskedKey?: string;
  accounts: BrokerAccount[];
  createdAt: number;
};

type BrokerAccount = {
  accountId: string;
  displayName: string;
  currency: string;
  balance: number;
  positions: Position[];
  trades: Trade[];
};

type Position = {
  symbol: string;
  qty: number;
  avgPrice: number;
  lastPrice: number;
};

type Trade = {
  id: string;
  time: number;
  symbol: string;
  side: "BUY" | "SELL";
  qty: number;
  price: number;
};

const STORAGE_KEY = "atp_broker_connections_v1";

function loadConnections(): BrokerConnection[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as BrokerConnection[]) : [];
  } catch {
    return [];
  }
}

function saveConnections(conns: BrokerConnection[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(conns));
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function genId(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function makeMockData(broker: BrokerName, clientId: string): BrokerConnection {
  const balance = Math.round(rand(25000, 150000));
  const symbols = ["RELIANCE", "TCS", "INFY", "HDFCBANK", "ICICIBANK", "SBIN"];

  const positions: Position[] = symbols.slice(0, 3).map((s) => {
    const avg = rand(100, 2500);
    const last = avg * rand(0.95, 1.05);
    return { symbol: s, qty: Math.round(rand(1, 30)), avgPrice: Number(avg.toFixed(2)), lastPrice: Number(last.toFixed(2)) };
  });

  const trades: Trade[] = Array.from({ length: 8 }).map(() => {
    const s = symbols[Math.floor(rand(0, symbols.length))];
    const price = rand(100, 3000);
    return {
      id: genId("trd"),
      time: Date.now() - Math.floor(rand(0, 1000 * 60 * 60 * 24)),
      symbol: s,
      side: Math.random() > 0.5 ? "BUY" : "SELL",
      qty: Math.round(rand(1, 50)),
      price: Number(price.toFixed(2)),
    };
  });

  const account: BrokerAccount = {
    accountId: genId("acc"),
    displayName: `${broker} • ${clientId}`,
    currency: "INR",
    balance,
    positions,
    trades,
  };

  return {
    id: genId("conn"),
    broker,
    clientId,
    maskedKey: "****",
    accounts: [account],
    createdAt: Date.now(),
  };
}

export default function BrokersPage() {
  const [connections, setConnections] = useState<BrokerConnection[]>([]);
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);

  // Form state
  const [broker, setBroker] = useState<BrokerName>("Mock");
  const [clientId, setClientId] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [accessToken, setAccessToken] = useState("");

  useEffect(() => {
    setConnections(loadConnections());
  }, []);

  useEffect(() => {
    saveConnections(connections);
  }, [connections]);

  // Simulated live PnL stream (per render)
  const totalBalance = useMemo(
    () =>
      connections.reduce((sum, c) => sum + c.accounts.reduce((s, a) => s + a.balance, 0), 0),
    [connections]
  );
  const [livePnl, setLivePnl] = useState(0);
  useEffect(() => {
    const t = setInterval(() => {
      // small random walk
      setLivePnl((p) => Math.max(-totalBalance * 0.05, Math.min(totalBalance * 0.05, p + rand(-250, 250))));
    }, 1200);
    return () => clearInterval(t);
  }, [totalBalance]);

  function handleAdd() {
    setAdding(true);
    // For now we create mock data locally
    setTimeout(() => {
      const conn = makeMockData(broker, clientId || "client");
      setConnections((prev) => [conn, ...prev]);
      // reset
      setClientId("");
      setApiKey("");
      setApiSecret("");
      setAccessToken("");
      setAdding(false);
      setOpen(false);
    }, 600);
  }

  function removeConnection(id: string) {
    setConnections((prev) => prev.filter((c) => c.id !== id));
  }

  return (
    <div className="space-y-6">
      <Card className="mb-2">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            <span>Brokers</span>
          </CardTitle>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" /> Add broker
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Connect a broker</DialogTitle>
              </DialogHeader>
              <div className="grid gap-3 py-2">
                <div className="grid gap-1">
                  <Label>Broker</Label>
                  <Select value={broker} onValueChange={(v) => setBroker(v as BrokerName)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select broker" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Mock">Mock</SelectItem>
                      <SelectItem value="Zerodha">Zerodha</SelectItem>
                      <SelectItem value="Upstox">Upstox</SelectItem>
                      <SelectItem value="Angel One">Angel One</SelectItem>
                      <SelectItem value="Dhan">Dhan</SelectItem>
                      <SelectItem value="Fyers">Fyers</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1">
                  <Label>Client ID</Label>
                  <Input value={clientId} onChange={(e) => setClientId(e.target.value)} placeholder="e.g. AB1234" />
                </div>
                <Separator />
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="grid gap-1">
                    <Label>API Key</Label>
                    <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="••••••" />
                  </div>
                  <div className="grid gap-1">
                    <Label>API Secret</Label>
                    <Input value={apiSecret} onChange={(e) => setApiSecret(e.target.value)} placeholder="••••••" />
                  </div>
                </div>
                <div className="grid gap-1">
                  <Label>Access Token (if required)</Label>
                  <Input value={accessToken} onChange={(e) => setAccessToken(e.target.value)} placeholder="optional" />
                </div>
              </div>
              <DialogFooter>
                <Button disabled={adding || !broker || !clientId} onClick={handleAdd}>
                  {adding ? "Connecting…" : "Connect"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border p-4">
              <div className="text-xs text-slate-500">Total balance</div>
              <div className="mt-1 flex items-center gap-2 text-2xl font-semibold">
                <Banknote className="h-5 w-5 text-emerald-500" />
                ₹ {totalBalance.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-xs text-slate-500">Live PnL (simulated)</div>
              <div className={`mt-1 flex items-center gap-2 text-2xl font-semibold ${livePnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                {livePnl >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
                ₹ {Math.abs(livePnl).toFixed(0)}
              </div>
            </div>
            <div className="rounded-md border p-4">
              <div className="text-xs text-slate-500">Connections</div>
              <div className="mt-1 text-2xl font-semibold">{connections.length}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {connections.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-slate-600 dark:text-slate-300">
            No broker connected yet. Click "Add broker" to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {connections.map((conn) => (
            <Card key={conn.id}>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <span className="font-semibold">{conn.broker}</span>
                  <Badge variant="secondary">{conn.clientId}</Badge>
                  <span className="text-xs text-slate-500">{new Date(conn.createdAt).toLocaleString()}</span>
                </CardTitle>
                <Button variant="outline" size="sm" onClick={() => removeConnection(conn.id)}>
                  Disconnect
                </Button>
              </CardHeader>
              <CardContent>
                {conn.accounts.map((acc) => {
                  const mtm = acc.positions.reduce((p, x) => p + (x.lastPrice - x.avgPrice) * x.qty, 0);
                  return (
                    <div key={acc.accountId} className="space-y-4">
                      <div className="grid gap-4 md:grid-cols-3">
                        <div className="rounded-md border p-4">
                          <div className="text-xs text-slate-500">Account</div>
                          <div className="mt-1 font-medium">{acc.displayName}</div>
                        </div>
                        <div className="rounded-md border p-4">
                          <div className="text-xs text-slate-500">Balance</div>
                          <div className="mt-1 text-xl font-semibold">₹ {acc.balance.toLocaleString("en-IN")}</div>
                        </div>
                        <div className="rounded-md border p-4">
                          <div className="text-xs text-slate-500">MTM</div>
                          <div className={`mt-1 text-xl font-semibold ${mtm >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                            ₹ {mtm.toFixed(0)}
                          </div>
                        </div>
                      </div>

                      <Tabs defaultValue="positions">
                        <TabsList>
                          <TabsTrigger value="positions">Positions</TabsTrigger>
                          <TabsTrigger value="trades">Recent Trades</TabsTrigger>
                        </TabsList>

                        <TabsContent value="positions">
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Symbol</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Avg</TableHead>
                                  <TableHead className="text-right">Last</TableHead>
                                  <TableHead className="text-right">P/L</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {acc.positions.map((p) => {
                                  const pnl = (p.lastPrice - p.avgPrice) * p.qty;
                                  return (
                                    <TableRow key={p.symbol}>
                                      <TableCell className="font-medium">{p.symbol}</TableCell>
                                      <TableCell className="text-right">{p.qty}</TableCell>
                                      <TableCell className="text-right">{p.avgPrice.toFixed(2)}</TableCell>
                                      <TableCell className="text-right">{p.lastPrice.toFixed(2)}</TableCell>
                                      <TableCell className={`text-right ${pnl >= 0 ? "text-emerald-600" : "text-red-600"}`}>
                                        {pnl.toFixed(2)}
                                      </TableCell>
                                    </TableRow>
                                  );
                                })}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>

                        <TabsContent value="trades">
                          <div className="rounded-md border">
                            <Table>
                              <TableHeader>
                                <TableRow>
                                  <TableHead>Time</TableHead>
                                  <TableHead>Symbol</TableHead>
                                  <TableHead>Side</TableHead>
                                  <TableHead className="text-right">Qty</TableHead>
                                  <TableHead className="text-right">Price</TableHead>
                                </TableRow>
                              </TableHeader>
                              <TableBody>
                                {acc.trades.map((t) => (
                                  <TableRow key={t.id}>
                                    <TableCell>{new Date(t.time).toLocaleString()}</TableCell>
                                    <TableCell className="font-medium">{t.symbol}</TableCell>
                                    <TableCell>
                                      <Badge variant={t.side === "BUY" ? "default" : "destructive"}>{t.side}</Badge>
                                    </TableCell>
                                    <TableCell className="text-right">{t.qty}</TableCell>
                                    <TableCell className="text-right">{t.price.toFixed(2)}</TableCell>
                                  </TableRow>
                                ))}
                              </TableBody>
                            </Table>
                          </div>
                        </TabsContent>
                      </Tabs>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
