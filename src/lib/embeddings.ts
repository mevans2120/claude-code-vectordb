/**
 * Embedding function using Google AI (same as chatbot)
 * Reuses existing embedding logic to maintain consistency
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import type { EmbeddingFunction } from './types';

/**
 * Google AI embedding function using text-embedding-004 model
 * This is the same model and configuration used by the chatbot
 * to ensure consistency in vector search results
 */
export class GoogleAIEmbeddingFunction implements EmbeddingFunction {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(apiKey?: string) {
    const key = apiKey || process.env.GOOGLE_GENERATIVE_AI_API_KEY;

    if (!key) {
      throw new Error(
        'Google AI API key required. Set GOOGLE_GENERATIVE_AI_API_KEY environment variable.'
      );
    }

    this.genAI = new GoogleGenerativeAI(key);
    this.model = this.genAI.getGenerativeModel({
      model: 'text-embedding-004', // Same as chatbot
    });
  }

  /**
   * Generate embeddings for a text string
   * @param text - Text to embed
   * @returns Embedding vector (384 dimensions for text-embedding-004)
   */
  async generate(text: string): Promise<number[]> {
    try {
      const result = await this.model.embedContent(text);
      return result.embedding.values;
    } catch (error) {
      console.error('Error generating embedding:', error);
      throw new Error(`Failed to generate embedding: ${error}`);
    }
  }
}

/**
 * Factory function to create the default embedding function
 * This ensures we use the same embedding model as the chatbot
 */
export function createDefaultEmbeddingFunction(): EmbeddingFunction {
  return new GoogleAIEmbeddingFunction();
}