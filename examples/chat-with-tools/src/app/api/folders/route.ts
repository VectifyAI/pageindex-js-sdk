import { PageIndexApi, PageIndexError } from '@pageindex/sdk';
import { NextResponse } from 'next/server';
import { getConfigFromRequest, validatePageIndexConfig } from '@/lib/config';

function getApi(req: Request) {
  const config = getConfigFromRequest(req);
  const { valid, missing } = validatePageIndexConfig(config);

  if (!valid) {
    throw new Error(`Missing configuration: ${missing.join(', ')}`);
  }

  return new PageIndexApi({
    apiUrl: config.pageindexApiUrl,
    apiKey: config.pageindexApiKey,
  });
}

function handleError(error: unknown, defaultMessage: string) {
  if (error instanceof PageIndexError) {
    return NextResponse.json({ error: error.message, code: error.code }, { status: 500 });
  }
  if (error instanceof Error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ error: defaultMessage }, { status: 500 });
}

export async function GET(req: Request) {
  try {
    const api = getApi(req);

    const result = await api.listFolders({ parentFolderId: 'root' });

    return NextResponse.json({
      folders: result.folders,
    });
  } catch (error) {
    console.error('Failed to fetch folders:', error);
    return handleError(error, 'Failed to fetch folders');
  }
}
