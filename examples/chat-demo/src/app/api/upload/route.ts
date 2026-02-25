import { PageIndexClient, PageIndexError } from '@pageindex/sdk';
import { NextResponse } from 'next/server';
import { getConfigFromRequest, validatePageIndexConfig } from '@/lib/config';

function getClient(req: Request) {
  const config = getConfigFromRequest(req);
  const { valid, missing } = validatePageIndexConfig(config);

  if (!valid) {
    throw new Error(`Missing configuration: ${missing.join(', ')}`);
  }

  return new PageIndexClient({
    apiUrl: config.pageindexApiUrl,
    apiKey: config.pageindexApiKey,
    folderScope: config.folderScope,
  });
}

function handleError(error: unknown, defaultMessage: string) {
  if (error instanceof PageIndexError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.statusCode || 500 },
    );
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'file is required' }, { status: 400 });
    }

    const client = getClient(req);

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const result = await client.api.submitDocument(fileBuffer, file.name);

    return NextResponse.json({
      docId: result.doc_id,
    });
  } catch (error) {
    console.error('Failed to upload document:', error);
    return handleError(error, 'Failed to upload document');
  }
}
