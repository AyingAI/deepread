
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book as BookType, ThoughtCard } from '../types';
import { GripVertical, ArrowLeft, PenTool, Brain, MessageSquare, Link, ChevronLeft, ChevronRight, Edit3 } from 'lucide-react';
import { getBookContentFromDB, updateBookMetadata, saveCardToDB, getCardsForBook } from '../utils/db';

// Access the global ePub instance loaded via <script> tag
const ePub = (window as any).ePub;

interface ReadingViewProps {
  book: BookType;
  intention: string;
  onBack: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({ book, intention: initialIntention, onBack }) => {
  const [cards, setCards] = useState<ThoughtCard[]>([]);
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  // Editable Intention State
  const [isEditingIntention, setIsEditingIntention] = useState(false);
  const [currentIntention, setCurrentIntention] = useState(initialIntention);
  const intentionInputRef = useRef<HTMLInputElement>(null);

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const locationDebounceRef = useRef<any>(null);

  // 1. Load Cards on Mount
  useEffect(() => {
    const loadCards = async () => {
        const storedCards = await getCardsForBook(book.id);
        setCards(storedCards);
    };
    loadCards();
  }, [book.id]);

  // 2. Load Book & Restore Location
  useEffect(() => {
    let bookInstance: any = null;

    const loadBook = async () => {
        setIsLoading(true);
        try {
            const buffer = await getBookContentFromDB(book.id);
            if (!buffer) {
                console.error("Book content not found");
                return;
            }

            if (viewerRef.current) {
                viewerRef.current.innerHTML = '';
            }

            bookInstance = ePub(buffer);
            
            if (viewerRef.current) {
                const rendition = bookInstance.renderTo(viewerRef.current, {
                    flow: "scrolled-doc",
                    width: "100%",
                    height: "100%",
                    allowScriptedContent: false
                });
                
                renditionRef.current = rendition;

                // Resume from last location if available
                await rendition.display(book.lastLocation || undefined);
                
                // --- STYLING ---
                rendition.themes.default({
                    'body': { 
                        'font-family': "'Noto Serif SC', serif !important", 
                        'font-size': '20px !important',
                        'line-height': '2.2 !important',
                        'color': '#2a2a2a !important',
                        'background-color': 'transparent !important',
                        'padding': '40px 10% !important',
                        'max-width': '900px !important',
                        'margin': '0 auto !important'
                    },
                    'p': {
                        'font-family': "'Noto Serif SC', serif !important",
                        'margin-bottom': '1.5em !important',
                        'text-align': 'justify !important'
                    },
                    'img': {
                        'max-width': '100% !important',
                        'height': 'auto !important',
                        'mix-blend-mode': 'multiply',
                        'margin': '20px auto !important',
                        'display': 'block !important'
                    },
                    '::selection': {
                        'background': 'rgba(139, 69, 19, 0.2)'
                    }
                });

                rendition.hooks.content.register((contents: any) => {
                     const link = contents.document.createElement('link');
                     link.setAttribute('rel', 'stylesheet');
                     link.setAttribute('href', 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400;500;700&display=swap');
                     contents.document.head.appendChild(link);
                     contents.document.addEventListener('keyup', handleKeyUp);
                });

                rendition.on('selected', (cfiRange: string, contents: any) => {
                    const range = contents.range(cfiRange);
                    const text = range.toString();
                    
                    if (text && text.trim().length > 0) {
                        const rect = range.getBoundingClientRect();
                        const iframe = viewerRef.current?.querySelector('iframe');
                        const iframeRect = iframe?.getBoundingClientRect();
                        
                        if (iframeRect) {
                            setSelection({
                                text: text,
                                top: iframeRect.top + rect.top, 
                                left: iframeRect.left + rect.right + 10
                            });
                        }
                    } else {
                        setSelection(null);
                    }
                });

                // --- PROGRESS SAVING ---
                rendition.on('relocated', (location: any) => {
                    // Debounce database writes to avoid performance hit during scrolling
                    if (locationDebounceRef.current) {
                        clearTimeout(locationDebounceRef.current);
                    }

                    locationDebounceRef.current = setTimeout(async () => {
                        const cfi = location.start.cfi;
                        // Calculate simplified percentage for visual bars
                        // Note: locations.percentageFromCfi is sometimes heavy, but fine here
                        // If locations aren't generated, this might return 0 or null, which is fine.
                        // For a robust app, we'd run book.locations.generate(1000) in background.
                        
                        // We will just save the CFI mostly.
                        await updateBookMetadata(book.id, { 
                            lastLocation: cfi,
                            // Optionally update progress if we generated locations, 
                            // but simpler to just track active state for now.
                            progress: location.start.displayed.page > 1 ? 50 : 0 // Mock progress update for now as generating locations is heavy
                        });
                    }, 1000);
                });
            }
        } catch (e) {
            console.error("Error loading book:", e);
        } finally {
            setIsLoading(false);
        }
    };

    loadBook();

    const handleKeyUp = (e: KeyboardEvent) => {
        if (e.key === 'ArrowRight') nextChapter();
        if (e.key === 'ArrowLeft') prevChapter();
    };
    window.addEventListener('keyup', handleKeyUp);

    return () => {
        window.removeEventListener('keyup', handleKeyUp);
        if (bookInstance) {
            bookInstance.destroy();
        }
    };
  }, [book.id]);

  const prevChapter = () => {
      renditionRef.current?.prev();
      setSelection(null);
  };

  const nextChapter = () => {
      renditionRef.current?.next();
      setSelection(null);
  };

  const handleDragStart = (e: React.DragEvent, text: string) => {
    e.dataTransfer.setData('text/plain', text);
    e.dataTransfer.effectAllowed = 'copy';
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingOver(false);
    const text = e.dataTransfer.getData('text/plain');
    if (text) {
        addCard(text);
        setSelection(null);
        if (renditionRef.current) {
            renditionRef.current.getContents().forEach((c: any) => c.window.getSelection().removeAllRanges());
        }
    }
  };

  const addCard = async (text: string) => {
      const newCard: ThoughtCard = {
          id: Date.now().toString(),
          bookId: book.id,
          quote: text,
          note: '',
          timestamp: Date.now()
      };
      
      // Optimistic update
      setCards(prev => [newCard, ...prev]);
      
      // Persist
      await saveCardToDB(newCard);
      
      // Update book sediment level (make stack thicker)
      await updateBookMetadata(book.id, { sedimentLevel: book.sedimentLevel + 2 });
  };

  const updateCardNote = async (id: string, note: string) => {
      setCards(prev => prev.map(c => c.id === id ? { ...c, note } : c));
      
      const card = cards.find(c => c.id === id);
      if (card) {
          await saveCardToDB({ ...card, note });
      }
  };

  const saveIntention = async () => {
      setIsEditingIntention(false);
      if (currentIntention.trim() !== book.intention) {
          await updateBookMetadata(book.id, { intention: currentIntention });
      }
  };

  const handleIntentionKeyDown = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
          saveIntention();
      }
  };

