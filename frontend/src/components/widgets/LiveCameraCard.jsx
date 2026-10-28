import React, { useState, useRef } from 'react';
import { Card } from '../ui/card';
import { StatusBadge } from './StatusBadge';
import { cn } from '../../lib/utils';
import { Camera, Trash2, Smartphone, QrCode, Play, Square, ExternalLink, Copy, Check, Eye, EyeOff, Sparkles } from 'lucide-react';
import { useWebcamStreamer } from '../../lib/webcamStreamer';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { HumanMotionOverlay } from '../cameras/HumanMotionOverlay';

export function LiveCameraCard(props) {
  const {
    camera,
    cameraId = camera?.id,
    name = camera?.name,
    zone = camera?.zone_name || camera?.zone,
    isLive = camera?.status === 'ONLINE' || camera?.status === 'LIVE',
    status = camera?.status,
    resolution = camera?.resolution,
    fps = camera?.fps,
    quality_preset = camera?.quality_preset,
    lens = camera?.lens,
    signal_bars = camera?.signal_bars ?? 5,
    signal_quality = camera?.signal_quality ?? 'Ultra',
    rtt_ms = camera?.rtt_ms ?? 0,
    className,
    onClick,
    onDelete
  } = props;

  const cameraType = (camera?.camera_type || camera?.type || 'LOCAL').toUpperCase();
  const { isStreaming, start, stop } = useWebcamStreamer(cameraId);

  const active = isLive || status === 'ONLINE' || status === 'LIVE' || isStreaming;
  const [hasError, setHasError] = useState(false);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showAi, setShowAi] = useState(true);
  const [showHumanMotion, setShowHumanMotion] = useState(false);
  const cardImgRef = useRef(null);

  React.useEffect(() => {
    setHasError(false);
  }, [active, cameraId]);

  const handleError = () => {
    setHasError(true);
    // Fast reconnect retry in 1.0s in case camera just started streaming
    setTimeout(() => {
      setHasError(false);
    }, 1000);
  };

  const handleStartWebcam = async (e) => {
    e.stopPropagation();
    try {
      await start();
      toast.success(`Webcam stream started for "${name}"`);
    } catch (err) {
      console.error('[LiveCameraCard] Failed to start webcam:', err);
      toast.error(err.message || 'Failed to start browser webcam. Check camera permissions.');
    }
  };

  const handleStopWebcam = (e) => {
    e.stopPropagation();
    stop();
    toast.info(`Webcam stream stopped for "${name}"`);
  };

  const phoneStreamUrl = typeof window !== 'undefined' ? `${window.location.origin}/phone-camera/${cameraId}` : '';

  const copyUrl = (e) => {
    e?.stopPropagation();
    if (!phoneStreamUrl) return;
    navigator.clipboard.writeText(phoneStreamUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Phone stream URL copied to clipboard');
  };

  return (
    <>
      <Card 
        className={cn("overflow-hidden group cursor-pointer hover:border-primary/50 transition-colors relative border bg-card", className)}
        onClick={onClick}
      >
        <div className="aspect-video bg-slate-950 flex items-center justify-center relative overflow-hidden">
          {active && cameraId && !hasError ? (
            <>
              <img 
                ref={cardImgRef}
                src={`/api/cameras/${cameraId}/feed?annotated=${showAi}`} 
                alt={name}
                crossOrigin="anonymous"
                onError={handleError}
                className="w-full h-full object-contain bg-slate-950"
              />
              <HumanMotionOverlay 
                targetRef={cardImgRef}
                enabled={showHumanMotion}
                cameraId={cameraId}
              />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center text-slate-500 gap-2 p-4 text-center">
              {cameraType === 'PHONE' ? (
                <>
                  <Smartphone className="w-8 h-8 text-sky-400/80" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    Phone Disconnected
                  </span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowPhoneModal(true);
                    }}
                    className="pointer-events-auto mt-1 px-3 py-1.5 rounded-md bg-sky-600 hover:bg-sky-500 text-white text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    Connect Phone
                  </button>
                </>
              ) : (
                <>
                  <Camera className="w-8 h-8 text-slate-400" />
                  <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
                    {active ? 'Connecting Feed...' : 'Webcam Offline'}
                  </span>
                  <button
                    type="button"
                    onClick={handleStartWebcam}
                    className="pointer-events-auto mt-1 px-3 py-1.5 rounded-md bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-semibold shadow-sm flex items-center gap-1.5 transition-all active:scale-95"
                  >
                    <Play className="w-3 h-3 fill-current" />
                    Stream My Webcam
                  </button>
                </>
              )}
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent pointer-events-none" />
          
          {/* Top Badges Overlay */}
          <div className="absolute top-2 left-2 right-2 flex items-center justify-between pointer-events-none">
            <div className="flex items-center gap-1.5 flex-wrap">
              {isStreaming && (
                <span className="text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded bg-emerald-500/90 text-white shadow-xs flex items-center gap-1 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                  WEB STREAMING
                </span>
              )}
              {active && resolution && (
                <span className="text-[10px] font-mono font-medium px-1.5 py-0.5 rounded bg-black/75 text-sky-300 border border-white/10 backdrop-blur-xs shadow-sm">
                  {resolution}
                </span>
              )}
              {active && (
                <span 
                  className={cn(
                    "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border backdrop-blur-xs shadow-sm flex items-center gap-1",
                    signal_bars >= 4 ? "bg-black/75 text-emerald-300 border-emerald-500/30" :
                    signal_bars === 3 ? "bg-black/75 text-amber-300 border-amber-500/30" :
                    "bg-black/75 text-rose-300 border-rose-500/30"
                  )}
                  title={`Signal Quality: ${signal_quality} (${signal_bars}/5) • Latency: ${rtt_ms}ms`}
                >
                  <span className="text-[9px]">📶</span>
                  {signal_bars}/5
                  {rtt_ms > 0 && <span className="opacity-80 text-[9px]">{rtt_ms}ms</span>}
                </span>
              )}
              {active && lens && (
                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-black/75 text-purple-300 border border-white/10 backdrop-blur-xs shadow-sm hidden sm:inline-block">
                  {lens}
                </span>
              )}
            </div>

            <div className="flex items-center gap-1 pointer-events-auto">
              {active && (
                <>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowHumanMotion(!showHumanMotion);
                    }}
                    title={showHumanMotion ? "Human Pose & Hand AI Active" : "Click to Enable MoveNet & 3D Hand Tracking"}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-xs transition-all border",
                      showHumanMotion 
                        ? "bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-400" 
                        : "bg-black/75 hover:bg-black text-slate-300 border-white/20"
                    )}
                  >
                    <Sparkles className="w-2.5 h-2.5 text-emerald-400" />
                    <span>{showHumanMotion ? '3D POSE ON' : '3D POSE'}</span>
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAi(!showAi);
                    }}
                    title={showAi ? "AI Overlay Active (Click for Raw Zero-Latency Feed)" : "Raw Direct Feed Active (Click to Show AI Boxes)"}
                    className={cn(
                      "px-1.5 py-0.5 rounded text-[10px] font-semibold flex items-center gap-1 shadow-xs transition-all border",
                      showAi ? "bg-primary/90 hover:bg-primary text-primary-foreground border-primary/50" : "bg-black/75 hover:bg-black text-slate-300 border-white/20"
                    )}
                  >
                    {showAi ? <Eye className="w-2.5 h-2.5" /> : <EyeOff className="w-2.5 h-2.5 text-slate-400" />}
                    <span>{showAi ? 'AI ON' : 'RAW'}</span>
                  </button>
                </>
              )}
              {isStreaming && (
                <button
                  type="button"
                  onClick={handleStopWebcam}
                  title="Stop streaming this webcam"
                  className="px-2 py-1 rounded bg-rose-600/90 hover:bg-rose-600 text-white text-[10px] font-semibold flex items-center gap-1 shadow-sm transition-all"
                >
                  <Square className="w-2.5 h-2.5 fill-current" />
                  Stop
                </button>
              )}
              {cameraType === 'PHONE' && !active && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowPhoneModal(true);
                  }}
                  title="Connect Phone Camera"
                  className="p-1.5 rounded-md bg-sky-600/80 hover:bg-sky-600 text-white shadow-sm"
                >
                  <QrCode className="w-3.5 h-3.5" />
                </button>
              )}
              {onDelete && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(cameraId);
                  }}
                  title="Delete Camera"
                  className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md bg-rose-600/80 hover:bg-rose-600 text-white shadow-sm"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
            <div className="min-w-0 pr-2 text-left">
              <h4 className="text-sm font-semibold text-white drop-shadow truncate">{name}</h4>
              <p className="text-xs text-slate-200 drop-shadow truncate">{zone || 'Unassigned'}</p>
            </div>
            <div className="flex items-center gap-1.5">
              {active && fps > 0 && (
                <span className={cn(
                  "text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border backdrop-blur-xs flex items-center gap-1",
                  fps >= 24 ? "bg-black/70 text-emerald-400 border-emerald-500/30" :
                  fps >= 15 ? "bg-black/70 text-sky-400 border-sky-500/30" :
                  "bg-black/70 text-amber-400 border-amber-500/30"
                )}>
                  ⚡ {fps} FPS
                </span>
              )}
              <StatusBadge status={active ? 'LIVE' : 'OFFLINE'} />
            </div>
          </div>
        </div>
      </Card>

      {/* Quick Phone Connection Modal */}
      <Dialog open={showPhoneModal} onOpenChange={setShowPhoneModal}>
        <DialogContent className="max-w-md p-6 bg-card" onClick={(e) => e.stopPropagation()}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-foreground font-bold">
              <Smartphone className="w-5 h-5 text-sky-500" />
              Connect Phone Camera #{cameraId}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Scan this QR code with your mobile camera to launch the real-time AI streamer.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col items-center justify-center p-4 bg-white rounded-xl shadow-xs border my-2">
            {phoneStreamUrl ? (
              <QRCodeSVG 
                value={phoneStreamUrl} 
                size={210} 
                level="M" 
                includeMargin={true}
              />
            ) : null}
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2 bg-muted/60 p-2.5 rounded-lg border text-xs font-mono break-all text-muted-foreground select-all">
              <span className="flex-1 truncate">{phoneStreamUrl}</span>
              <button 
                type="button" 
                onClick={copyUrl} 
                className="p-1 hover:text-foreground shrink-0" 
                title="Copy link"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                className="flex-1 gap-1.5 text-xs font-medium"
                onClick={copyUrl}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied' : 'Copy Link'}
              </Button>
              <Button 
                size="sm" 
                className="flex-1 gap-1.5 text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white"
                onClick={() => window.open(phoneStreamUrl, '_blank')}
              >
                <ExternalLink className="w-3.5 h-3.5" />
                Open Stream Page
              </Button>
            </div>

            <div className="p-3 bg-muted/40 rounded-lg text-[11px] text-muted-foreground space-y-1">
              <div className="font-semibold text-foreground flex items-center gap-1">
                💡 Instructions for Phone:
              </div>
              <div>1. Open link in <strong>Chrome (Android)</strong> or <strong>Safari (iOS)</strong>.</div>
              <div>2. Tap the large <strong>"▶ Tap to Start Camera"</strong> button.</div>
              <div>3. Allow camera access. Live feed & diagnostics will stream instantly!</div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
