#!/usr/bin/env tsx
/**
 * Document Ingestion Script for Vector Database
 *
 * This script reads markdown files from /docs folder and related directories,
 * chunks them appropriately, generates embeddings, and stores them in ChromaDB.
 *
 * Usage:
 *   npx tsx scripts/ingest-docs-to-vectordb.ts          # Ingest all docs
 *   npx tsx scripts/ingest-docs-to-vectordb.ts --clear  # Clear and re-ingest
 *   npx tsx scripts/ingest-docs-to-vectordb.ts --stats  # Show stats only
 */

import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import matter from 'gray-matter';
import crypto from 'crypto';
import { ProjectVectorDB } from '../src/lib/client';
import { GoogleAIEmbeddingFunction } from '../src/lib/embeddings';
import type { VectorDocument } from '../src/lib/types';

// Configuration
const CHUNK_SIZE = 800; // Characters per chunk (same as chatbot)
const CHUNK_OVERLAP = 200; // Character overlap between chunks
const COLLECTION_NAME = 'project-docs';

/**
 * Generate a deterministic ID for a chunk
 */
function generateChunkId(filePath: string, chunkIndex: number): string {
  const hash = crypto.createHash('sha256');
  hash.update(`${filePath}-${chunkIndex}`);
  return hash.digest('hex').substring(0, 16);
}

/**
 * Sanitize text content for safe JSON serialization
 * Removes problematic characters that can break JSON parsing
 */
function sanitizeContent(text: string): string {
  if (!text) return '';

  // More aggressive sanitization to prevent JSON parsing errors
  return text
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '') // Remove control characters
    .replace(/\\x[0-9a-fA-F]{0,2}(?![0-9a-fA-F])/g, '') // Remove incomplete hex escapes
    .replace(/\\u[0-9a-fA-F]{0,3}(?![0-9a-fA-F])/g, '') // Remove incomplete unicode escapes
    .replace(/[\uFFFD\uFFFE\uFFFF]/g, '') // Remove replacement characters
    .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove additional control chars
    .trim();
}

/**
 * Split text into chunks with overlap
 */
function createChunks(text: string, chunkSize: number, overlap: number): string[] {
  if (!text || text.length <= chunkSize) {
    return [text];
  }

  const chunks: string[] = [];
  let startIndex = 0;

  while (startIndex < text.length) {
    const endIndex = Math.min(startIndex + chunkSize, text.length);
    chunks.push(text.slice(startIndex, endIndex));

    if (endIndex >= text.length) break;

    // Move to next chunk with overlap
    startIndex += chunkSize - overlap;
  }

  return chunks;
}

/**
 * Infer category from file path
 */
function inferCategory(filePath: string): string {
  const relativePath = path.relative('docs', filePath).toLowerCase();

  if (relativePath.includes('architecture')) return 'architecture';
  if (relativePath.includes('chatbot')) return 'chatbot';
  if (relativePath.includes('design')) return 'design';
  if (relativePath.includes('implementation')) return 'implementation-plans';
  if (relativePath.includes('roadmap')) return 'roadmaps';
  if (relativePath.includes('research')) return 'research';
  if (relativePath.includes('testing')) return 'testing';
  if (relativePath.includes('audit')) return 'audits';
  if (relativePath.includes('eval')) return 'evaluations';
  if (relativePath.includes('css') || relativePath.includes('style')) return 'styling';
  if (relativePath.includes('animation')) return 'animation';
  if (relativePath.includes('migration')) return 'migrations';
  if (relativePath.includes('content')) return 'content';
  if (relativePath.includes('feature')) return 'features';
  if (relativePath.includes('_archive')) return 'archive';

  // Check first directory level
  const dirs = relativePath.split(path.sep);
  if (dirs.length > 0) {
    return dirs[0];
  }

  return 'general';
}

/**
 * Determine priority based on file path and name
 */
function inferPriority(filePath: string): number {
  const relativePath = path.relative('docs', filePath).toLowerCase();

  // High priority files
  if (relativePath.includes('claude.md')) return 100;
  if (relativePath.includes('readme')) return 95;
  if (relativePath.includes('current')) return 95;
  if (relativePath.includes('quick-reference')) return 90;
  if (relativePath.includes('implementation-plan')) return 85;

  // Medium priority
  if (relativePath.includes('architecture')) return 80;
  if (relativePath.includes('design')) return 75;
  if (relativePath.includes('roadmap')) return 75;
  if (relativePath.includes('testing')) return 70;

  // Lower priority
  if (relativePath.includes('_archive')) return 30;
  if (relativePath.includes('old')) return 35;
  if (relativePath.includes('deprecated')) return 35;

  // Default
  return 60;
}

/**
 * Extract title from markdown content or filename
 */
