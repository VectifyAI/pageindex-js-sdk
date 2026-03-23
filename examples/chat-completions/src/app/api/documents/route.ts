import { PageIndexApi, PageIndexError } from "@pageindex/sdk";
import { NextResponse } from "next/server";
import { getConfigFromRequest, validateConfig } from "@/lib/config";

export async function GET(req: Request) {
  const config = getConfigFromRequest(req);
  const { valid, missing } = validateConfig(config);

  if (!valid) {
    return NextResponse.json(
      { error: `Missing configuration: ${missing.join(", ")}` },
      { status: 400 },
    );
  }

  try {
    const api = new PageIndexApi({
      apiUrl: config.apiUrl,
      apiKey: config.apiKey,
    });

    const result = await api.listDocuments({ limit: 20 });
    return NextResponse.json({ docs: result.documents });
  } catch (error) {
    if (error instanceof PageIndexError) {
      return NextResponse.json(
        { error: error.message, code: error.code },
        { status: 500 },
      );
    }
    const message =
      error instanceof Error ? error.message : "Failed to fetch documents";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
