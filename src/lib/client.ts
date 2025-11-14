/**
 * TypeScript API Library for Vector Database
 *
 * This library provides a shared interface for accessing ChromaDB that can be used:
 * 1. By MCP servers (for agent queries) - uses tokens
 * 2. By TypeScript code directly (build scripts, CLI) - zero tokens
 *
 * This dual-access pattern saves ~100,000+ tokens/month by allowing
 * programmatic access without AI tool calls.
 */

import { ChromaClient, Collection } from 'chromadb';
import * as fs from 'fs';
import * as path from 'path';
import type {
  VectorDocument,
  DocumentMetadata,
  QueryResult,
  QueryOptions,
  CollectionStats,
  BackupData,
  VectorDBConfig,
  EmbeddingFunction,
} from './types';

// Re-export types for convenience
export * from './types';

/**
 * Main vector database client for project documentation
 * Wraps ChromaDB with project-specific functions
 */
export class ProjectVectorDB {
  private client: ChromaClient;
  private collection: Collection | null = null;
  private collectionName: string;
  private embeddingFunction?: EmbeddingFunction;
  private isInitialized = false;

  constructor(config: VectorDBConfig = {}) {
    const {
      chromaUrl = 'http://localhost:8000',
      collectionName = 'project-docs',
      embeddingFunction,
    } = config;

    this.client = new ChromaClient({
      path: chromaUrl,
    });
    this.collectionName = collectionName;
    this.embeddingFunction = embeddingFunction;
  }

