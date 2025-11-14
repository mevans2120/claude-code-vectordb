/**
 * Type definitions for the vector database API
 */

export interface VectorDocument {
  id: string;
  content: string;
  metadata: DocumentMetadata;
  embedding?: number[];
}

export interface DocumentMetadata {
  source: string; // 'docs', 'memory-bank', 'claude-md', etc.
  category?: string; // 'architecture', 'chatbot', 'design', 'implementation-plans', etc.
  filePath?: string; // Original file path
  title?: string;
  lastModified?: string;
  priority?: number; // Higher = more important
  tags?: string[];
  [key: string]: any; // Allow additional metadata
}

export interface QueryResult {
  content: string;
  metadata: DocumentMetadata;
  score: number; // Similarity score (0-1, higher = more similar)
  id: string;
}

export interface QueryOptions {
  limit?: number; // Number of results to return (default: 5)
  threshold?: number; // Minimum similarity threshold (default: 0.7)
  category?: string; // Filter by category
  source?: string; // Filter by source
  tags?: string[]; // Filter by tags
  dateRange?: {
    start?: Date;
    end?: Date;
  };
}

export interface CollectionStats {
  totalDocuments: number;
  categories: Record<string, number>;
  sources: Record<string, number>;
  lastUpdated: string;
  averageChunkSize: number;
}

export interface BackupData {
  version: string;
  exportDate: string;
  documents: VectorDocument[];
  stats: CollectionStats;
}

export interface EmbeddingFunction {
  generate(text: string): Promise<number[]>;
}

export interface VectorDBConfig {
  chromaUrl?: string; // Default: http://localhost:8000
  collectionName?: string; // Default: project-docs
  embeddingFunction?: EmbeddingFunction;
}