function extractTitle(content: string, filePath: string): string {
  // Try to extract from first H1 heading
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }

  // Otherwise use filename
  const filename = path.basename(filePath, '.md');
  return filename
    .replace(/[-_]/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Load and process markdown files
 */
async function loadDocuments(docsDir: string): Promise<VectorDocument[]> {
  // Find all markdown files
  const files = await glob(`${docsDir}/**/*.md`, {
    ignore: ['**/node_modules/**'],
  });

  console.log(`📂 Found ${files.length} markdown files`);

  const documents: VectorDocument[] = [];
  const fileStats = {
    processed: 0,
    skipped: 0,
    totalChunks: 0,
  };

  for (const filePath of files) {
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const stat = fs.statSync(filePath);

      // Parse frontmatter if exists
      const { data: frontmatter, content: body } = matter(content);

      // Skip empty files
      if (!body || body.trim().length === 0) {
        fileStats.skipped++;
        continue;
      }

      // Extract metadata
      const category = inferCategory(filePath);
      const priority = inferPriority(filePath);
      const title = frontmatter.title || extractTitle(body, filePath);
      const relativePath = path.relative(process.cwd(), filePath);

      // Sanitize content before chunking
      const sanitizedBody = sanitizeContent(body);

      // Create chunks
      const chunks = createChunks(sanitizedBody, CHUNK_SIZE, CHUNK_OVERLAP);

      // Create document for each chunk
      chunks.forEach((chunk, index) => {
        const chunkId = generateChunkId(filePath, index);

        documents.push({
          id: chunkId,
          content: chunk,
          metadata: {
            source: 'docs',
            category,
            filePath: relativePath,
            title,
            lastModified: stat.mtime.toISOString(),
            priority,
            chunkIndex: index,
            totalChunks: chunks.length,
            tags: frontmatter.tags || [],
            // Include any additional frontmatter
            ...Object.entries(frontmatter)
              .filter(([key]) => !['title', 'tags'].includes(key))
              .reduce((acc, [key, value]) => {
                if (typeof value !== 'object' || value === null) {
                  acc[key] = value;
                }
                return acc;
              }, {} as any),
          },
        });
      });

      fileStats.processed++;
      fileStats.totalChunks += chunks.length;

      // Progress indicator
      if (fileStats.processed % 10 === 0) {
        process.stdout.write('.');
      }
    } catch (error) {
      console.error(`\n❌ Error processing ${filePath}:`, error);
      fileStats.skipped++;
    }
  }

  console.log('\n');
  console.log('📊 Processing Summary:');
  console.log(`   Files processed: ${fileStats.processed}`);
  console.log(`   Files skipped: ${fileStats.skipped}`);
  console.log(`   Total chunks: ${fileStats.totalChunks}`);
  console.log(`   Avg chunks/file: ${(fileStats.totalChunks / fileStats.processed).toFixed(1)}`);

  return documents;
}

/**
 * Main ingestion function
 */
