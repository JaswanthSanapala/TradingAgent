import { NextRequest } from "next/server";
import { CONFIG } from '@/lib/config';
import { classifyNews } from "@/lib/news-agent";

export interface NewsItem {
  id: string;
  title: string;
  link: string;
  publishedAt: string; // ISO string
  source: string;
  summary?: string;
  sectors: string[];
  assets: string[];
  impact: "High" | "Medium" | "Low";
}

// Build feeds from env: NEWS_FEEDS="Name|URL,Name|URL,..."
const ENV_FEEDS: { source: string; url: string }[] = CONFIG.NEWS_FEEDS.map((entry) => {
  const [name, url] = entry.split('|').map(s => s.trim());
  return { source: name || url, url };
}).filter(f => !!f.url);

const FEEDS: { source: string; url: string }[] = ENV_FEEDS;

// Very small RSS parser for common structures (title, link, pubDate, description)
function parseRSS(xml: string): Array<{
  title: string;
  link: string;
  pubDate?: string;
  description?: string;
}> {
  const items: Array<{ title: string; link: string; pubDate?: string; description?: string }> = [];
  const itemRegex = /<item[\s\S]*?<\/item>/g;
  const titleRegex = /<title><!\[CDATA\[(.*?)\]\]><\/title>|<title>([^<]+)<\/title>/i;
  const linkRegex = /<link>([^<]+)<\/link>/i;
  const pubDateRegex = /<pubDate>([^<]+)<\/pubDate>/i;
  const descRegex = /<description><!\[CDATA\[([\s\S]*?)\]\]><\/description>|<description>([\s\S]*?)<\/description>/i;

  const matches = xml.match(itemRegex) || [];
  for (const m of matches) {
    const titleMatch = m.match(titleRegex);
    const title = (titleMatch?.[1] || titleMatch?.[2] || "").trim();
    const linkMatch = m.match(linkRegex);
    const link = (linkMatch?.[1] || "").trim();
    const pubDateMatch = m.match(pubDateRegex);
    const pubDate = pubDateMatch?.[1]?.trim();
    const descMatch = m.match(descRegex);
    const description = (descMatch?.[1] || descMatch?.[2] || "").trim();
    if (title && link) items.push({ title, link, pubDate, description });
  }
  return items;
}

async function fetchWithTimeout(url: string, ms: number): Promise<string> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { "User-Agent": "Mozilla/5.0" } });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(id);
  }
}

export async function GET(_req: NextRequest) {
  const allItems: NewsItem[] = [];

  if (FEEDS.length === 0) {
    return new Response(
      JSON.stringify({ error: 'NEWS_FEEDS env is required; no feeds configured', items: [] }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }

  await Promise.all(
    FEEDS.map(async ({ source, url }) => {
      try {
        const xml = await fetchWithTimeout(url, 8000);
        const parsed = parseRSS(xml);
        for (const it of parsed) {
          const publishedAt = it.pubDate ? new Date(it.pubDate).toISOString() : new Date().toISOString();
          const meta = classifyNews({ title: it.title, summary: it.description });
          const id = `${source}:${it.link}`;
          allItems.push({
            id,
            title: it.title,
            link: it.link,
            publishedAt,
            source,
            summary: it.description,
            sectors: meta.sectors,
            assets: meta.assets,
            impact: meta.impact,
          });
        }
      } catch (e) {
        // Ignore individual feed errors but log once per feed
        console.warn("[news] feed fetch failed:", source, e);
      }
    })
  );

  // Deduplicate by link
  const map = new Map<string, NewsItem>();
  for (const n of allItems) {
    if (!map.has(n.link)) map.set(n.link, n);
  }

  // Sort by publishedAt desc
  const items = Array.from(map.values()).sort(
    (a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
  );

  return new Response(JSON.stringify({ items }), { headers: { "Content-Type": "application/json" } });
}
