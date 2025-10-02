import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { compileStrategy } from '@/lib/strategy-compiler';
import { validateSystemMarkdown } from '@/lib/strategy-loader';
import { promises as fs } from 'fs';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const strategies = await prisma.strategy.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    
    return NextResponse.json({ success: true, strategies });
  } catch (error) {
    console.error('Error fetching strategies:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch strategies' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  // Deprecated in favor of /api/strategies/upload (system-format markdown only)
  return new NextResponse(
    JSON.stringify({ success: false, error: 'Removed. Use POST /api/strategies/upload (system-format markdown only).' }),
    { status: 410, headers: { 'Content-Type': 'application/json' } }
  );
}

export async function PUT(request: NextRequest) {
  try {
    const formData = await request.formData();
    const id = formData.get('id') as string | null;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const name = (formData.get('name') as string) || undefined;
    const description = (formData.get('description') as string) || undefined;
    const file = formData.get('file') as File | null;
    const editedContent = (formData.get('fileContent') as string) || undefined;

    const existing = await prisma.strategy.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Strategy not found' }, { status: 404 });
    }

    // Start from existing parameters
    const parameters: any = { ...(existing.parameters as any) };

    // If new file provided, save and replace fileName + content
    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
      await mkdir(uploadsDir, { recursive: true });
      const timestamp = Date.now();
      const newName = `${timestamp}_${file.name}`;
      const filePath = path.join(uploadsDir, newName);
      await writeFile(filePath, buffer);
      parameters.fileName = newName;
      const ext = path.extname(file.name).toLowerCase();
      parameters.fileType = (file as any).type || (ext ? `text/${ext.slice(1)}` : null);
      parameters.fileContent = buffer.toString('utf-8');
    }

    // If edited content provided, prefer it (even if no new file)
    if (editedContent !== undefined) {
      parameters.fileContent = editedContent;
    }

    // Re-compile with latest name/description and content
    const finalName = name ?? existing.name;
    const finalDesc = description ?? existing.description ?? undefined;
    // Enforce system-format markdown only
    if (parameters.fileContent) {
      const valid = validateSystemMarkdown(parameters.fileContent as string);
      if (!valid.ok) {
        return NextResponse.json({ success: false, error: 'Invalid system markdown', details: valid.errors }, { status: 400 });
      }
    }
    const { ir, notes } = compileStrategy({
      name: finalName,
      description: finalDesc,
      fileName: parameters.fileName,
      fileContent: parameters.fileContent,
    });
    parameters.compiled = ir;
    parameters.compilerNotes = notes;

    const updated = await prisma.strategy.update({
      where: { id },
      data: {
        name,
        description,
        parameters,
      },
    });

    return NextResponse.json({ success: true, strategy: updated });
  } catch (error) {
    console.error('Error updating strategy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json().catch(() => null) as { id?: string } | null;
    const id = body?.id;
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    // Find strategy to get uploaded file info
    const existing = await prisma.strategy.findUnique({ where: { id } });
    if (existing) {
      const params: any = existing.parameters || {};
      const fileName: string | undefined = params.fileName;
      if (fileName) {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
        const filePath = path.join(uploadsDir, fileName);
        try {
          await fs.unlink(filePath);
        } catch {}
      }
    }

    await prisma.strategy.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete strategy' },
      { status: 500 }
    );
  }
}
