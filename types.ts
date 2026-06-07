
export enum AppState {
  LOGIN = 'LOGIN',
  DESK = 'DESK',
  RITUAL = 'RITUAL',
  READING = 'READING'
}

export interface Book {
  id: string;
  title: string;
  author: string;
  coverColor: string;
  coverImage?: string; // data URL of EPUB cover, fallback to coverColor
  progress: number; // 0-100
  sedimentLevel: number; // Height of the stack based on notes
  intention?: string; // The user's goal for this book
  lastLocation?: string; // EPUB CFI string for position
  reviewNote?: string; // Final reflection after reading
  completedAt?: number; // Timestamp when review was saved
  totalReadingMs?: number; // Cumulative reading time in milliseconds
  lastReadAt?: number; // Timestamp of last reading session
}

export interface ThoughtCard {
  id: string;
  bookId: string; // Foreign key to link card to book
  quote: string;
  note: string;
  timestamp: number;
}
