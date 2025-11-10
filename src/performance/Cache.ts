/**
 * Cache System
 * Provides file content and search result caching for performance optimization
 */

import fs from 'fs/promises';
import crypto from 'crypto';

export interface CacheEntry<T> {
  value: T;
  timestamp: number;
  hash?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in milliseconds
  maxSize?: number; // Maximum number of entries
}

export class Cache<T> {
  private cache: Map<string, CacheEntry<T>> = new Map();
  private ttl: number;
  private maxSize: number;

  constructor(options: CacheOptions = {}) {
    this.ttl = options.ttl || 60000; // Default 1 minute
    this.maxSize = options.maxSize || 100; // Default 100 entries
  }

  /**
   * Get value from cache
   */
  get(key: string): T | undefined {
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Check if expired
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.value;
  }

  /**
   * Set value in cache
   */
  set(key: string, value: T, hash?: string): void {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }

    this.cache.set(key, {
      value,
      timestamp: Date.now(),
      hash,
    });
  }

  /**
   * Check if key exists and is valid
   */
  has(key: string): boolean {
    return this.get(key) !== undefined;
  }

  /**
   * Delete key from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache size
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Get cache statistics
   */
  getStats(): { size: number; maxSize: number; ttl: number } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    let removed = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}

/**
 * File Cache
 * Caches file contents with automatic invalidation on file changes
 */
export class FileCache {
  private cache: Cache<string>;
  private hashCache: Map<string, string> = new Map();

  constructor(options: CacheOptions = {}) {
    this.cache = new Cache<string>({
      ttl: options.ttl || 300000, // Default 5 minutes for files
      maxSize: options.maxSize || 50,
    });
  }

  /**
   * Get file content from cache or read from disk
   */
  async get(filePath: string): Promise<string> {
    // Check if cached
    const cached = this.cache.get(filePath);
    if (cached) {
      // Verify file hasn't changed
      const currentHash = await this.getFileHash(filePath);
      const cachedHash = this.hashCache.get(filePath);

      if (currentHash === cachedHash) {
        return cached;
      }
    }

    // Read from disk and cache
    const content = await fs.readFile(filePath, 'utf-8');
    const hash = await this.getFileHash(filePath);

    this.cache.set(filePath, content, hash);
    this.hashCache.set(filePath, hash);

    return content;
  }

  /**
   * Invalidate cache for a file
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
    this.hashCache.delete(filePath);
  }

  /**
   * Clear all cached files
   */
  clear(): void {
    this.cache.clear();
    this.hashCache.clear();
  }

  /**
   * Get file hash for change detection
   */
  private async getFileHash(filePath: string): Promise<string> {
    try {
      const stats = await fs.stat(filePath);
      // Use mtime and size as a quick hash
      return `${stats.mtimeMs}-${stats.size}`;
    } catch {
      return '';
    }
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }
}

/**
 * Result Cache
 * Caches search and analysis results
 */
export class ResultCache<T = any> {
  private cache: Cache<T>;

  constructor(options: CacheOptions = {}) {
    this.cache = new Cache<T>({
      ttl: options.ttl || 120000, // Default 2 minutes
      maxSize: options.maxSize || 200,
    });
  }

  /**
   * Generate cache key from parameters
   */
  private generateKey(params: Record<string, any>): string {
    const sortedParams = Object.keys(params)
      .sort()
      .reduce((acc, key) => {
        acc[key] = params[key];
        return acc;
      }, {} as Record<string, any>);

    return crypto
      .createHash('md5')
      .update(JSON.stringify(sortedParams))
      .digest('hex');
  }

  /**
   * Get result from cache
   */
  get(params: Record<string, any>): T | undefined {
    const key = this.generateKey(params);
    return this.cache.get(key);
  }

  /**
   * Set result in cache
   */
  set(params: Record<string, any>, result: T): void {
    const key = this.generateKey(params);
    this.cache.set(key, result);
  }

  /**
   * Check if result is cached
   */
  has(params: Record<string, any>): boolean {
    const key = this.generateKey(params);
    return this.cache.has(key);
  }

  /**
   * Clear cache
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return this.cache.getStats();
  }

  /**
   * Cleanup expired entries
   */
  cleanup(): number {
    return this.cache.cleanup();
  }
}

// Global cache instances
export const globalFileCache = new FileCache({
  ttl: 300000, // 5 minutes
  maxSize: 50,
});

export const globalSearchCache = new ResultCache({
  ttl: 120000, // 2 minutes
  maxSize: 200,
});
