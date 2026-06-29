/**
 * Database Connection Wrapper
 * 
 * Re-exports db instance from the monorepo's @tkdl/db package
 * This allows routes to import db without path traversal issues
 */

// At runtime, load the db from the monorepo package
let dbInstance: any;

export async function initializeDb() {
  try {
    // Dynamically import to avoid bundling issues
    const dbModule = await import('../../../lib/db/src/index.ts');
    dbInstance = dbModule.db;
    return dbInstance;
  } catch (error) {
    console.error('Failed to initialize database connection:', error);
    throw error;
  }
}

export function getDb() {
  if (!dbInstance) {
    throw new Error('Database not initialized. Call initializeDb() first.');
  }
  return dbInstance;
}

// For backward compatibility, try to export db directly
// This will fail at bundle time but work at runtime if dynamic import succeeds
export { db } from '../../../lib/db/src/index.ts';
