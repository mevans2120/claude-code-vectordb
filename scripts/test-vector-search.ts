#!/usr/bin/env tsx
/**
 * Quick test script for vector database search functionality
 * Can be run even while ingestion is in progress
 *
 * Usage: npx tsx scripts/test-vector-search.ts
 */

import { ProjectVectorDB } from '../src/lib/client';
import { GoogleAIEmbeddingFunction } from '../src/lib/embeddings';
import readline from 'readline';

// ANSI color codes for better output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
};

async function testVectorSearch() {
  console.log(`\n${colors.bright}${colors.cyan}🔍 Vector Database Search Test${colors.reset}\n`);

  try {
    // Initialize the client
    console.log(`${colors.dim}Connecting to ChromaDB...${colors.reset}`);
    const embedder = new GoogleAIEmbeddingFunction();
    const vectorDB = new ProjectVectorDB({
      chromaUrl: 'http://localhost:8000',
      collectionName: 'project-docs',
      embeddingFunction: embedder,
    });

    await vectorDB.initialize();
    console.log(`${colors.green}✅ Connected to Vector DB${colors.reset}\n`);

    // Get current stats
    const stats = await vectorDB.getStats();
    console.log(`${colors.bright}📊 Current Database Stats:${colors.reset}`);
    console.log(`   Documents indexed: ${colors.yellow}${stats.totalDocuments}${colors.reset}`);
    console.log(`   Average chunk size: ${stats.averageChunkSize} chars`);

    if (stats.totalDocuments === 0) {
      console.log(`\n${colors.yellow}⚠️  No documents in database yet. Ingestion may still be running.${colors.reset}`);
      console.log(`   Run this command to check ingestion status:`);
      console.log(`   ${colors.dim}npx tsx scripts/ingest-docs-to-vectordb.ts --stats${colors.reset}\n`);
      return;
    }

    console.log(`\n   ${colors.bright}Categories:${colors.reset}`);
    Object.entries(stats.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .forEach(([cat, count]) => {
        console.log(`     ${cat}: ${count} chunks`);
      });
    console.log();

    // Test queries
    const testQueries = [
      "What is the styling system and how should I use Tailwind?",
      "How does the chatbot work with RAG?",
      "What are the recent architecture decisions?",
      "What is the CSS animation system?",
      "How do I work with Sanity CMS?"
    ];

    console.log(`${colors.bright}🧪 Running Test Queries:${colors.reset}\n`);

    for (const query of testQueries) {
      console.log(`${colors.bright}Query:${colors.reset} "${colors.cyan}${query}${colors.reset}"`);

      const results = await vectorDB.query(query, {
        limit: 3,
        threshold: 0.5
      });

      if (results.length === 0) {
        console.log(`   ${colors.yellow}No results found (threshold: 0.5)${colors.reset}`);
      } else {
        console.log(`   ${colors.green}Found ${results.length} relevant results:${colors.reset}`);
        results.forEach((result, i) => {
          const preview = result.content.substring(0, 150).replace(/\n/g, ' ');
          console.log(`   ${i + 1}. ${colors.bright}Score: ${result.score.toFixed(3)}${colors.reset}`);
          console.log(`      ${colors.blue}Source:${colors.reset} ${result.metadata.filePath || 'N/A'}`);
          console.log(`      ${colors.dim}"${preview}..."${colors.reset}`);
        });
      }
      console.log();
    }

    // Interactive mode
    console.log(`${colors.bright}${colors.magenta}💬 Interactive Search Mode${colors.reset}`);
    console.log(`${colors.dim}Type your questions or 'exit' to quit${colors.reset}\n`);

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: `${colors.cyan}Search> ${colors.reset}`
    });

    rl.prompt();

    rl.on('line', async (line) => {
      const query = line.trim();

      if (query.toLowerCase() === 'exit' || query.toLowerCase() === 'quit') {
        console.log(`\n${colors.green}👋 Goodbye!${colors.reset}`);
        rl.close();
        process.exit(0);
      }

      if (query) {
        try {
          const results = await vectorDB.query(query, {
            limit: 3,
            threshold: 0.5
          });

          if (results.length === 0) {
            console.log(`${colors.yellow}No relevant results found.${colors.reset}`);
          } else {
            console.log(`\n${colors.green}Found ${results.length} results:${colors.reset}`);
            results.forEach((result, i) => {
              console.log(`\n${colors.bright}Result ${i + 1}:${colors.reset}`);
              console.log(`  ${colors.blue}Score:${colors.reset} ${result.score.toFixed(3)}`);
              console.log(`  ${colors.blue}Source:${colors.reset} ${result.metadata.filePath || 'N/A'}`);
              console.log(`  ${colors.blue}Category:${colors.reset} ${result.metadata.category || 'N/A'}`);
              console.log(`  ${colors.dim}Content:${colors.reset}`);

              // Format content with word wrap
              const words = result.content.split(' ');
              let line = '    ';
              for (const word of words) {
                if (line.length + word.length > 80) {
                  console.log(line);
                  line = '    ';
                }
                line += word + ' ';
              }
              if (line.trim()) console.log(line);
            });
          }
        } catch (error) {
          console.error(`${colors.red}Error: ${error}${colors.reset}`);
        }
      }

      console.log();
      rl.prompt();
    });

  } catch (error) {
    console.error(`\n${colors.bright}${colors.red}❌ Error:${colors.reset}`, error);
    console.error(`\n${colors.yellow}Troubleshooting:${colors.reset}`);
    console.error('  1. Ensure ChromaDB is running: npm run chromadb:start');
    console.error('  2. Check GOOGLE_GENERATIVE_AI_API_KEY is set');
    console.error('  3. Verify ingestion has started: Check the ingestion script output');
    process.exit(1);
  }
}

// Run the test
testVectorSearch().catch(console.error);