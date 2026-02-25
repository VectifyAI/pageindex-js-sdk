# Migrating from @pageindex/mcp-sdk to @pageindex/sdk

## Why the rename?

`@pageindex/mcp-sdk` has evolved beyond MCP — it now provides both a REST API client and MCP tools. The new name `@pageindex/sdk` better reflects its scope as a general-purpose PageIndex SDK.

## Important: API endpoint

The SDK now connects to `api.pageindex.ai` by default for programmatic access. Do **not** use `chat.pageindex.ai/mcp` — that endpoint is for Chat platform users (e.g. Claude Desktop, Cursor).

Get your API Key at [dash.pageindex.ai](https://dash.pageindex.ai/api-keys).

## Step 1: Update dependency

```bash
pnpm remove @pageindex/mcp-sdk
pnpm add @pageindex/sdk
```

## Step 2: Update imports

```diff
- import { PageIndexClient } from '@pageindex/mcp-sdk';
+ import { PageIndexClient } from '@pageindex/sdk';
```

All exported types and classes remain available — only the package name changed.

## Step 3: Update client configuration

`mcpToken` has been renamed to `apiKey`, and `apiUrl` is now optional (defaults to `https://api.pageindex.ai`):

```diff
  const client = new PageIndexClient({
-   apiUrl: 'https://chat.pageindex.ai',
-   mcpToken: 'your-mcp-token',
+   apiKey: 'your-api-key',
  });
```

If you need a custom endpoint, `apiUrl` is still available as an optional parameter.

## Step 4: Replace removed tools

`processDocument()` and `uploadDocument()` have been removed from `client.tools`. Use the new REST API client (`client.api`) instead:

**Process document from URL:**

```diff
- const result = await client.tools.processDocument({ url: 'https://...' });
+ // Use submitDocument with a fetched file instead
+ const response = await fetch('https://...');
+ const buffer = Buffer.from(await response.arrayBuffer());
+ const result = await client.api.submitDocument(buffer, 'document.pdf');
```

**Upload document:**

```diff
- const result = await client.tools.uploadDocument({
-   fileName: 'report.pdf',
-   fileType: 'application/pdf',
-   fileContent: buffer,
- });
+ const result = await client.api.submitDocument(buffer, 'report.pdf');
```

The related types (`UploadDocumentParams`, `UploadDocumentResult`, `UploadPhase`, `ProcessDocumentParams`, `ProcessDocumentResult`) have also been removed.

## Step 5 (optional): Simplify connection management

The SDK now auto-connects on first tool call and auto-closes after 60 seconds of idle. You can remove explicit `connect()` / `close()` calls:

```diff
  const client = new PageIndexClient({ apiKey: 'your-api-key' });

- await client.connect();
  const docs = await client.tools.recentDocuments();
- await client.close();
```

The idle timeout is configurable:

```typescript
const client = new PageIndexClient({
  apiKey: 'your-api-key',
  idleTimeout: 30_000, // 30s, default is 60s, 0 to disable
});
```

`await using` (TypeScript 5.2+) is also supported for explicit resource management:

```typescript
await using client = new PageIndexClient({ apiKey: 'your-api-key' });
const docs = await client.tools.recentDocuments();
// connection closed automatically when scope exits
```

> **Note:** `connect()`, `close()`, and `isConnected()` still work. Existing code using them will continue to function.

## Step 6 (optional): Use the new REST API client

The new `client.api` provides direct REST API access for document management:

```typescript
const client = new PageIndexClient({ apiKey: 'your-api-key' });

// Upload and process a document
const { doc_id } = await client.api.submitDocument(file, 'report.pdf');

// Query document data
const metadata = await client.api.getDocument(docId);
const tree = await client.api.getTree(docId, { summary: true });
const ocr = await client.api.getOcr(docId, { format: 'page' });

// List and delete
const docs = await client.api.listDocuments({ limit: 20, offset: 0 });
await client.api.deleteDocument(docId);

// Chat completions
const chat = await client.api.chatCompletions({
  messages: [{ role: 'user', content: 'Summarize the document' }],
  doc_id: docId,
});
```

## Step 7 (optional): Update error handling

`PageIndexError` now includes `statusCode` and three new error codes:

```diff
  if (e instanceof PageIndexError) {
-   // e.code: 'NOT_FOUND' | 'USAGE_LIMIT_REACHED' | 'INVALID_INPUT' | 'INTERNAL_ERROR'
+   // e.code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'SERVICE_UNAVAILABLE' | 'USAGE_LIMIT_REACHED' | 'INVALID_INPUT' | 'INTERNAL_ERROR'
+   // e.statusCode: HTTP status code (401, 404, 429, 503, etc.)
  }
```

## Summary

| | @pageindex/mcp-sdk | @pageindex/sdk |
|---|---|---|
| Package name | `@pageindex/mcp-sdk` | `@pageindex/sdk` |
| Auth config | `mcpToken` (required), `apiUrl` (required) | `apiKey` (required), `apiUrl` (optional, defaults to `api.pageindex.ai`) |
| MCP tools | `processDocument`, `uploadDocument`, + query tools | Query tools only (`recentDocuments`, `getDocument`, etc.) |
| REST API | — | `client.api` with `submitDocument`, `getTree`, `getOcr`, `chatCompletions`, etc. |
| MCP connection | Manual `connect()` / `close()` | Auto-connect + idle auto-close (60s default) |
| `await using` | Not supported | Supported |
| Error codes | 4 codes | 7 codes + `statusCode` field |
