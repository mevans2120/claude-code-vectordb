---
name: vectordb-context
description: Automatically queries vector DB for relevant context during planning and research tasks
version: 1.0.0
experimental: true
---

# Vector DB Context Skill

Enhances planning and research by automatically querying the vector database for relevant context, patterns, and prior implementations.

## When This Skill Activates

The skill triggers when you say things like:
- "help me plan..." / "let's plan..." / "I need to plan..."
- "research..." / "investigate..." / "look into..."
- "what's the best way to..." / "how should I..."
- "find examples of..." / "show me patterns for..."
- "what conventions..." / "what standards..."

## What It Does

1. **Extracts Key Concepts** from your request
2. **Queries Vector DB** for relevant documentation
3. **Presents Top Results** with summaries
4. **Suggests Related Topics** for deeper exploration
5. **Highlights Patterns** from previous implementations

## Example Workflow

### User Says:
"I need to plan an authentication system"

### Skill Response:
```
🔍 Searching vector DB for relevant context...

Found 5 relevant documents about authentication:

1. **Authentication Patterns** (score: 0.92)
   - JWT token implementation
   - Middleware setup examples
   - Session management patterns

2. **Security Best Practices** (score: 0.87)
   - Password hashing with bcrypt
   - Rate limiting strategies
   - CORS configuration

3. **API Auth Guide** (score: 0.84)
   - OAuth2 integration
   - API key management
   - Role-based access control

Would you like me to:
- Show full content of any result
- Search for more specific patterns
- Create a planning template based on these findings
```

## Configuration

### Environment Requirements
```bash
# Vector DB must be running
CHROMA_URL=http://localhost:8000
COLLECTION_NAME=project-docs

# Optional: Google AI for embeddings
GOOGLE_GENERATIVE_AI_API_KEY=your-key
```

### Query Script Location
```bash
# The skill expects this script to exist
~/claude-code-vectordb/skills/scripts/query-vectordb.ts
```

## Query Logic

```typescript
// Pseudocode for context extraction
function extractSearchTerms(userInput: string): string[] {
  // Remove common words
  const filtered = removeStopWords(userInput);

  // Extract technical terms
  const technical = extractTechnicalTerms(filtered);

  // Add synonyms and related terms
  const expanded = expandWithSynonyms(technical);

  return expanded;
}

// Query execution
async function queryVectorDB(terms: string[]) {
  const results = await collection.query({
    queryTexts: terms,
    nResults: 5,
    where: {
      category: { $in: ['architecture', 'patterns', 'guides'] }
    }
  });

  return formatResults(results);
}
```

## User Controls

### Disable for Current Session
Say: "disable vector context" or "no vector suggestions"

### Skip This Time
Say: "skip context" or "no search needed"

### Request More Results
Say: "show more" or "deeper search"

### Focus Search
Say: "only search for [specific topic]"

## Benefits

✅ **Consistency** - Ensures new work aligns with existing patterns
✅ **Efficiency** - Reduces redundant research time
✅ **Quality** - Leverages proven solutions
✅ **Learning** - Surfaces tribal knowledge
✅ **Context** - Provides relevant information proactively

## Limitations

⚠️ **Requires Running DB** - ChromaDB must be active
⚠️ **Network Latency** - Adds 100-500ms to responses
⚠️ **Relevance Varies** - Not all results will be pertinent
⚠️ **Token Usage** - Results consume context window

## Privacy & Security

- Queries are logged locally only
- No external API calls (except embeddings if configured)
- Results filtered to exclude sensitive patterns
- All data remains on local machine

## Feedback

This skill improves with usage. It tracks:
- Which results you explore further
- Which suggestions you implement
- Which queries return poor results

## Troubleshooting

### "Vector DB not responding"
```bash
# Check if ChromaDB is running
ps aux | grep chroma

# Restart if needed
npm run chromadb:start
```

### "No relevant results found"
- The vector DB may need more content
- Try more specific search terms
- Check if the collection exists

### "Results not relevant"
- Update embeddings model
- Retrain on better documents
- Adjust similarity threshold

## Future Enhancements

- 🔮 Learn from usage patterns
- 🔮 Personalized result ranking
- 🔮 Cross-project pattern detection
- 🔮 Automatic documentation updates
- 🔮 Integration with other skills

---

*Note: This is an experimental skill. Feedback and improvements welcome.*