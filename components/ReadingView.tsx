
import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Book as BookType, ThoughtCard } from '../types';
import { GripVertical, ArrowLeft, PenTool, Brain, MessageSquare, Link, Edit3, List, Trash2, FileDown, BookOpenCheck, Search, X } from 'lucide-react';
import { getBookContentFromDB, updateBookMetadata, saveCardToDB, getCardsForBook, deleteCardFromDB } from '../utils/db';

const ePub = (window as any).ePub;
const PAGE_TURN_WHEEL_THRESHOLD = 48;
const PAGE_TURN_COOLDOWN_MS = 650;

async function safeProgrammaticDisplay(rendition: any, target: string) {
  await rendition.display(target);
}

/**
 * Remove all .dr-search-highlight marks from a document, restoring
 * the original text nodes.  Also removes the injected style element.
 */
function removeSearchHighlightsFromDocument(doc: Document) {
  try {
    const marks = doc.querySelectorAll('.dr-search-highlight');
    marks.forEach((mark: Element) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
    });
    const style = doc.getElementById('dr-search-highlight-style');
    if (style) style.remove();
  } catch {}
}

/**
 * Highlight every occurrence of `query` inside `doc.body` with
 * <span class="dr-search-highlight">.  Injects a <style> once (id-guarded).
 * Skips SCRIPT / STYLE / NOSCRIPT nodes and text already inside a highlight.
 */
function applySearchHighlightToDocument(doc: Document, query: string) {
  try {
    if (!doc || !doc.body) return;

    // Remove stale highlights first (handles query-change / re-entry)
    const oldMarks = doc.querySelectorAll('.dr-search-highlight');
    oldMarks.forEach((mark: Element) => {
      const parent = mark.parentNode;
      if (parent) {
        while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
        parent.removeChild(mark);
        parent.normalize();
      }
    });

    // Inject style once
    if (!doc.getElementById('dr-search-highlight-style')) {
      const style = doc.createElement('style');
      style.id = 'dr-search-highlight-style';
      style.textContent = '.dr-search-highlight{background:#f6e58d;padding:1px 0;border-radius:2px;}';
      doc.head.appendChild(style);
    }

    // Walk text nodes, skip SCRIPT/STYLE/NOSCRIPT and already-highlighted nodes
    const SKIP = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT']);
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    const textNodes: Text[] = [];
    while (walker.nextNode()) {
      const node = walker.currentNode as Text;
      const parent = node.parentElement;
      if (parent && SKIP.has(parent.tagName)) continue;
      if (parent && parent.closest('.dr-search-highlight')) continue;
      textNodes.push(node);
    }

    for (const node of textNodes) {
      if (!node.textContent || !regex.test(node.textContent)) continue;
      regex.lastIndex = 0;
      const frag = doc.createDocumentFragment();
      let last = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(node.textContent!)) !== null) {
        if (m.index > last) frag.appendChild(doc.createTextNode(node.textContent!.slice(last, m.index)));
        const mark = doc.createElement('span');
        mark.className = 'dr-search-highlight';
        mark.textContent = m[1];
        frag.appendChild(mark);
        last = m.index + m[1].length;
      }
      if (last < node.textContent!.length) frag.appendChild(doc.createTextNode(node.textContent!.slice(last)));
      node.parentNode?.replaceChild(frag, node);
    }
  } catch {}
}

interface ReadingViewProps {
  book: BookType;
  intention: string;
  onBack: () => void;
}