  /**
   * Sanitize metadata for ChromaDB
   * ChromaDB only accepts string, number, boolean values
   * Convert arrays to comma-separated strings
   */
  private sanitizeMetadata(metadata: DocumentMetadata): any {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(metadata)) {
      if (value === null || value === undefined) {
        // Skip null/undefined values
        continue;
      } else if (Array.isArray(value)) {
        // Convert arrays to comma-separated strings
        sanitized[key] = value.join(',');
      } else if (typeof value === 'object' && value instanceof Date) {
        // Convert dates to ISO strings
        sanitized[key] = value.toISOString();
      } else if (typeof value === 'object') {
        // Skip complex objects
        continue;
      } else {
        // Keep strings, numbers, booleans
        sanitized[key] = value;
      }
    }
    return sanitized;
  }

  /**
   * Initialize the database connection and collection
   * Must be called before using other methods
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    try {
      // Try to get existing collection first
      try {
        this.collection = await this.client.getCollection({
          name: this.collectionName,
        });
        console.log(`✅ Connected to existing collection: ${this.collectionName}`);
      } catch (error) {
        // Collection doesn't exist, create it
        this.collection = await this.client.createCollection({
          name: this.collectionName,
          metadata: {
            description: 'Project documentation for Claude Code agents',
            created: new Date().toISOString(),
          },
        });
        console.log(`✅ Created new collection: ${this.collectionName}`);
      }

      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize vector DB: ${error}`);
    }
  }

  /**
   * Ensure the database is initialized
   */
  private async ensureInitialized(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
  }

  /**
   * Semantic search across all project documentation
   * @param query - Natural language question
   * @param options - Search options (limit, threshold, filters)
   * @returns Relevant document chunks with scores
   */
  async query(
    query: string,
    options: QueryOptions = {}
  ): Promise<QueryResult[]> {
    await this.ensureInitialized();

    const {
      limit = 5,
      threshold = 0.7,
      category,
      source,
      tags,
      dateRange,
    } = options;

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // Generate embedding for query
    if (!this.embeddingFunction) {
      throw new Error('Embedding function not configured. Please provide one in the constructor.');
    }

    const embedding = await this.embeddingFunction.generate(query);

    // Build where clause for filtering
    const whereClause: any = {};
    if (category) whereClause.category = category;
    if (source) whereClause.source = source;
    if (tags && tags.length > 0) {
      whereClause.tags = { $in: tags };
    }
    if (dateRange) {
      if (dateRange.start || dateRange.end) {
        whereClause.lastModified = {};
        if (dateRange.start) {
          whereClause.lastModified.$gte = dateRange.start.toISOString();
        }
        if (dateRange.end) {
          whereClause.lastModified.$lte = dateRange.end.toISOString();
        }
      }
    }

    // Query ChromaDB
    const results = await this.collection.query({
      queryEmbeddings: [embedding],
      nResults: limit,
      where: Object.keys(whereClause).length > 0 ? whereClause : undefined,
    });

    // Process and filter results
    const queryResults: QueryResult[] = [];

    if (results.distances && results.distances[0]) {
      for (let i = 0; i < results.distances[0].length; i++) {
        const distance = results.distances[0][i];
        const similarity = 1 - distance; // Convert distance to similarity

        if (similarity >= threshold) {
          queryResults.push({
            content: results.documents[0][i] || '',
            metadata: (results.metadatas?.[0]?.[i] as DocumentMetadata) || {},
            score: similarity,
            id: results.ids[0][i],
          });
        }
      }
    }

    // Sort by score (highest first)
    queryResults.sort((a, b) => b.score - a.score);

    return queryResults;
  }

  /**
   * Search within a specific category
   * @param category - Doc category (architecture, chatbot, design, etc.)
   * @param query - Search query
   * @returns Relevant documents from that category
   */
  async searchByCategory(
    category: string,
    query: string,
    options: Omit<QueryOptions, 'category'> = {}
  ): Promise<QueryResult[]> {
    return this.query(query, { ...options, category });
  }

  /**
   * Get recently modified documents
   * @param days - Number of days to look back
   * @returns Documents modified within the specified time period
   */
  async getRecentDocs(days: number): Promise<VectorDocument[]> {
    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // ChromaDB doesn't support date comparisons directly
    // Get all documents and filter in JavaScript
    const results = await this.collection.get();

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    const documents: VectorDocument[] = [];
    for (let i = 0; i < results.ids.length; i++) {
      const metadata = (results.metadatas?.[i] as any) || {};

      // Check if document is recent enough
      if (metadata.lastModified) {
        const docDate = new Date(metadata.lastModified);
        if (docDate >= cutoffDate) {
          documents.push({
            id: results.ids[i],
            content: results.documents[i] || '',
            metadata: metadata as DocumentMetadata,
            embedding: results.embeddings?.[i],
          });
        }
      }
    }

    return documents;
  }

  /**
   * Add documents to the vector database
   * @param documents - Documents to add with their embeddings
   */
  async addDocuments(documents: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    if (documents.length === 0) return;

    // Generate embeddings if not provided
    const docsToEmbed = documents.filter(d => !d.embedding);
    if (docsToEmbed.length > 0) {
      if (!this.embeddingFunction) {
        throw new Error('Embeddings required but no embedding function provided');
      }

      for (const doc of docsToEmbed) {
        doc.embedding = await this.embeddingFunction.generate(doc.content);
      }
    }

    // Add to ChromaDB (filter out complex metadata types)
    await this.collection.add({
      ids: documents.map(d => d.id),
      documents: documents.map(d => d.content),
      embeddings: documents.map(d => d.embedding!),
      metadatas: documents.map(d => this.sanitizeMetadata(d.metadata)),
    });
  }

  /**
   * Update existing documents
   * @param documents - Documents to update (must have matching IDs)
   */
  async updateDocuments(documents: VectorDocument[]): Promise<void> {
    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // Generate embeddings if needed
    for (const doc of documents) {
      if (!doc.embedding && this.embeddingFunction) {
        doc.embedding = await this.embeddingFunction.generate(doc.content);
      }
    }

    // Update in ChromaDB (filter out complex metadata types)
    await this.collection.update({
      ids: documents.map(d => d.id),
      documents: documents.map(d => d.content),
      embeddings: documents.map(d => d.embedding),
      metadatas: documents.map(d => this.sanitizeMetadata(d.metadata)),
    });
  }

  /**
   * Delete documents by IDs
   * @param ids - Document IDs to delete
   */
  async deleteDocuments(ids: string[]): Promise<void> {
    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    if (ids.length === 0) return;

    await this.collection.delete({ ids });
  }

  /**
   * Get all documents (use with caution on large collections)
   * @param limit - Maximum number of documents to return
   * @returns All documents in the collection
   */
  async getAllDocuments(limit?: number): Promise<VectorDocument[]> {
    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    const results = await this.collection.get({ limit });

    const documents: VectorDocument[] = [];
    for (let i = 0; i < results.ids.length; i++) {
      documents.push({
        id: results.ids[i],
        content: results.documents[i] || '',
        metadata: (results.metadatas?.[i] as DocumentMetadata) || {},
        embedding: results.embeddings?.[i],
      });
    }

    return documents;
  }

  /**
   * Export collection to JSONL for backup
   * @param outputPath - Path to save the backup file
   */
  async exportBackup(outputPath: string): Promise<void> {
    await this.ensureInitialized();

    const documents = await this.getAllDocuments();
    const stats = await this.getStats();

    const backup: BackupData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      documents,
      stats,
    };

    // Write as JSONL (one document per line)
    const jsonl = documents
      .map(doc =>
        JSON.stringify({
          id: doc.id,
          content: doc.content,
          metadata: doc.metadata,
          // Optionally exclude embeddings to save space
          // embedding: doc.embedding,
        })
      )
      .join('\n');

    // Write backup metadata as first line
    const fullBackup = JSON.stringify({
      version: backup.version,
      exportDate: backup.exportDate,
      stats: backup.stats,
    }) + '\n' + jsonl;

    fs.writeFileSync(outputPath, fullBackup);
    console.log(`✅ Backup exported to ${outputPath}`);
  }

  /**
   * Import backup from JSONL file
   * @param inputPath - Path to the backup file
   * @param clearExisting - Whether to clear existing data first
   */
  async importBackup(
    inputPath: string,
    clearExisting = false
  ): Promise<void> {
    await this.ensureInitialized();

    if (!fs.existsSync(inputPath)) {
      throw new Error(`Backup file not found: ${inputPath}`);
    }

    const content = fs.readFileSync(inputPath, 'utf-8');
    const lines = content.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      throw new Error('Backup file is empty');
    }

    // First line contains metadata
    const metadata = JSON.parse(lines[0]);
    console.log(`📦 Importing backup from ${metadata.exportDate}`);

    // Parse documents
    const documents: VectorDocument[] = [];
    for (let i = 1; i < lines.length; i++) {
      const doc = JSON.parse(lines[i]);
      documents.push(doc);
    }

    if (clearExisting && this.collection) {
      // Clear existing collection
      await this.client.deleteCollection({ name: this.collectionName });
      this.collection = await this.client.createCollection({
        name: this.collectionName,
        metadata: {
          description: 'Project documentation for Claude Code agents',
          created: new Date().toISOString(),
        },
      });
    }

    // Add documents in batches
    const batchSize = 100;
    for (let i = 0; i < documents.length; i += batchSize) {
      const batch = documents.slice(i, i + batchSize);
      await this.addDocuments(batch);
      console.log(`  Imported ${Math.min(i + batchSize, documents.length)}/${documents.length} documents`);
    }

    console.log(`✅ Import complete: ${documents.length} documents`);
  }

  /**
   * Get collection statistics
   * @returns Statistics about the collection
   */
  async getStats(): Promise<CollectionStats> {
    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    const count = await this.collection.count();
    const sample = await this.collection.get({ limit: 1000 });

    // Calculate statistics
    const categories: Record<string, number> = {};
    const sources: Record<string, number> = {};
    let totalChunkSize = 0;

    for (let i = 0; i < sample.ids.length; i++) {
      const metadata = sample.metadatas?.[i] as any;
      const content = sample.documents[i];

      if (metadata?.category) {
        categories[metadata.category] = (categories[metadata.category] || 0) + 1;
      }
      if (metadata?.source) {
        sources[metadata.source] = (sources[metadata.source] || 0) + 1;
      }
      if (content) {
        totalChunkSize += content.length;
      }
    }

    const averageChunkSize = sample.ids.length > 0
      ? Math.round(totalChunkSize / sample.ids.length)
      : 0;

    return {
      totalDocuments: count,
      categories,
      sources,
      lastUpdated: new Date().toISOString(),
      averageChunkSize,
    };
  }

  /**
   * Clear all documents from the collection
   * @param confirm - Must be true to actually delete all documents
   */
  async clearCollection(confirm = false): Promise<void> {
    if (!confirm) {
      throw new Error('Must confirm deletion by passing true');
    }

    await this.ensureInitialized();

    if (!this.collection) {
      throw new Error('Collection not initialized');
    }

    // Delete and recreate the collection
    await this.client.deleteCollection({ name: this.collectionName });

    this.collection = await this.client.createCollection({
      name: this.collectionName,
      metadata: {
        description: 'Project documentation for Claude Code agents',
        created: new Date().toISOString(),
      },
    });

    console.log(`✅ Collection ${this.collectionName} cleared`);
  }

  /**
   * Check if the ChromaDB server is running
   * @returns True if the server is accessible
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.client.heartbeat();
      return true;
    } catch (error) {
      return false;
    }
  }
}