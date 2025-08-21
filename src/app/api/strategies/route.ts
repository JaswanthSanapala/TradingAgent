import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import { compileStrategy } from '@/lib/strategy-compiler';

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
  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File | null;
    const editedContent = formData.get('fileContent') as string | null;
    
    if (!name) {
      return NextResponse.json(
        { success: false, error: 'Name is required' },
        { status: 400 }
      );
    }

    let fileName: string | null = null;
    let fileContent: string | null = null;

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
      await mkdir(uploadsDir, { recursive: true });
      
      // Generate unique filename
      const timestamp = Date.now();
      fileName = `${timestamp}_${file.name}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await writeFile(filePath, buffer);
      fileContent = buffer.toString('utf-8');
    }

    // If user provided edited content in the form, prefer that
    if (editedContent && editedContent.trim().length > 0) {
      fileContent = editedContent;
    }

    // Create default user if none exists (since no auth)
    let user = await prisma.user.findFirst();
    if (!user) {
      user = await prisma.user.create({
        data: {
          email: 'default@trading.ai',
          name: 'Default User',
        },
      });
    }

    // Compile strategy into IR for the agent to understand
    const { ir, notes } = compileStrategy({ name, description, fileName, fileContent });

    const data: any = {
      name,
      userId: user.id,
      parameters: {
        fileName: fileName,
        fileContent: fileContent,
        fileType: (file as any)?.type || null,
        compiled: ir,
        compilerNotes: notes,
      },
    };

    if (description) {
      data.description = description;
    }

    const strategy = await prisma.strategy.create({ data });

    return NextResponse.json({ success: true, strategy });
  } catch (error) {
    console.error('Error creating strategy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create strategy' },
      { status: 500 }
    );
  }
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
      parameters.fileType = (file as any).type || null;
      parameters.fileContent = buffer.toString('utf-8');
    }

    // If edited content provided, prefer it (even if no new file)
    if (editedContent !== undefined) {
      parameters.fileContent = editedContent;
    }

    // Re-compile with latest name/description and content
    const finalName = name ?? existing.name;
    const finalDesc = description ?? existing.description ?? undefined;
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
