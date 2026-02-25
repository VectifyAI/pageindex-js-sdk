import { PageIndexClient, PageIndexError, type GetDocumentMetadataResponse } from '@pageindex/sdk';
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

export async function POST(req: Request) {
  try {
    const { docIds } = (await req.json()) as { docIds: string[] };

    if (!docIds || !Array.isArray(docIds) || docIds.length === 0) {
      return NextResponse.json({ error: 'docIds array is required' }, { status: 400 });
    }

    if (docIds.length > 10) {
      return NextResponse.json({ error: 'Maximum 10 documents allowed' }, { status: 400 });
    }

    const client = getClient(req);

    const results = await Promise.allSettled(
      docIds.map((docId) => client.api.getDocument(docId)),
    );

    const documents: GetDocumentMetadataResponse[] = [];
    const errors: string[] = [];

    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        documents.push(result.value);
      } else {
        errors.push(docIds[index]);
      }
    });

    if (documents.length === 0) {
      return NextResponse.json(
        { error: `Failed to fetch documents: ${errors.join(', ')}` },
        { status: 500 },
      );
    }

    return NextResponse.json({ documents, errors });
  } catch (error) {
    console.error('Failed to fetch document details:', error);
    if (error instanceof PageIndexError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
    }
    if (error instanceof Error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ error: 'Failed to fetch document details' }, { status: 500 });
  }
}
