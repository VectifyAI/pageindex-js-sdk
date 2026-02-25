# Migrating from @pageindex/mcp-sdk to @pageindex/sdk

## Why the rename?

`@pageindex/mcp-sdk` has evolved beyond MCP — it now provides both a REST API client and MCP tools. The new name `@pageindex/sdk` better reflects its scope as a general-purpose PageIndex SDK.

## Important: API endpoint

The SDK should **only** connect to `api.pageindex.ai` for programmatic access. Do **not** use `chat.pageindex.ai/mcp`, that endpoint is designed for Chat platform users (e.g. Claude Desktop, Cursor), not for programmatic SDK calls.

```typescript
const client = new PageIndexClient({
  apiKey: 'your-api-key',
  // apiUrl defaults to https://api.pageindex.ai — no need to set it
});
```

Get your API Key at [dash.pageindex.ai](https://dash.pageindex.ai).

## Step 1: Update dependency

```bash
pnpm remove @pageindex/mcp-sdk
pnpm add @pageindex/sdk
```

## Step 2: Update imports

Find and replace across your project:

```diff
- import { PageIndexClient } from '@pageindex/mcp-sdk';
+ import { PageIndexClient } from '@pageindex/sdk';

- import { PageIndexError } from '@pageindex/mcp-sdk';
+ import { PageIndexError } from '@pageindex/sdk';

- import type { GetDocumentResult } from '@pageindex/mcp-sdk';
+ import type { GetDocumentResult } from '@pageindex/sdk';
```

All exported types and classes remain identical — only the package name changed.

## Step 3 (optional): Simplify connection management

The new SDK auto-connects MCP on first tool call and auto-closes after 60 seconds of idle. You can remove explicit `connect()` / `close()` calls:

```diff
  const client = new PageIndexClient({ apiKey: 'your-api-key' });

- await client.connect();
  const docs = await client.tools.recentDocuments();
- await client.close();
```

If you prefer explicit cleanup, `await using` (TypeScript 5.2+) is supported:

```typescript
await using client = new PageIndexClient({ apiKey: 'your-api-key' });
const docs = await client.tools.recentDocuments();
// connection closed automatically when scope exits
```

The idle timeout is configurable:

```typescript
const client = new PageIndexClient({
  apiKey: 'your-api-key',
  idleTimeout: 30_000, // 30s, default is 60s, 0 to disable
});
```

> **Note:** `connect()`, `close()`, and `isConnected()` still work as before. Existing code using them will continue to function without changes.

## Summary

| | @pageindex/mcp-sdk | @pageindex/sdk |
|---|---|---|
| Package name | `@pageindex/mcp-sdk` | `@pageindex/sdk` |
| API surface | Same | Same |
| MCP connection | Manual `connect()` / `close()` | Auto-connect + idle auto-close |
| `await using` | Not supported | Supported |
| REST API | Same | Same |
