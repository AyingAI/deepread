
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppState, Book } from './types';
import { LoginView } from './components/LoginView';
import { DeskView } from './components/DeskView';
import { RitualView } from './components/RitualView';
import { ReadingView } from './components/ReadingView';
import { updateBookMetadata } from './utils/db';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.LOGIN);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  const handleLogin = () => {
    setView(AppState.DESK);
  };

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);
    
    // Optimization: Only ask for intention if it's not set yet.
    // Otherwise, resume reading immediately.
    if (book.intention && book.intention.trim().length > 0) {
        setView(AppState.READING);
    } else {
        setView(AppState.RITUAL);
    }
  };

  const handleRitualComplete = async (userIntention: string) => {
    if (currentBook) {
        // Persist the intention immediately
        const updatedBook = { ...currentBook, intention: userIntention };
        await updateBookMetadata(currentBook.id, { intention: userIntention });
        setCurrentBook(updatedBook);
        setView(AppState.READING);
    }
  };

  const handleBack = async () => {
    // When returning to desk, refresh the books is handled by DeskView's useEffect, 
    // but clearing currentBook is key.
    setView(AppState.DESK);
    setCurrentBook(null);
  };

  return (
    <div className="w-full h-full">
      <AnimatePresence mode="wait">
        {view === AppState.LOGIN && (
          <motion.div key="login" className="w-full h-full" exit={{ opacity: 0 }}>
            <LoginView onLogin={handleLogin} />
          </motion.div>
        )}
        
        {view === AppState.DESK && (
          <motion.div key="desk" className="w-full h-full">
            <DeskView onSelectBook={handleSelectBook} />
          </motion.div>
        )}

        {view === AppState.RITUAL && currentBook && (
          <motion.div key="ritual" className="w-full h-full">
            <RitualView 
              book={currentBook} 
              onComplete={handleRitualComplete} 
              onBack={handleBack}
            />
          </motion.div>
        )}

        {view === AppState.READING && currentBook && (
          <motion.div 
            key="reading" 
            className="w-full h-full"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <ReadingView 
              book={currentBook} 
              // Pass the intention from the book object itself now
              intention={currentBook.intention || ''} 
              onBack={handleBack}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default App;
