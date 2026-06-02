
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book as BookType } from '../types';
import { Plus } from 'lucide-react';
import { saveBookToDB, getBooksFromDB } from '../utils/db';

// Access the global ePub instance loaded via <script> tag
const ePub = (window as any).ePub;

interface DeskViewProps {
  onSelectBook: (book: BookType) => void;
}

export const DeskView: React.FC<DeskViewProps> = ({ onSelectBook }) => {
  const [books, setBooks] = useState<BookType[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  useEffect(() => {
    const loadBooks = async () => {
        const storedBooks = await getBooksFromDB();
        setBooks(storedBooks.sort((a,b) => Number(b.id) - Number(a.id))); // Newest first
    };
    loadBooks();
  }, []);

  // Walnut / Cherry wood texture
  const deskStyle = {
    backgroundColor: '#3E2723',
    backgroundImage: `
      linear-gradient(rgba(20, 10, 5, 0.6), rgba(20, 10, 5, 0.8)),
      url('https://www.transparenttextures.com/patterns/wood-pattern.png')
    `,
    backgroundBlendMode: 'overlay',
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);

      try {
        const arrayBuffer = await file.arrayBuffer();
        const book = ePub(arrayBuffer);
        const metadata = await book.loaded.metadata;
        
        // Generate a random-ish consistent color based on title length
        const colors = ['#8B4513', '#2F4F4F', '#556B2F', '#800000', '#191970', '#483C32'];
        const coverColor = colors[metadata.title.length % colors.length];

        const newBook: BookType = {
          id: Date.now().toString(),
          title: metadata.title || file.name.replace('.epub', ''),
          author: metadata.creator || 'Unknown',
          coverColor: coverColor,
          progress: 0,
          sedimentLevel: 5 // Default thin book
        };

        await saveBookToDB(newBook, arrayBuffer);
        setBooks(prev => [newBook, ...prev]);

      } catch (err) {
        console.error("Failed to parse epub", err);
        alert("无法读取该文件，请确保是有效的 .epub 文件");
      } finally {
        setIsUploading(false);
      }
    }
  };

  // Split books
  const activeBooks = books.filter(b => b.progress < 100);
  const sedimentBooks = books.filter(b => b.progress === 100);

  return (
    <motion.div 
      className="w-full h-screen relative overflow-hidden flex"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.5 }}
      style={deskStyle}
    >
        {/* ================= LIGHTING & ATMOSPHERE ================= */}
        
        {/* 1. Lamp Base (Physical Object) - Top Left */}
        <div className="absolute -top-12 -left-12 z-20 pointer-events-none">
            {/* Base Structure */}
            <div className="w-64 h-64 bg-[#1a1a1a] rounded-full shadow-[10px_10px_30px_rgba(0,0,0,0.8)] relative flex items-center justify-center">
                {/* Metallic Reflection hint */}
                <div className="absolute top-4 left-4 w-40 h-40 rounded-full border border-white/5 opacity-20"></div>
                {/* Lamp Neck start */}
                <div className="absolute bottom-12 right-12 w-8 h-48 bg-[#0a0a0a] rotate-[-45deg] origin-bottom shadow-lg"></div>
            </div>
        </div>

        {/* 2. The Light Source (Glow) */}
        {/* Emanating from the lamp base area */}
        <div 
            className="absolute top-0 left-0 w-[140vw] h-[140vw] pointer-events-none z-10"
            style={{
                background: 'radial-gradient(circle at 10% 10%, rgba(255, 200, 150, 0.15) 0%, rgba(255, 160, 100, 0.05) 30%, rgba(0,0,0,0.4) 70%, rgba(0,0,0,0.8) 100%)',
                mixBlendMode: 'screen'
            }}
        />
        
        {/* 3. Warm ambient overlay for the "lit" area to unify colors */}
        <div className="absolute inset-0 bg-orange-900/10 mix-blend-color-dodge pointer-events-none z-10" />


        {/* ================= BACKGROUND PROPS (Bottom Right) ================= */}
        {/* Interactive sketches on the desk surface */}
        <div className="absolute bottom-0 right-0 z-0 w-[500px] h-[500px] pointer-events-none">
             
             {/* Pen - Rollling Interaction */}
             <motion.div 
                className="absolute bottom-32 right-20 cursor-pointer pointer-events-auto origin-center"
                style={{ width: '200px', height: '40px', rotate: 45 }}
                whileHover={{ 
                    rotate: [45, 43, 47, 45],
                    x: [0, -2, 2, 0],
                    transition: { duration: 0.4 } 
                }}
             >
                {/* Sketchy Pen SVG */}
                <svg width="200" height="40" viewBox="0 0 200 40" className="drop-shadow-md">
                    {/* Pen Body */}
                    <path d="M10,20 L180,20" stroke="#1a1a1a" strokeWidth="12" strokeLinecap="round" className="opacity-90"/>
                    <path d="M10,20 L180,20" stroke="#3e2723" strokeWidth="10" strokeLinecap="round" />
                    {/* Highlights */}
                    <path d="M20,16 L170,16" stroke="rgba(255,255,255,0.1)" strokeWidth="2" strokeLinecap="round" />
                    {/* Cap/Clip */}
                    <path d="M140,14 L180,14" stroke="#1a1a1a" strokeWidth="4" />
                    <path d="M140,14 L140,26" stroke="#1a1a1a" strokeWidth="2" />
                </svg>
             </motion.div>

             {/* Bookmarks - Floating Interaction */}
             <motion.div 
                className="absolute bottom-16 right-56 cursor-pointer pointer-events-auto"
                style={{ width: '80px', height: '120px' }}
                whileHover="hover"
             >
                 <svg width="100%" height="100%" viewBox="0 0 120 150" className="opacity-80">
                    <motion.g variants={{ hover: { y: -5, rotate: -2 } }} transition={{ type: "spring", stiffness: 100 }}>
                        {/* String */}
                        <path d="M60,0 C65,20 55,40 60,60" stroke="#333" strokeWidth="1" fill="none" />
                        {/* Tag */}
                        <rect x="40" y="60" width="40" height="70" rx="2" fill="#E3DAC9" stroke="#333" strokeWidth="1" />
                        <circle cx="60" cy="65" r="2" fill="#333" />
                        {/* Scribbles on tag */}
                        <path d="M45,80 L75,80 M45,90 L70,90 M45,100 L60,100" stroke="#333" strokeWidth="0.5" />
                    </motion.g>
                    
                    {/* Second Bookmark */}
                    <motion.g variants={{ hover: { y: -2, rotate: 2, x: 5 } }} transition={{ type: "spring", stiffness: 120, delay: 0.05 }}>
                        <rect x="80" y="90" width="30" height="50" rx="1" fill="#C0C0C0" stroke="#333" strokeWidth="1" transform="rotate(15 95 115)" />
                    </motion.g>
                 </svg>
             </motion.div>
        </div>


        {/* ================= MAIN CONTENT LAYOUT ================= */}
        
        {/* LEFT COLUMN: Sediment (Finished Books Stack) */}
        <div className="w-[160px] h-full relative z-30 flex flex-col justify-end pb-12 pl-2">
             <div className="flex flex-col-reverse items-center space-y-reverse space-y-[-4px] perspective-[1000px]">
                {sedimentBooks.map((book, i) => {
                    // Generate random variations for "messy stack" look
                    const randomX = (book.id.charCodeAt(0) % 10) - 5; 
                    const randomRot = (book.id.charCodeAt(book.id.length - 1) % 4) - 2;
                    const thickness = Math.max(28, Math.min(book.sedimentLevel, 45));

                    return (
                        <motion.div
                            key={book.id}
                            className="relative group cursor-pointer"
                            style={{ 
                                width: thickness + 'px', 
                                height: '220px', // Slightly taller for better vertical text fit
                                transform: `translateX(${randomX}px) rotate(${randomRot}deg)`,
                            }}
                            whileHover={{ x: 50, scale: 1.02 }}
                            transition={{ type: "spring", stiffness: 300, damping: 20 }}
                            onClick={() => onSelectBook(book)}
                        >
                             {/* The Spine (Visible part) */}
                             <div 
                                className="w-full h-full rounded-sm border-l border-white/10 shadow-[2px_2px_5px_rgba(0,0,0,0.6)] flex items-center justify-center relative overflow-hidden"
                                style={{ 
                                    backgroundColor: book.coverColor,
                                    backgroundImage: 'linear-gradient(to right, rgba(0,0,0,0.3), rgba(255,255,255,0.1) 20%, rgba(0,0,0,0.1) 50%, rgba(0,0,0,0.4))'
                                }}
                             >
                                 {/* Spine Label - Vertical */}
                                 {/* writing-mode: vertical-rl creates the spine text effect. 
                                     Text is rotated 90deg for English, stacked for CJK. */}
                                 <div 
                                    className="h-[90%] flex items-center justify-center text-[#FAF0E6] opacity-80 mix-blend-overlay py-4"
                                    style={{ writingMode: 'vertical-rl' }}
                                 >
                                     <span className="font-serif-en font-bold tracking-widest text-xs whitespace-nowrap overflow-hidden text-ellipsis max-h-full">
                                        {book.title}
                                     </span>
                                 </div>
                             </div>

                             {/* Hover Tooltip - Useful since spine text can be hard to read */}
                             <div className="absolute left-full top-1/2 -translate-y-1/2 ml-4 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                 <div className="bg-[#FAF0E6] text-[#2a2a2a] px-3 py-2 rounded shadow-xl whitespace-nowrap">
                                     <div className="font-serif-en font-bold text-xs mb-1">{book.title}</div>
                                     <div className="text-[10px] text-gray-500 font-serif font-normal">已读</div>
                                 </div>
                             </div>
                        </motion.div>
                    );
                })}
             </div>
        </div>

        {/* CENTER COLUMN: Active Desk (Scrollable) */}
        <div className="flex-1 h-full relative z-30 overflow-y-auto no-scrollbar mask-image-gradient">
             <div className="min-h-full p-12 pb-48 flex flex-col items-center justify-center">
                 
                 <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-x-16 gap-y-24 max-w-5xl mt-20">
                    {activeBooks.map((book) => (
                        <motion.div
                            key={book.id}
                            className="relative group cursor-pointer"
                            onClick={() => onSelectBook(book)}
                            whileHover={{ y: -5, scale: 1.02 }}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                        >
                            {/* Shadow beneath the book */}
                            <div className="absolute top-4 left-4 w-full h-full bg-black/40 blur-md rounded-sm group-hover:blur-lg group-hover:scale-105 transition-all duration-500" />
                            
                            {/* Book Cover - Flat */}
                            <div 
                                className="w-[180px] h-[260px] relative rounded-r-sm shadow-inner overflow-hidden transform transition-transform duration-500 bg-[#FAF0E6]"
                                style={{ backgroundColor: book.coverColor }}
                            >
                                {/* Spine Texture (Left edge) */}
                                <div className="absolute inset-y-0 left-0 w-3 bg-black/20 z-10" />
                                <div className="absolute inset-y-0 left-3 w-[1px] bg-white/10 z-10" />
                                
                                {/* Cover Content */}
                                <div className="p-6 h-full flex flex-col relative z-0">
                                    <div className="w-full h-full border border-[#FAF0E6]/20 flex flex-col justify-between p-2">
                                        <div className="font-serif-en font-bold text-xl leading-tight text-[#FAF0E6] mix-blend-hard-light drop-shadow-md text-center mt-4 line-clamp-4">
                                            {book.title}
                                        </div>
                                        <div className="text-xs opacity-80 font-serif-en font-normal text-[#FAF0E6] text-center mb-4 tracking-widest line-clamp-2">
                                            {book.author}
                                        </div>
                                    </div>
                                </div>

                                {/* Texture Overlay */}
                                <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/canvas-orange.png')] opacity-20 mix-blend-overlay pointer-events-none" />
                                
                                {/* Light Sheen Gradient */}
                                <div className="absolute inset-0 bg-gradient-to-br from-white/10 via-transparent to-black/20 pointer-events-none" />
                            </div>
                        </motion.div>
                    ))}

                    {/* Add Book Placeholder */}
                    <div className="w-[180px] h-[260px] border-2 border-dashed border-[#FAF0E6]/20 rounded-sm flex flex-col items-center justify-center group hover:border-[#FAF0E6]/40 transition-colors cursor-pointer relative">
                         <input 
                            type="file" 
                            accept=".epub"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            onChange={handleFileUpload}
                         />
                         {isUploading ? (
                             <div className="font-serif-en font-bold text-[#FAF0E6] animate-pulse flex flex-col items-center">
                                 <span className="mb-2">解析中...</span>
                                 <span className="text-xs opacity-60">请稍候</span>
                             </div>
                         ) : (
                             <>
                                <Plus size={32} className="text-[#FAF0E6]/30 mb-4 group-hover:text-[#FAF0E6]/60 transition-colors" />
                                <span className="font-serif-en font-bold text-[#FAF0E6]/30 text-xl group-hover:text-[#FAF0E6]/60 tracking-wider">New Book</span>
                             </>
                         )}
                    </div>
                 </div>
             </div>
        </div>

        {/* Right Margin Spacer */}
        <div className="w-[150px] pointer-events-none hidden md:block" />

    </motion.div>
  );
};
