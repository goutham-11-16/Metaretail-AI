import React, { useState, useEffect } from 'react';
import { useLocation, Link, useNavigate } from 'react-router-dom';
import { Search, Bell, Settings, Menu, Globe, Copy, Check, ExternalLink, Command, Volume2, VolumeX, Sparkles, RefreshCw, Power, Sun, Moon, Building2, Play, Square, Bot } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { CommandPalette } from '../common/CommandPalette';
import { toast } from 'sonner';
import { sharedAudioCues } from '../../lib/audioCues';

export function Header({ toggleSidebar, isDark, toggleTheme, onOpenCopilot }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [time, setTime] = useState(new Date());
  const [query, setQuery] = useState('');
  const [tunnelStatus, setTunnelStatus] = useState({ status: 'OFFLINE', public_url: null });
  const [isTunnelModalOpen, setIsTunnelModalOpen] = useState(false);
  const [isCmdOpen, setIsCmdOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isTogglingTunnel, setIsTogglingTunnel] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(!sharedAudioCues.isMuted());

  // Franchise Selector
  const franchises = [
    { id: 'blr-01', name: 'Flagship #01 - Indiranagar, BLR', code: 'BLR-HQ', status: 'LIVE' },
    { id: 'bom-02', name: 'Express #02 - Bandra West, BOM', code: 'BOM-EX', status: 'EDGE' },
    { id: 'del-03', name: 'Hypermarket #03 - Connaught Pl, DEL', code: 'DEL-HY', status: 'EDGE' },
  ];
  const [selectedFranchise, setSelectedFranchise] = useState(franchises[0]);

  // Simulator Status Polling
  const [simStatus, setSimStatus] = useState({ is_running: false, active_simulated_shoppers: 0 });
  const [isTogglingSim, setIsTogglingSim] = useState(false);

  const fetchSimStatus = async () => {
    try {
      const res = await fetch('/api/simulation/status');
      if (res.ok) setSimStatus(await res.json());
    } catch (e) {}
  };

  const handleToggleSim = async () => {
    setIsTogglingSim(true);
    try {
      const res = await fetch('/api/simulation/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSimStatus(data.simulation);
        if (data.simulation.is_running) {
          toast.success('Live Store Simulator Started!');
        } else {
          toast.info('Store Simulator Paused.');
        }
      }
    } catch (e) {
      toast.error('Failed to toggle simulator');
    } finally {
      setIsTogglingSim(false);
    }
  };

  // Poll tunnel status & sim status
  const fetchTunnel = async () => {
    try {
      const res = await fetch('/api/tunnel/status');
      if (res.ok) setTunnelStatus(await res.json());
    } catch (e) {}
  };

  useEffect(() => {
    fetchTunnel();
    fetchSimStatus();
    const tInterval = setInterval(fetchTunnel, 4000);
    const simInterval = setInterval(fetchSimStatus, 3000);
    const clockInterval = setInterval(() => setTime(new Date()), 1000);
    return () => {
      clearInterval(tInterval);
      clearInterval(simInterval);
      clearInterval(clockInterval);
    };
  }, []);

  // Keyboard shortcut: Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsCmdOpen(prev => !prev);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleToggleTunnel = async () => {
    setIsTogglingTunnel(true);
    try {
      const endpoint = tunnelStatus.status === 'ONLINE' ? '/api/tunnel/stop' : '/api/tunnel/start';
      const res = await fetch(endpoint, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTunnelStatus(data);
        if (data.status === 'ONLINE') {
          toast.success('Cloudflare Public Tunnel is ONLINE! Valid SSL ready.');
        } else {
          toast.info('Cloudflare Tunnel stopped.');
        }
      }
    } catch (e) {
      toast.error('Failed to toggle Cloudflare tunnel');
    } finally {
      setIsTogglingTunnel(false);
    }
  };

  const handleCopyUrl = () => {
    if (tunnelStatus.public_url) {
      navigator.clipboard.writeText(tunnelStatus.public_url);
      setCopied(true);
      toast.success('Public URL copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const playRetailBeep = () => {
    if (!soundEnabled) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1760, ctx.currentTime);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.12);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } catch (e) {}
  };

  const handleSearchSubmit = (e) => {
    if (e.key === 'Enter' && query.trim()) {
      playRetailBeep();
      navigate(`/products?q=${encodeURIComponent(query.trim())}`);
    }
  };

  const quickNav = (path) => {
    playRetailBeep();
    navigate(path);
    setIsCmdOpen(false);
  };

  const getPageTitle = () => {
    const path = location.pathname;
    if (path === '/') return 'Store Operations Dashboard';
    if (path === '/checkout') return 'Cashierless POS & Autonomous Checkout';
    if (path === '/floorplan') return '2D Store Blueprint & Spatial Heatmap';
    const title = path.substring(1).charAt(0).toUpperCase() + path.substring(2);
    return title.split('-').join(' ');
  };

  return (
    <header className="h-16 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-30 flex items-center justify-between px-4 sm:px-6 w-full max-w-full overflow-hidden">
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 shrink">
        <Button variant="ghost" size="icon" onClick={toggleSidebar} className="md:hidden shrink-0">
          <Menu className="w-5 h-5" />
        </Button>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground whitespace-nowrap truncate">{getPageTitle()}</h1>

        {/* Multi-Store Franchise Switcher */}
        <div className="hidden xl:flex items-center gap-1.5 bg-muted/60 border border-border/60 rounded-xl px-2.5 py-1 text-xs font-semibold shrink-0">
          <Building2 className="h-3.5 w-3.5 text-primary" />
          <select
            value={selectedFranchise.id}
            onChange={(e) => {
              const f = franchises.find(x => x.id === e.target.value);
              if (f) {
                setSelectedFranchise(f);
                toast.success(`Switched active node to ${f.name}`);
              }
            }}
            className="bg-transparent border-none text-foreground font-semibold text-xs outline-none cursor-pointer max-w-[180px] truncate"
          >
            {franchises.map(f => (
              <option key={f.id} value={f.id} className="bg-card text-foreground">
                {f.name} ({f.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Simulator Status & Toggle Button */}
        <Button
          variant={simStatus.is_running ? "default" : "outline"}
          size="sm"
          onClick={handleToggleSim}
          disabled={isTogglingSim}
          className={`hidden sm:inline-flex items-center gap-1.5 text-xs font-semibold h-9 px-2.5 sm:px-3 shrink-0 ${
            simStatus.is_running 
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs' 
              : 'border-border text-foreground/80 hover:bg-muted'
          }`}
          title="Autonomous Store Multi-Shopper Live Simulator"
        >
          {simStatus.is_running ? (
            <>
              <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
              <span>Sim Active ({simStatus.active_simulated_shoppers || 0})</span>
            </>
          ) : (
            <>
              <Play className="h-3.5 w-3.5 text-primary fill-current" />
              <span>Start Sim</span>
            </>
          )}
        </Button>

        {/* Cloudflare Tunnel Status Pill */}
        <button
          onClick={() => setIsTunnelModalOpen(true)}
          className={`hidden 2xl:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold border transition-all shrink-0 ${
            tunnelStatus.status === 'ONLINE'
              ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20'
              : 'bg-muted/60 text-foreground/70 border-border hover:bg-muted'
          }`}
          title="Cloudflare Global Public Tunnel"
        >
          <span className={`w-2 h-2 rounded-full ${tunnelStatus.status === 'ONLINE' ? 'bg-emerald-500 animate-pulse' : 'bg-zinc-400'}`} />
          <Globe className="h-3.5 w-3.5" />
          <span>{tunnelStatus.status === 'ONLINE' ? 'Tunnel Active' : 'Tunnel (Off)'}</span>
        </button>

        {/* Global Search Input */}
        <div className="relative hidden lg:flex items-center w-36 xl:w-48 2xl:w-56 shrink">
          <Search className="absolute left-2.5 w-4 h-4 text-foreground/60" />
          <Input 
            type="search" 
            placeholder="Search store (Press ↵)..." 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleSearchSubmit}
            className="pl-9 bg-muted/50 border border-border/50 h-9 text-xs text-foreground placeholder:text-foreground/50" 
          />
        </div>

        {/* AI Copilot Quick Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => { if (onOpenCopilot) onOpenCopilot(); }}
          className="hidden md:flex items-center gap-1.5 text-xs text-primary font-semibold px-2.5 h-9 bg-primary/5 border-primary/20 hover:bg-primary/10 shrink-0"
          title="Open AI Retail Copilot"
        >
          <Bot className="h-3.5 w-3.5" />
          <span>Copilot</span>
        </Button>

        {/* Command Palette Trigger */}
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsCmdOpen(true)}
          className="hidden xl:flex items-center gap-1.5 text-xs text-foreground/70 font-semibold px-2.5 h-9 shrink-0"
          title="Spotlight Command Palette (Cmd+K)"
        >
          <Command className="h-3.5 w-3.5" />
          <span>Cmd+K</span>
        </Button>

        {/* Sound Chime Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => {
            const nextVal = !soundEnabled;
            setSoundEnabled(nextVal);
            sharedAudioCues.setMuted(!nextVal);
            if (nextVal) {
              sharedAudioCues.playPickup();
              toast.success('Sound cues enabled');
            } else {
              toast.info('Sound muted');
            }
          }}
          title={soundEnabled ? "Sound Beeps & Chimes Enabled" : "Sound Muted"}
          className="text-foreground/70 hover:text-foreground shrink-0"
        >
          {soundEnabled ? <Volume2 className="h-4 w-4 text-emerald-500" /> : <VolumeX className="h-4 w-4 text-foreground/40" />}
        </Button>

        {/* Clock */}
        <div className="text-xs font-mono font-semibold text-foreground/70 hidden 2xl:block border-l pl-3 border-border shrink-0">
          {time.toLocaleTimeString([], { hour12: false })}
        </div>

        {/* Direct Theme Switcher Button (Light Mode / Dark Mode) */}
        <Button
          variant="outline"
          size="sm"
          onClick={toggleTheme}
          className="flex items-center gap-1.5 h-9 px-2.5 sm:px-3 font-semibold text-xs border-border bg-background hover:bg-muted text-foreground cursor-pointer shadow-xs shrink-0"
          title={isDark ? "Click to switch to Light Mode" : "Click to switch to Dark Mode"}
        >
          {isDark ? (
            <>
              <Sun className="h-4 w-4 text-amber-500" />
              <span className="hidden sm:inline">Light Mode</span>
            </>
          ) : (
            <>
              <Moon className="h-4 w-4 text-slate-700" />
              <span className="hidden sm:inline">Dark Mode</span>
            </>
          )}
        </Button>

        {/* Alerts Bell */}
        <Link to="/alerts">
          <Button variant="ghost" size="icon" className="relative text-foreground/70 hover:text-foreground" title="Alerts">
            <Bell className="w-5 h-5" />
            <span className="absolute top-2 right-2 w-2 h-2 bg-rose-500 rounded-full border border-background"></span>
          </Button>
        </Link>

        {/* Settings */}
        <Link to="/settings">
          <Button variant="ghost" size="icon" className="text-foreground/70 hover:text-foreground" title="Settings">
            <Settings className="w-5 h-5" />
          </Button>
        </Link>
      </div>

      {/* Cloudflare Tunnel Modal with QR Code */}
      <Dialog open={isTunnelModalOpen} onOpenChange={setIsTunnelModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold text-base">
              <Globe className="h-5 w-5 text-primary" /> Cloudflare Global Public Tunnel
            </DialogTitle>
            <DialogDescription className="text-xs text-foreground/70 font-medium">
              Zero-configuration public HTTPS tunneling (trycloudflare.com). Enables remote phone cameras to stream securely over cellular 5G anywhere in the world.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border border-border">
              <div>
                <span className="text-xs text-foreground/70 font-medium">Tunnel Status:</span>
                <p className="font-bold text-sm text-foreground flex items-center gap-1.5">
                  <span className={`w-2.5 h-2.5 rounded-full ${tunnelStatus.status === 'ONLINE' ? 'bg-emerald-500' : 'bg-zinc-400'}`} />
                  {tunnelStatus.status}
                </p>
              </div>
              <Button
                size="sm"
                variant={tunnelStatus.status === 'ONLINE' ? 'destructive' : 'default'}
                disabled={isTogglingTunnel}
                onClick={handleToggleTunnel}
                className="gap-2 font-semibold text-xs"
              >
                {isTogglingTunnel ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Power className="h-3.5 w-3.5" />}
                {tunnelStatus.status === 'ONLINE' ? 'Stop Tunnel' : 'Start Public Tunnel'}
              </Button>
            </div>

            {tunnelStatus.status === 'ONLINE' && tunnelStatus.public_url && (
              <div className="space-y-4">
                <div className="p-3 rounded-lg bg-primary/10 border border-primary/30 flex items-center justify-between gap-2">
                  <span className="text-xs font-mono font-bold text-primary truncate max-w-[280px]">
                    {tunnelStatus.public_url}
                  </span>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-primary" onClick={handleCopyUrl} title="Copy URL">
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                {/* QR Code for Mobile Phones */}
                <div className="flex flex-col items-center justify-center p-4 bg-white dark:bg-zinc-950 rounded-xl border shadow-inner">
                  <QRCodeSVG
                    value={tunnelStatus.public_url}
                    size={180}
                    level="M"
                    includeMargin={true}
                  />
                  <p className="text-[11px] text-zinc-600 dark:text-zinc-400 font-medium mt-2 text-center">
                    Scan with any phone camera to open live mobile streamer on cellular 5G.
                  </p>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Global Spotlight Command Palette */}
      <CommandPalette 
        isOpen={isCmdOpen} 
        setIsOpen={setIsCmdOpen} 
        isDark={isDark} 
        toggleTheme={toggleTheme} 
        onOpenCopilot={onOpenCopilot} 
      />
    </header>
  );
}
