# Migrating from @pageindex/search to @pageindex/sdk

Page Search is now part of PageIndex. `@pageindex/sdk` gives it as `PageSearchClient`, beside the other PageIndex APIs.

## Before you start

- You do not have to migrate at once. After your Page Search account has moved to PageIndex, PageIndex answers the old API host. `@pageindex/search` continues to work without code changes.
- Your API key does not change. A `pis_live_` key works with `@pageindex/sdk`.
- Your document IDs and collection IDs do not change.
- These items do not move: documents whose processing failed, past searches, the ledger, and invoices.

## Steps

1. Install the package:

   ```bash
   npm install @pageindex/sdk
   ```

2. Keep your key in `PAGEINDEX_SEARCH_API_KEY`, or move it to `PAGEINDEX_API_KEY`. The client reads `PAGEINDEX_API_KEY` first.

3. Replace the client:

   ```diff
   - import PageSearch from "@pageindex/search";
   - const client = new PageSearch();
   + import { PageSearchClient } from "@pageindex/sdk";
   + const client = new PageSearchClient();
   ```

4. Replace each call. Use the method table below.

5. Update the code that reads results. Use the field table below.

6. Update your error handling. Catch `PageIndexError` in place of `PageSearchError`.

## Methods

In the new column, `client` is a `PageSearchClient`, and `client.documents` is its `PageIndexClient`.

| `@pageindex/search` | `@pageindex/sdk` | Notes |
| --- | --- | --- |
| `client.documents.upload("report.pdf", options)` | `client.upload({ path: "report.pdf" }, options)` | A string is not a path. Pass `{ path }`, bytes, or a `Blob`. `filename` is `fileName`. The default `timeout` is 30 minutes, not 5. |
| `client.search(questions, { document })` | `client.search(questions, { document })` | `document` is an ID. A `Document` object is not accepted. |
| `client.search(questions, { documentIds, collection, filter, maxDocuments, documentTopK })` | `client.search(questions, { documents, collection, filter, maxDocuments, documentTopK })` | `documentIds` is `documents`. `folder` and `recursive` are new. |
| `client.documents.search(questions, options)` | `client.searchDocuments(questions, options)` | |
| `client.documents.get(id)` | `client.documents.api.getDocument(id)` | |
| `client.documents.wait(id)` | `client.documents.api.waitDocument(id)` | |
| `client.documents.list(options)` | `client.documents.api.listDocuments({ limit, offset })` | Pages by `offset`. A list is not an async iterator. For one collection, use `client.documents.tools.browseDocuments({ collection })` with the collection's name. |
| `client.documents.delete(id)` | `client.documents.api.deleteDocument(id)` | |
| `client.documents.pages(id, pages)` | `client.documents.tools.getPageContent(...)` | An MCP tool. It addresses a document by its path, or by its collection and name. |
| `client.documents.pageImage(id, page)` | `client.documents.tools.viewPages(...)`, `zoomPage(...)` | MCP tools. They return pictures of pages. |
| `client.documents.outline(id)` | `client.documents.api.getOutline(id)` | Its `result` holds the page count and the headings, each with its page. |
| `client.documents.makeOutline(id)` | `client.documents.api.buildOutline(id)` | |
| `client.collections.create(name)` | `client.documents.api.createCollection({ name })` | |
| `client.collections.list()` | `client.documents.api.listCollections()` | Returns all collections at once. |
| `client.collections.delete(collection)` | `client.documents.api.deleteCollection(id)` | Deletes the documents in the collection too. |
| `client.tools(options)` | `client.documents.tools` | MCP tools, not tool definitions for your model. |

These methods have no replacement yet. If you use them, keep `@pageindex/search` for them:

- `client.documents.update()`, `client.documents.schema()`, `client.documents.bookmarks()`
- `client.collections.get()`, `rename()`, `add()`, `remove()`, `schema()`, `outlines()`
- `client.usage()`, `client.outlines()`, `client.citations()`

## Result fields

The results have the same structure: one entry for each question, with the documents and their pages. Some fields have new names.

| `@pageindex/search` | `@pageindex/sdk` |
| --- | --- |
| `document_id` | `id` |
| `filename` | `name` |
| `page_count`, `pages` (on a document match) | `pageNum` |
| (none) | `folderId`, `collectionId` |
| `usage.cost_usd` | `usage.credits` |
| `usage.balance_usd` | `usage.balance` |
| `object` | (none) |

`usage` reports credits, not US dollars. One credit is one US cent: divide by 100 to get the old `_usd` values.

## Behavior changes

- Across documents, `@pageindex/search` ran the search on the server. `PageSearchClient` finds the documents first, then searches the pages of each document. The result is the same.
- `@pageindex/search` sent an `Idempotency-Key` and retried a failed search. `PageSearchClient` sends no idempotency key, so it sends a search again only after a 429, or when the search never reached the server. If you retry a search yourself, the second search is charged too.
- `@pageindex/search` retried a request that failed with a network error or with status 429, 500, 502, 503 or 504. `@pageindex/sdk` retries a GET, PUT or DELETE request that fails with a network error or with status 408, 409, 429 or 5xx, up to two times. It retries a POST only after a 429.

## Errors

| `PageSearchError` | `PageIndexError` |
| --- | --- |
| `status` | `statusCode` |
| `code`, e.g. `"document_failed"` | `code`, e.g. `"NOT_FOUND"` or `"USAGE_LIMIT_REACHED"` |
| `requestId` | (none) |
