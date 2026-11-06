import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Map, Camera, Users, Flame, Eye, RefreshCw, Layers, ShieldCheck, Sparkles, Navigation, Box, Play, Square, Compass } from 'lucide-react';
import { toast } from 'sonner';

export function FloorplanPage() {
  const [topology, setTopology] = useState(null);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('3d'); // '3d' | 'blueprint' | 'heatmap' | 'coverage' | 'trajectories'
  const [selectedZone, setSelectedZone] = useState(null);
  const [simStatus, setSimStatus] = useState({ is_running: false, active_simulated_shoppers: 0 });
  const [isTogglingSim, setIsTogglingSim] = useState(false);

  const fetchTopology = async () => {
    try {
      const res = await fetch('/api/store/topology');
      if (res.ok) {
        const data = await res.json();
        setTopology(data);
        if (!selectedZone && data.zones && data.zones.length > 0) {
          setSelectedZone(data.zones[1]); // Default to Aisle 1
        }
      }
    } catch (err) {
      console.error('Error loading store topology:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchSimStatus = async () => {
    try {
      const res = await fetch('/api/simulation/status');
      if (res.ok) {
        setSimStatus(await res.json());
      }
    } catch (e) {}
  };

  useEffect(() => {
    fetchTopology();
    fetchSimStatus();
    const interval = setInterval(() => {
      fetchTopology();
      fetchSimStatus();
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleToggleSim = async () => {
    setIsTogglingSim(true);
    try {
      const res = await fetch('/api/simulation/toggle', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setSimStatus(data.simulation);
        if (data.simulation.is_running) {
          toast.success('Autonomous Multi-Shopper Live Simulation Started');
        } else {
          toast.info('Autonomous Simulation Paused');
        }
      }
    } catch (e) {
      toast.error('Failed to toggle simulation');
    } finally {
      setIsTogglingSim(false);
    }
  };

  const getHeatColor = (heatIndex) => {
    if (heatIndex >= 0.8) return 'rgba(239, 68, 68, 0.55)'; // Hot Red
    if (heatIndex >= 0.6) return 'rgba(245, 158, 11, 0.45)'; // Amber
    if (heatIndex >= 0.4) return 'rgba(59, 130, 246, 0.35)'; // Blue
    return 'rgba(16, 185, 129, 0.25)'; // Cool Emerald
  };

  // Isometric coordinate transformation for 3D Digital Twin View
  const toIso = (x, y, z = 0) => {
    const cx = 500;
    const cy = 250;
    const scale = 0.68;
    const dx = (x - cx) * scale;
    const dy = (y - cy) * scale;
    // Standard 30-deg isometric projection
    const isoX = 500 + (dx - dy) * 0.96;
    const isoY = 270 + (dx + dy) * 0.48 - z * 0.9;
    return { x: Math.round(isoX), y: Math.round(isoY) };
  };

  const getZoneAccentColor = (category, isSelected) => {
    if (isSelected) return '#3b82f6'; // Bright Blue
    switch (category) {
      case 'Beverages': return '#0284c7';
      case 'Snacks': return '#f59e0b';
      case 'Bakery': return '#10b981';
      case 'Electronics': return '#8b5cf6';
      case 'Checkout': return '#ec4899';
      case 'Access': return '#64748b';
      default: return '#3b82f6';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header & Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Interactive Store Blueprint & Spatial Heatmap</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> 2D Vision Grid
            </Badge>
          </div>
          <p className="text-sm text-foreground/80 font-medium">
            Vector topology of store aisles, camera field-of-view scanning cones, and real-time shopper dwell density.
          </p>
        </div>

        {/* View Mode Switcher & Sim Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/50 text-xs font-semibold">
            <button
              onClick={() => setViewMode('3d')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === '3d' ? 'bg-primary text-primary-foreground shadow-sm font-bold' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <Box className="h-3.5 w-3.5" /> 3D Digital Twin
            </button>
            <button
              onClick={() => setViewMode('blueprint')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'blueprint' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <Layers className="h-3.5 w-3.5" /> 2D Blueprint
            </button>
            <button
              onClick={() => setViewMode('heatmap')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'heatmap' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <Flame className="h-3.5 w-3.5 text-amber-500" /> Dwell Heatmap
            </button>
            <button
              onClick={() => setViewMode('coverage')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'coverage' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <Eye className="h-3.5 w-3.5 text-primary" /> Camera FOV
            </button>
            <button
              onClick={() => setViewMode('trajectories')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                viewMode === 'trajectories' ? 'bg-background shadow-sm text-cyan-600 dark:text-cyan-400 font-bold' : 'text-foreground/70 hover:text-foreground'
              }`}
            >
              <Navigation className="h-3.5 w-3.5 text-cyan-500" /> Shopper Paths
            </button>
          </div>

          <Button
            variant={simStatus.is_running ? "default" : "outline"}
            size="sm"
            onClick={handleToggleSim}
            disabled={isTogglingSim}
            className={`gap-1.5 font-semibold text-xs ${simStatus.is_running ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : ''}`}
          >
            {simStatus.is_running ? <Square className="h-3.5 w-3.5 fill-current" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span>{simStatus.is_running ? `Sim Active (${simStatus.active_simulated_shoppers || 0})` : 'Start Simulator'}</span>
          </Button>

          <Button variant="outline" size="sm" onClick={fetchTopology} className="gap-2 font-medium">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Top Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground/70 font-medium">Live Shoppers on Map</p>
              <h3 className="text-xl font-bold text-foreground">
                {topology ? topology.total_shoppers_in_store : 0}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <Camera className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground/70 font-medium">Mounted Cameras</p>
              <h3 className="text-xl font-bold text-foreground">
                {topology ? topology.cameras.length : 0}
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <Flame className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground/70 font-medium">Top Traffic Hotspot</p>
              <h3 className="text-sm font-bold text-foreground truncate max-w-[140px]">
                Aisle 2 (Snacks)
              </h3>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-foreground/70 font-medium">Planogram Compliance</p>
              <h3 className="text-xl font-bold text-foreground">94.6%</h3>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Vector SVG Canvas */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-3">
          <Card className="border-border overflow-hidden bg-card/80 backdrop-blur">
            <div className="p-3 border-b border-border/40 flex items-center justify-between text-xs text-foreground/70 font-medium">
              <div className="flex items-center gap-2">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                <span>
                  {viewMode === '3d' 
                    ? '3D Digital Twin Simulation (Extruded Racks & Volumetric Vision Sensors)' 
                    : 'Warehouse Floorplan Grid (1000m × 500m scale)'}
                </span>
              </div>
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-primary" /> Active Shopper</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500" /> Camera FOV</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500" /> High Dwell</span>
              </div>
            </div>

            <div className="p-4 bg-muted/20 relative flex items-center justify-center overflow-x-auto">
              {viewMode === '3d' ? (
                /* --- 3D ISOMETRIC DIGITAL TWIN SVG --- */
                <svg
                  viewBox="0 0 1000 580"
                  className="w-full h-auto max-w-4xl border border-border/60 rounded-xl bg-slate-950 shadow-2xl"
                >
                  <defs>
                    <linearGradient id="isoFloorGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#0b0f19" />
                      <stop offset="100%" stopColor="#020617" />
                    </linearGradient>
                    <radialGradient id="camBeamGlow" cx="50%" cy="50%" r="50%">
                      <stop offset="0%" stopColor="rgba(16, 185, 129, 0.4)" />
                      <stop offset="100%" stopColor="rgba(16, 185, 129, 0.02)" />
                    </radialGradient>
                    <filter id="glow3d" x="-20%" y="-20%" width="140%" height="140%">
                      <feGaussianBlur stdDeviation="4" result="blur" />
                      <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                  </defs>

                  {/* 3D Isometric Floor Ground Plane */}
                  {(() => {
                    const c1 = toIso(15, 15, 0);
                    const c2 = toIso(985, 15, 0);
                    const c3 = toIso(985, 485, 0);
                    const c4 = toIso(15, 485, 0);
                    return (
                      <g>
                        <polygon
                          points={`${c1.x},${c1.y} ${c2.x},${c2.y} ${c3.x},${c3.y} ${c4.x},${c4.y}`}
                          fill="url(#isoFloorGrad)"
                          stroke="#1e293b"
                          strokeWidth="2"
                        />
                        {/* Floor Guide Isometric Grid Lines */}
                        {[150, 300, 450, 600, 750, 900].map((gx) => {
                          const pA = toIso(gx, 15, 0);
                          const pB = toIso(gx, 485, 0);
                          return (
                            <line
                              key={`glx-${gx}`}
                              x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y}
                              stroke="rgba(56, 189, 248, 0.06)"
                              strokeWidth="1"
                            />
                          );
                        })}
                        {[100, 200, 300, 400].map((gy) => {
                          const pA = toIso(15, gy, 0);
                          const pB = toIso(985, gy, 0);
                          return (
                            <line
                              key={`gly-${gy}`}
                              x1={pA.x} y1={pA.y} x2={pB.x} y2={pB.y}
                              stroke="rgba(56, 189, 248, 0.06)"
                              strokeWidth="1"
                            />
                          );
                        })}
                      </g>
                    );
                  })()}

                  {/* Extruded 3D Zone Racks */}
                  {topology?.zones?.map((zone) => {
                    const isSelected = selectedZone?.zone_id === zone.zone_id;
                    const accent = getZoneAccentColor(zone.category, isSelected);
                    const isGate = zone.category === 'Access' || zone.category === 'Checkout';
                    const rackHeight = isGate ? 18 : 46;

                    // Ground corners
                    const p0 = toIso(zone.x, zone.y, 0);
                    const p1 = toIso(zone.x + zone.width, zone.y, 0);
                    const p2 = toIso(zone.x + zone.width, zone.y + zone.height, 0);
                    const p3 = toIso(zone.x, zone.y + zone.height, 0);

                    // Top elevated corners
                    const t0 = toIso(zone.x, zone.y, rackHeight);
                    const t1 = toIso(zone.x + zone.width, zone.y, rackHeight);
                    const t2 = toIso(zone.x + zone.width, zone.y + zone.height, rackHeight);
                    const t3 = toIso(zone.x, zone.y + zone.height, rackHeight);

                    return (
                      <g 
                        key={`iso-zone-${zone.zone_id}`} 
                        className="cursor-pointer transition-all group"
                        onClick={() => setSelectedZone(zone)}
                      >
                        {/* Rack Ground Shadow */}
                        <polygon
                          points={`${p0.x + 6},${p0.y + 4} ${p1.x + 6},${p1.y + 4} ${p2.x + 6},${p2.y + 4} ${p3.x + 6},${p3.y + 4}`}
                          fill="rgba(0, 0, 0, 0.6)"
                          className="blur-xs"
                        />

                        {/* Front Face (T3, T2, P2, P3) */}
                        <polygon
                          points={`${t3.x},${t3.y} ${t2.x},${t2.y} ${p2.x},${p2.y} ${p3.x},${p3.y}`}
                          fill={isSelected ? '#1e3a8a' : '#0f172a'}
                          stroke={accent}
                          strokeWidth="1.2"
                        />
                        {/* Front Face Shelving Lines */}
                        {!isGate && [0.33, 0.66].map((frac, sIdx) => {
                          const fH = rackHeight * frac;
                          const sA = toIso(zone.x, zone.y + zone.height, fH);
                          const sB = toIso(zone.x + zone.width, zone.y + zone.height, fH);
                          return (
                            <line
                              key={sIdx}
                              x1={sA.x} y1={sA.y} x2={sB.x} y2={sB.y}
                              stroke={accent}
                              strokeWidth="0.8"
                              strokeDasharray="3 2"
                              opacity="0.6"
                            />
                          );
                        })}

                        {/* Side Face (T2, T1, P1, P2) */}
                        <polygon
                          points={`${t2.x},${t2.y} ${t1.x},${t1.y} ${p1.x},${p1.y} ${p2.x},${p2.y}`}
                          fill={isSelected ? '#172554' : '#090d16'}
                          stroke={accent}
                          strokeWidth="1.2"
                          opacity="0.9"
                        />

                        {/* Top Face (T0, T1, T2, T3) */}
                        <polygon
                          points={`${t0.x},${t0.y} ${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y}`}
                          fill={isSelected ? 'rgba(59, 130, 246, 0.45)' : 'rgba(30, 41, 59, 0.85)'}
                          stroke={isSelected ? '#60a5fa' : accent}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          className="group-hover:fill-opacity-90"
                        />

                        {/* Top Face Label */}
                        <text
                          x={t0.x + 8}
                          y={t0.y + 16}
                          fill="#ffffff"
                          className="text-[11px] font-bold select-none drop-shadow"
                        >
                          {zone.name}
                        </text>
                        <text
                          x={t0.x + 8}
                          y={t0.y + 28}
                          fill={accent}
                          className="text-[9px] font-mono font-bold select-none drop-shadow"
                        >
                          {zone.code} · {zone.total_stock} Units
                        </text>
                      </g>
                    );
                  })}

                  {/* 3D Volumetric Camera Masts */}
                  {topology?.cameras?.map((cam) => {
                    const base = toIso(cam.x, cam.y, 0);
                    const top = toIso(cam.x, cam.y, 70);
                    const coneLeft = toIso(cam.x - (cam.direction_degrees > 90 ? 110 : -30), cam.y + cam.range, 0);
                    const coneRight = toIso(cam.x + (cam.direction_degrees > 90 ? -20 : 130), cam.y + cam.range, 0);

                    return (
                      <g key={`iso-cam-${cam.camera_id}`}>
                        {/* Volumetric Scanning Cone Beam */}
                        <polygon
                          points={`${top.x},${top.y} ${coneLeft.x},${coneLeft.y} ${coneRight.x},${coneRight.y}`}
                          fill="url(#camBeamGlow)"
                          stroke="rgba(16, 185, 129, 0.4)"
                          strokeWidth="1"
                          strokeDasharray="3 3"
                          className="pointer-events-none"
                        />

                        {/* Camera Ground Mount */}
                        <circle cx={base.x} cy={base.y} r="5" fill="#0f172a" stroke="#38bdf8" strokeWidth="1.5" />

                        {/* Vertical 3D Mounting Pole */}
                        <line x1={base.x} y1={base.y} x2={top.x} y2={top.y} stroke="#64748b" strokeWidth="2.5" strokeLinecap="round" />

                        {/* Camera Sensor Head */}
                        <circle cx={top.x} cy={top.y} r="8" fill="#020617" stroke="#10b981" strokeWidth="2" filter="url(#glow3d)" />
                        <circle cx={top.x} cy={top.y} r="3" fill="#22c55e" className="animate-pulse" />

                        {/* Camera Name Tag */}
                        <rect x={top.x + 10} y={top.y - 10} width="58" height="15" rx="3" fill="#0f172a" stroke="#10b981" strokeWidth="0.8" />
                        <text x={top.x + 14} y={top.y + 1} fill="#10b981" className="text-[9px] font-mono font-bold select-none">
                          {cam.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* 3D Animated Shoppers & Radar Beacons */}
                  {topology?.customers?.map((cust) => {
                    const groundPos = toIso(cust.x, cust.y, 0);
                    const floatPos = toIso(cust.x, cust.y, 28);

                    return (
                      <g key={`iso-cust-${cust.track_id}`} className="cursor-pointer">
                        {/* Ground Elliptical Shadow */}
                        <ellipse cx={groundPos.x} cy={groundPos.y} rx="12" ry="6" fill="rgba(0, 0, 0, 0.7)" />

                        {/* Ground Pulsing Radar Ring */}
                        <ellipse
                          cx={groundPos.x}
                          cy={groundPos.y}
                          rx="24"
                          ry="12"
                          fill="none"
                          stroke="#38bdf8"
                          strokeWidth="1.5"
                          opacity="0.8"
                          className="animate-ping"
                        />

                        {/* Vertical Tether Link to Floating Avatar */}
                        <line
                          x1={groundPos.x}
                          y1={groundPos.y}
                          x2={floatPos.x}
                          y2={floatPos.y}
                          stroke="#38bdf8"
                          strokeWidth="1.2"
                          strokeDasharray="2 2"
                        />

                        {/* 3D Floating Avatar Orb */}
                        <circle
                          cx={floatPos.x}
                          cy={floatPos.y}
                          r="10"
                          fill="#2563eb"
                          stroke="#ffffff"
                          strokeWidth="2.5"
                          filter="url(#glow3d)"
                        />
                        <circle cx={floatPos.x} cy={floatPos.y} r="4" fill="#93c5fd" />

                        {/* Shopper Track Badge */}
                        <rect
                          x={floatPos.x - 26}
                          y={floatPos.y - 22}
                          width="52"
                          height="15"
                          rx="4"
                          fill="#020617"
                          stroke="#38bdf8"
                          strokeWidth="1"
                        />
                        <text
                          x={floatPos.x}
                          y={floatPos.y - 11}
                          fill="#ffffff"
                          textAnchor="middle"
                          className="text-[9px] font-mono font-bold select-none"
                        >
                          #{cust.track_id} ({Math.round(cust.dwell_seconds)}s)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                /* --- 2D BLUEPRINT & HEATMAP SVG --- */
                <svg
                  viewBox="0 0 1000 500"
                  className="w-full h-auto max-w-4xl border border-border/60 rounded-xl bg-background shadow-inner"
                >
                  {/* Blueprint Grid Lines */}
                  <defs>
                    <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-border/40" />
                    </pattern>
                  </defs>
                  <rect width="1000" height="500" fill="url(#grid)" />

                  {/* Outer Store Perimeter */}
                  <rect x="15" y="15" width="970" height="470" rx="12" fill="none" stroke="currentColor" strokeWidth="2.5" className="text-foreground/30" />

                  {/* Store Zones */}
                  {topology?.zones?.map((zone) => {
                    const isSelected = selectedZone?.zone_id === zone.zone_id;
                    const heatFill = viewMode === 'heatmap' ? getHeatColor(zone.dwell_heat_index) : (isSelected ? 'rgba(59, 130, 246, 0.12)' : 'rgba(255, 255, 255, 0.03)');

                    return (
                      <g key={zone.zone_id} className="cursor-pointer transition-all" onClick={() => setSelectedZone(zone)}>
                        <rect
                          x={zone.x}
                          y={zone.y}
                          width={zone.width}
                          height={zone.height}
                          rx="8"
                          fill={heatFill}
                          stroke={isSelected ? '#3b82f6' : (viewMode === 'heatmap' ? 'rgba(245, 158, 11, 0.6)' : 'currentColor')}
                          strokeWidth={isSelected ? 2.5 : 1.5}
                          strokeDasharray={zone.category === 'Checkout' || zone.category === 'Access' ? '4 4' : 'none'}
                          className={isSelected ? '' : 'text-border hover:stroke-primary/80'}
                        />
                        <text
                          x={zone.x + 12}
                          y={zone.y + 24}
                          fill="currentColor"
                          className="text-xs font-bold text-foreground select-none"
                        >
                          {zone.name}
                        </text>
                        <rect
                          x={zone.x + 12}
                          y={zone.y + 32}
                          width="64"
                          height="18"
                          rx="4"
                          fill="currentColor"
                          className="text-muted/80"
                        />
                        <text
                          x={zone.x + 16}
                          y={zone.y + 44}
                          fill="currentColor"
                          className="text-[10px] font-mono font-semibold text-foreground/80 select-none"
                        >
                          {zone.code}
                        </text>

                        {viewMode === 'heatmap' && (
                          <text
                            x={zone.x + zone.width - 65}
                            y={zone.y + 24}
                            fill="#ef4444"
                            className="text-[11px] font-bold select-none"
                          >
                            🔥 {Math.round(zone.dwell_heat_index * 100)}% Heat
                          </text>
                        )}

                        <text
                          x={zone.x + 12}
                          y={zone.y + zone.height - 14}
                          fill="currentColor"
                          className="text-[10px] font-medium text-foreground/70 select-none"
                        >
                          Stock: {zone.total_stock} units · {zone.products_count} SKUs
                        </text>
                      </g>
                    );
                  })}

                  {/* Camera Nodes */}
                  {topology?.cameras?.map((cam) => {
                    const isCovered = viewMode === 'coverage';
                    return (
                      <g key={cam.camera_id}>
                        <path
                          d={`M ${cam.x} ${cam.y} L ${cam.x + (cam.direction_degrees > 90 ? -120 : 120)} ${cam.y + cam.range} L ${cam.x + (cam.direction_degrees > 90 ? -30 : 200)} ${cam.y + cam.range} Z`}
                          fill={isCovered ? 'rgba(16, 185, 129, 0.25)' : 'rgba(59, 130, 246, 0.12)'}
                          stroke={isCovered ? 'rgba(16, 185, 129, 0.6)' : 'rgba(59, 130, 246, 0.3)'}
                          strokeWidth="1"
                          className="pointer-events-none"
                        />
                        <circle cx={cam.x} cy={cam.y} r="9" fill="#0f172a" stroke="#38bdf8" strokeWidth="2" />
                        <circle cx={cam.x} cy={cam.y} r="3" fill="#22c55e" className="animate-pulse" />
                        <text x={cam.x + 12} y={cam.y + 4} fill="currentColor" className="text-[10px] font-bold text-foreground font-mono select-none">
                          {cam.name}
                        </text>
                      </g>
                    );
                  })}

                  {/* 2D Shoppers & Trajectories */}
                  {topology?.customers?.map((cust) => {
                    const trajPoints = cust.trajectory && cust.trajectory.length > 0
                      ? cust.trajectory.map(p => `${p.x},${p.y}`).join(' ')
                      : null;

                    return (
                      <g key={cust.track_id} className="cursor-pointer">
                        {trajPoints && (viewMode === 'trajectories' || viewMode === 'blueprint') && (
                          <>
                            <polyline
                              points={trajPoints}
                              fill="none"
                              stroke="#06b6d4"
                              strokeWidth={viewMode === 'trajectories' ? "3" : "1.5"}
                              strokeDasharray="4 3"
                              strokeLinecap="round"
                              opacity={viewMode === 'trajectories' ? "0.9" : "0.35"}
                            />
                            {cust.trajectory.map((pt, pIdx) => (
                              <circle
                                key={pIdx}
                                cx={pt.x}
                                cy={pt.y}
                                r={pIdx === 0 ? "4" : "2.5"}
                                fill={pIdx === 0 ? "#10b981" : "#06b6d4"}
                                opacity={viewMode === 'trajectories' ? "0.8" : "0.4"}
                              />
                            ))}
                          </>
                        )}
                        <circle cx={cust.x} cy={cust.y} r="16" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.6" className="animate-ping" />
                        <circle cx={cust.x} cy={cust.y} r="8" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                        <rect x={cust.x - 22} y={cust.y - 24} width="44" height="15" rx="3" fill="#0f172a" stroke="#38bdf8" strokeWidth="0.5" />
                        <text x={cust.x} y={cust.y - 13} fill="#ffffff" textAnchor="middle" className="text-[9px] font-bold font-mono select-none">
                          #{cust.track_id} ({Math.round(cust.dwell_seconds)}s)
                        </text>
                      </g>
                    );
                  })}
                </svg>
              )}
            </div>
          </Card>
        </div>

        {/* Zone Detail Inspector Sidebar */}
        <div className="space-y-4">
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border/40">
              <CardTitle className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Navigation className="h-4 w-4 text-primary" /> Zone Inspector
              </CardTitle>
              <CardDescription className="text-xs text-foreground/70 font-medium">
                Click any zone on the blueprint to inspect real-time metrics
              </CardDescription>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {selectedZone ? (
                <>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-base text-foreground">{selectedZone.name}</h3>
                      <Badge variant="outline" className="font-mono text-xs font-semibold">{selectedZone.code}</Badge>
                    </div>
                    <p className="text-xs text-foreground/70 font-medium">Category: {selectedZone.category}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-foreground/70 font-medium block">Shelf Inventory</span>
                      <span className="font-bold text-foreground text-sm">{selectedZone.total_stock} Units</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-foreground/70 font-medium block">Product SKUs</span>
                      <span className="font-bold text-foreground text-sm">{selectedZone.products_count} Items</span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-foreground/70 font-medium block">Traffic Density</span>
                      <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                        {Math.round(selectedZone.dwell_heat_index * 100)}% Heat
                      </span>
                    </div>
                    <div className="p-2.5 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-foreground/70 font-medium block">Activity Level</span>
                      <Badge className="text-[10px] mt-0.5 font-semibold" variant={selectedZone.activity_level === 'HIGH' ? 'destructive' : 'secondary'}>
                        {selectedZone.activity_level}
                      </Badge>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <h4 className="text-xs font-semibold text-foreground mb-2">Assigned Vision Coverage</h4>
                    <p className="text-xs text-foreground/70 font-medium">
                      Camera feeds mapped to this zone continuously feed ByteTrack re-identification and shelf removal state machines.
                    </p>
                  </div>
                </>
              ) : (
                <div className="text-center py-8 text-xs text-foreground/70 font-medium">
                  Select a zone on the blueprint to view telemetry.
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
