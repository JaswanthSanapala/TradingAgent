import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { reloadBroker } from '@/lib/broker';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const cfg = await prisma.apiConfiguration.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    return NextResponse.json({ success: true, config: cfg || null });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Failed to load config' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { provider, apiKey, apiSecret, sandbox, settings } = body as { provider?: string; apiKey?: string; apiSecret?: string; sandbox?: boolean; settings?: any };
    if (!provider) return NextResponse.json({ success: false, error: 'provider is required' }, { status: 400 });

    // Deactivate others and upsert this provider
    await prisma.$transaction(async (tx) => {
      await tx.apiConfiguration.updateMany({ data: { isActive: false } });
      const existing = await tx.apiConfiguration.findFirst({ where: { provider } });
      if (existing) {
        await tx.apiConfiguration.update({ where: { id: existing.id }, data: { apiKey, apiSecret, sandbox: sandbox ?? existing.sandbox, isActive: true, settings: settings ?? existing.settings } });
      } else {
        await tx.apiConfiguration.create({ data: { provider, apiKey, apiSecret, sandbox: sandbox ?? true, isActive: true, settings: settings ?? {} } });
      }
    });

    reloadBroker();
    const cfg = await prisma.apiConfiguration.findFirst({ where: { isActive: true }, orderBy: { updatedAt: 'desc' } });
    return NextResponse.json({ success: true, config: cfg });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ success: false, error: 'Failed to save config' }, { status: 500 });
  }
}
