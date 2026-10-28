import React, { useState, useRef, useEffect } from 'react';
import { 
  Camera, Upload, X, CheckCircle2, Image as ImageIcon, AlertCircle, 
  Smartphone, QrCode, RefreshCw, ExternalLink, Sparkles, Video, Check, Copy
} from 'lucide-react';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';

const ANGLES = ['Front', 'Back', 'Left', 'Right', 'Top', 'Packaging', 'Angle 7', 'Angle 8'];

export function ProductImageCapture({ onComplete, onBack }) {
  // Modes: 'camera' | 'upload'
  const [mode, setMode] = useState('camera');
  // Sources: 'connected_camera' | 'webcam'
  const [captureSource, setCaptureSource] = useState('connected_camera');
  
  const videoRef = useRef(null);
  const feedImgRef = useRef(null);
  const fileInputRef = useRef(null);
  
  const [stream, setStream] = useState(null);
  const [images, setImages] = useState([]);
  const [currentAngleIndex, setCurrentAngleIndex] = useState(0);
  const [cameraError, setCameraError] = useState(null);
  const [cameras, setCameras] = useState([]);
  const [selectedCameraId, setSelectedCameraId] = useState(1);
  const [isFlashing, setIsFlashing] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showQrConnect, setShowQrConnect] = useState(false);
  const [copied, setCopied] = useState(false);

  // Fetch available cameras from backend
  const fetchCameras = async () => {
    try {
      const res = await fetch('/api/cameras');
      if (res.ok) {
        const data = await res.json();
        setCameras(data);
        
        // Find first online camera, prefer phone camera
        const onlineCam = data.find(c => c.status === 'ONLINE' || c.status === 'LIVE');
        if (onlineCam) {
          setSelectedCameraId(onlineCam.id);
          setCaptureSource('connected_camera');
        } else if (data.length > 0) {
          setSelectedCameraId(data[0].id);
        }
      }
    } catch (e) {
      console.warn('Failed to fetch cameras:', e);
    }
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 4000);
    return () => clearInterval(interval);
  }, []);

  // Manage webcam stream lifecycle
  useEffect(() => {
    if (mode === 'camera' && captureSource === 'webcam') {
      startWebcam();
    } else {
      stopWebcam();
    }
    return () => stopWebcam();
  }, [mode, captureSource]);

  const startWebcam = async () => {
    setCameraError(null);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Browser camera API unavailable on insecure HTTP. Please use Connected Phone Camera or File Upload.');
      }
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
      }
    } catch (err) {
      console.warn('Webcam error:', err);
      setCameraError(err.message || 'Camera access denied or device not found.');
    }
  };

  const stopWebcam = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
    }
  };

  // Add photo helper
  const addCapturedPhoto = (dataUrl, blob) => {
    const angle = ANGLES[currentAngleIndex] || `Angle ${images.length + 1}`;
    const newImage = { angle, dataUrl, blob, id: Date.now() };
    setImages(prev => [...prev, newImage]);
    
    // Shutter flash animation
    setIsFlashing(true);
    setTimeout(() => setIsFlashing(false), 200);

    // Auto-advance target angle
    if (currentAngleIndex < ANGLES.length - 1) {
      setCurrentAngleIndex(prev => prev + 1);
    }
    toast.success(`Captured ${angle} angle photo!`);
  };

  // Capture photo from either Local Webcam or Connected Phone Camera
  const capturePhoto = async () => {
    if (images.length >= 8) {
      toast.info('Maximum 8 training photos reached.');
      return;
    }

    if (captureSource === 'webcam') {
      if (!videoRef.current) return;
      const canvas = document.createElement('canvas');
      canvas.width = videoRef.current.videoWidth || 854;
      canvas.height = videoRef.current.videoHeight || 480;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      canvas.toBlob((blob) => {
        if (blob) addCapturedPhoto(dataUrl, blob);
      }, 'image/jpeg', 0.92);

    } else {
      // Capture from Connected Phone / AI Camera
      try {
        // Method 1: Grab instantly from live feed image element if available
        if (feedImgRef.current && feedImgRef.current.complete && feedImgRef.current.naturalWidth > 0) {
          const canvas = document.createElement('canvas');
          canvas.width = feedImgRef.current.naturalWidth || 854;
          canvas.height = feedImgRef.current.naturalHeight || 480;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(feedImgRef.current, 0, 0);
          
          const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
          canvas.toBlob((blob) => {
            if (blob) {
              addCapturedPhoto(dataUrl, blob);
            }
          }, 'image/jpeg', 0.92);
          return;
        }

        // Method 2: Fetch crisp unannotated snapshot from backend endpoint
        const res = await fetch(`/api/cameras/${selectedCameraId}/snapshot?raw=true`);
        if (!res.ok) throw new Error('Camera snapshot failed');
        const blob = await res.blob();
        const reader = new FileReader();
        reader.onload = (e) => {
          addCapturedPhoto(e.target.result, blob);
        };
        reader.readAsDataURL(blob);
      } catch (err) {
        console.error('Snapshot capture error:', err);
        toast.error('Failed to capture frame from camera. Ensure phone camera is streaming.');
      }
    }
  };

  const handleFiles = (filesList) => {
    const files = Array.from(filesList || []);
    if (files.length === 0) return;

    files.forEach((file, idx) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const dataUrl = event.target.result;
        const angle = ANGLES[(images.length + idx) % ANGLES.length];
        setImages(prev => [
          ...prev,
          { angle, dataUrl, blob: file, id: Date.now() + idx + Math.random() }
        ]);
      };
      reader.readAsDataURL(file);
    });

    toast.success(`Loaded ${files.length} photo${files.length > 1 ? 's' : ''}`);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const updateAngle = (id, newAngle) => {
    setImages(prev => prev.map(img => img.id === id ? { ...img, angle: newAngle } : img));
  };

  const removeImage = (idToRemove) => {
    setImages(prev => prev.filter(img => img.id !== idToRemove));
  };

  const handleComplete = () => {
    if (images.length > 0) {
      stopWebcam();
      onComplete(images);
    }
  };

  const targetHost = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
  const localHttpsPhoneUrl = `https://${targetHost}:8443/phone-camera/${selectedCameraId}`;
  const cloudflarePhoneUrl = `https://cal-ian-puts-cape.trycloudflare.com/phone-camera/${selectedCameraId}`;
  
  // Use Cloudflare URL if on tunnel, else local HTTPS port 8443
  const activePhoneUrl = typeof window !== 'undefined' && window.location.hostname.includes('trycloudflare.com')
    ? cloudflarePhoneUrl 
    : localHttpsPhoneUrl;

  const copyPhoneUrl = () => {
    navigator.clipboard.writeText(activePhoneUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Phone camera streamer URL copied!');
  };

  const selectedCam = cameras.find(c => c.id === selectedCameraId);
  const isSelectedCamOnline = selectedCam && (selectedCam.status === 'ONLINE' || selectedCam.status === 'LIVE');

  return (
    <div className="flex flex-col space-y-3.5">
      {/* Primary Mode Switcher */}
      <div className="flex rounded-lg border p-1 bg-muted/40 gap-1">
        <button
          type="button"
          onClick={() => { setMode('camera'); setCameraError(null); }}
          className={cn(
            "flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2",
            mode === 'camera' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Camera className="w-3.5 h-3.5 text-primary" /> Live Camera Capture
        </button>
        <button
          type="button"
          onClick={() => { setMode('upload'); stopWebcam(); }}
          className={cn(
            "flex-1 py-1.5 px-3 text-xs font-semibold rounded-md transition-all flex items-center justify-center gap-2",
            mode === 'upload' ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Upload className="w-3.5 h-3.5" /> Upload Image Files
        </button>
      </div>

      {mode === 'camera' && (
        <div className="space-y-2">
          {/* Sub-header: Camera Source Selector */}
          <div className="flex items-center justify-between bg-slate-900/60 p-2 rounded-lg border border-border/40 text-xs">
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-semibold text-slate-400">Source:</span>
              <div className="inline-flex rounded-md bg-slate-800/80 p-0.5 border border-slate-700/60">
                <button
                  type="button"
                  onClick={() => { setCaptureSource('connected_camera'); setCameraError(null); }}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all",
                    captureSource === 'connected_camera'
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Smartphone className="w-3 h-3" />
                  <span>Connected Phone Camera</span>
                  {isSelectedCamOnline && (
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => { setCaptureSource('webcam'); setCameraError(null); }}
                  className={cn(
                    "px-2.5 py-1 rounded text-[11px] font-semibold flex items-center gap-1.5 transition-all",
                    captureSource === 'webcam'
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-slate-400 hover:text-slate-200"
                  )}
                >
                  <Video className="w-3 h-3" />
                  <span>Browser Webcam</span>
                </button>
              </div>
            </div>

            {captureSource === 'connected_camera' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => setShowQrConnect(!showQrConnect)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-sky-300 text-[11px] font-medium border border-sky-500/20 flex items-center gap-1 transition-all"
                >
                  <QrCode className="w-3 h-3" />
                  <span>{showQrConnect ? 'Hide QR' : 'Connect Phone'}</span>
                </button>
              </div>
            )}
          </div>

          {/* QR Code Phone Connector Drawer */}
          {showQrConnect && (
            <div className="bg-slate-900 border border-sky-500/30 rounded-lg p-3 text-xs flex flex-col sm:flex-row items-center gap-3 shadow-md animate-in fade-in duration-200">
              <div className="bg-white p-1.5 rounded-md shadow-inner flex-shrink-0">
                <QRCodeSVG value={activePhoneUrl} size={90} />
              </div>
              <div className="flex-1 space-y-1 text-left">
                <p className="font-semibold text-sky-300 flex items-center gap-1.5">
                  <Smartphone className="w-3.5 h-3.5" /> Stream from your Phone Camera
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Scan this QR code with your mobile phone camera or open the link below. The live stream will instantly appear here for product photo capture!
                </p>
                <div className="flex items-center gap-2 pt-1">
                  <Button 
                    type="button" 
                    size="sm" 
                    variant="outline" 
                    onClick={copyPhoneUrl}
                    className="h-7 text-[11px] gap-1 px-2.5 border-slate-700 bg-slate-800 hover:bg-slate-700"
                  >
                    {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copied ? 'Copied Link' : 'Copy Phone Stream Link'}</span>
                  </Button>
                  <a 
                    href={activePhoneUrl} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-[11px] text-sky-400 hover:underline flex items-center gap-1"
                  >
                    Open Link <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
            </div>
          )}

          {/* Main Video Viewport */}
          <div className="relative overflow-hidden bg-black rounded-lg aspect-[4/3] flex flex-col items-center justify-center border border-border/60 shadow-inner">
            {/* White Shutter Flash Effect */}
            <div 
              className={cn(
                "absolute inset-0 bg-white z-30 pointer-events-none transition-opacity duration-150",
                isFlashing ? "opacity-90" : "opacity-0"
              )} 
            />

            {captureSource === 'connected_camera' ? (
              /* Connected Phone Camera Stream View */
              isSelectedCamOnline ? (
                <>
                  <img 
                    ref={feedImgRef}
                    src={`/api/cameras/${selectedCameraId}/feed?annotated=false`}
                    alt="Phone Camera Stream"
                    crossOrigin="anonymous"
                    className="absolute inset-0 w-full h-full object-cover"
                  />

                  {/* Target Guide Framing Overlay */}
                  <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40">
                    <div className="w-full h-full border-2 border-dashed border-emerald-400/80 rounded-lg relative flex items-center justify-center shadow-sm">
                      <div className="absolute top-2.5 bg-black/80 px-3 py-1 rounded-full text-emerald-300 text-xs font-semibold backdrop-blur border border-emerald-500/30 flex items-center gap-1.5 shadow-md">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                        Target: {ANGLES[currentAngleIndex] || 'Extra'} ({currentAngleIndex + 1}/5)
                      </div>
                      <div className="text-[11px] text-white/70 bg-black/60 px-2 py-0.5 rounded backdrop-blur border border-white/10 pointer-events-none">
                        Align item inside frame & click Snap Photo
                      </div>
                    </div>
                  </div>

                  {/* Shutter Button Deck */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center items-center gap-3 z-20">
                    <Button 
                      type="button"
                      size="icon" 
                      className="w-14 h-14 rounded-full border-4 border-white bg-emerald-600 hover:bg-emerald-500 text-white shadow-2xl transition-all active:scale-95"
                      onClick={capturePhoto}
                      disabled={images.length >= 8}
                      title="Capture Photo"
                    >
                      <Camera className="w-6 h-6" />
                    </Button>
                  </div>
                </>
              ) : (
                /* Phone Camera Offline Banner */
                <div className="text-center text-white p-6 max-w-sm flex flex-col items-center">
                  <div className="w-14 h-14 rounded-full bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 mb-3 shadow-lg">
                    <Smartphone className="w-7 h-7" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 mb-1">Phone Camera 1 is Waiting</h4>
                  <p className="text-xs text-slate-400 leading-relaxed mb-4">
                    Open the camera streamer on your phone to transmit live video, or switch to file upload below.
                  </p>
                  
                  <div className="flex flex-col sm:flex-row gap-2 w-full">
                    <Button 
                      type="button"
                      size="sm" 
                      onClick={() => setShowQrConnect(true)}
                      className="flex-1 bg-sky-600 hover:bg-sky-500 text-white text-xs gap-1.5"
                    >
                      <QrCode className="w-3.5 h-3.5" /> Show Phone QR
                    </Button>
                    <Button 
                      type="button"
                      size="sm" 
                      variant="outline" 
                      onClick={() => setMode('upload')} 
                      className="flex-1 border-white/20 text-slate-200 hover:text-white text-xs gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Use File Upload
                    </Button>
                  </div>
                </div>
              )
            ) : (
              /* Local Browser Webcam View */
              cameraError ? (
                <div className="text-center text-white p-6 max-w-sm flex flex-col items-center">
                  <div className="w-12 h-12 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 mb-3 shadow-lg">
                    <AlertCircle className="w-6 h-6" />
                  </div>
                  <h4 className="text-sm font-semibold text-slate-100 mb-1">Local Browser Camera Blocked</h4>
                  <p className="text-xs text-rose-300 font-medium mb-1">
                    {cameraError}
                  </p>
                  <p className="text-[11px] text-slate-400 leading-relaxed mb-4">
                    Modern browsers strictly block webcams over plain HTTP. Use your Connected Phone Camera or upload files instead.
                  </p>
                  
                  <div className="flex flex-col gap-2 w-full">
                    <Button 
                      type="button"
                      size="sm" 
                      onClick={() => { setCaptureSource('connected_camera'); setCameraError(null); }}
                      className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-xs gap-1.5"
                    >
                      <Smartphone className="w-3.5 h-3.5" /> Switch to Connected Phone Camera
                    </Button>
                    <Button 
                      type="button"
                      size="sm" 
                      variant="outline" 
                      onClick={() => setMode('upload')} 
                      className="w-full border-white/20 text-slate-200 text-xs gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" /> Switch to File Upload
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  <video 
                    ref={videoRef}
                    autoPlay 
                    playsInline 
                    muted 
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                  
                  {/* Overlay Guide */}
                  <div className="absolute inset-0 pointer-events-none border-[20px] border-black/40">
                    <div className="w-full h-full border-2 border-dashed border-white/70 rounded-lg relative flex items-center justify-center">
                      <div className="absolute top-2.5 bg-black/80 px-3 py-1 rounded-full text-white text-xs font-semibold backdrop-blur border border-white/10">
                        Target: {ANGLES[currentAngleIndex] || 'Extra'} ({currentAngleIndex + 1}/5)
                      </div>
                    </div>
                  </div>

                  {/* Bottom Controls */}
                  <div className="absolute bottom-3 left-0 right-0 flex justify-center z-20">
                    <Button 
                      type="button"
                      size="icon" 
                      className="w-14 h-14 rounded-full border-4 border-white bg-primary hover:bg-primary/90 shadow-2xl transition-all active:scale-95"
                      onClick={capturePhoto}
                      disabled={images.length >= 8}
                      title="Capture Photo"
                    >
                      <Camera className="w-6 h-6" />
                    </Button>
                  </div>
                </>
              )
            )}
          </div>
        </div>
      )}

      {mode === 'upload' && (
        /* Enhanced Drag & Drop File Upload Area */
        <div 
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files) handleFiles(e.dataTransfer.files);
          }}
          className={cn(
            "cursor-pointer border-2 border-dashed rounded-lg p-6 transition-all text-center flex flex-col items-center justify-center min-h-[190px] gap-2 select-none",
            dragOver 
              ? "border-primary bg-primary/15 scale-[0.99]" 
              : "border-primary/30 hover:border-primary/60 bg-primary/5"
          )}
        >
          <input 
            ref={fileInputRef}
            type="file" 
            multiple 
            accept="image/*" 
            className="hidden" 
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary mb-1">
            <Upload className="w-6 h-6" />
          </div>
          <p className="text-sm font-semibold text-foreground">Click to browse or drag & drop product photos</p>
          <p className="text-xs text-muted-foreground">PNG, JPG, WEBP (Front, Back, Packaging, Labels)</p>
          <Button size="sm" variant="secondary" className="mt-2 text-xs">
            Choose Photos from Computer / Phone
          </Button>
        </div>
      )}

      {/* Captured / Uploaded Images Strip */}
      <div className="space-y-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
            {images.length} Training Photo{images.length !== 1 ? 's' : ''} Ready
          </span>
          <span className="text-[11px] text-muted-foreground">
            {images.length === 0 ? 'Capture or upload at least 1 photo' : 'Select angle badge to customize'}
          </span>
        </div>

        {images.length > 0 ? (
          <div className="flex gap-2.5 overflow-x-auto py-1.5 pb-2.5 snap-x">
            {images.map((img) => (
              <div key={img.id} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-border shadow-sm group bg-slate-950">
                <img 
                  src={img.dataUrl} 
                  alt={img.angle}
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-1 left-1">
                  <select
                    value={img.angle}
                    onChange={(e) => updateAngle(img.id, e.target.value)}
                    className="bg-black/85 text-white text-[10px] rounded px-1.5 py-0.5 border border-white/20 outline-none font-semibold cursor-pointer shadow"
                  >
                    {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={() => removeImage(img.id)}
                  className="absolute top-1 right-1 bg-rose-600/90 text-white rounded-full p-1 hover:bg-rose-600 shadow transition-all"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="border border-border/50 rounded-lg p-3 bg-muted/20 text-center">
            <p className="text-xs text-amber-500 font-medium flex items-center justify-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5" /> Reference photos are required for AI visual recognition
            </p>
          </div>
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex justify-between items-center pt-2">
        <Button variant="outline" size="sm" onClick={onBack}>Back</Button>
        <Button 
          size="sm"
          onClick={handleComplete} 
          disabled={images.length === 0}
          className="gap-1.5"
        >
          <CheckCircle2 className="w-4 h-4" />
          Continue with {images.length} Photo{images.length !== 1 ? 's' : ''}
        </Button>
      </div>
    </div>
  );
}


