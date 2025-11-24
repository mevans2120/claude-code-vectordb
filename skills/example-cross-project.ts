#!/usr/bin/env tsx
/**
 * Example: How an agent in ANOTHER project can access the Vector DB
 *
 * This shows what an agent would write when working in a different project
 * but needing to access the centralized vector database.
 */

// Option 1: Direct ChromaDB connection (no dependency on this project)
import { ChromaClient } from 'chromadb';

async function searchVectorDB(query: string) {
  // Connect to the running ChromaDB instance
  const client = new ChromaClient({
    path: 'http://localhost:8000'
  });

  // Get the collection
  const collection = await client.getOrCreateCollection({
    name: 'project-docs'
  });

  // Perform the search
  const results = await collection.query({
    queryTexts: [query],
    nResults: 5,
  });

  return results;
}

// Example usage by an agent
async function main() {
  console.log('🔍 Searching vector DB from another project...');

  // This code would be written by an agent working in ANY project
  const results = await searchVectorDB('authentication patterns');

  console.log(`Found ${results.documents[0]?.length || 0} results`);

  results.documents[0]?.forEach((doc, i) => {
    console.log(`\n Result ${i + 1}:`);
    console.log(doc?.substring(0, 200) + '...');
  });
}

main().catch(console.error);

/**
 * To make this even easier, you could:
 *
 * 1. Publish the agent-sdk as an npm package:
 *    npm publish
 *
 * 2. Or create a simple connection script that agents can copy:
 *    Just the searchVectorDB function above
 *
 * 3. Or have agents install chromadb and connect directly:
 *    npm install chromadb
 *    Then use the code above
 */