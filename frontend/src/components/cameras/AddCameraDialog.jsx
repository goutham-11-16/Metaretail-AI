import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Camera, Smartphone, Network, QrCode, Copy, RefreshCw, Check, ExternalLink, Globe, ShieldCheck, AlertCircle, Plus } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/tabs';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { cn } from '../../lib/utils';
import { sharedWebcamStreamer } from '../../lib/webcamStreamer';

export function AddCameraDialog({ open, onOpenChange, onCameraAdded }) {
  const [activeTab, setActiveTab] = useState('local');
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({ name: '', zoneId: 'unassigned', url: '' });
  
  // Local Camera state
  const [devices, setDevices] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState('default');
  const [hasWebcamPermission, setHasWebcamPermission] = useState(null);
  const videoRef = useRef(null);

  // Phone Camera state
  const [qrUrl, setQrUrl] = useState('');
  const [qrData, setQrData] = useState(null);
  const [streamRoute, setStreamRoute] = useState('tunnel'); // 'tunnel' | 'lan_https' | 'lan_http'
  const [activeCameraId, setActiveCameraId] = useState(null);
  const [phoneConnected, setPhoneConnected] = useState(false);
  const [phoneTelemetry, setPhoneTelemetry] = useState(null);
  const [copied, setCopied] = useState(false);

  // Reset or initialize on dialog open
  useEffect(() => {
    if (open) {
      fetchZones();
      getDevices();
    } else {
      // Clean up when dialog closes
      setQrUrl('');
      setQrData(null);
      setActiveCameraId(null);
      setPhoneConnected(false);
      setPhoneTelemetry(null);
      setFormData({ name: '', zoneId: 'unassigned', url: '' });
    }
  }, [open]);

  const fetchZones = async () => {
    try {
      const res = await fetch('/api/zones');
      if (res.ok) setZones(await res.json());
    } catch (err) {
      console.error('Failed to fetch zones:', err);
    }
  };

  const getDevices = async () => {
    const fallbackList = [
      { deviceId: 'default', label: 'Default Integrated Webcam (Auto /dev/video0)' },
      { deviceId: '0', label: 'System Camera Index 0' },
      { deviceId: '1', label: 'System Camera Index 1' }
    ];

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          setHasWebcamPermission(true);
          // Stop stream right after checking permission
          stream.getTracks().forEach(t => t.stop());
        } catch (permErr) {
          console.warn('Webcam permission not granted or device unavailable:', permErr);
          setHasWebcamPermission(false);
        }

        const allDevices = await navigator.mediaDevices.enumerateDevices();
        const videoDevices = allDevices
          .filter(d => d.kind === 'videoinput')
          .map((d, idx) => ({
            deviceId: d.deviceId || String(idx),
            label: d.label || `Webcam Device ${idx + 1}`
          }));

        if (videoDevices.length > 0) {
          setDevices([...videoDevices, ...fallbackList]);
          setSelectedDevice(videoDevices[0].deviceId);
          return;
        }
      }
    } catch (err) {
      console.warn('Camera enumeration error, using system fallbacks', err);
      setHasWebcamPermission(false);
    }

    setDevices(fallbackList);
    setSelectedDevice('default');
  };

  // Video preview for local webcam
  useEffect(() => {
    let stream = null;
    const startPreview = async () => {
      if (activeTab === 'local' && selectedDevice && videoRef.current && selectedDevice !== 'default' && selectedDevice !== '0' && selectedDevice !== '1') {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedDevice } }
          });
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.warn('Webcam preview could not start:', err);
        }
      }
    };
    startPreview();
    
    return () => {
      if (stream) {
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, [selectedDevice, activeTab]);

  // Poll for phone connection and live telemetry once QR is generated
  useEffect(() => {
    if (!activeCameraId) return;
    let active = true;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/cameras/${activeCameraId}`);
        if (res.ok && active) {
          const data = await res.json();
          if (data.status === 'ONLINE' || data.status === 'LIVE') {
            setPhoneConnected(true);
            setPhoneTelemetry(data);
          }
        }
      } catch (err) {
        // ignore polling errors
      }
    }, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [activeCameraId]);

  // Generate Phone QR and create camera in DB
  const generatePhoneQr = async () => {
    setLoading(true);
    try {
      let camId = activeCameraId;
      const cameraName = formData.name.trim() || 'Phone Camera';

      if (!camId) {
        const res = await fetch('/api/cameras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            camera_type: 'PHONE', 
            type: 'PHONE',
            name: cameraName,
            assigned_zone_id: (formData.zoneId && formData.zoneId !== 'unassigned') ? parseInt(formData.zoneId) : null
          })
        });

        if (res.ok) {
          const cam = await res.json();
          camId = cam.id;
          setActiveCameraId(cam.id);
          // Notify parent so the camera card is already added to the matrix
          if (onCameraAdded) onCameraAdded(cam);
        } else {
          const errText = await res.text();
          throw new Error(errText || 'Failed to create camera record');
        }
      } else if (formData.name.trim()) {
        // Update existing camera record if name was changed
        await fetch(`/api/cameras/${camId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: formData.name.trim(),
            assigned_zone_id: (formData.zoneId && formData.zoneId !== 'unassigned') ? parseInt(formData.zoneId) : null
          })
        });
      }

      // Fetch accurate network & tunnel URLs from backend
      const hostParam = encodeURIComponent(window.location.host);
      let token = '';
      let data = null;

      try {
        const qrRes = await fetch(`/api/cameras/${camId}/qr-data?host=${hostParam}`);
        if (qrRes.ok) {
          data = await qrRes.json();
          token = data.token || '';
        }
      } catch (e) {
        console.warn('QR data endpoint error, using client-side fallback', e);
      }

      // Fallback URL generation if endpoint is unavailable
      const isTunnelHost = window.location.hostname.includes('trycloudflare.com') || window.location.hostname.includes('.loca.lt');
      const tunnelUrl = `${window.location.origin}/phone-camera/${camId}${token ? `?token=${token}` : ''}`;
      const lanIp = data?.lan_ip || '192.168.12.159';
      const lanHttpsUrl = data?.https_url || `https://${lanIp}:8443/phone-camera/${camId}${token ? `?token=${token}` : ''}`;
      const lanHttpUrl = data?.http_url || `http://${lanIp}:8000/phone-camera/${camId}${token ? `?token=${token}` : ''}`;

      const qrPayload = {
        camera_id: camId,
        token: token,
        tunnel_url: isTunnelHost ? tunnelUrl : null,
        lan_https_url: lanHttpsUrl,
        lan_http_url: lanHttpUrl,
        direct_origin_url: tunnelUrl
      };

      setQrData(qrPayload);

      // Select initial route
      let selectedUrl = tunnelUrl;
      if (isTunnelHost) {
        setStreamRoute('tunnel');
        selectedUrl = tunnelUrl;
      } else {
        setStreamRoute('lan_https');
        selectedUrl = lanHttpsUrl;
      }

      setQrUrl(selectedUrl);
      toast.success(`Phone Camera #${camId} ready! Scan QR code to stream.`);
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not generate QR code');
    } finally {
      setLoading(false);
    }
  };

  const handleRouteChange = (route) => {
    setStreamRoute(route);
    if (!qrData) return;
    if (route === 'tunnel') {
      setQrUrl(qrData.direct_origin_url);
    } else if (route === 'lan_https') {
      setQrUrl(qrData.lan_https_url);
    } else if (route === 'lan_http') {
      setQrUrl(qrData.lan_http_url);
    }
  };

  const copyQrUrl = () => {
    if (!qrUrl) return;
    navigator.clipboard.writeText(qrUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success('Camera stream URL copied to clipboard');
  };

  const handleSubmit = async (type) => {
    setLoading(true);
    try {
      const defaultName = type === 'local' ? 'Store Webcam' : type === 'network' ? 'IP Camera' : 'Phone Camera';
      const finalName = formData.name.trim() || defaultName;

      const payload = {
        name: finalName,
        camera_type: type.toUpperCase(),
        type: type.toUpperCase(),
        assigned_zone_id: (formData.zoneId && formData.zoneId !== 'unassigned') ? parseInt(formData.zoneId) : null
      };

      if (type === 'network') {
        if (!formData.url.trim()) {
          toast.error('Please enter a stream URL (e.g., rtsp:// or http://)');
          setLoading(false);
          return;
        }
        payload.connection_url = formData.url.trim();
      }

      if (type === 'local') {
        payload.connection_url = selectedDevice || 'default';
      }

      const res = await fetch('/api/cameras', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const cam = await res.json();
        toast.success(`Camera "${cam.name}" added successfully!`);
        if (onCameraAdded) onCameraAdded(cam);
        onOpenChange(false);
        setFormData({ name: '', zoneId: 'unassigned', url: '' });

        if (type === 'local') {
          try {
            await sharedWebcamStreamer.startStream(cam.id, selectedDevice);
            toast.success(`Webcam stream active for "${cam.name}"!`);
          } catch (streamErr) {
            console.warn('[AddCameraDialog] Webcam auto-start note:', streamErr);
          }
        }
      } else {
        const errText = await res.text();
        throw new Error(errText || 'Failed to add camera');
      }
    } catch (err) {
      toast.error(err.message || 'Error creating camera');
    } finally {
      setLoading(false);
    }
  };

  // When user clicks "Done" on Phone tab
  const handlePhoneDone = async () => {
    if (activeCameraId && formData.name.trim()) {
      try {
        await fetch(`/api/cameras/${activeCameraId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            name: formData.name.trim(),
            assigned_zone_id: (formData.zoneId && formData.zoneId !== 'unassigned') ? parseInt(formData.zoneId) : null
          })
        });
      } catch (e) {
        // ignore patch error
      }
    }
    toast.success('Phone camera configured and saved');
    if (onCameraAdded) onCameraAdded();
    onOpenChange(false);
  };

  const isCloudflare = typeof window !== 'undefined' && window.location.hostname.includes('trycloudflare.com');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[560px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <Plus className="w-5 h-5 text-primary" />
            Add Camera Sensor
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="mt-2">
          <TabsList className="grid grid-cols-3 w-full bg-muted/60 p-1">
            <TabsTrigger value="local" className="gap-1.5 font-semibold text-xs sm:text-sm">
              <Camera className="w-4 h-4"/> Webcam
            </TabsTrigger>
            <TabsTrigger value="phone" className="gap-1.5 font-semibold text-xs sm:text-sm">
              <Smartphone className="w-4 h-4 text-emerald-500"/> Phone
            </TabsTrigger>
            <TabsTrigger value="network" className="gap-1.5 font-semibold text-xs sm:text-sm">
              <Network className="w-4 h-4 text-sky-500"/> IP / RTSP
            </TabsTrigger>
          </TabsList>

          <div className="mt-5 space-y-4">
            {/* Common Fields: Name & Zone Assignment */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-muted/30 p-3 rounded-lg border border-border/60">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Camera Name</Label>
                <Input 
                  placeholder={
                    activeTab === 'local' ? 'Store Webcam 1' :
                    activeTab === 'phone' ? 'Phone Camera 1' : 'IP Camera 1'
                  }
                  value={formData.name}
                  onChange={e => setFormData(p => ({...p, name: e.target.value}))}
                  className="bg-background text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-foreground/90">Zone Assignment</Label>
                <Select 
                  value={formData.zoneId} 
                  onValueChange={v => setFormData(p => ({...p, zoneId: v}))}
                >
                  <SelectTrigger className="bg-background text-sm">
                    <SelectValue placeholder="Select Zone" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned (General Area)</SelectItem>
                    {zones.map(z => (
                      <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* TAB 1: LOCAL WEBCAM */}
            <TabsContent value="local" className="space-y-4 mt-0">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-semibold">Video Device</Label>
                  {hasWebcamPermission === false && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400 flex items-center gap-1 font-medium">
                      <AlertCircle className="w-3.5 h-3.5" /> Browser camera blocked - using system device
                    </span>
                  )}
                </div>
                <Select value={selectedDevice} onValueChange={setSelectedDevice}>
                  <SelectTrigger className="bg-background text-sm">
                    <SelectValue placeholder="Select Camera Device" />
                  </SelectTrigger>
                  <SelectContent>
                    {devices.map(d => (
                      <SelectItem key={d.deviceId} value={d.deviceId}>{d.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full aspect-video bg-slate-950 rounded-xl overflow-hidden flex items-center justify-center border border-border relative">
                <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400 gap-2 pointer-events-none p-4 text-center">
                  <Camera className="w-8 h-8 opacity-40" />
                  <span className="text-xs font-mono text-slate-300">
                    {devices.find(d => d.deviceId === selectedDevice)?.label || 'System Webcam (/dev/video0)'}
                  </span>
                  <span className="text-[10px] text-slate-500 max-w-xs">
                    Ready to stream via OpenCV capture or browser input.
                  </span>
                </div>
              </div>

              <Button 
                className="w-full font-semibold gap-2" 
                onClick={() => handleSubmit('local')}
                disabled={loading}
              >
                <Camera className="w-4 h-4" />
                {loading ? 'Adding Webcam...' : 'Add Webcam'}
              </Button>
            </TabsContent>

            {/* TAB 2: PHONE CAMERA */}
            <TabsContent value="phone" className="space-y-4 mt-0">
              <div className="w-full bg-card rounded-xl border border-border flex flex-col items-center justify-center p-5 text-center space-y-4">
                {!qrUrl ? (
                  <div className="py-4 flex flex-col items-center space-y-4">
                    <div className="p-3.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      <Smartphone className="w-8 h-8" />
                    </div>
                    <div>
                      <h4 className="font-bold text-base text-foreground mb-1">Turn Any Smartphone into an AI CCTV Camera</h4>
                      <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                        Stream crystal-clear 1280×720 HD video at high FPS directly to the server with zero apps to install. Works instantly in Chrome or Safari.
                      </p>
                    </div>

                    <Button 
                      onClick={generatePhoneQr} 
                      disabled={loading} 
                      className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                    >
                      <QrCode className="w-4 h-4" />
                      {loading ? 'Registering Camera...' : 'Generate Connection Link & QR'}
                    </Button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-3.5 w-full">
                    {/* Route / Protocol Selector */}
                    <div className="flex items-center gap-2 flex-wrap justify-center">
                      <div className="inline-flex p-0.5 bg-muted rounded-lg border border-border text-[11px] font-semibold">
                        {isCloudflare && (
                          <button
                            type="button"
                            onClick={() => handleRouteChange('tunnel')}
                            className={cn(
                              "px-2.5 py-1 rounded-md transition-all flex items-center gap-1",
                              streamRoute === 'tunnel' ? "bg-background text-primary font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
                            )}
                          >
                            <Globe className="w-3.5 h-3.5" /> Cloudflare Link (Anywhere)
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleRouteChange('lan_https')}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all flex items-center gap-1",
                            streamRoute === 'lan_https' ? "bg-background text-emerald-600 dark:text-emerald-400 font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" /> LAN HTTPS (:8443)
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRouteChange('lan_http')}
                          className={cn(
                            "px-2.5 py-1 rounded-md transition-all",
                            streamRoute === 'lan_http' ? "bg-background text-foreground font-bold shadow-sm" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          LAN HTTP (:8000)
                        </button>
                      </div>
                      <Button size="icon" variant="outline" className="h-7 w-7" onClick={generatePhoneQr} title="Regenerate QR" disabled={loading}>
                        <RefreshCw className={cn("w-3.5 h-3.5", loading && "animate-spin")} />
                      </Button>
                    </div>

                    {/* QR Code Container */}
                    <div className="p-3 bg-white rounded-xl shadow border border-slate-200 inline-flex items-center justify-center">
                      <QRCodeSVG 
                        value={qrUrl} 
                        size={180} 
                        level="M" 
                        includeMargin={true}
                      />
                    </div>
                    
                    <div className="text-center space-y-1 max-w-sm">
                      <p className="text-xs font-bold text-foreground">
                        Scan with your Phone Camera (or Open Link Below)
                      </p>
                      {streamRoute === 'lan_https' && (
                        <p className="text-[11px] text-emerald-800 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 p-2 rounded-md border border-emerald-200 dark:border-emerald-800 text-left">
                          💡 <b>First Time:</b> Tap <i>"Advanced"</i> → <i>"Proceed"</i> to trust local SSL, then tap <b>"Allow"</b> for camera access.
                        </p>
                      )}
                      {streamRoute === 'tunnel' && (
                        <p className="text-[11px] text-sky-800 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/40 p-2 rounded-md border border-sky-200 dark:border-sky-800 text-left">
                          🌐 <b>Cloudflare Link:</b> Works on any network worldwide (5G, 4G, or Wi-Fi) with valid SSL!
                        </p>
                      )}
                    </div>

                    {/* Link Copy & Open */}
                    <div className="flex w-full items-center gap-2 max-w-md">
                      <Input value={qrUrl} readOnly className="text-xs font-mono bg-muted/40 text-foreground h-8" />
                      <Button size="icon" variant="outline" className="h-8 w-8 shrink-0" onClick={copyQrUrl} title="Copy Link">
                        {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                      </Button>
                      <a href={qrUrl} target="_blank" rel="noreferrer">
                        <Button size="icon" variant="secondary" className="h-8 w-8 shrink-0" title="Open Stream in New Tab">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </Button>
                      </a>
                    </div>

                    {/* Connection Status & Live Video Preview */}
                    <div className="w-full flex flex-col items-center pt-1">
                      {phoneConnected ? (
                        <div className="flex flex-col items-center gap-3 w-full">
                          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-300 dark:border-emerald-800">
                            <span className="w-2 h-2 rounded-full bg-emerald-600 animate-pulse"></span>
                            Phone Camera Connected & Streaming Live!
                          </div>
                          {activeCameraId && (
                            <div className="w-full max-w-sm aspect-video bg-black rounded-xl overflow-hidden border-2 border-emerald-500 shadow-lg relative mt-1">
                              <img 
                                src={`/api/cameras/${activeCameraId}/feed`} 
                                alt="Phone Live Stream" 
                                className="w-full h-full object-cover" 
                              />
                              <div className="absolute top-2 left-2 bg-black/75 backdrop-blur-xs text-white text-[10px] px-2 py-0.5 rounded font-medium flex items-center gap-1.5">
                                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                                LIVE FROM PHONE
                              </div>
                            </div>
                          )}

                          {/* Detected Phone Camera Telemetry Card */}
                          <div className="w-full max-w-sm bg-muted/50 border border-border rounded-lg p-2.5 text-xs flex flex-col gap-2 text-left">
                            <div className="font-semibold text-foreground flex items-center justify-between text-xs">
                              <span className="flex items-center gap-1.5">
                                <span>📱</span> Phone Camera Telemetry
                              </span>
                              <span className="text-emerald-600 dark:text-emerald-400 font-mono font-bold">
                                {phoneTelemetry?.fps ? `${phoneTelemetry.fps} FPS` : 'Online'}
                              </span>
                            </div>
                            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                              <div className="bg-background rounded p-1.5 border border-border/60">
                                <span className="block text-[9px] uppercase font-bold text-muted-foreground">Resolution</span>
                                <span className="font-mono font-semibold text-foreground">
                                  {phoneTelemetry?.resolution || (phoneTelemetry?.width ? `${phoneTelemetry.width}×${phoneTelemetry.height}` : '1280×720 (HD)')}
                                </span>
                              </div>
                              <div className="bg-background rounded p-1.5 border border-border/60">
                                <span className="block text-[9px] uppercase font-bold text-muted-foreground">Camera Lens</span>
                                <span className="font-semibold text-foreground">
                                  {phoneTelemetry?.lens || 'Back Camera'}
                                </span>
                              </div>
                              <div className="bg-background rounded p-1.5 border border-border/60">
                                <span className="block text-[9px] uppercase font-bold text-muted-foreground">Quality</span>
                                <span className="font-semibold text-foreground">
                                  {phoneTelemetry?.quality_preset || 'Standard HD'}
                                </span>
                              </div>
                              <div className="bg-background rounded p-1.5 border border-border/60">
                                <span className="block text-[9px] uppercase font-bold text-muted-foreground">Signal & Latency</span>
                                <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                  📶 {phoneTelemetry?.signal_bars ?? 5}/5 {phoneTelemetry?.rtt_ms > 0 ? `• ${phoneTelemetry.rtt_ms}ms` : ''}
                                </span>
                              </div>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-900 dark:text-amber-200 text-xs font-semibold border border-amber-300 dark:border-amber-800">
                          <span className="w-2 h-2 rounded-full bg-amber-600 animate-ping"></span>
                          Waiting for phone connection...
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>

              {qrUrl ? (
                <div className="flex gap-2">
                  <Button 
                    variant="outline"
                    className="flex-1"
                    onClick={() => {
                      setActiveCameraId(null);
                      setQrUrl('');
                      setQrData(null);
                      setPhoneConnected(false);
                    }}
                  >
                    Add Another Camera
                  </Button>
                  <Button 
                    className="flex-1 font-semibold bg-primary" 
                    onClick={handlePhoneDone}
                  >
                    ✓ Done & View Feed
                  </Button>
                </div>
              ) : null}
            </TabsContent>

            {/* TAB 3: NETWORK / IP / RTSP CAMERA */}
            <TabsContent value="network" className="space-y-4 mt-0">
              <div className="space-y-2">
                <Label className="text-xs font-semibold">Stream URL (RTSP / HTTP / MJPEG) *</Label>
                <Input 
                  placeholder="rtsp://192.168.1.100:554/stream" 
                  value={formData.url}
                  onChange={e => setFormData(p => ({...p, url: e.target.value}))}
                  className="bg-background text-sm font-mono"
                />
                
                {/* Helpful quick template pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                  <span className="text-[11px] text-muted-foreground">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, url: 'rtsp://admin:admin123@192.168.1.100:554/live' }))}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border font-mono"
                  >
                    RTSP Aisle Cam
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(p => ({ ...p, url: 'http://192.168.1.50:8080/video' }))}
                    className="text-[10px] px-2 py-0.5 rounded bg-muted hover:bg-muted/80 text-foreground border font-mono"
                  >
                    HTTP MJPEG Cam
                  </button>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  Supports RTSP H.264/H.265 streams, HTTP MJPEG feeds, and network video feeds.
                </p>
              </div>

              <div className="w-full aspect-video bg-slate-950 rounded-xl flex flex-col items-center justify-center border border-border text-slate-500 gap-2">
                <Network className="w-10 h-10 opacity-30 text-sky-400" />
                <span className="text-xs text-slate-400 font-medium">IP Network Camera Feed</span>
                <span className="text-[10px] text-slate-500">Will connect via OpenCV backend ingestion</span>
              </div>

              <Button 
                className="w-full font-semibold gap-2" 
                onClick={() => handleSubmit('network')}
                disabled={loading}
              >
                <Network className="w-4 h-4" />
                {loading ? 'Connecting & Adding Camera...' : 'Add Network Camera'}
              </Button>
            </TabsContent>
          </div>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
