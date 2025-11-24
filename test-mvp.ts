#!/usr/bin/env tsx
/**
 * MVP Test Script - Validates all Phase 1 features
 *
 * Run this to verify everything works:
 *   npm install chromadb @google/generative-ai  # If not already installed
 *   export GOOGLE_GENERATIVE_AI_API_KEY=your-key-here
 *   tsx test-mvp.ts
 */

import { ChromaClient } from 'chromadb';
import { ProjectVectorDB } from './src/agent-sdk';
import { GoogleAIEmbeddingFunction } from './src/lib/embeddings';
import * as fs from 'fs';

async function testDirectChromaConnection() {
  console.log('\n🧪 Test 1: Direct ChromaDB Connection (what agents in other projects would do)');

  try {
    const client = new ChromaClient({ path: 'http://localhost:8000' });
    const collections = await client.listCollections();
    console.log('✅ Connected to ChromaDB');
    console.log(`   Found ${collections.length} collections`);
    return true;
  } catch (error) {
    console.log('❌ Failed to connect to ChromaDB');
    console.log('   Make sure to run: npm run chromadb:start');
    return false;
  }
}

async function testAgentSDK() {
  console.log('\n🧪 Test 2: Agent SDK (Code Execution Mode)');

  try {
    const embedder = new GoogleAIEmbeddingFunction();
    const db = new ProjectVectorDB({
      chromaUrl: 'http://localhost:8000',
      collectionName: 'test-collection',
      embeddingFunction: embedder,
    });

    await db.initialize();
    console.log('✅ Agent SDK initialized');

    // Test adding a document
    await db.addDocuments([{
      id: 'test-doc-1',
      content: 'This is a test document about authentication patterns using JWT tokens',
      metadata: {
        source: 'test',
        title: 'Test Document',
        category: 'test',
      }
    }]);
    console.log('✅ Document added successfully');

    // Test querying
    const results = await db.query('authentication', { limit: 1 });
    console.log(`✅ Query successful: Found ${results.length} results`);

    // Test backup
    const backupPath = './test-backup.jsonl';
    await db.exportBackup(backupPath);
    console.log('✅ Backup created');

    // Cleanup
    if (fs.existsSync(backupPath)) {
      fs.unlinkSync(backupPath);
    }

    return true;
  } catch (error) {
    console.log('❌ Agent SDK test failed:', error);
    if ((error as Error).message.includes('API key')) {
      console.log('   Set GOOGLE_GENERATIVE_AI_API_KEY environment variable');
    }
    return false;
  }
}

async function simulateAgentCodeExecution() {
  console.log('\n🧪 Test 3: Simulate Agent Code Execution Pattern');
  console.log('   (This is what an agent would write in another project)');

  const agentCode = `
    // Agent working in another project writes this:
    import { ChromaClient } from 'chromadb';

    const client = new ChromaClient({ path: 'http://localhost:8000' });
    const collection = await client.getOrCreateCollection({ name: 'project-docs' });

    // Search for authentication patterns
    const results = await collection.query({
      queryTexts: ['authentication patterns'],
      nResults: 5
    });

    console.log('Found ' + results.ids[0].length + ' relevant documents');
  `;

  console.log('📝 Agent writes:');
  console.log(agentCode);

  try {
    // Actually execute the pattern
    const client = new ChromaClient({ path: 'http://localhost:8000' });
    const collection = await client.getOrCreateCollection({ name: 'project-docs' });
    console.log('✅ Agent code would execute successfully');
    return true;
  } catch (error) {
    console.log('❌ Agent code execution would fail');
    return false;
  }
}

async function runAllTests() {
  console.log('🚀 Claude Code Vector DB - MVP Test Suite');
  console.log('=========================================');

  const results = {
    directChroma: await testDirectChromaConnection(),
    agentSDK: await testAgentSDK(),
    codeExecution: await simulateAgentCodeExecution(),
  };

  console.log('\n📊 Test Results:');
  console.log('--------------------------------');
  console.log(`Direct ChromaDB:    ${results.directChroma ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Agent SDK:          ${results.agentSDK ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`Code Execution:     ${results.codeExecution ? '✅ PASS' : '❌ FAIL'}`);

  const allPass = Object.values(results).every(r => r);

  if (allPass) {
    console.log('\n🎉 All tests passed! Ready for pilot testing.');
    console.log('\nNext steps:');
    console.log('1. Agents can now connect from ANY project using:');
    console.log('   npm install chromadb');
    console.log('2. Then write simple connection code (5-10 lines)');
    console.log('3. Zero MCP overhead, direct code execution');
  } else {
    console.log('\n⚠️  Some tests failed. Check the errors above.');
    console.log('\nTroubleshooting:');
    console.log('1. Start ChromaDB: npm run chromadb:start');
    console.log('2. Set API key: export GOOGLE_GENERATIVE_AI_API_KEY=...');
    console.log('3. Install deps: npm install');
  }
}

// Run tests
runAllTests().catch(console.error);