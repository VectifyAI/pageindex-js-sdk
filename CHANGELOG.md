# [0.9.0](https://github.com/VectifyAI/pageindex-js-sdk/compare/v0.8.0...v0.9.0) (2026-11-14)


* feat(api)!: remove undocumented mode option from submitDocument ([9458a56](https://github.com/VectifyAI/pageindex-js-sdk/commit/9458a56441e75e680a5392d26f9edf9f4915580b))
* feat(tools)!: follow the MCP server's document and page tools ([cfff20a](https://github.com/VectifyAI/pageindex-js-sdk/commit/cfff20a75d1961ff74bcde48ba75c052197f1604))
* fix(tools)!: type tool results as the MCP server returns them ([1767987](https://github.com/VectifyAI/pageindex-js-sdk/commit/1767987604185fd79a5e5847f78a7e0bb8a3e6b9))


### Bug Fixes

* **tools:** type the outline as text and declare page_search ([a640ac0](https://github.com/VectifyAI/pageindex-js-sdk/commit/a640ac0e2fa9ecd070d57e473c6793593335855c))


### Features

* **tools:** add browseDocuments, getFolderStructure, searchDocuments ([00ad538](https://github.com/VectifyAI/pageindex-js-sdk/commit/00ad5388536898f080c5ba193bf3a91bb1bfcde6))
* **tools:** address a collection document by its collection and name ([72f712e](https://github.com/VectifyAI/pageindex-js-sdk/commit/72f712e0a238b2a420bc768ffbbaafbfe9877d2d))
* **tools:** address documents and folders by library path ([4de36eb](https://github.com/VectifyAI/pageindex-js-sdk/commit/4de36eb8ac2adc00cc9a03cef470d21eee86a492))
* **transport:** identify the SDK via User-Agent ([4a628b6](https://github.com/VectifyAI/pageindex-js-sdk/commit/4a628b67fcd79a824beb261057f24c5b648dc709))
* **transport:** read the pictures a tool returns beside its JSON ([24d446d](https://github.com/VectifyAI/pageindex-js-sdk/commit/24d446dfe5f9b7f836f278fabde7dd4d0afd6aa7))


### BREAKING CHANGES

* findRelevantDocuments is removed and browseDocuments no
longer takes sort: "relevance" or query; the server dropped both. Use
searchDocuments({ questions }). getPageContent results gain a required
pictures array, and BrowseFolderItem's counts and created_at are optional.
* GetDocumentResult drops `id`, `createdAt` and `pageNum`
(always undefined at runtime) for `created_at`, `page_count` and
`folder_id`; SearchDocumentResultItem drops `score`.
* SubmitDocumentOptions no longer accepts `mode`.

# [0.8.0](https://github.com/VectifyAI/pageindex-js-sdk/compare/v0.7.0...v0.8.0) (2026-03-24)


### Bug Fixes

* sort imports to satisfy biome lint ([6e66ee5](https://github.com/VectifyAI/pageindex-js-sdk/commit/6e66ee55e60f9c63999f3b716b39034e11c06f54))


### Features

* **api:** add folder REST API and remove deprecated MCP createFolder ([d01e353](https://github.com/VectifyAI/pageindex-js-sdk/commit/d01e353f0cc0de4e7f69e9edcf8024bfaa6e4b11))

# [0.7.0](https://github.com/VectifyAI/pageindex-js-sdk/compare/v0.6.0...v0.7.0) (2026-03-23)


### Bug Fixes

* **ci:** add packageManager field for pnpm/action-setup ([48ce485](https://github.com/VectifyAI/pageindex-js-sdk/commit/48ce485647ae0ef9e8752a7573a988c2b0278be6))


### Features

* **api:** add document tree retrieval and streaming chat completions ([0da4699](https://github.com/VectifyAI/pageindex-js-sdk/commit/0da4699a291137380b533a83893dab0c7c6e100e))
* **examples:** add chat-completions example and rename chat-demo ([c17cbae](https://github.com/VectifyAI/pageindex-js-sdk/commit/c17cbae2bafd76014fa817a0543cca04dc0fa3ea))
