/**
 * TKDL API Response Caching Middleware
 * 
 * Caches GET request responses to reduce database load and speed up repeated requests
 * 
 * Usage:
 * app.use('/api', cacheMiddleware(30)); // Cache API responses for 30 seconds
 */

import { Request, Response, NextFunction } from 'express';

interface CacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
}

class ResponseCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cleanupInterval: NodeJS.Timeout | null = null;

  constructor() {
    // Clean up expired cache entries every 5 minutes
    this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Generate cache key from request
   * Includes URL, query params, but NOT auth headers (those change per user)
   */
  private getKey(req: Request): string {
    const path = req.path;
    const query = JSON.stringify(req.query);
    const userId = (req as any).user?.id || 'anon';
    return `${userId}:${path}:${query}`;
  }

  /**
   * Get cached response if available and not expired
   */
  get(req: Request): any | null {
    if (req.method !== 'GET') return null;

    const key = this.getKey(req);
    const entry = this.cache.get(key);

    if (!entry) return null;

    // Check if expired
    const age = Date.now() - entry.timestamp;
    if (age > entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data;
  }

  /**
   * Store response in cache
   */
  set(req: Request, data: any, ttlSeconds: number): void {
    if (req.method !== 'GET') return;

    const key = this.getKey(req);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttlSeconds * 1000,
    });
  }

  /**
   * Clear all expired cache entries
   */
  private cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.ttl) {
        this.cache.delete(key);
      }
    }
  }

  /**
   * Clear entire cache (for testing)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache stats (for monitoring)
   */
  getStats() {
    return {
      entries: this.cache.size,
      memory: process.memoryUsage().heapUsed,
    };
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.cache.clear();
  }
}

// Global cache instance
const cache = new ResponseCache();

/**
 * Cache strategy for different endpoints
 */
const CACHE_STRATEGIES = {
  // Player data - cache for 5 minutes (changes less frequently)
  '/api/players': 300,
  '/api/players/:id': 300,
  '/api/players/:id/stats': 300,
  '/api/players/:id/stats/category': 300,
  '/api/players/:id/stats/category/:category': 300,
  
  // Leaderboard - cache for 2 minutes
  '/api/leaderboard': 120,
  '/api/league/rankings': 120,
  
  // Matches - cache for 1 minute
  '/api/matches': 60,
  '/api/matches/recent': 60,
  
  // Coach data - cache for 10 minutes
  '/api/players/:id/practice-routine': 600,
  '/api/players/:id/stats/coach-feed': 300,
  
  // Streaks - cache for 5 minutes
  '/api/players/:id/streaks': 300,
  
  // Drills - cache for 10 minutes
  '/api/players/:id/drills/stats': 600,
  '/api/players/:id/drills/milestones': 600,
  '/api/players/:id/drills/adaptive': 600,
  
  // Community - cache posts for 30 seconds (frequently updated)
  '/api/community/posts': 30,
  '/api/community/posts/pending': 15,  // Admin posts update frequently
  
  // Settings - cache for 2 minutes (doesn't change often)
  '/api/settings': 120,
  
  // Default for any GET endpoint not listed above
  default: 60,
};

/**
 * Get cache TTL for a request
 */
function getCacheTTL(path: string): number | null {
  // Don't cache POST/PUT/DELETE/PATCH
  if (!path.startsWith('/api')) return null;

  // Check for exact match
  if (path in CACHE_STRATEGIES) {
    return CACHE_STRATEGIES[path as keyof typeof CACHE_STRATEGIES];
  }

  // Check for pattern matches
  for (const [pattern, ttl] of Object.entries(CACHE_STRATEGIES)) {
    if (pattern === 'default') continue;
    
    // Simple pattern matching (replace :id with actual IDs)
    const regex = new RegExp(`^${pattern.replace(/:[^/]+/g, '[^/]+')}$`);
    if (regex.test(path)) {
      return ttl;
    }
  }

  // Use default for other GET requests
  return CACHE_STRATEGIES.default;
}

/**
 * Express middleware for response caching
 */
export function cacheMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    const ttl = getCacheTTL(req.path);

    // Only cache GET requests
    if (req.method !== 'GET' || !ttl) {
      return next();
    }

    // Check if response is in cache
    const cachedResponse = cache.get(req);
    if (cachedResponse) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedResponse);
    }

    res.set('X-Cache', 'MISS');

    // Intercept res.json() to cache the response
    const originalJson = res.json.bind(res);
    res.json = function(data: any) {
      // Only cache successful responses
      if (res.statusCode === 200) {
        cache.set(req, data, ttl);
      }
      return originalJson(data);
    };

    next();
  };
}

/**
 * Invalidate cache on mutations
 * Call this after POST/PUT/DELETE/PATCH operations
 */
export function invalidateCache(pattern?: string): void {
  if (!pattern) {
    cache.clear();
  } else {
    // Implement pattern-based invalidation if needed
    cache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getCacheStats() {
  return cache.getStats();
}

/**
 * Cleanup function (call on server shutdown)
 */
export function cleanupCache(): void {
  cache.destroy();
}

export default cacheMiddleware;
