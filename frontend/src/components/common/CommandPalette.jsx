import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, Command, LayoutDashboard, ShoppingCart, Map, Video, 
  Layers, Package, BarChart3, AlertTriangle, FileText, Settings, 
  Play, Square, Database, Download, Bot, Moon, Sun, Volume2, 
  VolumeX, ArrowRight, CornerDownLeft, Sparkles, Check
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { toast } from 'sonner';
import { sharedAudioCues } from '../../lib/audioCues';

export function CommandPalette({ isOpen, setIsOpen, isDark, toggleTheme, onOpenCopilot }) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [products, setProducts] = useState([]);
  const [simStatus, setSimStatus] = useState({ is_running: false });
  const [isExportingBQ, setIsExportingBQ] = useState(false);
  const inputRef = useRef(null);

  // Poll simulator status & fetch products
  useEffect(() => {
    if (!isOpen) return;

    fetch('/api/simulation/status')
      .then(res => res.ok ? res.json() : null)
      .then(data => { if (data) setSimStatus(data); })
      .catch(() => {});

    fetch('/api/products')
      .then(res => res.ok ? res.json() : [])
      .then(data => { if (Array.isArray(data)) setProducts(data); })
      .catch(() => {});

    setQuery('');
    setSelectedIndex(0);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, [isOpen]);

  // Global keydown for Cmd+K / Ctrl+K and Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsOpen(prev => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, setIsOpen]);

  // Actions definitions
  const pages = [
    { id: 'page-dash', title: 'Store Operations Dashboard', path: '/', icon: LayoutDashboard, category: 'Pages' },
    { id: 'page-pos', title: 'Cashierless POS & Virtual Carts', path: '/checkout', icon: ShoppingCart, category: 'Pages' },
    { id: 'page-floor', title: 'Store Blueprint & 3D Digital Twin', path: '/floorplan', icon: Map, category: 'Pages' },
    { id: 'page-cctv', title: 'CCTV Vision Matrix & Streams', path: '/cameras', icon: Video, category: 'Pages' },
    { id: 'page-plano', title: 'Planogram & Shelf Replenishment', path: '/planogram', icon: Layers, category: 'Pages' },
    { id: 'page-prod', title: 'Product Catalog & ViT Classifier', path: '/products', icon: Package, category: 'Pages' },
    { id: 'page-bi', title: 'C-Suite Commercial BI & BigQuery Hub', path: '/analytics', icon: BarChart3, category: 'Pages' },
    { id: 'page-sec', title: 'Loss Prevention & Security Audits', path: '/alerts', icon: AlertTriangle, category: 'Pages' },
    { id: 'page-logs', title: 'Unified Retail Event Stream', path: '/events', icon: FileText, category: 'Pages' },
    { id: 'page-set', title: 'Enterprise Settings & Edge Config', path: '/settings', icon: Settings, category: 'Pages' },
  ];

  const handleToggleSimulation = async () => {
    try {
      const res = await fetch('/api/simulation/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSimStatus(data.simulation);
        if (data.simulation.is_running) {
          toast.success('Live Store Simulator Started! Multi-shopper footfall active.');
        } else {
          toast.info('Store Simulator Paused.');
        }
      }
    } catch (e) {
      toast.error('Failed to toggle simulator');
    }
  };

  const handleBigQueryExport = async () => {
    setIsExportingBQ(true);
    toast.loading('Exporting SQLite records to BigQuery NDJSON schemas...', { id: 'bq-export' });
    try {
      const res = await fetch('/api/bigquery/export', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`BigQuery Export Complete: 5 tables formatted (${data.exports?.store_products?.count || 12} products)`, { id: 'bq-export' });
        navigate('/analytics');
      } else {
        toast.error('BigQuery export failed', { id: 'bq-export' });
      }
    } catch (e) {
      toast.error('BigQuery export network error', { id: 'bq-export' });
    } finally {
      setIsExportingBQ(false);
    }
  };

  const liveActions = [
    {
      id: 'act-sim',
      title: simStatus.is_running ? 'Pause Store Live Simulator' : 'Start Autonomous Store Live Simulator',
      subtitle: simStatus.is_running ? `${simStatus.active_simulated_shoppers || 0} shoppers in-store` : 'Generate multi-shopper footfall & autonomous checkouts',
      icon: simStatus.is_running ? Square : Play,
      category: 'Store Actions',
      handler: () => { handleToggleSimulation(); setIsOpen(false); },
      badge: simStatus.is_running ? 'Active 🟢' : 'Start ▶'
    },
    {
      id: 'act-copilot',
      title: 'Open AI Retail Copilot',
      subtitle: 'Ask about stockouts, revenue velocity, or TimesFM forecast',
      icon: Bot,
      category: 'Store Actions',
      handler: () => { if (onOpenCopilot) onOpenCopilot(); setIsOpen(false); },
      badge: 'Assistant'
    },
    {
      id: 'act-bq',
      title: 'Sync Catalog & Events to Google BigQuery',
      subtitle: 'Generate NDJSON tables and TimesFM ML pipeline exports',
      icon: Database,
      category: 'Store Actions',
      handler: () => { handleBigQueryExport(); setIsOpen(false); },
      badge: 'AI/ML'
    },
    {
      id: 'act-pdf',
      title: 'Download Executive Warehouse Sales PDF Report',
      subtitle: 'Itemized sales, dispatched quantities, asset valuations, and GST breakdowns',
      icon: FileText,
      category: 'Warehouse Actions',
      handler: () => {
        window.open('/api/analytics/export/pdf', '_blank');
        toast.success('Downloading warehouse executive sales PDF...');
        setIsOpen(false);
      },
      badge: 'PDF'
    },
    {
      id: 'act-csv',
      title: 'Download Executive Audit CSV Report',
      subtitle: 'Direct export of transactions, GMV, and shrinkage logs',
      icon: Download,
      category: 'Warehouse Actions',
      handler: () => {
        window.open('/api/analytics/export/csv', '_blank');
        toast.success('Downloading audit CSV...');
        setIsOpen(false);
      },
      badge: 'CSV'
    },
    {
      id: 'act-theme',
      title: isDark ? 'Switch to Day/Light Mode' : 'Switch to Dark/OLED Mode',
      subtitle: 'Toggle dashboard visual contrast theme',
      icon: isDark ? Sun : Moon,
      category: 'Store Actions',
      handler: () => { toggleTheme(); setIsOpen(false); },
      badge: 'Theme'
    },
    {
      id: 'act-sound',
      title: sharedAudioCues.isMuted() ? 'Enable Sound Cues & Chimes' : 'Mute Retail Beeps & Chimes',
      subtitle: 'Audio feedback for barcode scans and cart additions',
      icon: sharedAudioCues.isMuted() ? Volume2 : VolumeX,
      category: 'Store Actions',
      handler: () => {
        const next = !sharedAudioCues.isMuted();
        sharedAudioCues.setMuted(next);
        toast.info(next ? 'Sound cues muted' : 'Sound cues enabled');
        setIsOpen(false);
      },
      badge: 'Audio'
    }
  ];

  // Filter items
  const cleanQ = query.trim().toLowerCase();

  const filteredPages = pages.filter(p => 
    !cleanQ || p.title.toLowerCase().includes(cleanQ) || p.path.toLowerCase().includes(cleanQ)
  );

  const filteredActions = liveActions.filter(a => 
    !cleanQ || a.title.toLowerCase().includes(cleanQ) || a.subtitle.toLowerCase().includes(cleanQ)
  );

  const filteredProducts = products.filter(p => 
    !cleanQ || p.name.toLowerCase().includes(cleanQ) || p.sku.toLowerCase().includes(cleanQ) || (p.category && p.category.toLowerCase().includes(cleanQ))
  ).slice(0, 5);

  const allItems = [
    ...filteredPages.map(p => ({ ...p, type: 'PAGE' })),
    ...filteredActions.map(a => ({ ...a, type: 'ACTION' })),
    ...filteredProducts.map(pr => ({ 
      id: `prod-${pr.id}`, 
      title: pr.name, 
      subtitle: `${pr.sku} · ₹${pr.unit_price} · ${pr.current_stock ?? 0} in stock`,
      category: 'Catalog SKUs',
      type: 'PRODUCT',
      product: pr
    }))
  ];

  // Keyboard navigation
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % (allItems.length || 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + (allItems.length || 1)) % (allItems.length || 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const current = allItems[selectedIndex];
      if (current) {
        executeItem(current);
      }
    }
  };

  const executeItem = (item) => {
    sharedAudioCues.playPickup();
    if (item.type === 'PAGE') {
      navigate(item.path);
      setIsOpen(false);
    } else if (item.type === 'ACTION') {
      item.handler();
    } else if (item.type === 'PRODUCT') {
      navigate('/planogram');
      toast.info(`Inspecting ${item.product.name} on Planogram`);
      setIsOpen(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-start justify-center pt-20 px-4 animate-in fade-in duration-150"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col text-foreground animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Spotlight Search Header */}
        <div className="p-4 border-b border-border/60 flex items-center gap-3 bg-muted/20">
          <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <Search className="h-4 w-4" />
          </div>
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command, store aisle, SKU, or action (e.g. 'coke', 'bigquery', 'pos')..."
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
            className="w-full bg-transparent border-none outline-none text-base text-foreground placeholder:text-foreground/45 font-medium"
          />
          {query && (
            <button 
              onClick={() => { setQuery(''); inputRef.current?.focus(); }}
              className="text-xs text-foreground/50 hover:text-foreground px-2 py-1 rounded bg-muted/60"
            >
              Clear
            </button>
          )}
          <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] font-mono font-semibold text-foreground/60 bg-muted/80 rounded border border-border">
            ESC
          </kbd>
        </div>

        {/* Results List */}
        <div className="p-2 max-h-[420px] overflow-y-auto space-y-4">
          {allItems.length === 0 ? (
            <div className="py-12 text-center text-foreground/60">
              <p className="text-sm font-medium">No matching pages, actions, or products found.</p>
              <p className="text-xs text-foreground/40 mt-1">Try searching for "BigQuery", "POS", "Beverages", or "Restock".</p>
            </div>
          ) : (
            <>
              {/* Group: Store Actions */}
              {filteredActions.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-foreground/50 uppercase tracking-wider">
                    Operational Controls & Simulation
                  </div>
                  <div className="space-y-1">
                    {filteredActions.map((action) => {
                      const idx = allItems.findIndex(i => i.id === action.id);
                      const isSelected = selectedIndex === idx;
                      const Icon = action.icon;
                      return (
                        <div
                          key={action.id}
                          onClick={() => executeItem({ ...action, type: 'ACTION' })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-xs' 
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground/70'}`}>
                              <Icon className="h-4 w-4" />
                            </div>
                            <div>
                              <div className="text-sm font-semibold">{action.title}</div>
                              <div className="text-xs text-foreground/60">{action.subtitle}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {action.badge && (
                              <Badge variant="outline" className="text-[10px] font-mono">
                                {action.badge}
                              </Badge>
                            )}
                            {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-primary opacity-80" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group: Store Pages */}
              {filteredPages.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-foreground/50 uppercase tracking-wider">
                    Store View Navigation
                  </div>
                  <div className="space-y-1">
                    {filteredPages.map((page) => {
                      const idx = allItems.findIndex(i => i.id === page.id);
                      const isSelected = selectedIndex === idx;
                      const Icon = page.icon;
                      return (
                        <div
                          key={page.id}
                          onClick={() => executeItem({ ...page, type: 'PAGE' })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`px-3 py-2 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-xs' 
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted/70 text-foreground/70'}`}>
                              <Icon className="h-3.5 w-3.5" />
                            </div>
                            <span className="text-sm font-medium">{page.title}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono text-foreground/50">{page.path}</span>
                            {isSelected && <CornerDownLeft className="h-3.5 w-3.5 text-primary opacity-80" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Group: Catalog SKUs */}
              {filteredProducts.length > 0 && (
                <div>
                  <div className="px-3 py-1.5 text-[11px] font-bold text-foreground/50 uppercase tracking-wider">
                    Live Catalog SKUs ({products.length} registered)
                  </div>
                  <div className="space-y-1">
                    {filteredProducts.map((prod) => {
                      const idx = allItems.findIndex(i => i.id === `prod-${prod.id}`);
                      const isSelected = selectedIndex === idx;
                      return (
                        <div
                          key={prod.id}
                          onClick={() => executeItem({ type: 'PRODUCT', product: prod })}
                          onMouseEnter={() => setSelectedIndex(idx)}
                          className={`px-3 py-2.5 rounded-xl cursor-pointer flex items-center justify-between transition-all ${
                            isSelected 
                              ? 'bg-primary/10 text-primary font-medium border border-primary/20 shadow-xs' 
                              : 'hover:bg-muted/60 text-foreground'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center overflow-hidden border border-border">
                              {prod.image_url ? (
                                <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                              ) : (
                                <Package className="h-4 w-4 text-foreground/50" />
                              )}
                            </div>
                            <div>
                              <div className="text-sm font-semibold">{prod.name}</div>
                              <div className="text-xs text-foreground/60 font-mono">
                                {prod.sku} · {prod.category || 'Grocery'}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-xs font-bold text-foreground">₹{prod.unit_price}</div>
                              <div className={`text-[10px] font-medium ${(prod.current_stock || 0) <= 3 ? 'text-amber-500 font-bold' : 'text-foreground/60'}`}>
                                {prod.current_stock || 0} left
                              </div>
                            </div>
                            {isSelected && <ArrowRight className="h-3.5 w-3.5 text-primary" />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="p-3 border-t border-border/60 bg-muted/30 flex items-center justify-between text-[11px] text-foreground/60">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono font-bold">↑↓</kbd> Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono font-bold">↵</kbd> Select
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-muted border border-border font-mono font-bold">ESC</kbd> Close
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-primary font-semibold">
            <Sparkles className="h-3 w-3" /> MetaRetail Spotlight
          </div>
        </div>
      </div>
    </div>
  );
}