async function ingestDocs() {
  console.log('🚀 Starting document ingestion to Vector DB...\n');

  const flags = {
    clear: process.argv.includes('--clear'),
    statsOnly: process.argv.includes('--stats'),
  };

  try {
    // Initialize Vector DB client
    console.log('🔌 Connecting to ChromaDB...');
    const embedder = new GoogleAIEmbeddingFunction();
    const vectorDB = new ProjectVectorDB({
      chromaUrl: 'http://localhost:8000',
      collectionName: COLLECTION_NAME,
      embeddingFunction: embedder,
    });

    await vectorDB.initialize();
    console.log('✅ Connected to Vector DB\n');

    // If stats only, show stats and exit
    if (flags.statsOnly) {
      const stats = await vectorDB.getStats();
      console.log('📊 Current Collection Stats:');
      console.log(`   Total documents: ${stats.totalDocuments}`);
      console.log(`   Average chunk size: ${stats.averageChunkSize} chars`);
      console.log('\n   Categories:');
      Object.entries(stats.categories)
        .sort(([, a], [, b]) => b - a)
        .forEach(([cat, count]) => {
          console.log(`     ${cat}: ${count} chunks`);
        });
      console.log('\n   Sources:');
      Object.entries(stats.sources)
        .sort(([, a], [, b]) => b - a)
        .forEach(([src, count]) => {
          console.log(`     ${src}: ${count} chunks`);
        });
      return;
    }

    // Clear collection if requested
    if (flags.clear) {
      console.log('🗑️  Clearing existing collection...');
      await vectorDB.clearCollection(true);
      console.log('✅ Collection cleared\n');
    }

    // Load documents from /docs folder
    console.log('📚 Loading documentation files...\n');
    const docsPath = path.join(process.cwd(), 'docs');
    const documents = await loadDocuments(docsPath);

    if (documents.length === 0) {
      console.error('❌ No documents found to ingest!');
      return;
    }

    // Also load memory bank if exists
    const memoryBankPath = path.join(process.cwd(), 'memory-bank', 'CURRENT.md');
    if (fs.existsSync(memoryBankPath)) {
      console.log('\n📝 Loading memory bank...');
      const memoryContent = fs.readFileSync(memoryBankPath, 'utf-8');
      const sanitizedMemory = sanitizeContent(memoryContent);
      const memoryChunks = createChunks(sanitizedMemory, CHUNK_SIZE, CHUNK_OVERLAP);

      memoryChunks.forEach((chunk, index) => {
        documents.push({
          id: `memory-bank-${index}`,
          content: chunk,
          metadata: {
            source: 'memory-bank',
            category: 'current-status',
            filePath: 'memory-bank/CURRENT.md',
            title: 'Current Development Status',
            lastModified: fs.statSync(memoryBankPath).mtime.toISOString(),
            priority: 100, // High priority for current status
            chunkIndex: index,
            totalChunks: memoryChunks.length,
          },
        });
      });
      console.log(`✅ Added ${memoryChunks.length} chunks from memory bank`);
    }

    // Also load CLAUDE.md if exists
    const claudeMdPath = path.join(process.cwd(), 'CLAUDE.md');
    if (fs.existsSync(claudeMdPath)) {
      console.log('\n📝 Loading CLAUDE.md instructions...');
      const claudeContent = fs.readFileSync(claudeMdPath, 'utf-8');
      const sanitizedClaude = sanitizeContent(claudeContent);
      const claudeChunks = createChunks(sanitizedClaude, CHUNK_SIZE, CHUNK_OVERLAP);

      claudeChunks.forEach((chunk, index) => {
        documents.push({
          id: `claude-md-${index}`,
          content: chunk,
          metadata: {
            source: 'claude-md',
            category: 'project-instructions',
            filePath: 'CLAUDE.md',
            title: 'Project Instructions for Claude Code',
            lastModified: fs.statSync(claudeMdPath).mtime.toISOString(),
            priority: 100, // High priority for instructions
            chunkIndex: index,
            totalChunks: claudeChunks.length,
          },
        });
      });
      console.log(`✅ Added ${claudeChunks.length} chunks from CLAUDE.md`);
    }

    console.log(`\n📦 Total documents to ingest: ${documents.length}`);

    // Ingest documents in batches
    console.log('\n⚡ Generating embeddings and storing documents...');
    console.log('   (This may take a few minutes...)\n');

    const batchSize = 50;
    let successCount = 0;
    let failedBatches: number[] = [];

    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      const batchNumber = Math.floor(i / batchSize) + 1;

      try {
        await vectorDB.addDocuments(batch);
        successCount += batch.length;
      } catch (error: any) {
        console.error(`\n❌ Error in batch ${batchNumber} (docs ${i}-${i + batch.length - 1}):`);
        console.error(`   ${error.message}`);
        failedBatches.push(batchNumber);

        // Try to add documents one by one to identify the problematic one
        console.log(`   Attempting to add documents individually...`);
        for (let j = 0; j < batch.length; j++) {
          try {
            await vectorDB.addDocuments([batch[j]]);
            successCount++;
          } catch (individualError: any) {
            console.error(`   ❌ Failed document ${i + j}: ${batch[j].id}`);
            console.error(`      Source: ${batch[j].metadata.filePath}`);
            console.error(`      Preview: ${batch[j].content.substring(0, 50)}...`);
            // Continue with next document
          }
        }
      }

      const progress = Math.min(i + batchSize, documents.length);
      const percentage = ((progress / documents.length) * 100).toFixed(1);
      process.stdout.write(`\r   Progress: ${successCount}/${documents.length} (${percentage}%) - Failed batches: ${failedBatches.length}`);
    }
    console.log('\n\n✅ All documents ingested successfully!');

    // Show final stats
    const finalStats = await vectorDB.getStats();
    console.log('\n📊 Final Collection Stats:');
    console.log(`   Total documents: ${finalStats.totalDocuments}`);
    console.log(`   Average chunk size: ${finalStats.averageChunkSize} chars`);
    console.log('\n   Top categories:');
    Object.entries(finalStats.categories)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .forEach(([cat, count]) => {
        console.log(`     ${cat}: ${count} chunks`);
      });

    // Test with a sample query
    console.log('\n🔍 Testing with sample query...');
    const testQuery = 'What is the styling system and how should I use Tailwind?';
    const results = await vectorDB.query(testQuery, { limit: 3 });

    console.log(`   Query: "${testQuery}"`);
    console.log(`   Found ${results.length} relevant results:`);
    results.forEach((result, i) => {
      console.log(`     ${i + 1}. Score: ${result.score.toFixed(3)} | ${result.metadata.title}`);
      console.log(`        ${result.content.substring(0, 100)}...`);
    });

    console.log('\n🎉 Vector database is ready for agent queries!');
    console.log('\nYou can now:');
    console.log('  • Build the MCP server (Task 4)');
    console.log('  • Create CLI tools (Task 5)');
    console.log('  • Query directly via TypeScript API');

  } catch (error) {
    console.error('\n❌ Error during ingestion:', error);
    console.error('\nTroubleshooting:');
    console.error('  1. Ensure ChromaDB server is running: npm run chromadb:start');
    console.error('  2. Check GOOGLE_GENERATIVE_AI_API_KEY is set in .env.local');
    console.error('  3. Verify /docs folder exists and contains markdown files');
    process.exit(1);
  }
}

// Run ingestion
ingestDocs().catch(console.error);