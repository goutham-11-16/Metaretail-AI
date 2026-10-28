import React, { useEffect, useRef, useState } from 'react';
import { sharedHumanTracker } from '../../lib/humanTracker';
import { Activity, Sparkles, Hand, UserCheck, AlertCircle } from 'lucide-react';
import { cn } from '../../lib/utils';

export function HumanMotionOverlay({
  targetRef,
  enabled = true,
  cameraId = null,
  onTelemetryUpdate = null,
  className
}) {
  const canvasRef = useRef(null);
  const [fps, setFps] = useState(0);
  const [bodiesCount, setBodiesCount] = useState(0);
  const [handsCount, setHandsCount] = useState(0);
  const [latestAction, setLatestAction] = useState(null);
  const [topEmotion, setTopEmotion] = useState(null);
  const [isEngineReady, setIsEngineReady] = useState(false);
  const [initError, setInitError] = useState(null);

  useEffect(() => {
    if (!enabled) return;

    let isMounted = true;
    let animId = null;
    let lastTime = performance.now();
    let frameCounter = 0;
    let fpsTimer = performance.now();

    const startTracker = async () => {
      try {
        await sharedHumanTracker.init();
        if (isMounted) setIsEngineReady(true);
      } catch (err) {
        console.warn('[HumanMotionOverlay] Initialization warning:', err);
        if (isMounted) setInitError(err.message || 'Model load failure');
        return;
      }

      const loop = async () => {
        if (!isMounted || !enabled) return;

        const targetEl = targetRef?.current;
        const canvas = canvasRef.current;

        if (targetEl && canvas) {
          // Sync canvas dimensions with target element
          const rect = targetEl.getBoundingClientRect();
          const targetW = targetEl.videoWidth || targetEl.naturalWidth || rect.width || 640;
          const targetH = targetEl.videoHeight || targetEl.naturalHeight || rect.height || 360;

          if (canvas.width !== targetW || canvas.height !== targetH) {
            canvas.width = targetW;
            canvas.height = targetH;
          }

          // Check if element is ready for image extraction
          const isReady = (targetEl instanceof HTMLVideoElement && targetEl.readyState >= 2) ||
                          (targetEl instanceof HTMLImageElement && targetEl.complete && targetEl.naturalWidth > 0) ||
                          (targetEl instanceof HTMLCanvasElement);

          if (isReady) {
            try {
              const res = await sharedHumanTracker.detect(targetEl);
              if (res && isMounted) {
                // Clear canvas & render overlay
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);

                sharedHumanTracker.drawOverlay(canvas, res, {
                  drawSkeleton: true,
                  drawHands: true,
                  drawFaces: true,
                  drawGestures: true
                });

                // Update Telemetry
                const bCount = res.bodies?.length || 0;
                const hCount = res.hands?.length || 0;
                setBodiesCount(bCount);
                setHandsCount(hCount);

                if (res.bodies?.[0]?.actionLabel) {
                  setLatestAction(res.bodies[0].actionLabel);
                } else if (res.hands?.[0]?.gestureType) {
                  setLatestAction(res.hands[0].gestureType);
                }

                if (res.faces?.[0]?.emotion?.[0]) {
                  setTopEmotion(res.faces[0].emotion[0]);
                }

                if (onTelemetryUpdate) {
                  onTelemetryUpdate({
                    bodies: res.bodies,
                    hands: res.hands,
                    faces: res.faces,
                    fps
                  });
                }
              }
            } catch (detErr) {
              // Frame dropped or busy
            }
          }
        }

        // FPS calculation
        frameCounter++;
        const now = performance.now();
        if (now - fpsTimer >= 1000) {
          setFps(Math.round((frameCounter * 1000) / (now - fpsTimer)));
          frameCounter = 0;
          fpsTimer = now;
        }

        animId = requestAnimationFrame(loop);
      };

      animId = requestAnimationFrame(loop);
    };

    startTracker();

    return () => {
      isMounted = false;
      if (animId) cancelAnimationFrame(animId);
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    };
  }, [enabled, targetRef, onTelemetryUpdate]);

  if (!enabled) return null;

  return (
    <div className={cn("absolute inset-0 pointer-events-none overflow-hidden", className)}>
      {/* Real-time Render Canvas */}
      <canvas
        ref={canvasRef}
        className="w-full h-full object-contain absolute inset-0 z-10"
      />

      {/* Human AI Live Telemetry HUD */}
      <div className="absolute top-2 right-2 z-20 flex flex-col items-end gap-1.5 pointer-events-auto">
        <div className="bg-slate-950/85 backdrop-blur-md border border-emerald-500/40 px-2.5 py-1.5 rounded-lg shadow-lg flex items-center gap-2 text-white text-xs">
          <div className="flex items-center gap-1 text-emerald-400 font-semibold font-mono">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            Human AI
          </div>
          <span className="text-white/20">|</span>
          <span className="font-mono text-emerald-300 font-semibold">{fps || 30} FPS</span>
          <span className="text-white/20">|</span>
          <span className="text-sky-300 flex items-center gap-1 font-mono">
            <UserCheck className="w-3 h-3" /> {bodiesCount} {bodiesCount === 1 ? 'Body' : 'Bodies'}
          </span>
          {handsCount > 0 && (
            <>
              <span className="text-white/20">|</span>
              <span className="text-amber-300 flex items-center gap-1 font-mono">
                <Hand className="w-3 h-3" /> {handsCount} {handsCount === 1 ? 'Hand' : 'Hands'}
              </span>
            </>
          )}
        </div>

        {/* Live Detected Action Banner */}
        {latestAction && (
          <div className="bg-emerald-950/90 backdrop-blur-md border border-emerald-400/50 text-emerald-200 px-2.5 py-1 rounded-md text-[11px] font-medium shadow-md flex items-center gap-1.5 animate-in fade-in slide-in-from-right-2 duration-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
            Motion: <span className="font-semibold text-white">{latestAction}</span>
          </div>
        )}

        {/* Top Emotion Banner */}
        {topEmotion && (
          <div className="bg-sky-950/80 backdrop-blur-md border border-sky-400/40 text-sky-200 px-2 py-0.5 rounded text-[10px] shadow-sm flex items-center gap-1">
            <span>Emotion:</span>
            <span className="font-semibold text-white capitalize">{topEmotion.emotion} ({Math.round(topEmotion.score * 100)}%)</span>
          </div>
        )}
      </div>
    </div>
  );
}
