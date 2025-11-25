import { compileStrategy } from '@lib/strategy/strategy-compiler';
import { parseSystemMarkdown,validateSystemMarkdown } from '@lib/strategy/strategy-loader';
import { mkdir,writeFile } from 'fs/promises';
import { NextRequest, NextResponse } from 'next/server';
import path from 'path';

import { prisma } from '@/lib/core/db';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const name = (formData.get('name') as string) || '';
    const description = (formData.get('description') as string) || '';
    const file = formData.get('file') as File | null;
    const editedContent = (formData.get('fileContent') as string) || '';

    if (!name) return NextResponse.json({ success: false, error: 'Name is required' }, { status: 400 });

    let fileName: string | null = null;
    let fileContent: string | null = null;

    if (file) {
      const ext = path.extname(file.name).toLowerCase();
      if (ext !== '.md') return NextResponse.json({ success: false, error: 'Only .md (system format) is accepted' }, { status: 400 });
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
      await mkdir(uploadsDir, { recursive: true });
      fileName = `${Date.now()}_${file.name}`;
      const filePath = path.join(uploadsDir, fileName);
      await writeFile(filePath, buffer);
      fileContent = buffer.toString('utf-8');
    }

    if (editedContent && editedContent.trim().length > 0) {
      fileContent = editedContent;
    }

    if (!fileContent) return NextResponse.json({ success: false, error: 'File content is required' }, { status: 400 });

    // Enforce system-format markdown only
    const valid = validateSystemMarkdown(fileContent);
    if (!valid.ok) return NextResponse.json({ success: false, error: 'Invalid system markdown', details: valid.errors }, { status: 400 });

    // Parse to spec (for metadata) and compile (for IR/code)
    const { spec, warnings } = parseSystemMarkdown(fileContent);
    const { ir, notes } = compileStrategy({ name, description, fileName, fileContent });

    // Create default user if none exists (since no auth)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({ data: { email: 'default@trading.ai', name: 'Default User' } });
    }

    const strategy = await prisma.strategy.create({
      data: {
        name,
        description,
        userId: user.id,
        parameters: {
          fileName,
          fileContent,
          fileType: 'text/markdown',
          compiled: ir,
          compilerNotes: notes,
          systemFormat: true,
          spec,
          warnings,
        },
      },
    });

    const createdAgent = await prisma.agent.create({
      data: {
        name: `${name} Agent`,
        algorithm: 'ppo',
        version: 1,
        parameters: {
          lr: 3e-4,
          gamma: 0.99,
          strategyIR: ir,
          strategyOrigin: ir.origin,
        },
        performance: { progress: 0, status: 'untrained' },
        strategyId: strategy.id,
        userId: user.id,
      },
    });

    return NextResponse.json({ success: true, strategy, agent: createdAgent });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error?.message || 'Upload failed' }, { status: 500 });
  }
}
