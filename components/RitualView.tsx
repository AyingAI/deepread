import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Book as BookType } from '../types';
import { ArrowLeft } from 'lucide-react';

interface RitualViewProps {
  book: BookType;
  onComplete: (intention: string) => void;
  onBack: () => void;
}

export const RitualView: React.FC<RitualViewProps> = ({ book, onComplete, onBack }) => {
  const [intention, setIntention] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (intention.trim()) {
      onComplete(intention);
    }
  };

  return (
    <motion.div 
      className="w-full h-screen bg-[#FAF0E6] flex flex-col items-center justify-center relative z-10"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, filter: 'blur(10px)' }}
      transition={{ duration: 1.5 }}
    >
      {/* Back Button */}
      <button 
        onClick={onBack}
        className="absolute top-8 left-8 p-2 text-[#4A4A4A] opacity-50 hover:opacity-100 transition-opacity"
      >
        <ArrowLeft size={24} />
      </button>

      {/* Top Meta */}
      <div className="absolute top-12 text-[#4A4A4A] opacity-40 text-xs tracking-[0.2em] font-serif uppercase">
        Reading: {book.title}
      </div>

      <div className="max-w-2xl w-full px-8 text-center">
        <motion.h2 
          className="text-3xl md:text-4xl text-[#4A4A4A] font-serif font-light mb-16"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 1 }}
        >
          今天，你为了什么翻开这本书？
        </motion.h2>

        <form onSubmit={handleSubmit} className="relative w-full group">
          <input
            type="text"
            value={intention}
            onChange={(e) => setIntention(e.target.value)}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            placeholder="写下一个你最关心的问题"
            className="w-full bg-transparent text-center text-xl md:text-2xl text-[#2a2a2a] placeholder-gray-400/50 outline-none font-fangsong py-4"
            autoFocus
          />
          
          {/* Animated Line */}
          <div className="h-[1px] bg-gray-300 w-full relative overflow-hidden mt-2">
            <motion.div 
              className="absolute inset-0 bg-[#4A4A4A]"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: isFocused || intention ? 1 : 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }} // EaseOutExpo
            />
          </div>

          <motion.div 
             className="mt-8 text-xs text-gray-400 font-serif tracking-widest opacity-0"
             animate={{ opacity: intention ? 1 : 0 }}
             transition={{ duration: 0.5 }}
          >
             按 Enter 进入沉浸阅读
          </motion.div>
        </form>
      </div>
    </motion.div>
  );
};