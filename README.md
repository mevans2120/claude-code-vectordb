# Claude Code Vector Database

A vector database system for providing context to Claude Code AI assistants. This enables semantic search across project documentation without manually reading hundreds of files.

## Features

- **Local ChromaDB** storage for offline development
- **Google AI embeddings** for semantic search
- **Dual-access pattern**: Direct TypeScript API (0 tokens) + MCP server for agents
- **Batch ingestion** with error recovery
- **Comprehensive search** across documentation, instructions, and project status

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up environment**
   ```bash
   cp .env.example .env
   # Edit .env and add your GOOGLE_GENERATIVE_AI_API_KEY
   ```

3. **Start ChromaDB**
   ```bash
   npm run chromadb:start
   ```

4. **Ingest documentation**
   ```bash
   npm run ingest:clear  # Fresh start with clear
   # or
   npm run ingest       # Add to existing
   ```

5. **Test search**
   ```bash
   npm run test:search
   ```

## Architecture

```
Project Documentation → Ingestion Script → ChromaDB Vector DB
                                                ↓
                                         TypeScript API
                                          ↙          ↘
                              MCP Server              Direct Import
                                   ↓                       ↓
                            Claude Code Agents      Build Scripts/CLI
```

## Scripts

- `npm run chromadb:start` - Start ChromaDB server
- `npm run chromadb:stop` - Stop ChromaDB server
- `npm run ingest` - Ingest documents
- `npm run ingest:clear` - Clear and re-ingest
- `npm run test:search` - Interactive search testing
- `npm run test:api` - API functionality testing

## Configuration

Edit `.env` file:
- `GOOGLE_GENERATIVE_AI_API_KEY` - Required for embeddings
- `DOCS_PATH` - Path to documentation folder
- `MEMORY_BANK_PATH` - Path to current status file
- `CLAUDE_MD_PATH` - Path to Claude instructions

## Dual-Access Pattern

### For AI Agents (via MCP)
```typescript
// Agents query through MCP server (uses tokens)
const results = await mcp.query("What is the styling system?");
```

### For Programmatic Access (Direct)
```typescript
// Direct TypeScript import (0 tokens)
import { ProjectVectorDB } from './src/lib/client';
const db = new ProjectVectorDB();
const results = await db.query("css styles");
```

## Token Savings

- Direct API access: **0 tokens**
- File reading avoided: **~2000 tokens/file**
- Monthly savings: **~100,000+ tokens**

## Development

### Project Structure
```
src/
├── lib/           # Core vector DB library
├── mcp-server/    # MCP server for Claude Code
└── cli/           # Command-line tools

scripts/           # Utility scripts
chromadb-data/     # Local database storage
```

### Adding MCP Server
The MCP server (Task 4) will enable Claude Code agents to query the database. Implementation pending.

### CLI Tools
Command-line interface (Task 5) for manual queries and maintenance. Implementation pending.

## Troubleshooting

1. **ChromaDB not starting**
   - Check Python installation: `python3 --version`
   - Install ChromaDB: `pip install chromadb`

2. **Ingestion fails**
   - Verify API key is set in `.env`
   - Check source paths exist
   - Review error logs for problematic documents

3. **Search returns no results**
   - Lower similarity threshold (default 0.5)
   - Ensure ingestion completed successfully
   - Check database stats: `npm run test:api`

## License

Private project - not for distribution