
import React, { useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AppState, Book } from './types';
import { EntryView } from './components/EntryView';
import { DeskView } from './components/DeskView';
import { RitualView } from './components/RitualView';
import { ReadingView } from './components/ReadingView';
import { updateBookMetadata } from './utils/db';

const App: React.FC = () => {
  const [view, setView] = useState<AppState>(AppState.ENTRY);
  const [currentBook, setCurrentBook] = useState<Book | null>(null);

  const handleEnter = () => {
    setView(AppState.DESK);
  };

  const handleSelectBook = (book: Book) => {
    setCurrentBook(book);

    if (book.intention && book.intention.trim().length > 0) {
        setView(AppState.READING);
    } else {
        setView(AppState.RITUAL);
    }
  };

  const handleRitualComplete = async (userIntention: string) => {
    if (currentBook) {
        const updatedBook = { ...currentBook, intention: userIntention };
        await updateBookMetadata(currentBook.id, { intention: userIntention });
        setCurrentBook(updatedBook);
        setView(AppState.READING);
    }
  };

  const handleBack = async () => {
    setView(AppState.DESK);
    setCurrentBook(null);
  };

  return (
    <div className="w-full h-full">
      <AnimatePresence mode="wait">
        {view === AppState.ENTRY && (
          <motion.div key="entry" className="w-full h-full" exit={{ opacity: 0 }}>
            <EntryView onEnter={handleEnter} />
          </motion.div>
        )}

        {view === AppState.DESK && (
          <motion.div key="desk" className="w-full h-full" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
            <DeskView onSelectBook={handleSelectBook} />
          </motion.div>
        )}

        {view === AppState.RITUAL && currentBook && (
          <motion.div key="ritual" className="w-full h-full" exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
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
