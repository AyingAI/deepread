
import { Book, ThoughtCard } from '../types';

const DB_NAME = 'DeepreadDB';
const DB_VERSION = 2;
const STORE_BOOKS = 'books';
const STORE_CONTENT = 'content';
const STORE_CARDS = 'cards';

// --- Connection pool: reuse a single db handle ---
let dbPromise: Promise<IDBDatabase> | null = null;

const getDB = (): Promise<IDBDatabase> => {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_BOOKS)) {
          db.createObjectStore(STORE_BOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CONTENT)) {
          db.createObjectStore(STORE_CONTENT, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_CARDS)) {
          const cardStore = db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
          cardStore.createIndex('bookId', 'bookId', { unique: false });
        }
      };
    });
  }
  return dbPromise;
};

// Helper: run a single readwrite transaction
const withStores = async <T>(storeNames: string[], mode: IDBTransactionMode, fn: (stores: IDBObjectStore[]) => Promise<T> | T): Promise<T> => {
  const db = await getDB();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(storeNames, mode);
    tx.oncomplete = () => {};
    tx.onerror = () => reject(tx.error);
    const stores = storeNames.map(name => tx.objectStore(name));
    Promise.resolve(fn(stores)).then(resolve).catch(reject);
  });
};

// --- Books ---

export const saveBookToDB = async (book: Book, arrayBuffer: ArrayBuffer) => {
  await withStores([STORE_BOOKS, STORE_CONTENT], 'readwrite', async ([bookStore, contentStore]) => {
    bookStore.put(book);
    contentStore.put({ id: book.id, data: arrayBuffer });
  });
};

// O(1): direct key lookup instead of full-table scan
export const updateBookMetadata = async (id: string, updates: Partial<Book>) => {
  await withStores([STORE_BOOKS], 'readwrite', async ([store]) => {
    return new Promise<void>((resolve, reject) => {
      const getReq = store.get(id);
      getReq.onsuccess = () => {
        const book = getReq.result;
        if (!book) { resolve(); return; }
        store.put({ ...book, ...updates });
        resolve();
      };
      getReq.onerror = () => reject(getReq.error);
    });
  });
};

export const getBooksFromDB = async (): Promise<Book[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_BOOKS, 'readonly');
    const req = tx.objectStore(STORE_BOOKS).getAll();
    req.onsuccess = () => resolve(req.result || []);
    req.onerror = () => reject(req.error);
  });
};

export const deleteBookFromDB = async (id: string) => {
  await withStores([STORE_BOOKS, STORE_CONTENT, STORE_CARDS], 'readwrite', async ([bookStore, contentStore, cardStore]) => {
    bookStore.delete(id);
    contentStore.delete(id);
    // Delete all cards for this book
    const index = cardStore.index('bookId');
    const req = index.openCursor(IDBKeyRange.only(id));
    return new Promise<void>((resolve, reject) => {
      req.onsuccess = () => {
        const cursor = req.result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        } else {
          resolve();
        }
      };
      req.onerror = () => reject(req.error);
    });
  });
};

// --- Content ---

export const getBookContentFromDB = async (id: string): Promise<ArrayBuffer | null> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_CONTENT, 'readonly').objectStore(STORE_CONTENT).get(id);
    req.onsuccess = () => resolve(req.result?.data ?? null);
    req.onerror = () => reject(req.error);
  });
};

// --- Cards ---

export const saveCardToDB = async (card: ThoughtCard) => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CARDS, 'readwrite');
    tx.objectStore(STORE_CARDS).put(card);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const getCardsForBook = async (bookId: string): Promise<ThoughtCard[]> => {
  const db = await getDB();
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE_CARDS, 'readonly').objectStore(STORE_CARDS).index('bookId').getAll(bookId);
    req.onsuccess = () => {
      const cards = req.result || [];
      cards.sort((a, b) => b.timestamp - a.timestamp);
      resolve(cards);
    };
    req.onerror = () => reject(req.error);
  });
};

export const deleteCardFromDB = async (id: string) => {
  const db = await getDB();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(STORE_CARDS, 'readwrite');
    tx.objectStore(STORE_CARDS).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};
