
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
  progress: number; // 0-100
  sedimentLevel: number; // Height of the stack based on notes
  intention?: string; // The user's goal for this book
  lastLocation?: string; // EPUB CFI string for position
}

export interface ThoughtCard {
  id: string;
  bookId: string; // Foreign key to link card to book
  quote: string;
  note: string;
  timestamp: number;
}
