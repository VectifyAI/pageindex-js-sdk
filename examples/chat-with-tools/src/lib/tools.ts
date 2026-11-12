import { tool } from 'ai';
import { z } from 'zod';
import { PageIndexClient } from '@pageindex/sdk';

// Tool schemas - using camelCase to match SDK types
const getFolderStructureSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Subtree root as a folder path (e.g. "Research/2024"). Omit for the entire library.'),
  depth: z
    .number()
    .int()
    .min(1)
    .max(10)
    .default(10)
    .optional()
    .describe('Maximum depth to traverse (1-10, default 10).'),
});

const browseDocumentsSchema = z.object({
  path: z
    .string()
    .optional()
    .describe('Folder scope as a path copied from a folder\'s `path` (e.g. "Research/2024"). Omit for the library root.'),
  recursive: z
    .boolean()
    .optional()
    .describe(
      'When false (default), returns direct contents plus sub-folders. When true, flattens all descendants into one document list.',
    ),
  offset: z.number().int().min(0).optional().describe('Pagination offset from a previous `next_offset`.'),
  limit: z.number().min(1).max(50).default(10).optional().describe('Number of documents to return (1-50).'),
});

const searchDocumentsSchema = z.object({
  questions: z
    .array(z.string().min(1).max(2000))
    .min(1)
    .max(10)
    .describe('What the user wants answered, as full questions (1-10).'),
  topK: z.number().int().min(1).max(50).optional().describe('Documents per question (1-50).'),
  path: z.string().optional().describe('Folder scope as a folder path (e.g. "Research/2024"). Omit for the whole library.'),
});

const documentPath = z
  .string()
  .min(1)
  .describe(
    'Document path copied verbatim from the `path` field of a browse_documents() or search_documents() response (e.g. "Research/2024/Q3 Report.pdf").',
  );

const getDocumentSchema = z.object({
  path: documentPath,
});

const getDocumentStructureSchema = z.object({
  path: documentPath,
  part: z.number().int().min(1).default(1).optional().describe('Part number for pagination (1-based).'),
});

const getPageContentSchema = z.object({
  path: documentPath,
  pages: z
    .string()
    .min(1)
    .describe('Page specification: "5", "3,7,10", "5-10", or "1-3,7,9-12".'),
});

const TOOL_DESCRIPTIONS = {
  get_folder_structure:
    'Orientation step: returns the folder hierarchy as a tree. Call this FIRST when exploring a library — folder names reveal content domains and return folder paths you can pass to browse_documents().',
  browse_documents:
    'Lists a folder\'s sub-folders and documents, newest first. Free: use it first when folder names can pick the documents out. Pass a folder path to drill into a sub-folder.',
  search_documents:
    'Finds the documents likely to answer each question, with a 0-1 relevance. Priced by the documents it looks at, so use it when browsing cannot pick the documents out.',
  get_document:
    'Get a document\'s processing status and metadata. Call before get_document_structure() or get_page_content() to confirm the document is ready.',
  get_document_structure:
    'Extract a document\'s hierarchical outline (headers, sections, page references). REQUIRED for documents over 20 pages — use it to locate relevant sections before reading pages.',
  get_page_content:
    'Extract page content from a processed document. Use tight, targeted page ranges — never the whole document at once.',
};

export function buildPageIndexTools(client: PageIndexClient) {
  return {
    pageindex_get_folder_structure: tool({
      description: TOOL_DESCRIPTIONS.get_folder_structure,
      inputSchema: getFolderStructureSchema,
      execute: async (params) => client.tools.getFolderStructure(params),
    }),
    pageindex_browse_documents: tool({
      description: TOOL_DESCRIPTIONS.browse_documents,
      inputSchema: browseDocumentsSchema,
      execute: async (params) => client.tools.browseDocuments(params),
    }),
    pageindex_search_documents: tool({
      description: TOOL_DESCRIPTIONS.search_documents,
      inputSchema: searchDocumentsSchema,
      execute: async (params) => client.tools.searchDocuments(params),
    }),
    pageindex_get_document: tool({
      description: TOOL_DESCRIPTIONS.get_document,
      inputSchema: getDocumentSchema,
      execute: async (params) => client.tools.getDocument(params),
    }),
    pageindex_get_document_structure: tool({
      description: TOOL_DESCRIPTIONS.get_document_structure,
      inputSchema: getDocumentStructureSchema,
      execute: async (params) => client.tools.getDocumentStructure(params),
    }),
    pageindex_get_page_content: tool({
      description: TOOL_DESCRIPTIONS.get_page_content,
      inputSchema: getPageContentSchema,
      execute: async (params) => client.tools.getPageContent(params),
    }),
  };
}
