# @pageindex/sdk

TypeScript SDK for [PageIndex](https://pageindex.ai) — upload documents, retrieve tree structures, and chat with your PDFs.

Get your API Key at [developer.pageindex.ai](https://developer.pageindex.ai/api-keys). Full docs at [docs.pageindex.ai/js-sdk](https://docs.pageindex.ai/js-sdk).

## Installation

```bash
npm install @pageindex/sdk
```

## Quick Start

```typescript
import { PageIndexClient } from '@pageindex/sdk';
import { readFileSync } from 'fs';

const client = new PageIndexClient({ apiKey: 'YOUR_API_KEY' });

// Upload a document
const file = readFileSync('./report.pdf');
const { doc_id } = await client.api.submitDocument(file, 'report.pdf');

// Get tree structure
const tree = await client.api.getTree(doc_id);

// Chat with the document
const response = await client.api.chatCompletions({
  messages: [{ role: 'user', content: 'What are the key findings?' }],
  doc_id,
});
console.log(response.choices[0].message.content);

// Stream a response
const stream = await client.api.chatCompletions({
  messages: [{ role: 'user', content: 'Summarize this document' }],
  doc_id,
  stream: true,
});
for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

## Configuration

```typescript
const client = new PageIndexClient({
  apiKey: 'YOUR_API_KEY', // Required
  apiUrl: 'https://...', // Default: https://api.pageindex.ai
  folderScope: 'folder-id', // Restrict all operations to a folder
});
```

## REST API (`client.api`)

| Method                                     | Description                                     |
| ------------------------------------------ | ----------------------------------------------- |
| `submitDocument(file, fileName, options?)` | Upload a document                               |
| `getTree(docId, options?)`                 | Get tree structure and processing status        |
| `getDocument(docId)`                       | Get document metadata                           |
| `listDocuments(options?)`                  | List documents (paginated)                      |
| `deleteDocument(docId)`                    | Delete a document                               |
| `createFolder(options)`                    | Create a folder                                 |
| `listFolders(options?)`                    | List folders                                    |
| `chatCompletions(params)`                  | Chat with documents (streaming & non-streaming) |

## Chat API

Supports non-streaming, streaming, multi-document, metadata streaming, and citations. See [Chat API docs](https://docs.pageindex.ai/js-sdk/chat) for full reference.

```typescript
// Multi-document chat
await client.api.chatCompletions({
  messages: [{ role: 'user', content: 'Compare these' }],
  doc_id: ['doc-1', 'doc-2'],
});

// Streaming with tool call metadata
const stream = await client.api.chatCompletions({
  messages,
  doc_id,
  stream: true,
  stream_metadata: true,
});
for await (const chunk of stream) {
  if (chunk.block_metadata?.type === 'mcp_tool_use_start') {
    console.log(`[Using: ${chunk.block_metadata.tool_name}]`);
  }
  process.stdout.write(chunk.choices[0]?.delta?.content ?? '');
}
```

## MCP Tools (`client.tools`)

Typed wrappers for PageIndex MCP — for building custom AI agent integrations. See [MCP Tools docs](https://docs.pageindex.ai/js-sdk/mcp-tools).

| Method                         | Description                                                          |
| ------------------------------ | -------------------------------------------------------------------- |
| `browseDocuments(params?)`     | A folder's sub-folders and documents, newest first                   |
| `listDocuments(params?)`       | Documents by metadata: filter, sort, aggregates, group by            |
| `listCollections()`            | The account's collections                                            |
| `getMetadataSchema(params?)`   | Metadata fields to filter on (folder, collection, or overview)       |
| `getFolderStructure(params?)`  | Folder hierarchy as a tree                                           |
| `searchDocuments(params)`      | Documents likely to answer `questions` (priced)                      |
| `getDocument(params)`          | Get document details by library path                                 |
| `getDocumentStructure(params)` | Extract document outline                                             |
| `searchPages(params)`          | Pages of one document that answer `questions` (priced)               |
| `getPageContent(params)`       | Read page content; picture pages come back in `pictures`             |
| `viewPages(params)`            | Up to 5 pages as pictures, with their text                           |
| `zoomPage(params)`             | A region of a page, rendered sharper                                 |
| `getDocumentImage(params)`     | Retrieve embedded image                                              |
| `removeDocument(params)`       | Delete documents (batch)                                             |

List first, search second: `browseDocuments()`, `listDocuments()` and `listCollections()` are free; `searchDocuments({ questions })` and `searchPages()` are charged by what they read, so use them when a listing cannot pick the documents or pages out.

```typescript
const { results } = await client.tools.searchDocuments({
  questions: ["What was Q3 revenue?"],
  topK: 3,
});
const doc = results[0]?.documents[0];
if (doc?.path) {
  const pages = await client.tools.searchPages({ path: doc.path, questions: ["Q3 revenue table"] });
}
```

Documents and folders are addressed by their **library path**: `"Research/2024/Q3 Report.pdf"` for a document (a root document is just its file name), `"Research/2024"` for a folder, `""` for the library root. Copy `path` verbatim from a `browseDocuments()`, `searchDocuments()` or `getDocument()` result:

```typescript
const { documents } = await client.tools.browseDocuments({ path: "Research" });
const doc = documents[0];
if (doc?.path) {
  const pages = await client.tools.getPageContent({ path: doc.path, pages: "1-3" });
}
```

The `docName` / `docNames` / `folderId` parameters are deprecated in favor of `path` / `paths`; the server still accepts them. Documents in a collection have no path, so `docName` stays their address.

**Deprecated** (still callable for backward compatibility, hidden from the live MCP `tools/list`):

| Method                           | Replacement                                          |
| -------------------------------- | ---------------------------------------------------- |
| `recentDocuments(params?)`       | `browseDocuments()`                                  |
| `listFolders(params?)`           | `getFolderStructure()`                               |
| `searchDocuments({ query })`     | `searchDocuments({ questions })` (keyword form)      |

## Error Handling

```typescript
import { PageIndexError } from '@pageindex/sdk';

try {
  await client.api.getDocument('invalid-id');
} catch (error) {
  if (error instanceof PageIndexError) {
    console.log(error.code); // "NOT_FOUND" | "UNAUTHORIZED" | "PLAN_REQUIRED" | ...
    console.log(error.message);
  }
}
```

## Examples

- [examples/chat-with-tools](./examples/chat-with-tools) — Next.js + AI SDK with MCP tools
- [examples/chat-completions](./examples/chat-completions) — Direct Chat Completions API usage

## Links

- [JS SDK Docs](https://docs.pageindex.ai/js-sdk) · [Python SDK](https://docs.pageindex.ai/sdk) · [MCP](https://docs.pageindex.ai/cookbook/mcp) · [REST API](https://docs.pageindex.ai/endpoints)
- [Discord](https://discord.gg/VuXuf29EUj) · [GitHub](https://github.com/VectifyAI/pageindex-js-sdk)

## License

MIT
