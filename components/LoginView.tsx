
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface LoginViewProps {
  onLogin: () => void;
}

export const LoginView: React.FC<LoginViewProps> = ({ onLogin }) => {
  const [isZoomed, setIsZoomed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [username, setUsername] = useState('myreader');
  const [password, setPassword] = useState('123456');

  const handleWindowClick = () => {
    setIsZoomed(true);
    setTimeout(() => setShowForm(true), 1500);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username === 'myreader' && password === '123456') {
      onLogin();
    } else {
      alert('Default: myreader / 123456');
    }
  };

  // Generate random stars for the sky
  const stars = Array.from({ length: 30 }).map((_, i) => ({
    id: i,
    top: `${Math.random() * 45}%`,
    left: `${Math.random() * 100}%`,
    size: Math.random() * 2 + 1,
    delay: Math.random() * 3,
    duration: Math.random() * 2 + 3
  }));

  // Abstract city buildings (width, height, left) - Taller for better composition
  const cityBuildings = [
    { w: 60, h: 220, l: 5 },
    { w: 90, h: 380, l: 12 },
    { w: 50, h: 180, l: 28 },
    { w: 110, h: 450, l: 65 },
    { w: 70, h: 280, l: 82 },
    { w: 40, h: 160, l: 92 },
  ];

  return (
    <div className="relative w-full h-screen bg-[#0F1115] overflow-hidden flex flex-col items-center justify-end text-[#FAF0E6]">
      <style>{`
        @keyframes breathe {
          0%, 100% { opacity: 0.2; transform: scale(1); }
          50% { opacity: 0.9; transform: scale(1.3); }
        }
        .star-breath {
           animation: breathe 4s ease-in-out infinite;
        }
      `}</style>

      {/* 1. ATMOSPHERE: Sky & Stars */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#0a0a12] to-[#14141c] z-0" />
      
      {stars.map((star) => (
        <div 
            key={star.id}
            className="absolute bg-white rounded-full star-breath"
            style={{
                top: star.top,
                left: star.left,
                width: `${star.size}px`,
                height: `${star.size}px`,
                animationDelay: `${star.delay}s`,
                animationDuration: `${star.duration}s`,
                boxShadow: `0 0 ${star.size * 2}px rgba(255,255,255,0.8)`
            }}
        />
      ))}

      {/* Floating Title (Optimized Fonts) */}
      <motion.div 
        className={`absolute top-[12%] text-center z-10 transition-opacity duration-1000 ${isZoomed ? 'opacity-0' : 'opacity-100'}`}
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 2 }}
      >
        <h1 className="text-6xl font-serif font-bold tracking-widest mb-2 opacity-90 text-[#E0E0E0] drop-shadow-[0_0_10px_rgba(255,255,255,0.2)]">深读</h1>
        <p className="font-serif-en font-bold text-3xl opacity-60 mt-2 tracking-wide">Deep read</p>
        <p className="text-[#FAF0E6]/40 text-[10px] md:text-xs font-serif font-bold tracking-[0.3em] whitespace-nowrap shadow-black drop-shadow-sm mt-6">
            这里存放的不是书，而是你的时间与智慧
        </p>
      </motion.div>

      {/* 2. BACKGROUND: Abstract City Silhouette */}
      <div className="absolute bottom-0 w-full h-[500px] pointer-events-none z-0 opacity-20 flex items-end justify-center">
         {/* Simple line horizon */}
         <div className="absolute bottom-0 w-full h-[1px] bg-white/30 box-shadow-[0_0_20px_white]"></div>
         
         {cityBuildings.map((b, i) => (
             <div 
                key={i}
                className="absolute bottom-0 border-t border-r border-l border-white/20 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-[1px]"
                style={{
                    left: `${b.l}%`,
                    width: `${b.w}px`,
                    height: `${b.h}px`,
                }}
             />
         ))}
      </div>

      {/* 3. FOREGROUND: The "Home" Building */}
      <motion.div 
        className="relative z-20 mb-[-10px]"
        initial={{ scale: 1, y: 0 }}
        // Focus is now higher (top of building), so we adjust zoom target to keep it somewhat centered
        animate={isZoomed ? { scale: 6, y: 200 } : { scale: 1, y: 0 }}
        transition={{ duration: 1.8, ease: [0.43, 0.13, 0.23, 0.96] }}
        style={{ transformOrigin: '50% 25%' }} // Set pivot point to the upper quarter where the window is
      >
        
        {/* Building Structure - Responsive Height */}
        <div className="relative w-[320px] h-[60vh] min-h-[500px] max-h-[800px] bg-[#111116] border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center">
             
             {/* Cornice / Top Ledge */}
             <div className="w-[340px] h-4 bg-[#1a1a20] border border-white/10 absolute -top-4 -left-[10px] shadow-lg z-10"></div>

             {/* === THE LIT WINDOW (Moved to Top) === */}
             <div className="mt-20 mb-8 relative group cursor-pointer shrink-0" onClick={handleWindowClick}>
                {/* The Halo (Glow Effect) */}
                <div className="absolute -inset-10 bg-[#FF8C00] opacity-10 blur-2xl rounded-full group-hover:opacity-20 transition-opacity duration-1000 animate-pulse"></div>
                
                {/* Window Frame */}
                <div className="w-24 h-28 bg-[#2a1a10] border-2 border-[#3a2a20] relative overflow-hidden shadow-[0_0_40px_rgba(255,140,0,0.15)] group-hover:shadow-[0_0_60px_rgba(255,140,0,0.3)] transition-all duration-700">
                     {/* Warm Light Gradient */}
                     <div className="absolute inset-0 bg-gradient-to-b from-[#ffdb7d] to-[#ff8c00] opacity-90 mix-blend-hard-light"></div>
                     
                     {/* Silhouette Person */}
                     <div className="absolute bottom-0 right-4 w-6 h-8 bg-[#1a0a00] opacity-80 rounded-t-lg shadow-sm"></div>
                     <div className="absolute bottom-0 right-2 w-12 h-2 bg-[#1a0a00] opacity-80"></div>

                     {/* Window Panes */}
                     <div className="absolute inset-0 grid grid-cols-2 grid-rows-2">
                        <div className="border-r border-b border-[#3a2a20]/40"></div>
                        <div className="border-b border-[#3a2a20]/40"></div>
                        <div className="border-r border-[#3a2a20]/40"></div>
                        <div></div>
                    </div>
                </div>

                {/* Window Sill */}
                <div className="absolute -bottom-2 -left-2 w-[120%] h-2 bg-[#1a1a20] border-t border-white/10 shadow-sm"></div>
             </div>

             {/* === LOWER SECTION: Dark Windows (Fills space below) === */}
             <div className="flex-1 w-full px-12 py-8 flex flex-col justify-start opacity-20 overflow-hidden">
                 {/* Decorative Grid of dark windows to act as texture */}
                 <div className="grid grid-cols-2 gap-x-8 gap-y-12 w-full">
                     {Array.from({length: 8}).map((_, i) => (
                         <div key={i} className="w-full h-12 bg-black border border-white/10"></div>
                     ))}
                 </div>
             </div>

             {/* Dark Windows Grid (Bottom Base Footer) */}
             <div className="mb-12 w-full px-16 flex justify-center opacity-20 shrink-0">
                 <div className="w-8 h-10 border border-white/20 bg-black mx-3"></div>
                 <div className="w-8 h-10 border border-white/20 bg-black mx-3"></div>
                 <div className="w-8 h-10 border border-white/20 bg-black mx-3"></div>
             </div>

             {/* Building Base outline */}
             <div className="absolute bottom-0 w-full h-1 bg-white/5"></div>
        </div>
      </motion.div>

      {/* Login Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div 
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1 }}
          >
            <motion.div 
                className="bg-[#FAF0E6] text-[#4A4A4A] p-12 w-96 shadow-2xl relative overflow-hidden"
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.2 }}
            >
                {/* Paper texture overlay on card */}
                <div className="absolute inset-0 pointer-events-none opacity-20 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]"></div>

                <h2 className="text-3xl font-serif font-bold mb-8 text-center text-[#2a2a2a] tracking-wider">欢迎回家</h2>
                <form onSubmit={handleSubmit} className="relative z-10 space-y-6">
                    <div className="group">
                        <label className="block text-xs uppercase tracking-widest text-[#8B4513]/60 mb-2 font-serif-en font-bold">Name</label>
                        <input 
                            type="text" 
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full bg-transparent border-b border-[#8B4513]/20 focus:border-[#8B4513] outline-none py-2 transition-colors font-serif-en font-bold text-xl text-[#2a2a2a]"
                        />
                    </div>
                    <div className="group">
                        <label className="block text-xs uppercase tracking-widest text-[#8B4513]/60 mb-2 font-serif-en font-bold">Key</label>
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full bg-transparent border-b border-[#8B4513]/20 focus:border-[#8B4513] outline-none py-2 transition-colors font-serif-en font-bold text-xl text-[#2a2a2a]"
                        />
                    </div>
                    <button 
                        type="submit" 
                        className="w-full mt-8 bg-[#2a2a2a] text-[#FAF0E6] py-3 hover:bg-black transition-colors duration-500 font-serif font-bold tracking-widest text-sm shadow-lg hover:shadow-xl transform hover:-translate-y-1"
                    >
                        点灯阅读
                    </button>
                </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
