
import { Book, ThoughtCard } from '../types';

const DB_NAME = 'DeepreadDB';
const DB_VERSION = 2; // Incremented version for schema changes
const STORE_BOOKS = 'books';
const STORE_CONTENT = 'content';
const STORE_CARDS = 'cards'; // New store for notes

export const initDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
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
      // Create Cards Store
      if (!db.objectStoreNames.contains(STORE_CARDS)) {
        const cardStore = db.createObjectStore(STORE_CARDS, { keyPath: 'id' });
        cardStore.createIndex('bookId', 'bookId', { unique: false });
      }
    };
  });
};

export const saveBookToDB = async (book: Book, arrayBuffer: ArrayBuffer) => {
  const db = await initDB();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction([STORE_BOOKS, STORE_CONTENT], 'readwrite');
    
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);

    const bookStore = transaction.objectStore(STORE_BOOKS);
    const contentStore = transaction.objectStore(STORE_CONTENT);

    bookStore.put(book);
    contentStore.put({ id: book.id, data: arrayBuffer });
  });
};

// Update only specific fields of a book (e.g., progress, intention, location)
export const updateBookMetadata = async (id: string, updates: Partial<Book>) => {
    const db = await initDB();
    const books = await getBooksFromDB();
    const book = books.find(b => b.id === id);
    if (!book) return;

    const updatedBook = { ...book, ...updates };
    
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_BOOKS], 'readwrite');
        const store = transaction.objectStore(STORE_BOOKS);
        store.put(updatedBook);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getBooksFromDB = async (): Promise<Book[]> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_BOOKS, 'readonly');
    const store = transaction.objectStore(STORE_BOOKS);
    const request = store.getAll();

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
};

export const getBookContentFromDB = async (id: string): Promise<ArrayBuffer | null> => {
  const db = await initDB();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_CONTENT, 'readonly');
    const store = transaction.objectStore(STORE_CONTENT);
    const request = store.get(id);

    request.onsuccess = () => {
        if (request.result) {
            resolve(request.result.data);
        } else {
            resolve(null);
        }
    };
    request.onerror = () => reject(request.error);
  });
};

// --- Card Methods ---

export const saveCardToDB = async (card: ThoughtCard) => {
    const db = await initDB();
    return new Promise<void>((resolve, reject) => {
        const transaction = db.transaction([STORE_CARDS], 'readwrite');
        const store = transaction.objectStore(STORE_CARDS);
        store.put(card);
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => reject(transaction.error);
    });
};

export const getCardsForBook = async (bookId: string): Promise<ThoughtCard[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const transaction = db.transaction([STORE_CARDS], 'readonly');
        const store = transaction.objectStore(STORE_CARDS);
        const index = store.index('bookId');
        const request = index.getAll(bookId);

        request.onsuccess = () => {
            // Sort by timestamp descending (newest first)
            const cards = request.result || [];
            cards.sort((a, b) => b.timestamp - a.timestamp);
            resolve(cards);
        };
        request.onerror = () => reject(request.error);
    });
};
