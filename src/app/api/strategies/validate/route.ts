import { compileStrategy } from '@lib/strategy/strategy-compiler';
import { parseSystemMarkdown,validateSystemMarkdown } from '@lib/strategy/strategy-loader';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    let content = '';
    let name = '';
    let description = '';

    const ct = request.headers.get('content-type') || '';
    if (ct.includes('application/json')) {
      const body = await request.json().catch(() => ({}));
      content = body.content || '';
      name = body.name || '';
      description = body.description || '';
    } else {
      const form = await request.formData();
      content = (form.get('fileContent') as string) || '';
      name = (form.get('name') as string) || '';
      description = (form.get('description') as string) || '';
    }

    if (!content || !content.trim()) {
      return NextResponse.json({ success: false, error: 'content is required' }, { status: 400 });
    }

    const valid = validateSystemMarkdown(content);
    if (!valid.ok) return NextResponse.json({ success: false, error: 'Invalid system markdown', details: valid.errors }, { status: 400 });

    const parsed = parseSystemMarkdown(content);
    const compiled = compileStrategy({ name, description, fileName: 'upload.md', fileContent: content });

    return NextResponse.json({ success: true, parsed, compiled });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e?.message || 'validate failed' }, { status: 500 });
  }
}
