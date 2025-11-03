
import { openDB, IDBPDatabase } from 'idb';

const DB_NAME = 'keychain-db';
const STORE_NAME = 'session-keys';

let dbPromise: Promise<IDBPDatabase> | null = null;

function getDb(): Promise<IDBPDatabase> {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, 1, {
      upgrade(db) {
        db.createObjectStore(STORE_NAME);
      },
    });
  }
  return dbPromise;
}

/**
 * Adds a session key to the keychain for a specific conversation.
 * The keychain for a conversation is an array of key objects.
 */
export async function addSessionKey(
  conversationId: string,
  sessionId: string,
  key: Uint8Array
): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  const store = tx.objectStore(STORE_NAME);
  const currentKeys = (await store.get(conversationId)) || [];
  
  // Avoid adding duplicate keys
  if (!currentKeys.some((k: any) => k.sessionId === sessionId)) {
    await store.put([...currentKeys, { sessionId, key }], conversationId);
  }
  await tx.done;
}

/**
 * Retrieves a specific session key from the keychain.
 */
export async function getSessionKey(
  conversationId: string,
  sessionId: string
): Promise<Uint8Array | null> {
  const db = await getDb();
  const keys = (await db.get(STORE_NAME, conversationId)) as any[];
  if (!keys) return null;
  
  const keyObj = keys.find(k => k.sessionId === sessionId);
  return keyObj ? keyObj.key : null;
}

/**
 * Retrieves the most recently added session key for a conversation.
 */
export async function getLatestSessionKey(
  conversationId: string
): Promise<{ sessionId: string; key: Uint8Array } | null> {
  const db = await getDb();
  const keys = (await db.get(STORE_NAME, conversationId)) as any[];
  if (!keys || keys.length === 0) return null;
  
  return keys[keys.length - 1]; // The last key is the latest
}

/**
 * Clears all keys from the database. Used on logout.
 */
export async function clearAllKeys(): Promise<void> {
  const db = await getDb();
  const tx = db.transaction(STORE_NAME, 'readwrite');
  await tx.objectStore(STORE_NAME).clear();
  await tx.done;
}