  return (
    <div className="w-full h-screen bg-[#FAF0E6] flex overflow-hidden">
      
      {/* ================= LEFT COLUMN: BOOK STREAM (65%) ================= */}
      <div className="w-[65%] h-full relative bg-[#FAF0E6] flex flex-col group">
          {/* Back Navigation & Meta */}
          <div className="flex-none px-8 pt-8 pb-4 z-20 flex justify-between items-end border-b border-[#8B4513]/10 bg-[#FAF0E6]">
            <div className="flex items-center gap-6 w-full">
                <button 
                    onClick={onBack}
                    className="p-2 text-[#4A4A4A] opacity-40 hover:opacity-100 transition-opacity flex items-center gap-2 group-btn flex-shrink-0"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1 min-w-0">
                    <div className="text-sm text-[#4A4A4A]/40 font-serif tracking-[0.1em] uppercase max-w-[300px] truncate">
                        {book.title}
                    </div>
                    
                    {/* EDITABLE INTENTION AREA */}
                    <div className="flex items-center gap-2 mt-1 h-6">
                        <span className="text-xs text-[#8B4513]/60 font-serif font-bold uppercase flex-shrink-0">
                            Purpose:
                        </span>
                        
                        {isEditingIntention ? (
                             <input 
                                ref={intentionInputRef}
                                type="text"
                                value={currentIntention}
                                onChange={(e) => setCurrentIntention(e.target.value)}
                                onBlur={saveIntention}
                                onKeyDown={handleIntentionKeyDown}
                                autoFocus
                                className="font-fangsong text-[#5C4033] tracking-wide bg-white/50 border-b border-[#8B4513]/30 outline-none w-full max-w-md px-1"
                             />
                        ) : (
                            <div 
                                onClick={() => {
                                    setIsEditingIntention(true);
                                    // Slight delay to allow render before focus, though autoFocus handles it mostly
                                    setTimeout(() => intentionInputRef.current?.focus(), 10);
                                }}
                                className="group/edit flex items-center gap-2 cursor-pointer hover:bg-[#8B4513]/5 px-2 rounded transition-colors duration-200"
                                title="点击修改阅读目标"
                            >
                                <span className="font-fangsong text-[#5C4033] tracking-wide truncate">
                                    {currentIntention || "暂无目标"}
                                </span>
                                <Edit3 size={10} className="text-[#8B4513]/30 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                            </div>
                        )}
                    </div>
                </div>
            </div>
          </div>

          {/* READER CONTAINER */}
          <div className="flex-1 relative overflow-hidden flex flex-col">
             {isLoading && (
                 <div className="absolute inset-0 flex items-center justify-center text-[#5C4033]/50 font-serif animate-pulse z-50 bg-[#FAF0E6]">
                     <span className="tracking-widest">翻回上次阅读页...</span>
                 </div>
             )}
             
             {/* Navigation Overlay Buttons */}
             <button 
                onClick={prevChapter}
                className="absolute left-0 top-0 bottom-0 w-24 flex items-center justify-center z-40 opacity-0 group-hover:opacity-100 hover:bg-gradient-to-r hover:from-black/5 hover:to-transparent transition-all duration-500 outline-none"
             >
                 <ChevronLeft className="text-[#8B4513]/40" size={48} />
             </button>

             <button 
                onClick={nextChapter}
                className="absolute right-0 top-0 bottom-0 w-24 flex items-center justify-center z-40 opacity-0 group-hover:opacity-100 hover:bg-gradient-to-l hover:from-black/5 hover:to-transparent transition-all duration-500 outline-none"
             >
                 <ChevronRight className="text-[#8B4513]/40" size={48} />
             </button>

             <div 
                ref={viewerRef} 
                className="w-full h-full"
             />
          </div>

          {/* FLOATY GRIP HANDLE */}
          <AnimatePresence>
            {selection && (
                <motion.div
                    className="fixed z-[100]"
                    style={{ top: selection.top, left: selection.left }}
                    initial={{ opacity: 0, scale: 0.8, x: -10 }}
                    animate={{ opacity: 1, scale: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}
                >
                    <div
                        className="cursor-grab active:cursor-grabbing flex items-center gap-2 bg-[#2a2a2a] text-[#FAF0E6] px-5 py-3 rounded-r-full rounded-bl-full shadow-[5px_5px_20px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform border border-white/10"
                        draggable
                        onDragStart={(e) => handleDragStart(e, selection.text)}
                    >
                        <GripVertical size={18} />
                        <span className="text-sm font-serif font-bold tracking-widest pr-1">抓取</span>
                    </div>
                </motion.div>
            )}
          </AnimatePresence>
      </div>

      {/* ================= RIGHT COLUMN: MIND STREAM (35%) ================= */}
      <div 
        className={`w-[35%] h-full border-l border-[#8B4513]/5 relative flex flex-col transition-colors duration-500 ease-in-out
            ${isDraggingOver ? 'bg-[#E6DCC8] shadow-[inset_10px_0_30px_rgba(139,69,19,0.05)]' : 'bg-[#EFE5D5] shadow-[inset_10px_0_20px_-10px_rgba(0,0,0,0.03)]'}
        `}
        onDragOver={(e) => {
            e.preventDefault();
            setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={handleDrop}
      >
          {/* Header */}
          <div className="sticky top-0 bg-[#EFE5D5]/95 backdrop-blur-sm p-8 z-10 border-b border-[#8B4513]/5 flex-none">
               <h3 className="text-xs uppercase tracking-[0.2em] text-[#5C4033]/50 flex items-center justify-between font-serif font-bold">
                   <span>思维流淌</span>
                   <span className="font-fangsong text-[#5C4033] bg-[#5C4033]/5 px-2 py-1 rounded">{cards.length} 想法</span>
               </h3>
          </div>

          <div className="flex-1 overflow-y-auto no-scrollbar p-8 pb-32">
               <div className="space-y-8">
                   <AnimatePresence mode="popLayout">
                       {cards.length === 0 && (
                           <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }}
                            className="h-full flex flex-col items-center justify-center text-[#5C4033]/30 space-y-6 mt-20"
                           >
                               <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#5C4033]/20 flex items-center justify-center">
                                   <PenTool size={24} />
                               </div>
                               <span className="font-serif text-lg tracking-widest opacity-70">从左侧拖拽文字生成卡片</span>
                           </motion.div>
                       )}

                       {cards.map((card) => (
                           <ThoughtCardItem 
                                key={card.id} 
                                card={card} 
                                onUpdate={updateCardNote} 
                                bookTitle={book.title}
                                bookAuthor={book.author}
                                intention={currentIntention}
                            />
                       ))}
                   </AnimatePresence>
               </div>
          </div>
      </div>
    </div>
  );
};

const ThoughtCardItem: React.FC<{ 
    card: ThoughtCard; 
    onUpdate: (id: string, note: string) => void;
    bookTitle: string;
    bookAuthor: string;
    intention: string;
}> = ({ card, onUpdate, bookTitle, bookAuthor, intention }) => {
    const [isFocused, setIsFocused] = useState(false);
    const [activeAction, setActiveAction] = useState<'explain' | 'challenge' | 'associate' | null>(null);
    const [aiResponse, setAiResponse] = useState<string | null>(null);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiError, setAiError] = useState<string | null>(null);

