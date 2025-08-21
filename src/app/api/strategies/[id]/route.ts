import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeFile, mkdir, unlink } from 'fs/promises';
import path from 'path';

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const description = formData.get('description') as string;
    const file = formData.get('file') as File | null;
    
    if (!name || !description) {
      return NextResponse.json(
        { success: false, error: 'Name and description are required' },
        { status: 400 }
      );
    }

    const existingStrategy = await prisma.strategy.findUnique({
      where: { id: params.id },
    });

    if (!existingStrategy) {
      return NextResponse.json(
        { success: false, error: 'Strategy not found' },
        { status: 404 }
      );
    }

    let updateData: any = {
      name,
      description,
    };

    if (file) {
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      
      // Create uploads directory if it doesn't exist
      const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
      await mkdir(uploadsDir, { recursive: true });
      
      // Generate unique filename
      const timestamp = Date.now();
      const fileName = `${timestamp}_${file.name}`;
      const filePath = path.join(uploadsDir, fileName);
      
      await writeFile(filePath, buffer);
      const fileContent = buffer.toString('utf-8');

      // Delete old file if exists
      const oldParams = existingStrategy.parameters as any;
      if (oldParams?.filePath) {
        try {
          const oldFilePath = path.join(uploadsDir, oldParams.filePath);
          await unlink(oldFilePath);
        } catch (error) {
          console.warn('Could not delete old file:', error);
        }
      }

      updateData.parameters = {
        filePath: fileName,
        fileContent: fileContent,
        fileType: file.type,
        fileName: file.name,
      };
    }

    const strategy = await prisma.strategy.update({
      where: { id: params.id },
      data: updateData,
    });

    return NextResponse.json({ success: true, strategy });
  } catch (error) {
    console.error('Error updating strategy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to update strategy' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const strategy = await prisma.strategy.findUnique({
      where: { id: params.id },
    });

    if (!strategy) {
      return NextResponse.json(
        { success: false, error: 'Strategy not found' },
        { status: 404 }
      );
    }

    // Delete associated file if exists
    const strategyParams = strategy.parameters as any;
    if (strategyParams?.filePath) {
      try {
        const uploadsDir = path.join(process.cwd(), 'uploads', 'strategies');
        const filePath = path.join(uploadsDir, strategyParams.filePath);
        await unlink(filePath);
      } catch (error) {
        console.warn('Could not delete strategy file:', error);
      }
    }

    await prisma.strategy.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting strategy:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to delete strategy' },
      { status: 500 }
    );
  }
}
