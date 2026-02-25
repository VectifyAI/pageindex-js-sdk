# @pageindex/sdk

TypeScript SDK for [PageIndex](https://pageindex.ai) document processing.

Get your API Key at [dash.pageindex.ai](https://dash.pageindex.ai/api-keys). For full API documentation, see [docs.pageindex.ai](https://docs.pageindex.ai).

## Installation

```bash
pnpm add @pageindex/sdk
```

Requires Node.js >= 18.0.0

## Quick Start

```typescript
import { PageIndexClient } from '@pageindex/sdk';

const client = new PageIndexClient({
  apiKey: 'your-api-key',
});

// Upload a document
const { doc_id } = await client.api.submitDocument(fileBuffer, 'report.pdf');

// List recent documents
const recent = await client.tools.recentDocuments();

// Extract document structure
const structure = await client.tools.getDocumentStructure({ docName: 'report.pdf' });

// Extract page content
const pages = await client.tools.getPageContent({ docName: 'report.pdf', pages: '1-5' });
```

With explicit resource management (TypeScript 5.2+):

```typescript
await using client = new PageIndexClient({ apiKey: 'your-api-key' });
const recent = await client.tools.recentDocuments();
// connection closed automatically when scope exits
```

## API

### Client

```typescript
const client = new PageIndexClient({
  apiKey: 'your-api-key',
  apiUrl: 'https://api.pageindex.ai', // optional, this is the default
  folderScope: 'folder-id', // optional
});
```

### Tools

All methods via `client.tools`:

| Method                                                         | Description                         |
| -------------------------------------------------------------- | ----------------------------------- |
| `recentDocuments()`                                            | List recent uploads                 |
| `findRelevantDocuments({ nameOrDescriptionFilter?, limit? })`  | Search documents                    |
| `getDocument({ docName, waitForCompletion? })`                 | Get document details                |
| `getDocumentStructure({ docName, part?, waitForCompletion? })` | Extract document outline            |
| `getPageContent({ docName, pages, waitForCompletion? })`       | Extract page content                |
| `removeDocument({ docNames })`                                 | Delete documents                    |
| `createFolder({ name, description?, parentFolderId? })`        | Create folder                       |
| `listFolders({ parentFolderId? })`                             | List folders                        |

Page specification formats: `"5"`, `"3,7,10"`, `"5-10"`, `"1-3,7,9-12"`

### API

All methods via `client.api`:

```typescript
// Submit a document
const result = await client.api.submitDocument(file, 'document.pdf');

// Get document metadata
const doc = await client.api.getDocument(docId);

// Get document tree structure
const tree = await client.api.getTree(docId, { summary: true });

// Get OCR content
const ocr = await client.api.getOcr(docId, { format: 'page' });

// List all documents
const docs = await client.api.listDocuments({ limit: 20, offset: 0 });

// Delete a document
await client.api.deleteDocument(docId);

// Chat completions
const chat = await client.api.chatCompletions({
  messages: [{ role: 'user', content: 'Summarize the document' }],
  doc_id: docId,
});

// Process markdown
const md = await client.api.processMarkdown(file, 'notes.md');
```

### Error Handling

```typescript
import { PageIndexError } from '@pageindex/sdk';

try {
  await client.tools.getDocument({ docName: 'xxx' });
} catch (e) {
  if (e instanceof PageIndexError) {
    // e.code: 'NOT_FOUND' | 'UNAUTHORIZED' | 'RATE_LIMITED' | 'USAGE_LIMIT_REACHED' | ...
    // e.statusCode: HTTP status code
  }
}
```

## Documentation

- [API Quickstart](https://docs.pageindex.ai/quickstart) — Get started with document processing
- [API Endpoints](https://docs.pageindex.ai/endpoints) — Full REST API reference
- [Python SDK](https://docs.pageindex.ai/sdk) — Python client (tree, chat, OCR)
- [MCP Integration](https://docs.pageindex.ai/cookbook/mcp) — Use PageIndex with AI agents

## Examples

See [examples/chat-demo](./examples/chat-demo) for Next.js + AI SDK integration.

## License

MIT
