import { notFound } from "next/navigation";
import dynamic from "next/dynamic";

const pages = {
  features: dynamic(() => import("@/components/pages/features")),
  strategies: dynamic(() => import("@/components/pages/strategies")),
  "agent-training": dynamic(() => import("@/components/pages/agent_training")),
  backtest: dynamic(() => import("@/components/pages/backtest")),
  trades: dynamic(() => import("@/components/pages/trades")),
  brokers: dynamic(() => import("@/components/pages/brokers")),
  news: dynamic(() => import("@/components/pages/news")),
  "live-charts": dynamic(() => import("@/components/pages/live_charts")),
};

type PageProps = {
  params: Promise<{ page: string[] }>;
};

export default async function Page({ params }: PageProps) {
  const resolved = await params;
  const pageName = resolved.page[0] as keyof typeof pages;
  const PageComponent = pages[pageName];

  if (!PageComponent) {
    notFound();
  }

  return <PageComponent />;
}
