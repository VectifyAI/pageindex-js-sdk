# @pageindex/sdk

TypeScript SDK for [PageIndex](https://pageindex.ai) — upload documents, retrieve tree structures, and chat with your PDFs.

Get your API Key at [dash.pageindex.ai](https://dash.pageindex.ai/api-keys). Full docs at [docs.pageindex.ai/js-sdk](https://docs.pageindex.ai/js-sdk).

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

| Method                           | Description                  |
| -------------------------------- | ---------------------------- |
| `recentDocuments(params?)`       | List recent uploads          |
| `findRelevantDocuments(params?)` | Search documents             |
| `getDocument(params)`            | Get document details by name |
| `getDocumentStructure(params)`   | Extract document outline     |
| `getPageContent(params)`         | Read page content            |
| `getDocumentImage(params)`       | Retrieve embedded image      |
| `removeDocument(params)`         | Delete documents (batch)     |
| `createFolder(params)`           | Create folder                |
| `listFolders(params?)`           | List folders                 |

## Error Handling

```typescript
import { PageIndexError } from '@pageindex/sdk';

try {
  await client.api.getDocument('invalid-id');
} catch (error) {
  if (error instanceof PageIndexError) {
    console.log(error.code); // "NOT_FOUND" | "UNAUTHORIZED" | "RATE_LIMITED" | ...
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
