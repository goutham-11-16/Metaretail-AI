import React, { useEffect, useState, useRef } from 'react';
import { X, Settings, Maximize2, Activity, BoxSelect, AlertTriangle, Trash2, Play, Square, ExternalLink, Sparkles, Hand, UserCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { EventStream } from '../widgets/EventStream';
import { sharedWebcamStreamer } from '../../lib/webcamStreamer';
import { HumanMotionOverlay } from './HumanMotionOverlay';

export function CameraFullView({ cameraId, open, onClose }) {
  const [camera, setCamera] = useState(null);
  const [showAI, setShowAI] = useState(true);
  const [showHumanMotion, setShowHumanMotion] = useState(true);
  const [humanTelemetry, setHumanTelemetry] = useState(null);
  const [activeTab, setActiveTab] = useState('detections');
  const [fps, setFps] = useState(0);
  const [loading, setLoading] = useState(true);
  const imgRef = useRef(null);
  
  // Periodic camera status polling
  useEffect(() => {
    if (!open || !cameraId) return;

    let active = true;
    const fetchCamera = () => {
      fetch(`/api/cameras/${cameraId}`)
        .then(res => res.json())
        .then(data => {
          if (active) {
            setCamera(data);
            setLoading(false);
          }
        })
        .catch(err => {
          if (active) {
            setCamera({ id: cameraId, name: `Camera ${cameraId}`, status: 'ONLINE', zone_name: 'Store Zone' });
            setLoading(false);
          }
        });
    };

    fetchCamera();
    const timer = setInterval(fetchCamera, 3000);
    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [open, cameraId]);

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete camera "${camera?.name || cameraId}"?`)) return;
    try {
      const res = await fetch(`/api/cameras/${cameraId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Camera deleted');
        onClose();
      } else {
        throw new Error('Failed to delete camera');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200">
      <div className="bg-card w-full max-w-7xl h-[90vh] rounded-xl shadow-2xl border flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b bg-card">
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="text-xl font-bold tracking-tight">{camera?.name || 'Loading...'}</h2>
            {camera?.zone_name && <Badge variant="outline">{camera.zone_name}</Badge>}
            <Badge variant={camera?.status === 'OFFLINE' ? 'destructive' : 'default'} className="animate-pulse">
              {camera?.status || 'ONLINE'}
            </Badge>
            {camera?.status !== 'OFFLINE' && (
              <>
                <Badge 
                  variant="outline" 
                  className={cn(
                    "font-mono text-xs flex items-center gap-1",
                    (camera?.signal_bars ?? 5) >= 4 ? "text-emerald-400 border-emerald-500/30 bg-emerald-500/10" :
                    (camera?.signal_bars ?? 5) === 3 ? "text-amber-400 border-amber-500/30 bg-amber-500/10" :
                    "text-rose-400 border-rose-500/30 bg-rose-500/10"
                  )}
                >
                  📶 {camera?.signal_bars ?? 5}/5 {camera?.signal_quality || 'Ultra'}
                  {camera?.rtt_ms > 0 && <span className="opacity-75">({camera.rtt_ms}ms)</span>}
                </Badge>
                <Badge variant="secondary" className="font-mono text-xs">
                  {camera?.resolution || (camera?.width ? `${camera.width}x${camera.height}` : '720p HD')}
                </Badge>
                <Badge variant="outline" className="text-xs hidden sm:inline-flex">
                  {camera?.lens || 'Back Camera'}
                </Badge>
                <Badge variant="outline" className="text-xs hidden md:inline-flex">
                  {camera?.quality_preset || (camera?.quality ? `${Math.round(camera.quality * 100)}% Quality` : 'High Quality')}
                </Badge>
              </>
            )}
            <div className="flex items-center text-xs text-muted-foreground ml-1">
              <Activity className="w-3 h-3 mr-1 text-emerald-500" />
              {camera?.fps ? `${camera.fps} FPS` : 'Live Stream'}
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <Button 
              variant={showHumanMotion ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowHumanMotion(!showHumanMotion)}
              className={cn("hidden sm:flex gap-1.5", showHumanMotion ? "bg-emerald-600 hover:bg-emerald-500 text-white" : "")}
              title="Toggle vladmandic/human 17-point MoveNet pose and 3D hand tracking"
            >
              <Sparkles className="w-4 h-4 mr-1 text-emerald-300" />
              {showHumanMotion ? "Human Motion ON" : "Human Motion OFF"}
            </Button>
            <Button 
              variant={showAI ? "default" : "outline"} 
              size="sm" 
              onClick={() => setShowAI(!showAI)}
              className="hidden sm:flex"
            >
              <BoxSelect className="w-4 h-4 mr-2" />
              {showAI ? "AI Boxes ON" : "AI Boxes OFF"}
            </Button>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive"
              onClick={handleDelete}
              title="Delete Camera"
            >
              <Trash2 className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="icon" onClick={onClose} title="Close">
              <X className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
          
          {/* Main Video Area */}
          <div className="flex-1 bg-black relative flex items-center justify-center overflow-hidden">
            {loading ? (
              <div className="text-muted-foreground flex flex-col items-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                Connecting to stream...
              </div>
            ) : (
              <>
                <img 
                  ref={imgRef}
                  key={`${cameraId}-${showAI}`}
                  src={`/api/cameras/${cameraId}/feed?annotated=${showAI}`}
                  alt={camera?.name || 'Live Camera Feed'}
                  crossOrigin="anonymous"
                  className="w-full h-full object-contain select-none"
                />

                {/* Vladimir Mandic Human Motion & Skeleton Tracking Overlay */}
                <HumanMotionOverlay 
                  targetRef={imgRef}
                  enabled={showHumanMotion}
                  cameraId={cameraId}
                  onTelemetryUpdate={setHumanTelemetry}
                />

                {/* Video HUD Telemetry Overlay */}
                {camera?.status !== 'OFFLINE' && (
                  <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between bg-black/70 backdrop-blur-md px-3.5 py-2 rounded-lg text-white text-xs border border-white/10 pointer-events-none">
                    <div className="flex items-center gap-2.5 font-medium flex-wrap">
                      <span className="flex items-center gap-1.5 text-emerald-400">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        {camera?.lens || 'Back Camera'}
                      </span>
                      <span className="text-white/30 hidden sm:inline">|</span>
                      <span className="font-mono text-sky-400">
                        {camera?.resolution || (camera?.width ? `${camera.width}x${camera.height}` : '1280x720')}
                      </span>
                      <span className="text-white/30 hidden sm:inline">|</span>
                      <span className="text-emerald-300 flex items-center gap-1">
                        📶 {camera?.signal_bars ?? 5}/5 ({camera?.signal_quality || 'Ultra'})
                        {camera?.rtt_ms > 0 && <span className="text-[10px] text-emerald-400/80">• {camera.rtt_ms}ms</span>}
                      </span>
                      <span className="text-white/30 hidden sm:inline">|</span>
                      <span className="text-amber-400 hidden sm:inline">
                        {camera?.quality_preset || 'High Quality'}
                      </span>
                    </div>
                    <div className="font-mono text-emerald-400 font-semibold ml-2 flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                      ⚡ {camera?.fps || 30} FPS
                    </div>
                  </div>
                )}
              </>
            )}
            
            {camera?.status === 'OFFLINE' && !loading && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/85 text-white p-6 text-center z-20">
                <AlertTriangle className="w-12 h-12 text-destructive mb-3" />
                <p className="text-lg font-semibold">Camera is Offline</p>
                <p className="text-sm text-slate-300 mb-4 max-w-md">
                  {camera?.camera_type === 'PHONE'
                    ? 'Waiting for mobile phone to connect and start streaming.'
                    : 'Webcam feed is currently inactive in this session.'}
                </p>

                {camera?.camera_type === 'PHONE' ? (
                  <Button 
                    onClick={() => {
                      const url = `${window.location.origin}/phone-camera/${cameraId}`;
                      window.open(url, '_blank');
                    }}
                    className="gap-2 bg-sky-600 hover:bg-sky-500 text-white font-medium"
                  >
                    <ExternalLink className="w-4 h-4" />
                    Open Phone Camera Link
                  </Button>
                ) : (
                  <Button 
                    onClick={async () => {
                      try {
                        await sharedWebcamStreamer.startStream(cameraId);
                        toast.success('Webcam stream started!');
                      } catch (err) {
                        toast.error(err.message || 'Failed to access webcam');
                      }
                    }}
                    className="gap-2 font-medium"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Start Webcam Stream
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Side Panel */}
          <div className="w-full lg:w-80 border-l bg-card flex flex-col">
            <div className="p-3 border-b flex items-center justify-between gap-1 bg-muted/30">
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setActiveTab('detections')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all",
                    activeTab === 'detections' 
                      ? "bg-background text-foreground shadow-sm" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Events
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('human_motion')}
                  className={cn(
                    "px-3 py-1.5 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5",
                    activeTab === 'human_motion' 
                      ? "bg-emerald-500/20 text-emerald-300 shadow-sm border border-emerald-500/30" 
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <Sparkles className="w-3 h-3 text-emerald-400" />
                  Human Motion
                </button>
              </div>
              <Badge variant={activeTab === 'human_motion' ? "outline" : "secondary"} className="text-[10px]">
                {activeTab === 'human_motion' ? 'WebGL GPU' : 'Live'}
              </Badge>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {activeTab === 'detections' ? (
                <EventStream limit={10} showCamera={false} />
              ) : (
                <div className="space-y-4 text-xs">
                  {/* Status Banner */}
                  <div className="p-3 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-emerald-300">
                    <div className="flex items-center justify-between font-semibold">
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                        MoveNet & Hand AI Active
                      </span>
                      <span className="font-mono text-emerald-400">{humanTelemetry?.fps || 0} FPS</span>
                    </div>
                    <p className="text-[11px] text-emerald-400/80 mt-1">
                      Real-time 17-point pose estimation and 21-point hand tracking running on client WebGL.
                    </p>
                  </div>

                  {/* Body Pose Card */}
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <UserCheck className="w-4 h-4 text-emerald-400" />
                        Human Skeletons
                      </span>
                      <Badge variant="secondary" className="font-mono">
                        {humanTelemetry?.bodies || 0} Detected
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-muted-foreground text-[11px]">
                      <div className="bg-background/50 p-2 rounded border">
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Arm Reach</span>
                        <span className={cn("font-medium", humanTelemetry?.reach ? "text-amber-400" : "text-slate-400")}>
                          {humanTelemetry?.reach ? "Reaching Shelf ◄" : "Resting"}
                        </span>
                      </div>
                      <div className="bg-background/50 p-2 rounded border">
                        <span className="block text-[10px] uppercase font-semibold text-muted-foreground">Posture</span>
                        <span className={cn("font-medium", humanTelemetry?.bend ? "text-cyan-400" : "text-slate-400")}>
                          {humanTelemetry?.bend ? "Bending / Inspecting" : "Upright"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Hand Tracking & Gestures */}
                  <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                    <div className="flex items-center justify-between font-medium text-foreground">
                      <span className="flex items-center gap-1.5">
                        <Hand className="w-4 h-4 text-cyan-400" />
                        Hand Tracking & Gestures
                      </span>
                      <Badge variant="secondary" className="font-mono">
                        {humanTelemetry?.hands || 0} Hands (21 3D pts)
                      </Badge>
                    </div>
                    {humanTelemetry?.gestureList && humanTelemetry.gestureList.length > 0 ? (
                      <div className="space-y-1">
                        {humanTelemetry.gestureList.map((g, idx) => (
                          <div key={idx} className="flex items-center justify-between bg-cyan-950/30 border border-cyan-500/20 px-2 py-1.5 rounded text-cyan-300">
                            <span className="font-semibold">{g.gesture}</span>
                            <span className="text-[10px] font-mono text-cyan-400">{Math.round(g.score * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] text-muted-foreground italic">
                        {humanTelemetry?.hands > 0 ? "Analyzing hand gestures..." : "No hands in active frame"}
                      </p>
                    )}
                  </div>

                  {/* Emotion & Expression */}
                  {humanTelemetry?.emotions && humanTelemetry.emotions.length > 0 && (
                    <div className="p-3 rounded-lg border bg-muted/20 space-y-2">
                      <div className="font-medium text-foreground">Customer Expression</div>
                      <div className="space-y-1.5">
                        {humanTelemetry.emotions.slice(0, 3).map((e, idx) => (
                          <div key={idx} className="flex items-center justify-between text-[11px]">
                            <span className="capitalize text-muted-foreground">{e.emotion}</span>
                            <div className="flex items-center gap-2 w-32">
                              <div className="h-1.5 flex-1 bg-muted rounded-full overflow-hidden">
                                <div 
                                  className="h-full bg-emerald-400 rounded-full" 
                                  style={{ width: `${Math.round(e.score * 100)}%` }} 
                                />
                              </div>
                              <span className="font-mono w-8 text-right text-[10px]">{Math.round(e.score * 100)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Library Attribution */}
                  <div className="pt-2 text-[10px] text-muted-foreground/80 flex items-center justify-between border-t">
                    <span>Engine: @vladmandic/human v3.3</span>
                    <span className="text-emerald-400">WebGL Shader</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