    const handleAiReflect = async (action: 'explain' | 'challenge' | 'associate') => {
        setIsAiLoading(true);
        setAiError(null);
        setActiveAction(action);
        setAiResponse(null);

        try {
            const res = await fetch('/api/gemini/reflect', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    quote: card.quote,
                    note: card.note,
                    action: action,
                    title: bookTitle,
                    author: bookAuthor,
                    intention: intention
                })
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || '思绪生成失败，请稍后重试。');
            }

            setAiResponse(data.text);
        } catch (err: any) {
            console.error("AI Reflect error:", err);
            setAiError(err.message || '网络连接失败，请稍后重试。');
        } finally {
            setIsAiLoading(false);
        }
    };

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
            className="bg-[#FAF0E6] p-8 shadow-[0_4px_20px_rgba(92,64,51,0.08)] border border-white/60 relative group rounded-sm hover:shadow-[0_8px_30px_rgba(92,64,51,0.12)] transition-shadow duration-300"
        >
            <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] rounded-sm"></div>

            <div className="relative z-10">
                <div className="mb-6 relative pl-4">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8B4513]/30 rounded-full" />
                    <blockquote className="text-base font-serif text-[#4A4A4A] leading-relaxed mix-blend-multiply text-justify">
                        {card.quote}
                    </blockquote>
                </div>

                <div className="relative mt-6 pt-6 border-t border-dashed border-[#8B4513]/10">
                    <textarea
                        value={card.note}
                        onChange={(e) => onUpdate(card.id, e.target.value)}
                        placeholder="在此写下你的思考..."
                        className="w-full bg-transparent resize-none text-[#2a2a2a] outline-none font-fangsong text-xl leading-relaxed placeholder-[#8B4513]/20 min-h-[80px]"
                        onFocus={() => setIsFocused(true)}
                        onBlur={() => setIsFocused(false)}
                    />
                    
                    <div className="h-[1px] bg-[#8B4513]/10 w-full relative overflow-hidden mt-2">
                        <motion.div 
                            className="absolute inset-0 bg-[#8B4513]"
                            initial={{ scaleX: 0, opacity: 0.5 }}
                            animate={{ scaleX: isFocused ? 1 : 0, opacity: 1 }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                        />
                    </div>
                </div>

                <div className="flex items-center justify-end space-x-2 mt-6">
                    <ActionButton 
                        icon={<Brain size={14} />} 
                        label="解释" 
                        active={activeAction === 'explain'}
                        onClick={() => handleAiReflect('explain')}
                    />
                    <ActionButton 
                        icon={<MessageSquare size={14} />} 
                        label="反驳" 
                        active={activeAction === 'challenge'}
                        onClick={() => handleAiReflect('challenge')}
                    />
                    <ActionButton 
                        icon={<Link size={14} />} 
                        label="联想" 
                        active={activeAction === 'associate'}
                        onClick={() => handleAiReflect('associate')}
                    />
                </div>

                {/* AI Reflections Slip */}
                <AnimatePresence>
                    {activeAction && (
                        <motion.div
                            initial={{ opacity: 0, height: 0, marginTop: 0 }}
                            animate={{ opacity: 1, height: 'auto', marginTop: 24 }}
                            exit={{ opacity: 0, height: 0, marginTop: 0 }}
                            transition={{ duration: 0.3 }}
                            className="p-5 bg-[#FAF1E4] rounded border border-[#8B4513]/15 overflow-hidden text-[#5C4033] shadow-inner font-fangsong relative"
                        >
                            <div className="flex items-center justify-between border-b border-[#8B4513]/10 pb-2 mb-3 text-[11px] tracking-wider text-[#8B4513]/60 font-bold">
                                <span className="flex items-center gap-1.5 font-serif uppercase animate-pulse">
                                    {activeAction === 'explain' && <Brain size={12} className="text-[#8B4513]" />}
                                    {activeAction === 'challenge' && <MessageSquare size={12} className="text-[#8B4513]" />}
                                    {activeAction === 'associate' && <Link size={12} className="text-[#8B4513]" />}
                                    {activeAction === 'explain' ? '意境深度释义' : activeAction === 'challenge' ? '辩证思辨视角' : '跨界启发联想'}
                                </span>
                                <button 
                                    onClick={() => {
                                        setActiveAction(null);
                                        setAiResponse(null);
                                        setAiError(null);
                                    }}
                                    className="text-[11px] opacity-60 hover:opacity-100 text-[#8B4513] transition-opacity cursor-pointer font-serif font-bold"
                                >
                                    收起
                                </button>
                            </div>

                            {isAiLoading && (
                                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                                    <div className="w-5 h-5 border-2 border-[#8B4513]/30 border-t-[#8B4513] rounded-full animate-spin"></div>
                                    <span className="text-xs font-serif opacity-60 tracking-widest text-[#8B4513]/70 animate-pulse">正在铺纸研墨，思索真义...</span>
                                </div>
                            )}

                            {aiError && (
                                <div className="text-red-700/80 text-xs py-2 leading-relaxed">
                                    {aiError}
                                </div>
                            )}

                            {aiResponse && (
                                <motion.p 
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ duration: 0.5 }}
                                    className="text-sm md:text-base leading-relaxed tracking-wider whitespace-pre-line text-[#3d2712] font-fangsong text-justify animate-fade-in"
                                >
                                    {aiResponse}
                                </motion.p>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </motion.div>
    );
}

const ActionButton: React.FC<{ icon: React.ReactNode, label: string, active: boolean, onClick: () => void }> = ({ icon, label, active, onClick }) => (
    <button 
        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-all duration-300 cursor-pointer group text-xs
            ${active ? 'bg-[#8B4513]/10 shadow-[inner_0_1px_2px_rgba(0,0,0,0.05)] border border-[#8B4513]/10' : 'bg-[#5C4033]/5 hover:bg-[#5C4033]/10'}
        `}
        onClick={onClick}
    >
        <span className={`${active ? 'text-[#8B4513]' : 'text-[#5C4033]/70 group-hover:text-[#5C4033]'} transition-colors`}>{icon}</span>
        <span className={`font-serif font-bold tracking-wider transition-colors
            ${active ? 'text-[#8B4513]' : 'text-[#5C4033]/80 group-hover:text-[#5C4033]'}
        `}>{label}</span>
    </button>
);
