# @pageindex/sdk

TypeScript SDK for [PageIndex](https://pageindex.ai). Upload documents, retrieve tree structures, and chat with your PDFs. Find the pages that answer a question (Page Search), and extract JSON from a PDF (Page Extract).

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
  apiKey: 'YOUR_API_KEY', // Default: the PAGEINDEX_API_KEY environment variable
  apiUrl: 'https://...', // Default: https://api.pageindex.ai
  folderScope: 'folder-id', // Restrict all operations to a folder
});
```

If you do not pass `apiKey`, the client reads `PAGEINDEX_API_KEY`. If that variable is not set, it reads `PAGEINDEX_SEARCH_API_KEY`, then `PAGEINDEX_EXTRACT_API_KEY`.

## REST API (`client.api`)

| Method                                     | Description                                     |
| ------------------------------------------ | ----------------------------------------------- |
| `submitDocument(file, fileName, options?)` | Upload a document                               |
| `waitDocument(docId, options?)`            | Wait until a document's processing is done      |
| `getTree(docId, options?)`                 | Get tree structure and processing status        |
| `buildOutlineIndex(docId)`                 | Build a missing outline index                   |
| `getDocument(docId)`                       | Get document metadata                           |
| `listDocuments(options?)`                  | List documents (paginated)                      |
| `deleteDocument(docId)`                    | Delete a document                               |
| `createFolder(options)`                    | Create a folder                                 |
| `listFolders(options?)`                    | List folders                                    |
| `listCollections()`                        | List collections                                |
| `createCollection(options)`                | Create a collection                             |
| `deleteCollection(collectionId)`           | Delete a collection and its documents           |
| `searchPages(docId, options)`              | Judge one document's pages against questions    |
| `searchDocuments(options)`                 | Judge documents against questions               |
| `createExtract(options)`                   | Start an extract job                            |
| `getExtract(jobId)`                        | Get an extract job and its result               |
| `listExtracts(options?)`                   | List extract jobs                               |
| `cancelExtract(jobId)`                     | Cancel an extract job                           |
| `deleteExtract(jobId)`                     | Delete an extract job                           |
| `chatCompletions(params)`                  | Chat with documents (streaming & non-streaming) |

`submitDocument` takes `{ index: false }` to store the pages and build no outline index. Such an upload costs less. `buildOutlineIndex()` builds the index later.

## Page Search (`PageSearchClient`)

`PageSearchClient` finds the pages that help answer each question. It has the same methods as the Python SDK's `PageSearchClient`.

```typescript
import { PageSearchClient } from '@pageindex/sdk';

const search = new PageSearchClient(); // Reads PAGEINDEX_API_KEY

// Upload a PDF. Its pages are stored and no outline index is built.
const { doc_id } = await search.upload({ path: './report.pdf' });

// Search one document's pages
const one = await search.search('What was revenue in 2024?', { document: doc_id });

// Search across documents: a collection's, a folder's, or all of yours
const many = await search.search(['What was revenue in 2024?'], {
  collection: 'collection-id',
  maxDocuments: 3,
  includeText: true,
});
for (const { question, documents } of many.results) {
  for (const doc of documents) {
    console.log(question, doc.name, doc.pages.map((p) => p.page));
  }
}

// Find the documents only
await search.searchDocuments('What was revenue in 2024?', { topK: 5 });
```

Across documents, `search()` first finds the most relevant documents for each question. Then it searches the pages of those documents only. Every page searched is charged. Across documents, every document judged is charged too. `result.usage` gives the cost in credits and the balance that is left. One credit is one US cent.

`PageSearchClient` addresses documents by their ID and calls the REST API. `client.tools.searchPages()` addresses a document by its library path and calls the MCP server, for AI agents.

`upload()` takes bytes, a `Blob`, or `{ path }` in Node. To share a connection and a key with other code, pass `{ client: pageIndexClient }` in place of `apiKey`.

## Page Extract (`PageExtractClient`)

`PageExtractClient` extracts JSON that fits a JSON Schema from a PDF. It has the same methods as the Python SDK's `PageExtractClient`.

```typescript
import { PageExtractClient } from '@pageindex/sdk';

const extract = new PageExtractClient(); // Reads PAGEINDEX_API_KEY

const schema = {
  type: 'object',
  properties: { total: { type: 'number' }, currency: { type: 'string' } },
};

// From a file: it is uploaded to the "Page Extract" collection first
const job = await extract.extract<{ total: number; currency: string }>(
  { path: './invoice.pdf' },
  schema,
  { pages: [1, 3], citeSources: true },
);
console.log(job.extract_result?.total);

// From an uploaded document, without waiting for the result
const pending = await extract.extract('doc-id', schema, { wait: false });
const completed = await extract.waitExtract(pending.id);
```

A string is a `doc_id`. To upload a file, pass bytes, a `Blob`, or `{ path }`. With Zod, pass `z.toJSONSchema(schema)` as the schema.

A job can take a minute or more. `extract()` waits up to `timeout`, which is one hour by default. If a job fails, is cancelled, or does not end within `timeout`, `extract()` rejects with a `PageIndexError` whose `details.job` holds the job. A job that does not end in time continues in the cloud: read it later with `getExtract(jobId)`.

With `citeSources`, `extract_metadata.field_metadata` gives the page of each list item by its JSON Pointer, e.g. `{ "/items/0": { page: 3 } }`. A schema without lists gets no entries.

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
| `browseDocuments(params?)`     | A folder's sub-folders and documents, or a collection's documents    |
| `listCollections()`            | The account's collections                                            |
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

List first, search second: `browseDocuments()` and `listCollections()` are free; `searchDocuments({ questions })` and `searchPages()` are charged by what they read, so use them when a listing cannot pick the documents or pages out.

A collection's documents have no `path`. List them with `browseDocuments({ collection })`, then read one by `collection` and its name as `docName`.

`listDocuments()`, `getMetadataSchema()` and the `metadataFilter` parameter are deprecated: the server no longer lists them, and still answers a call.

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

The `docName` / `docNames` / `folderId` parameters are deprecated in favor of `path` / `paths`; the server still accepts them. Documents in a collection have no path: address one by `collection` (its name from `listCollections()`) and `docName`, e.g. `getDocument({ collection: "Filings", docName: "10-K.pdf" })`.

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
    console.log(error.statusCode); // The HTTP status
    console.log(error.message);
  }
}
```

| Status | `code` | Cause |
| --- | --- | --- |
| 402 | `USAGE_LIMIT_REACHED` | The account has not enough credits |
| 404 | `NOT_FOUND` | The document, collection or job does not exist |
| 409 | `INTERNAL_ERROR` | The document is still processing, or the job has already ended. Read `statusCode`, not `code` |
| (none) | `INVALID_INPUT` | The SDK refused the arguments before it sent a request |

## Examples

- [examples/chat-with-tools](./examples/chat-with-tools) — Next.js + AI SDK with MCP tools
- [examples/chat-completions](./examples/chat-completions) — Direct Chat Completions API usage

## Migrating from `@pageindex/search`

See [docs/migrating-from-pageindex-search.md](./docs/migrating-from-pageindex-search.md).

## Links

- [JS SDK Docs](https://docs.pageindex.ai/js-sdk) · [Python SDK](https://docs.pageindex.ai/sdk) · [MCP](https://docs.pageindex.ai/cookbook/mcp) · [REST API](https://docs.pageindex.ai/endpoints)
- [Discord](https://discord.gg/VuXuf29EUj) · [GitHub](https://github.com/VectifyAI/pageindex-js-sdk)

## License

MIT
