#!/usr/bin/env tsx
/**
 * Diagnostic script to check what's in the vector database
 * and what similarity scores we're getting
 */

import { ProjectVectorDB } from '../src/lib/client';
import { GoogleAIEmbeddingFunction } from '../src/lib/embeddings';

async function runDiagnostics() {
  console.log('\n🔍 Vector Database Diagnostics\n');

  try {
    // Initialize
    const embedder = new GoogleAIEmbeddingFunction();
    const vectorDB = new ProjectVectorDB({
      chromaUrl: 'http://localhost:8000',
      collectionName: 'project-docs',
      embeddingFunction: embedder,
    });

    await vectorDB.initialize();
    console.log('✅ Connected to Vector DB\n');

    // Get stats
    const stats = await vectorDB.getStats();
    console.log(`📊 Database Stats:`);
    console.log(`   Total documents: ${stats.totalDocuments}`);
    console.log(`   Categories: ${Object.keys(stats.categories).length}`);
    console.log();

    // Get a sample of documents
    const sample = await vectorDB.getAllDocuments(5);
    console.log('📄 Sample Documents:');
    sample.forEach((doc, i) => {
      console.log(`\n${i + 1}. ID: ${doc.id}`);
      console.log(`   Category: ${doc.metadata.category}`);
      console.log(`   Source: ${doc.metadata.filePath}`);
      console.log(`   Content preview: "${doc.content.substring(0, 100)}..."`);
    });

    // Test queries with different thresholds
    console.log('\n🧪 Testing Query with Different Thresholds:\n');
    const testQuery = "design system css styling tailwind";

    const thresholds = [0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];

    for (const threshold of thresholds) {
      const results = await vectorDB.query(testQuery, {
        limit: 3,
        threshold: threshold
      });

      console.log(`Threshold ${threshold.toFixed(1)}: ${results.length} results`);
      if (results.length > 0) {
        console.log(`   Best score: ${results[0].score.toFixed(3)}`);
        console.log(`   From: ${results[0].metadata.filePath}`);
      }
    }

    // Try a very broad search with no threshold
    console.log('\n🔍 Broad Search (no threshold):');
    const broadResults = await vectorDB.query("css", {
      limit: 5,
      threshold: 0.0
    });

    console.log(`Found ${broadResults.length} results:`);
    broadResults.forEach((result, i) => {
      console.log(`${i + 1}. Score: ${result.score.toFixed(3)} | ${result.metadata.category} | ${result.metadata.filePath}`);
    });

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

runDiagnostics().catch(console.error);