export const ReadingView: React.FC<ReadingViewProps> = ({ book, intention: initialIntention, onBack }) => {
  const [cards, setCards] = useState<ThoughtCard[]>([]);
  const cardsRef = useRef<ThoughtCard[]>([]);
  const [selection, setSelection] = useState<{ text: string; top: number; left: number } | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [progress, setProgress] = useState(book.progress || 0);
  const [toc, setToc] = useState<any[]>([]);
  const [showToc, setShowToc] = useState(false);
  const [chapterLabel, setChapterLabel] = useState('');

  const [isEditingIntention, setIsEditingIntention] = useState(false);
  const [currentIntention, setCurrentIntention] = useState(initialIntention);
  const intentionInputRef = useRef<HTMLInputElement>(null);

  const [showReview, setShowReview] = useState(false);
  const [reviewNote, setReviewNote] = useState(book.reviewNote || '');
  const [reviewSaved, setReviewSaved] = useState(false);
  const [reviewHint, setReviewHint] = useState<string | null>(null);
  const reviewHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Search state
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ cfi: string; excerpt: string }[]>([]);
  const [cardSearchResults, setCardSearchResults] = useState<ThoughtCard[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const highlightQueryRef = useRef<string | null>(null);
  const isSearchNavigatingRef = useRef(false);
  const searchSeqRef = useRef(0);

  const viewerRef = useRef<HTMLDivElement>(null);
  const renditionRef = useRef<any>(null);
  const bookRef = useRef<any>(null);
  const locationsReadyRef = useRef(false);
  const locationDebounceRef = useRef<any>(null);
  const progressRef = useRef(book.progress || 0);
  const tocRef = useRef<any[]>([]);
  const pageTurnLockRef = useRef(false);
  const wheelDeltaRef = useRef(0);
  const wheelResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Reading session tracking
  const sessionStartedAtRef = useRef<number>(Date.now());
  const baseTotalReadingMsRef = useRef<number>(book.totalReadingMs || 0);
  const [totalReadingMs, setTotalReadingMs] = useState(book.totalReadingMs || 0);
  const readingStatsIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const persistReadingStats = () => {
    const elapsed = Date.now() - sessionStartedAtRef.current;
    const total = baseTotalReadingMsRef.current + elapsed;
    setTotalReadingMs(total);
    updateBookMetadata(book.id, { totalReadingMs: total, lastReadAt: Date.now() });
  };

  // Card save debounce: timer per card id, pending card data per card id
  const cardSaveTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const pendingCardsRef = useRef<Map<string, ThoughtCard>>(new Map());

  // 1. Load Cards
  useEffect(() => {
    getCardsForBook(book.id).then(loaded => {
      cardsRef.current = loaded;
      setCards(loaded);
    });
  }, [book.id]);

  // 1b. Reading stats: 60s interval + unmount save
  useEffect(() => {
    readingStatsIntervalRef.current = setInterval(persistReadingStats, 60_000);
    return () => {
      if (readingStatsIntervalRef.current) clearInterval(readingStatsIntervalRef.current);
      persistReadingStats(); // fire-and-forget final save
    };
  }, [book.id]);

  // 2. Load Book & Render
  useEffect(() => {
    let bookInstance: any = null;
    let cancelled = false;
    const readerCleanupFns: Array<() => void> = [];

    const loadBook = async () => {
      setIsLoading(true);
      locationsReadyRef.current = false;
      progressRef.current = book.progress || 0;
      try {
        const buffer = await getBookContentFromDB(book.id);
        if (!buffer || cancelled) return;

        if (viewerRef.current) viewerRef.current.innerHTML = '';

        bookInstance = ePub(buffer);
        bookRef.current = bookInstance;

        if (!viewerRef.current) return;
        const viewerElement = viewerRef.current;

        const turnPage = async (direction: 'next' | 'prev') => {
          const rendition = renditionRef.current;
          if (!rendition || pageTurnLockRef.current) return;

          pageTurnLockRef.current = true;
          setSelection(null);
          try {
            if (direction === 'next') {
              await rendition.next();
            } else {
              await rendition.prev();
            }
          } catch (err) {
            console.warn('Page turn failed', err);
          } finally {
            window.setTimeout(() => {
              pageTurnLockRef.current = false;
            }, PAGE_TURN_COOLDOWN_MS);
          }
        };

        const handleWheelForPageTurn = (event: WheelEvent) => {
          const target = event.target as HTMLElement | null;
          if (target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;

          const dominantDelta = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
          if (Math.abs(dominantDelta) < 1) return;

          event.preventDefault();
          event.stopPropagation();

          wheelDeltaRef.current += dominantDelta;
          if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
          wheelResetTimerRef.current = setTimeout(() => {
            wheelDeltaRef.current = 0;
            wheelResetTimerRef.current = null;
          }, 220);

          if (Math.abs(wheelDeltaRef.current) < PAGE_TURN_WHEEL_THRESHOLD) return;

          const direction = wheelDeltaRef.current > 0 ? 'next' : 'prev';
          wheelDeltaRef.current = 0;
          void turnPage(direction);
        };

        const bindContentWheel = (contents: any) => {
          const doc = contents?.document;
          if (!doc || (doc as any).__deepreadWheelBound) return;
          (doc as any).__deepreadWheelBound = true;
          doc.addEventListener('wheel', handleWheelForPageTurn, { passive: false });
          readerCleanupFns.push(() => {
            doc.removeEventListener('wheel', handleWheelForPageTurn);
            delete (doc as any).__deepreadWheelBound;
          });
        };

        // --- PAGINATED READER: vertical wheel maps to page/chapter turns ---
        const rendition = bookInstance.renderTo(viewerElement, {
          manager: 'default',
          flow: 'paginated',
          width: '100%',
          height: '100%',
          spread: 'none',
          allowScriptedContent: false,
        });

        renditionRef.current = rendition;
        viewerElement.addEventListener('wheel', handleWheelForPageTurn, { passive: false });
        readerCleanupFns.push(() => viewerElement.removeEventListener('wheel', handleWheelForPageTurn));
        rendition.hooks.content.register(bindContentWheel);
        rendition.on('rendered', (_section: any, view: any) => bindContentWheel(view?.contents));

        await rendition.display(book.lastLocation || undefined);
        if (cancelled) return;

        // --- TOC ---
        bookInstance.loaded.navigation.then((nav: any) => {
          if (!cancelled) {
            const items = nav.toc || [];
            setToc(items);
            tocRef.current = items;
          }
        });

        // --- STYLING ---
        rendition.themes.default({
          body: {
            'font-family': "'Noto Serif SC', serif !important",
            'font-size': '20px !important',
            'line-height': '2.2 !important',
            'color': '#2a2a2a !important',
            'background-color': 'transparent !important',
            'padding': '40px 10% !important',
          },
          p: {
            'font-family': "'Noto Serif SC', serif !important",
            'margin-bottom': '1.5em !important',
            'text-align': 'justify !important',
          },
          img: {
            'max-width': '100% !important',
            'height': 'auto !important',
            'mix-blend-mode': 'multiply',
            'margin': '20px auto !important',
            'display': 'block !important',
          },
          '::selection': { 'background': 'rgba(139, 69, 19, 0.2)' },
        });

        rendition.hooks.content.register((contents: any) => {
          const link = contents.document.createElement('link');
          link.setAttribute('rel', 'stylesheet');
          link.setAttribute('href', 'https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@200;300;400;500;700&display=swap');
          contents.document.head.appendChild(link);
        });

        // --- SEARCH HIGHLIGHT: apply to every iframe that loads via hook ---
        rendition.hooks.content.register((contents: any) => {
          // Skip during CFI navigation — display() may trigger content hooks
          // before the iframe DOM is stable; wrapping text nodes at that point
          // corrupts epub.js CFI offset calculations (IndexSizeError).
          if (isSearchNavigatingRef.current) return;
          const query = highlightQueryRef.current;
          if (!query) return;
          applySearchHighlightToDocument(contents.document, query);
        });

        // --- TEXT SELECTION ---
        rendition.on('selected', (cfiRange: string, contents: any) => {
          const range = contents.range(cfiRange);
          const text = range.toString();
          if (text && text.trim().length > 0) {
            const rect = range.getBoundingClientRect();
            const iframe = contents.window?.frameElement as HTMLIFrameElement | null;
            const iframeRect = iframe?.getBoundingClientRect();
            if (iframeRect) {
              setSelection({ text, top: iframeRect.top + rect.top, left: iframeRect.left + rect.right + 10 });
            }
          } else {
            setSelection(null);
          }
        });

        // --- LOCATIONS (progress) ---
        bookInstance.locations.generate(1024).then(() => {
          if (cancelled) return;
          locationsReadyRef.current = true;
          const loc = rendition.currentLocation();
          if (loc?.start?.cfi) {
            const pct = Math.round(bookInstance.locations.percentageFromCfi(loc.start.cfi) * 100);
            progressRef.current = pct;
            setProgress(pct);
            updateBookMetadata(book.id, { progress: pct });
          }
        });

        // --- CHAPTER LABEL from TOC ---
        const updateChapterLabel = (href: string) => {
          const items = tocRef.current;
          const nav = items.find((item: any) => href && item.href && href.includes(item.href.split('#')[0]));
          if (nav) setChapterLabel(nav.label?.trim() || '');
        };

        // --- SAVE LOCATION on scroll ---
        rendition.on('relocated', (location: any) => {
          updateChapterLabel(location.start?.href || '');

          if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
          locationDebounceRef.current = setTimeout(async () => {
            const cfi = location.start?.cfi;
            if (!cfi) return;
            let newProgress = progressRef.current;
            if (locationsReadyRef.current && bookInstance.locations) {
              newProgress = Math.round(bookInstance.locations.percentageFromCfi(cfi) * 100);
              progressRef.current = newProgress;
              setProgress(newProgress);
            }
            if (newProgress >= 95) { newProgress = 100; progressRef.current = 100; setProgress(100); }
            await updateBookMetadata(book.id, { lastLocation: cfi, progress: newProgress });
          }, 800);
        });
      } catch (e) {
        console.error('Error loading book:', e);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    loadBook();

    return () => {
      cancelled = true;
      if (locationDebounceRef.current) clearTimeout(locationDebounceRef.current);
      if (wheelResetTimerRef.current) clearTimeout(wheelResetTimerRef.current);
      readerCleanupFns.forEach(cleanup => cleanup());
      if (bookInstance) bookInstance.destroy();

      // Flush pending card saves
      cardSaveTimersRef.current.forEach(timer => clearTimeout(timer));
      cardSaveTimersRef.current.clear();
      pendingCardsRef.current.forEach(card => saveCardToDB(card));
      pendingCardsRef.current.clear();

      // Clean up review hint timer
      if (reviewHintTimerRef.current) clearTimeout(reviewHintTimerRef.current);
    };
  }, [book.id]);

  // 3. Highlight search keywords — registered via content hook in loadBook

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
      renditionRef.current?.getContents().forEach((c: any) => c.window.getSelection().removeAllRanges());
    }
  };

  const addCard = async (text: string) => {
    const newCard: ThoughtCard = { id: Date.now().toString(), bookId: book.id, quote: text, note: '', timestamp: Date.now() };
    cardsRef.current = [newCard, ...cardsRef.current];
    setCards(cardsRef.current);
    await saveCardToDB(newCard);
    await updateBookMetadata(book.id, { sedimentLevel: book.sedimentLevel + 2 });
  };

  const handleDeleteCard = async (id: string) => {
    try {
      // Clean up debounce timer and pending data for this card
      const timer = cardSaveTimersRef.current.get(id);
      if (timer) {
        clearTimeout(timer);
        cardSaveTimersRef.current.delete(id);
      }
      pendingCardsRef.current.delete(id);

      await deleteCardFromDB(id);
      cardsRef.current = cardsRef.current.filter(c => c.id !== id);
      setCards(cardsRef.current);
    } catch (err) {
      console.error('Failed to delete card:', err);
    }
  };

  const updateCardNote = (id: string, note: string) => {
    // 1. Update cardsRef synchronously, then setCards
    cardsRef.current = cardsRef.current.map(c => c.id === id ? { ...c, note } : c);
    setCards(cardsRef.current);

    // 2. Debounce IndexedDB write — read from cardsRef, no closure dependency on setCards updater
    const updatedCard = cardsRef.current.find(c => c.id === id);
    if (updatedCard) {
      pendingCardsRef.current.set(id, updatedCard);
      const existing = cardSaveTimersRef.current.get(id);
      if (existing) clearTimeout(existing);
      cardSaveTimersRef.current.set(id, setTimeout(() => {
        const card = pendingCardsRef.current.get(id);
        if (card) {
          saveCardToDB(card);
          pendingCardsRef.current.delete(id);
        }
        cardSaveTimersRef.current.delete(id);
      }, 600));
    }
  };

  const flushCardNote = (id: string) => {
    const timer = cardSaveTimersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      cardSaveTimersRef.current.delete(id);
    }
    const card = pendingCardsRef.current.get(id);
    if (card) {
      saveCardToDB(card);
      pendingCardsRef.current.delete(id);
    }
  };

  const saveIntention = async () => {
    setIsEditingIntention(false);
    const trimmed = currentIntention.trim();
    if (trimmed !== (book.intention || '')) {
      await updateBookMetadata(book.id, { intention: trimmed });
    }
  };

  const handleIntentionKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') saveIntention();
  };

  // Search handlers
  const openSearch = () => {
    setShowSearch(true);
    setTimeout(() => searchInputRef.current?.focus(), 50);
  };

  const closeSearch = () => {
    clearHighlights();
    searchSeqRef.current += 1;
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setCardSearchResults([]);
  };

  const handleSearch = async (query: string) => {
    const seq = ++searchSeqRef.current;
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults([]);
      setCardSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    const originalQuery = query.trim();
    const q = originalQuery.toLowerCase();

    // Search cards (sync)
    const matchedCards = cardsRef.current.filter(
      c => c.quote.toLowerCase().includes(q) || c.note.toLowerCase().includes(q)
    );
    if (seq !== searchSeqRef.current) return;
    setCardSearchResults(matchedCards);

    // Search book content via spine item find
    let contentResults: { cfi: string; excerpt: string }[] = [];
    try {
      const book = bookRef.current;
      if (book?.spine?.spineItems) {
        for (const item of book.spine.spineItems) {
          if (seq !== searchSeqRef.current) return;
          try {
            await item.load(book.load.bind(book));
            const matches = item.find(originalQuery);
            if (matches && matches.length > 0) {
              contentResults.push(
                ...matches.slice(0, 50 - contentResults.length).map((m: any) => ({
                  cfi: m.cfi,
                  excerpt: m.excerpt || '',
                }))
              );
              if (contentResults.length >= 50) break;
            }
          } finally {
            item.unload();
          }
        }
      }
    } catch (err) {
      console.warn('Book content search failed', err);
    }

    if (seq !== searchSeqRef.current) return;
    setSearchResults(contentResults);
    setIsSearching(false);
  };

  const highlightMatch = (text: string, query: string): string => {
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return text;
    const start = Math.max(0, idx - 30);
    const end = Math.min(text.length, idx + query.length + 30);
    let snippet = text.slice(start, end);
    if (start > 0) snippet = '…' + snippet;
    if (end < text.length) snippet = snippet + '…';
    return snippet;
  };

  /** Remove highlights from every reachable iframe document. */
  const clearHighlights = () => {
    highlightQueryRef.current = null;

    // 1. Contents known to epub.js (rendition may be null transiently)
    const rendition = renditionRef.current;
    if (rendition) {
      try {
        const contents = rendition.getContents();
        contents.forEach((c: any) => {
          if (c.document) removeSearchHighlightsFromDocument(c.document);
        });
      } catch {}
    }

    // 2. Always sweep iframes in the viewer; getContents() may miss a transient
    //    iframe while epub.js is re-rendering after navigation.
    const viewer = viewerRef.current;
    if (viewer) {
      try {
        viewer.querySelectorAll('iframe').forEach((iframe: HTMLIFrameElement) => {
          const doc = iframe.contentDocument;
          if (doc) removeSearchHighlightsFromDocument(doc);
        });
      } catch {}
    }
  };

  const navigateToResult = async (cfi: string) => {
    const query = searchQuery.trim();
    if (!query) return;

    const rendition = renditionRef.current;
    if (!rendition) return;

    // 1. Remove old highlights from all iframes
    highlightQueryRef.current = null;
    clearHighlights();

    // 2. Block content hook from applying highlights during CFI display.
    //    epub.js builds/rebuilds iframe DOM during display(); wrapping text
    //    nodes at that stage corrupts CFI offset calculations (IndexSizeError).
    isSearchNavigatingRef.current = true;

    try {
      // 3. Navigate via the same display helper used by TOC jumps.
      await safeProgrammaticDisplay(rendition, cfi);
    } catch (err) {
      console.warn('navigateToResult: display failed', err);
    } finally {
      // 4. Unblock content hook — future iframe loads will pick up the ref
      isSearchNavigatingRef.current = false;
    }

    // 5. Now safe to set the query — content hook and explicit scan both work
    highlightQueryRef.current = query;

    // 6. Explicitly highlight all reachable iframes after a microtask tick.
    //    The content hook handles iframes loaded from this point on, but
    //    already-loaded iframes whose content didn't change won't re-trigger.
    //    requestAnimationFrame ensures the iframe DOM is fully settled.
    requestAnimationFrame(() => {
      const currentRendition = renditionRef.current;
      if (!currentRendition) return;
      try {
        const contents = currentRendition.getContents();
        contents.forEach((c: any) => {
          if (c.document) applySearchHighlightToDocument(c.document, query);
        });
      } catch {}
      const viewer = viewerRef.current;
      if (viewer) {
        try {
          viewer.querySelectorAll('iframe').forEach((iframe: HTMLIFrameElement) => {
            const doc = iframe.contentDocument;
            if (doc) applySearchHighlightToDocument(doc, query);
          });
        } catch {}
      }
    });

    // 7. Close search panel and clear results
    searchSeqRef.current += 1;
    setShowSearch(false);
    setSearchQuery('');
    setSearchResults([]);
    setCardSearchResults([]);
  };

  const handleTocNavigate = async (href: string) => {
    const rendition = renditionRef.current;
    if (rendition) {
      await safeProgrammaticDisplay(rendition, href);
    }
    setShowToc(false);
  };

  const handleExportMarkdown = () => {
    if (cards.length === 0) return;
    const now = new Date();
    const timeStr = now.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
    const lines: string[] = [];
    lines.push(`# ${book.title}`);
    lines.push('');
    lines.push(`**作者：** ${book.author || '未知'}`);
    lines.push('');
    lines.push(`**阅读意图：** ${currentIntention || '未设定'}`);
    lines.push('');
    lines.push(`**导出时间：** ${timeStr}`);
    lines.push('');
    lines.push(`**卡片数量：** ${cards.length}`);
    lines.push('');
    lines.push('---');
    lines.push('');
    cards.forEach((card, i) => {
      lines.push(`## ${i + 1}. 摘录`);
      lines.push('');
      card.quote.split('\n').forEach(line => {
        lines.push(line.trim() === '' ? '>' : `> ${line}`);
      });
      lines.push('');
      lines.push(`**我的思考：** ${card.note || '（未填写）'}`);
      lines.push('');
      const cardTime = new Date(card.timestamp).toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      lines.push(`*创建时间：${cardTime}*`);
      lines.push('');
      lines.push('---');
      lines.push('');
    });
    const content = lines.join('\n');
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const safeName = (book.title || 'deepread').replace(/[<>:"/\\|?*]/g, '_');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${safeName}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleCloseReview = () => setShowReview(false);

  const handleSaveReview = async () => {
    await updateBookMetadata(book.id, { reviewNote, completedAt: Date.now(), progress: 100 });
    setProgress(100);
    setReviewSaved(true);
  };

  return (
    <div className="w-full h-screen bg-[#FAF0E6] flex overflow-hidden">

      {/* ================= LEFT COLUMN (75%) ================= */}
      <div className="w-[75%] h-full relative bg-[#FAF0E6] flex flex-col group">
        {/* Header */}
        <div className="flex-none px-8 pt-8 pb-4 z-20 flex justify-between items-end border-b border-[#8B4513]/10 bg-[#FAF0E6]">
          <div className="flex items-center gap-6 w-full">
            <button onClick={onBack} className="p-2 text-[#4A4A4A] opacity-40 hover:opacity-100 transition-opacity flex-shrink-0">
              <ArrowLeft size={24} />
            </button>
            {toc.length > 0 && (
              <button onClick={() => setShowToc(!showToc)} className="p-2 text-[#4A4A4A] opacity-40 hover:opacity-100 transition-opacity flex-shrink-0" title="目录">
                <List size={20} />
              </button>
            )}
            <button onClick={openSearch} className="p-2 text-[#4A4A4A] opacity-40 hover:opacity-100 transition-opacity flex-shrink-0" title="搜索">
              <Search size={18} />
            </button>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-3">
                <div className="text-sm text-[#4A4A4A]/40 font-serif tracking-[0.1em] uppercase max-w-[300px] truncate">{book.title}</div>
                {chapterLabel && (
                  <span className="text-xs text-[#8B4513]/30 font-serif truncate max-w-[200px]">— {chapterLabel}</span>
                )}
                <div className="flex items-center gap-2 flex-shrink-0">
                  <div className="w-20 h-1 bg-[#8B4513]/10 rounded-full overflow-hidden">
                    <div className="h-full bg-[#8B4513]/40 rounded-full transition-all duration-700" style={{ width: `${progress}%` }} />
                  </div>
                  <span className="text-[10px] text-[#8B4513]/40 font-serif tabular-nums">{progress}%</span>
                  <span className="text-[10px] text-[#8B4513]/25 font-serif tabular-nums ml-1" title="累计阅读时长">
                    {totalReadingMs < 3_600_000
                      ? `${Math.round(totalReadingMs / 60_000)} 分钟`
                      : `${(totalReadingMs / 3_600_000).toFixed(1)} 小时`}
                  </span>
                  <div className="relative">
                    <button
                      onClick={() => {
                        if (progress >= 95 || (book.progress || 0) >= 95) {
                          setShowReview(true);
                          setReviewSaved(false);
                        } else {
                          if (reviewHintTimerRef.current) clearTimeout(reviewHintTimerRef.current);
                          setReviewHint(`读到 95% 后开启完成回顾，当前 ${progress}%`);
                          reviewHintTimerRef.current = setTimeout(() => { setReviewHint(null); reviewHintTimerRef.current = null; }, 2500);
                        }
                      }}
                      className="p-1.5 rounded text-[#8B4513]/40 hover:text-[#8B4513] hover:bg-[#8B4513]/5 transition-colors cursor-pointer"
                      title="完成回顾"
                    >
                      <BookOpenCheck size={16} />
                    </button>
                    <AnimatePresence>
                      {reviewHint && (
                        <motion.div
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 4 }}
                          transition={{ duration: 0.2 }}
                          className="absolute top-full right-0 mt-2 whitespace-nowrap text-[11px] font-serif text-[#8B4513]/70 bg-[#FAF0E6] border border-[#8B4513]/15 shadow-sm rounded px-3 py-1.5 z-50 pointer-events-none"
                        >
                          {reviewHint}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-1 h-6">
                <span className="text-xs text-[#8B4513]/60 font-serif font-bold uppercase flex-shrink-0">Purpose:</span>
                {isEditingIntention ? (
                  <input ref={intentionInputRef} type="text" value={currentIntention} onChange={e => setCurrentIntention(e.target.value)} onBlur={saveIntention} onKeyDown={handleIntentionKeyDown} autoFocus className="font-fangsong text-[#5C4033] tracking-wide bg-white/50 border-b border-[#8B4513]/30 outline-none w-full max-w-md px-1" />
                ) : (
                  <div onClick={() => { setIsEditingIntention(true); setTimeout(() => intentionInputRef.current?.focus(), 10); }} className="group/edit flex items-center gap-2 cursor-pointer hover:bg-[#8B4513]/5 px-2 rounded transition-colors duration-200" title="点击修改阅读目标">
                    <span className="font-fangsong text-[#5C4033] tracking-wide truncate">{currentIntention || '暂无目标'}</span>
                    <Edit3 size={10} className="text-[#8B4513]/30 opacity-0 group-hover/edit:opacity-100 transition-opacity" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Reader */}
        <div className="flex-1 relative overflow-hidden">
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center text-[#5C4033]/50 font-serif animate-pulse z-50 bg-[#FAF0E6]">
              <span className="tracking-widest">翻回上次阅读页...</span>
            </div>
          )}
          <div ref={viewerRef} className="w-full h-full" />
        </div>

        {/* TOC sidebar */}
        <AnimatePresence>
          {showToc && (
            <motion.div initial={{ x: -320, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -320, opacity: 0 }} transition={{ type: 'spring', stiffness: 300, damping: 30 }} className="absolute left-0 top-0 bottom-0 w-80 z-50 bg-[#FAF0E6] border-r border-[#8B4513]/10 shadow-[4px_0_20px_rgba(0,0,0,0.08)] overflow-y-auto">
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs uppercase tracking-[0.2em] text-[#5C4033]/50 font-serif font-bold">目录</span>
                  <button onClick={() => setShowToc(false)} className="text-[#5C4033]/40 hover:text-[#5C4033] transition-colors text-lg">×</button>
                </div>
                <div className="space-y-1">
                  {toc.map((item: any, i: number) => (
                    <button key={i} onClick={() => handleTocNavigate(item.href)} className="w-full text-left px-3 py-2.5 text-sm font-serif text-[#4A4A4A] hover:bg-[#8B4513]/5 rounded transition-colors truncate block" title={item.label?.trim()}>
                      {item.label?.trim() || `第 ${i + 1} 章`}
                    </button>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Search overlay */}
        <AnimatePresence>
          {showSearch && (
            <motion.div initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -20, opacity: 0 }} transition={{ type: 'spring', stiffness: 400, damping: 30 }} className="absolute top-0 left-0 right-0 z-50 bg-[#FAF0E6] border-b border-[#8B4513]/10 shadow-[0_4px_20px_rgba(0,0,0,0.08)] max-h-[70vh] flex flex-col">
              <div className="p-4 flex items-center gap-3 border-b border-[#8B4513]/5 flex-none">
                <Search size={16} className="text-[#8B4513]/40 flex-shrink-0" />
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => handleSearch(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Escape') closeSearch(); }}
                  placeholder="搜索正文或卡片..."
                  className="flex-1 bg-transparent outline-none font-fangsong text-[#2a2a2a] placeholder-[#8B4513]/25 text-sm"
                  autoFocus
                />
                {searchQuery && (
                  <span className="text-[10px] text-[#8B4513]/40 font-serif flex-shrink-0">
                    {isSearching ? '搜索中...' : `${searchResults.length + cardSearchResults.length} 条结果`}
                  </span>
                )}
                <button onClick={closeSearch} className="p-1 text-[#5C4033]/40 hover:text-[#5C4033] transition-colors cursor-pointer flex-shrink-0">
                  <X size={16} />
                </button>
              </div>
              {/* Results */}
              {(searchResults.length > 0 || cardSearchResults.length > 0) && (
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {/* Content results */}
                  {searchResults.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-[#8B4513]/50 font-serif font-bold mb-2">正文匹配 ({searchResults.length})</div>
                      <div className="space-y-1">
                        {searchResults.slice(0, 20).map((r, i) => (
                          <button key={i} onClick={() => navigateToResult(r.cfi)} className="w-full text-left px-3 py-2 text-sm font-serif text-[#4A4A4A] hover:bg-[#8B4513]/5 rounded transition-colors leading-relaxed line-clamp-2">
                            {r.excerpt}
                          </button>
                        ))}
                        {searchResults.length > 20 && (
                          <div className="text-[10px] text-[#8B4513]/40 font-serif px-3">还有 {searchResults.length - 20} 条结果...</div>
                        )}
                      </div>
                    </div>
                  )}
                  {/* Card results */}
                  {cardSearchResults.length > 0 && (
                    <div>
                      <div className="text-[10px] uppercase tracking-[0.15em] text-[#8B4513]/50 font-serif font-bold mb-2">卡片匹配 ({cardSearchResults.length})</div>
                      <div className="space-y-1">
                        {cardSearchResults.map(card => (
                          <div key={card.id} className="px-3 py-2 bg-white/30 rounded border border-[#8B4513]/5">
                            <div className="text-sm font-serif text-[#4A4A4A] leading-relaxed line-clamp-2">{card.quote}</div>
                            {card.note && <div className="text-xs font-fangsong text-[#5C4033]/60 mt-1 line-clamp-1">{card.note}</div>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
              {/* Empty state */}
              {searchQuery && !isSearching && searchResults.length === 0 && cardSearchResults.length === 0 && (
                <div className="p-8 text-center text-sm font-serif text-[#5C4033]/30">未找到匹配内容</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Drag handle */}
        <AnimatePresence>
          {selection && (
            <motion.div className="fixed z-[100]" style={{ top: selection.top, left: selection.left }} initial={{ opacity: 0, scale: 0.8, x: -10 }} animate={{ opacity: 1, scale: 1, x: 0 }} exit={{ opacity: 0, scale: 0.8, transition: { duration: 0.15 } }}>
              <div className="cursor-grab active:cursor-grabbing flex items-center gap-2 bg-[#2a2a2a] text-[#FAF0E6] px-5 py-3 rounded-r-full rounded-bl-full shadow-[5px_5px_20px_rgba(0,0,0,0.2)] hover:scale-105 transition-transform border border-white/10" draggable onDragStart={e => handleDragStart(e, selection.text)}>
                <GripVertical size={18} />
                <span className="text-sm font-serif font-bold tracking-widest pr-1">抓取</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ================= RIGHT COLUMN: MIND STREAM (25%) ================= */}
      <div className={`w-[25%] h-full border-l border-[#8B4513]/5 relative flex flex-col transition-colors duration-500 ease-in-out ${isDraggingOver ? 'bg-[#E6DCC8] shadow-[inset_10px_0_30px_rgba(139,69,19,0.05)]' : 'bg-[#EFE5D5] shadow-[inset_10px_0_20px_-10px_rgba(0,0,0,0.03)]'}`} onDragOver={e => { e.preventDefault(); setIsDraggingOver(true); }} onDragLeave={() => setIsDraggingOver(false)} onDrop={handleDrop}>
        <div className="sticky top-0 bg-[#EFE5D5]/95 backdrop-blur-sm p-8 z-10 border-b border-[#8B4513]/5 flex-none">
          <h3 className="text-xs uppercase tracking-[0.2em] text-[#5C4033]/50 flex items-center justify-between font-serif font-bold">
            <span>思维流淌</span>
            <div className="flex items-center gap-2">
              <button
                onClick={handleExportMarkdown}
                disabled={cards.length === 0}
                className="p-1.5 rounded text-[#5C4033]/70 hover:text-[#5C4033] hover:bg-[#5C4033]/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                title={cards.length === 0 ? '暂无卡片可导出' : '导出为 Markdown'}
              >
                <FileDown size={16} />
              </button>
              <span className="font-fangsong text-[#5C4033] bg-[#5C4033]/5 px-2 py-1 rounded">{cards.length} 想法</span>
            </div>
          </h3>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar p-8 pb-32">
          <div className="space-y-8">
            <AnimatePresence mode="popLayout">
              {cards.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col items-center justify-center text-[#5C4033]/30 space-y-6 mt-20">
                  <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#5C4033]/20 flex items-center justify-center"><PenTool size={24} /></div>
                  <span className="font-serif text-lg tracking-widest opacity-70">从左侧拖拽文字生成卡片</span>
                </motion.div>
              )}
              {cards.map(card => (
                <ThoughtCardItem key={card.id} card={card} onUpdate={updateCardNote} onDelete={handleDeleteCard} onFlush={flushCardNote} bookTitle={book.title} bookAuthor={book.author} intention={currentIntention} />
              ))}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {showReview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-black/30 backdrop-blur-sm"
            onClick={e => { if (e.target === e.currentTarget) handleCloseReview(); }}
          >
            <motion.div
              initial={{ opacity: 0, y: 30, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className="bg-[#FAF0E6] w-full max-w-lg mx-4 rounded-sm shadow-[0_20px_60px_rgba(92,64,51,0.15)] border border-[#8B4513]/10 relative overflow-hidden"
            >
              {/* Paper texture */}
              <div className="absolute inset-0 pointer-events-none opacity-30 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')]" />

              <div className="relative z-10 p-8">
                {/* Header */}
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-lg font-serif font-bold text-[#5C4033] tracking-wider">阅读完成回顾</h2>
                  <button onClick={handleCloseReview} aria-label="关闭回顾" title="关闭回顾" className="text-[#5C4033]/40 hover:text-[#5C4033] transition-colors text-xl cursor-pointer">×</button>
                </div>

                {/* Book info */}
                <div className="mb-5">
                  <div className="font-serif text-[#2a2a2a] font-bold text-base">{book.title}</div>
                  <div className="text-sm text-[#5C4033]/60 font-serif mt-0.5">{book.author || '未知作者'}</div>
                </div>

                {/* Intention */}
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-[0.15em] text-[#8B4513]/50 font-serif font-bold mb-1.5">最初阅读意图</div>
                  <div className="text-sm font-fangsong text-[#5C4033] bg-white/30 px-3 py-2 rounded border border-[#8B4513]/8">
                    {currentIntention || '未设定'}
                  </div>
                </div>

                {/* Cards preview */}
                <div className="mb-5">
                  <div className="text-xs uppercase tracking-[0.15em] text-[#8B4513]/50 font-serif font-bold mb-1.5">
                    摘录卡片 <span className="font-fangsong normal-case ml-1">({cards.length})</span>
                  </div>
                  {cards.length === 0 ? (
                    <div className="text-sm text-[#5C4033]/40 font-serif py-2">还没有摘录卡片</div>
                  ) : (
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {cards.slice(0, 5).map(card => (
                        <div key={card.id} className="text-sm text-[#4A4A4A] font-serif bg-white/30 px-3 py-2 rounded border border-[#8B4513]/8 leading-relaxed line-clamp-3">
                          {card.quote.length > 120 ? card.quote.slice(0, 120) + '…' : card.quote}
                        </div>
                      ))}
                      {cards.length > 5 && (
                        <div className="text-xs text-[#8B4513]/40 font-serif">还有 {cards.length - 5} 张卡片…</div>
                      )}
                    </div>
                  )}
                </div>

                {/* Review note textarea */}
                <div className="mb-6">
                  <div className="text-xs uppercase tracking-[0.15em] text-[#8B4513]/50 font-serif font-bold mb-1.5">读完后的收获</div>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="写下你读完这本书的最终收获和感想…"
                    className="w-full bg-white/30 border border-[#8B4513]/10 rounded px-3 py-2 text-[#2a2a2a] font-fangsong text-sm leading-relaxed resize-none outline-none focus:border-[#8B4513]/30 min-h-[100px] placeholder-[#8B4513]/20"
                  />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-end gap-3">
                  <button onClick={handleCloseReview} className="px-4 py-2 text-sm font-serif text-[#5C4033]/60 hover:text-[#5C4033] transition-colors cursor-pointer">
                    取消
                  </button>
                  {reviewSaved ? (
                    <span className="px-4 py-2 text-sm font-serif text-[#8B4513]/60 tracking-wider">已保存 ✓</span>
                  ) : (
                    <button onClick={handleSaveReview} className="px-5 py-2 text-sm font-serif font-bold text-[#FAF0E6] bg-[#5C4033] hover:bg-[#8B4513] rounded transition-colors cursor-pointer tracking-wider">
                      保存回顾
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ThoughtCardItem: React.FC<{
  card: ThoughtCard;
  onUpdate: (id: string, note: string) => void;
  onDelete: (id: string) => void;
  onFlush: (id: string) => void;
  bookTitle: string;
  bookAuthor: string;
  intention: string;
}> = ({ card, onUpdate, onDelete, onFlush, bookTitle, bookAuthor, intention }) => {
  const [isFocused, setIsFocused] = useState(false);
  const [activeAction, setActiveAction] = useState<'explain' | 'challenge' | 'associate' | null>(null);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const requestSeqRef = useRef(0);

  const handleAiReflect = async (action: 'explain' | 'challenge' | 'associate') => {
    const seq = ++requestSeqRef.current;
    setIsAiLoading(true);
    setAiError(null);
    setActiveAction(action);
    setAiResponse("");
    try {
      const res = await fetch('/api/ai/reflect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quote: card.quote, note: card.note, action, title: bookTitle, author: bookAuthor, intention }),
      });

      if (!res.ok) {
        let errMsg = '思绪生成失败，请稍后重试。';
        try { const d = await res.json(); errMsg = d.error || errMsg; } catch { try { errMsg = await res.text() || errMsg; } catch {} }
        throw new Error(errMsg);
      }

      if (res.body) {
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          if (seq !== requestSeqRef.current) { reader.cancel(); return; }
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) setAiResponse(prev => (prev || "") + chunk);
        }
      } else {
        const text = await res.text();
        if (seq !== requestSeqRef.current) return;
        setAiResponse(text);
      }
    } catch (err: any) {
      if (seq !== requestSeqRef.current) return;
      console.error('AI Reflect error:', err);
      setAiError(err.message || '网络连接失败，请稍后重试。');
    } finally {
      if (seq === requestSeqRef.current) setIsAiLoading(false);
    }
  };

  return (
    <motion.div layout initial={{ opacity: 0, y: 30, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} className="bg-[#FAF0E6] p-8 shadow-[0_4px_20px_rgba(92,64,51,0.08)] border border-white/60 relative group rounded-sm hover:shadow-[0_8px_30px_rgba(92,64,51,0.12)] transition-shadow duration-300">
      <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-multiply bg-[url('https://www.transparenttextures.com/patterns/cream-paper.png')] rounded-sm" />
      {/* Delete card button */}
      <button
        onClick={() => onDelete(card.id)}
        className="absolute top-3 right-3 z-20 p-1.5 rounded-full text-[#8B4513]/20 opacity-0 group-hover:opacity-100 hover:text-red-700 hover:bg-red-50 transition-all cursor-pointer"
        title="删除此卡片"
      >
        <Trash2 size={14} />
      </button>
      <div className="relative z-10">
        <div className="mb-6 relative pl-4">
          <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#8B4513]/30 rounded-full" />
          <blockquote className="text-base font-serif text-[#4A4A4A] leading-relaxed mix-blend-multiply text-justify">{card.quote}</blockquote>
        </div>
        <div className="relative mt-6 pt-6 border-t border-dashed border-[#8B4513]/10">
          <textarea value={card.note} onChange={e => onUpdate(card.id, e.target.value)} placeholder="在此写下你的思考..." className="w-full bg-transparent resize-none text-[#2a2a2a] outline-none font-fangsong text-xl leading-relaxed placeholder-[#8B4513]/20 min-h-[80px]" onFocus={() => setIsFocused(true)} onBlur={() => { setIsFocused(false); onFlush(card.id); }} />
          <div className="h-[1px] bg-[#8B4513]/10 w-full relative overflow-hidden mt-2">
            <motion.div className="absolute inset-0 bg-[#8B4513]" initial={{ scaleX: 0, opacity: 0.5 }} animate={{ scaleX: isFocused ? 1 : 0, opacity: 1 }} transition={{ duration: 0.5, ease: 'easeOut' }} />
          </div>
        </div>
        <div className="flex items-center justify-end space-x-2 mt-6">
          <ActionButton icon={<Brain size={14} />} label="解释" active={activeAction === 'explain'} onClick={() => handleAiReflect('explain')} />
          <ActionButton icon={<MessageSquare size={14} />} label="反驳" active={activeAction === 'challenge'} onClick={() => handleAiReflect('challenge')} />
          <ActionButton icon={<Link size={14} />} label="联想" active={activeAction === 'associate'} onClick={() => handleAiReflect('associate')} />
        </div>
        <AnimatePresence>
          {activeAction && (
            <motion.div initial={{ opacity: 0, height: 0, marginTop: 0 }} animate={{ opacity: 1, height: 'auto', marginTop: 24 }} exit={{ opacity: 0, height: 0, marginTop: 0 }} transition={{ duration: 0.3 }} className="p-5 bg-[#FAF1E4] rounded border border-[#8B4513]/15 overflow-hidden text-[#5C4033] shadow-inner font-fangsong relative">
              <div className="flex items-center justify-between border-b border-[#8B4513]/10 pb-2 mb-3 text-[11px] tracking-wider text-[#8B4513]/60 font-bold">
                <span className={`flex items-center gap-1.5 font-serif uppercase ${isAiLoading ? 'animate-pulse' : ''}`}>
                  {activeAction === 'explain' && <Brain size={12} className="text-[#8B4513]" />}
                  {activeAction === 'challenge' && <MessageSquare size={12} className="text-[#8B4513]" />}
                  {activeAction === 'associate' && <Link size={12} className="text-[#8B4513]" />}
                  {activeAction === 'explain' ? '意境深度释义' : activeAction === 'challenge' ? '辩证思辨视角' : '跨界启发联想'}
                </span>
                <button onClick={() => { setActiveAction(null); setAiResponse(null); setAiError(null); }} className="text-[11px] opacity-60 hover:opacity-100 text-[#8B4513] transition-opacity cursor-pointer font-serif font-bold">收起</button>
              </div>
              {isAiLoading && !aiResponse && (
                <div className="flex flex-col items-center justify-center py-6 space-y-3">
                  <div className="w-5 h-5 border-2 border-[#8B4513]/30 border-t-[#8B4513] rounded-full animate-spin" />
                  <span className="text-xs font-serif opacity-60 tracking-widest text-[#8B4513]/70 animate-pulse">正在铺纸研墨，思索真义...</span>
                </div>
              )}
              {aiError && <div className="text-red-700/80 text-xs py-2 leading-relaxed">{aiError}</div>}
              {aiResponse && (
                <p className="text-sm md:text-base leading-relaxed tracking-wider whitespace-pre-line text-[#3d2712] font-fangsong text-justify">
                  {aiResponse}
                  {isAiLoading && <span className="inline-block w-[2px] h-[1em] bg-[#8B4513]/40 ml-[2px] animate-pulse align-text-bottom" />}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

const ActionButton: React.FC<{ icon: React.ReactNode; label: string; active: boolean; onClick: () => void }> = ({ icon, label, active, onClick }) => (
  <button className={`flex items-center space-x-1.5 px-3 py-1.5 rounded transition-all duration-300 cursor-pointer group text-xs ${active ? 'bg-[#8B4513]/10 shadow-[inner_0_1px_2px_rgba(0,0,0,0.05)] border border-[#8B4513]/10' : 'bg-[#5C4033]/5 hover:bg-[#5C4033]/10'}`} onClick={onClick}>
    <span className={`${active ? 'text-[#8B4513]' : 'text-[#5C4033]/70 group-hover:text-[#5C4033]'} transition-colors`}>{icon}</span>
    <span className={`font-serif font-bold tracking-wider transition-colors ${active ? 'text-[#8B4513]' : 'text-[#5C4033]/80 group-hover:text-[#5C4033]'}`}>{label}</span>
  </button>
);
