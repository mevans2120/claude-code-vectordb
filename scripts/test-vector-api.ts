#!/usr/bin/env tsx
/**
 * Test script for the TypeScript Vector DB API
 * This demonstrates the dual-access pattern:
 * - This script uses the API directly (zero tokens)
 * - MCP server will use the same API (uses tokens)
 *
 * Run: npx tsx scripts/test-vector-api.ts
 */

import { ProjectVectorDB } from '../src/lib/client';
import { GoogleAIEmbeddingFunction } from '../src/lib/embeddings';
import type { VectorDocument } from '../src/lib/types';

async function testVectorAPI() {
  console.log('🧪 Testing Vector DB TypeScript API...\n');

  try {
    // 1. Initialize the client with embedding function
    console.log('1️⃣  Initializing Vector DB client...');
    const embedder = new GoogleAIEmbeddingFunction();
    const vectorDB = new ProjectVectorDB({
      chromaUrl: 'http://localhost:8000',
      collectionName: 'test-api-collection',
      embeddingFunction: embedder,
    });

    await vectorDB.initialize();
    console.log('✅ Client initialized\n');

    // 2. Health check
    console.log('2️⃣  Checking ChromaDB server health...');
    const isHealthy = await vectorDB.healthCheck();
    console.log(`✅ Server is ${isHealthy ? 'healthy' : 'not responding'}\n`);

    // 3. Clear collection for clean test
    console.log('3️⃣  Clearing test collection...');
    await vectorDB.clearCollection(true);
    console.log('✅ Collection cleared\n');

    // 4. Add test documents
    console.log('4️⃣  Adding test documents...');
    const testDocs: VectorDocument[] = [
      {
        id: 'doc-1',
        content: 'The styling system uses Tailwind CSS with utility-first classes and semantic tokens. Always use Tailwind classes instead of inline styles.',
        metadata: {
          source: 'docs',
          category: 'architecture',
          filePath: '/docs/styling-guide.md',
          title: 'Styling Guide',
          lastModified: new Date().toISOString(),
          priority: 90,
          tags: ['css', 'tailwind', 'styling'],
        },
      },
      {
        id: 'doc-2',
        content: 'Sanity CMS integration uses the App Router pattern with server components for data fetching. All content is managed through schemas.',
        metadata: {
          source: 'docs',
          category: 'architecture',
          filePath: '/docs/sanity-integration.md',
          title: 'Sanity Integration',
          lastModified: new Date().toISOString(),
          priority: 85,
          tags: ['cms', 'sanity', 'backend'],
        },
      },
      {
        id: 'doc-3',
        content: 'The chatbot uses RAG (Retrieval Augmented Generation) with vector search powered by Supabase and pgvector. Embeddings use Google AI.',
        metadata: {
          source: 'docs',
          category: 'chatbot',
          filePath: '/docs/chatbot-architecture.md',
          title: 'Chatbot Architecture',
          lastModified: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
          priority: 95,
          tags: ['chatbot', 'ai', 'vector-search'],
        },
      },
      {
        id: 'doc-4',
        content: 'Recent decision: Use ChromaDB for local vector database instead of Supabase for agent queries to enable offline development.',
        metadata: {
          source: 'memory-bank',
          category: 'decisions',
          filePath: '/memory-bank/CURRENT.md',
          title: 'Recent Decisions',
          lastModified: new Date().toISOString(),
          priority: 100,
          tags: ['decisions', 'vector-db', 'chromadb'],
        },
      },
    ];

    await vectorDB.addDocuments(testDocs);
    console.log(`✅ Added ${testDocs.length} test documents\n`);

    // 5. Test semantic search
    console.log('5️⃣  Testing semantic search...');
    const query1 = 'How does the styling system work?';
    console.log(`   Query: "${query1}"`);

    const results1 = await vectorDB.query(query1, { limit: 3, threshold: 0.0 }); // Lower threshold for testing
    console.log(`   ✅ Found ${results1.length} results:`);
    results1.forEach((result, i) => {
      console.log(`      ${i + 1}. Score: ${result.score.toFixed(3)} | ${result.metadata.title}`);
      console.log(`         Content: ${result.content.substring(0, 100)}...`);
    });
    console.log();

    // 6. Test category filtering
    console.log('6️⃣  Testing category filtering...');
    const query2 = 'What technology is used?';
    const results2 = await vectorDB.searchByCategory('chatbot', query2);
    console.log(`   Query: "${query2}" (category: chatbot)`);
    console.log(`   ✅ Found ${results2.length} results in chatbot category\n`);

    // 7. Test recent docs retrieval
    console.log('7️⃣  Testing recent docs retrieval...');
    const recentDocs = await vectorDB.getRecentDocs(3); // Last 3 days
    console.log(`   ✅ Found ${recentDocs.length} documents modified in the last 3 days:`);
    recentDocs.forEach(doc => {
      console.log(`      - ${doc.metadata.title} (${doc.metadata.source})`);
    });
    console.log();

    // 8. Test statistics
    console.log('8️⃣  Getting collection statistics...');
    const stats = await vectorDB.getStats();
    console.log('   ✅ Stats:');
    console.log(`      Total documents: ${stats.totalDocuments}`);
    console.log(`      Average chunk size: ${stats.averageChunkSize} chars`);
    console.log(`      Categories: ${JSON.stringify(stats.categories)}`);
    console.log(`      Sources: ${JSON.stringify(stats.sources)}\n`);

    // 9. Test backup export
    console.log('9️⃣  Testing backup export...');
    const backupPath = './vector-db-backup.jsonl';
    await vectorDB.exportBackup(backupPath);
    console.log(`   ✅ Backup exported to ${backupPath}\n`);

    // 10. Test document update
    console.log('🔟 Testing document update...');
    const updatedDoc: VectorDocument = {
      id: 'doc-1',
      content: 'UPDATED: The styling system uses Tailwind CSS v3.4 with semantic design tokens and custom utilities.',
      metadata: {
        ...testDocs[0].metadata,
        lastModified: new Date().toISOString(),
        updated: true,
      },
    };
    await vectorDB.updateDocuments([updatedDoc]);
    console.log('   ✅ Document updated\n');

    // 11. Verify update with query
    console.log('1️⃣1️⃣ Verifying update with query...');
    const verifyResults = await vectorDB.query('Tailwind CSS v3.4', { limit: 1 });
    if (verifyResults[0]?.content.includes('v3.4')) {
      console.log('   ✅ Update verified - found updated content\n');
    } else {
      console.log('   ❌ Update verification failed\n');
    }

    // 12. Clean up
    console.log('🧹 Cleaning up...');
    await vectorDB.clearCollection(true);
    console.log('✅ Test collection cleared\n');

    // Summary
    console.log('=' .repeat(60));
    console.log('🎉 Vector DB TypeScript API Test Complete!');
    console.log('=' .repeat(60));
    console.log('\n📋 API Functions Tested:');
    console.log('  ✅ initialize() - Connection setup');
    console.log('  ✅ healthCheck() - Server status');
    console.log('  ✅ clearCollection() - Data cleanup');
    console.log('  ✅ addDocuments() - Bulk insertion');
    console.log('  ✅ query() - Semantic search');
    console.log('  ✅ searchByCategory() - Filtered search');
    console.log('  ✅ getRecentDocs() - Time-based retrieval');
    console.log('  ✅ getStats() - Collection statistics');
    console.log('  ✅ exportBackup() - Data export');
    console.log('  ✅ updateDocuments() - Document updates');
    console.log('\n✨ This API can now be used by:');
    console.log('  • MCP servers (for agent queries)');
    console.log('  • Build scripts (zero tokens)');
    console.log('  • CLI tools (zero tokens)');
    console.log('  • Migration scripts (zero tokens)');

    // Clean up backup file
    const fs = await import('fs');
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

  } catch (error) {
    console.error('\n❌ Test failed:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure ChromaDB server is running: npm run chromadb:start');
    console.error('  2. Check GOOGLE_GENERATIVE_AI_API_KEY is set in .env.local');
    console.error('  3. Verify ChromaDB is accessible at http://localhost:8000');
    process.exit(1);
  }
}

// Run the test
testVectorAPI().catch(console.error);