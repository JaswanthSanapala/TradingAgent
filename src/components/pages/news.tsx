'use client'

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Newspaper, RotateCcw } from "lucide-react";

export default function NewsPage() {
  return <NewsPageImpl />;
}

import React from "react";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { differenceInMinutes, format } from "date-fns";

type Impact = "High" | "Medium" | "Low";

type NewsItem = {
  id: string;
  title: string;
  link: string;
  publishedAt: string;
  source: string;
  summary?: string;
  sectors: string[];
  assets: string[];
  impact: Impact;
};

function impactColor(impact: Impact) {
  switch (impact) {
    case "High":
      return "bg-red-600 hover:bg-red-600 text-white";
    case "Medium":
      return "bg-amber-500 hover:bg-amber-500 text-white";
    default:
      return "bg-slate-500 hover:bg-slate-500 text-white";
  }
}

function NewsPageImpl() {
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [sectorFilter, setSectorFilter] = React.useState<string>("All");
  const [impactFilter, setImpactFilter] = React.useState<Impact | "All">("All");
  const [assetFilter, setAssetFilter] = React.useState<string>("All");
  const PAGE_SIZE = 20;
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const sentinelRef = React.useRef<HTMLDivElement | null>(null);

  const fetchNews = React.useCallback(async () => {
    let mounted = true;
    try {
      setLoading(true);
      setError(null);
      const res = await fetch("/api/news", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: { items: NewsItem[] } = await res.json();
      const sorted = [...data.items].sort(
        (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      if (mounted) setItems(sorted);
    } catch (e: any) {
      if (mounted) setError(e?.message ?? "Failed to load news");
    } finally {
      if (mounted) setLoading(false);
    }
    return () => {
      mounted = false;
    };
  }, []);

  React.useEffect(() => {
    const cleanup = fetchNews();
    return () => {
      // in case fetchNews returned a cleanup
      if (typeof cleanup === "function") (cleanup as any)();
    };
  }, [fetchNews]);

  const sectors = React.useMemo(() => {
    const s = new Set<string>();
    items.forEach((n) => n.sectors.forEach((x) => s.add(x)));
    return ["All", ...Array.from(s).sort()];
  }, [items]);

  const assets = React.useMemo(() => {
    const a = new Set<string>();
    items.forEach((n) => n.assets.forEach((x) => a.add(x)));
    return ["All", ...Array.from(a).sort()];
  }, [items]);

  const filtered = React.useMemo(() => {
    return items.filter((n) => {
      const sectorOk = sectorFilter === "All" || n.sectors.includes(sectorFilter);
      const impactOk = impactFilter === "All" || n.impact === impactFilter;
      const assetOk = assetFilter === "All" || n.assets.includes(assetFilter);
      return sectorOk && impactOk && assetOk;
    });
  }, [items, sectorFilter, impactFilter, assetFilter]);

  // Reset pagination when filters change
  React.useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [sectorFilter, impactFilter, assetFilter]);

  // Infinite scroll observer
  React.useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      const first = entries[0];
      if (first.isIntersecting) {
        setVisibleCount((c) => Math.min(c + PAGE_SIZE, filtered.length));
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, [filtered.length]);

  return (
    <div className="space-y-4">
      <Card className="mb-2">
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Newspaper className="h-5 w-5" />
            <span>News</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex flex-col space-y-2">
              <span className="text-xs text-slate-500">Sector</span>
              <Select value={sectorFilter} onValueChange={setSectorFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-2">
              <span className="text-xs text-slate-500">Impact</span>
              <Select value={impactFilter} onValueChange={(v) => setImpactFilter(v as any)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {(["All", "High", "Medium", "Low"] as const).map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex flex-col space-y-2">
              <span className="text-xs text-slate-500">Asset</span>
              <Select value={assetFilter} onValueChange={setAssetFilter}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="All" />
                </SelectTrigger>
                <SelectContent>
                  {assets.map((a) => (
                    <SelectItem key={a} value={a}>
                      {a}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end justify-between md:justify-end gap-3">
              <span className="text-sm text-slate-500">
                Showing {filtered.length} of {items.length}
              </span>
              <Button variant="outline" size="sm" onClick={() => fetchNews()} disabled={loading} title="Refresh news">
                <RotateCcw className={`h-4 w-4 mr-1 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Refreshing…' : 'Refresh'}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {loading && (
        <Card>
          <CardContent className="py-6 text-slate-500">Loading latest news…</CardContent>
        </Card>
      )}
      {error && (
        <Card>
          <CardContent className="py-6 text-red-600">{error}</CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {filtered.slice(0, visibleCount).map((n) => (
          <Card key={n.id} className="">
            <CardHeader className="py-4">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <a
                  href={n.link}
                  target="_blank"
                  rel="noreferrer"
                  className="text-base md:text-lg font-semibold hover:underline"
                >
                  {n.title}
                </a>
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <span>{n.source}</span>
                  <Separator orientation="vertical" className="h-4" />
                  <span>{formatNewsTime(n.publishedAt)}</span>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {n.summary && (
                <p className="text-sm text-slate-600 dark:text-slate-300 line-clamp-3">{stripHtml(n.summary)}</p>
              )}
              <div className="flex flex-wrap gap-2 items-center">
                <Badge className={impactColor(n.impact)}>Impact: {n.impact}</Badge>
                {n.sectors.map((s) => (
                  <Badge key={s} variant="secondary">
                    {s}
                  </Badge>
                ))}
                {n.assets.slice(0, 5).map((a) => (
                  <Badge key={a} variant="outline">
                    {a}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>
        ))}
        {/* Sentinel for infinite scroll */}
        <div ref={sentinelRef} />
      </div>
    </div>
  );
}

function stripHtml(html: string) {
  if (!html) return "";
  return html.replace(/<[^>]*>/g, "").replace(/&[^;]+;/g, " ").trim();
}

function formatNewsTime(publishedAt: string) {
  const d = new Date(publishedAt);
  if (isNaN(d.getTime())) return "";
  const now = new Date();
  const mins = differenceInMinutes(now, d);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} minutes ago`;
  return format(d, "HH:mm, yyyy-MM-dd");
}
