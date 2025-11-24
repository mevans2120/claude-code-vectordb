# Cross-Project Usage Guide

## Quick Answer: YES, you can use this from other projects!

Here's how to set it up for real-world usage:

## Setup Steps

### 1. Start the Vector DB Server (One Time)

In the `claude-code-vectordb` project:

```bash
# Terminal 1: Start ChromaDB
npm run chromadb:start

# Terminal 2: Start MCP Server (if using MCP)
npm run mcp:dev
```

### 2. From Other Projects - Three Ways to Connect

#### Method A: Direct ChromaDB (Simplest for Agents)

Agents can write this code in ANY project:

```typescript
// No special imports needed, just install: npm install chromadb
import { ChromaClient } from 'chromadb';

const client = new ChromaClient({ path: 'http://localhost:8000' });
const collection = await client.getCollection({ name: 'project-docs' });

// Query
const results = await collection.query({
  queryTexts: ["your search query"],
  nResults: 5
});
```

#### Method B: Using Agent SDK (After Publishing)

```bash
# One-time: In claude-code-vectordb directory
npm link  # Makes it available locally

# In your other project
npm link claude-code-vectordb
```

Then agents can:
```typescript
import { ProjectVectorDB } from 'claude-code-vectordb';
const db = new ProjectVectorDB();
await db.initialize();
const results = await db.query("authentication patterns");
```

#### Method C: Via MCP (Traditional Tool Calling)

If the other project has MCP client setup:
- The server is already running
- Agents use the `search_tools`, `query_vector_db`, etc. tools

## For Your Pilot Testing

### Recommended Approach:

1. **Keep ChromaDB running** on `localhost:8000`
2. **Have agents write direct ChromaDB connections** (Method A)
   - This requires zero setup in other projects
   - Just `npm install chromadb` once
   - Agents can immediately start querying

### Example Agent Workflow:

Agent working in `some-other-project/`:

```typescript
// Agent writes this when it needs to search documentation
import { ChromaClient } from 'chromadb';

async function findRelevantDocs(query: string) {
  const client = new ChromaClient({ path: 'http://localhost:8000' });
  const collection = await client.getCollection({ name: 'project-docs' });

  const results = await collection.query({
    queryTexts: [query],
    nResults: 10
  });

  // Process results...
  return results.documents[0];
}

// Use it for the task at hand
const authDocs = await findRelevantDocs("authentication middleware");
```

## Why This Works

- **ChromaDB is a standalone server** - runs independently
- **Any project can connect** - just needs the URL
- **No token overhead** - direct code execution
- **Agent writes minimal code** - 5-10 lines to query

## Making It Even Better

After pilot validation, you could:

1. **Publish to NPM**: `npm publish` makes the SDK installable anywhere
2. **Create a CLI**: `npx claude-vectordb query "search term"`
3. **Add to Agent's System Prompt**: Include the connection snippet

## Testing Cross-Project Now

```bash
# Terminal 1: Start your vector DB
cd ~/claude-code-vectordb
npm run chromadb:start

# Terminal 2: Go to any other project
cd ~/some-other-project

# Install chromadb if needed
npm install chromadb

# Create a test file
echo "import { ChromaClient } from 'chromadb';
const client = new ChromaClient({ path: 'http://localhost:8000' });
console.log('Connected to VectorDB!');" > test-vectordb.ts

# Run it
npx tsx test-vectordb.ts
```

If you see "Connected to VectorDB!", you're ready to go!