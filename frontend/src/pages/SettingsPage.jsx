import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Input } from '../components/ui/input';
import { Button } from '../components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { toast } from 'sonner';
import { ShieldCheck, Trash2, RefreshCw, Sparkles, Check, Database, Globe } from 'lucide-react';

export function SettingsPage() {
  const [threshold, setThreshold] = useState(() => {
    return parseFloat(localStorage.getItem('metaretail_threshold')) || 0.65;
  });
  const [saveUnknown, setSaveUnknown] = useState(() => {
    return localStorage.getItem('metaretail_save_unknown') !== 'false';
  });
  const [soundAlerts, setSoundAlerts] = useState(() => {
    return localStorage.getItem('metaretail_sound_alerts') === 'true';
  });
  const [resPreset, setResPreset] = useState(() => {
    return localStorage.getItem('metaretail_res_preset') || '720p';
  });

  const [health, setHealth] = useState(null);
  const [isCleaning, setIsCleaning] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    fetch('/api/health')
      .then(res => res.json())
      .then(setHealth)
      .catch(() => setHealth({ status: 'offline' }));
  }, []);

  const handleSaveSettings = () => {
    localStorage.setItem('metaretail_threshold', threshold.toString());
    localStorage.setItem('metaretail_save_unknown', saveUnknown.toString());
    localStorage.setItem('metaretail_sound_alerts', soundAlerts.toString());
    localStorage.setItem('metaretail_res_preset', resPreset);
    toast.success('System preferences saved successfully');
  };

  const handleCleanupCameras = async () => {
    if (!confirm('This will delete offline/disconnected cameras from the system. Active streaming cameras will NOT be affected. Proceed?')) return;
    setIsCleaning(true);
    try {
      const res = await fetch('/api/maintenance/cleanup-cameras', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        toast.success(`Cleanup complete! Removed ${data.deleted_cameras} offline cameras.`);
      } else {
        throw new Error('Cleanup failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsCleaning(false);
    }
  };

  const handleResetData = async () => {
    if (!confirm('WARNING: This will reset event logs, customer interactions, and test history. Your registered products and active cameras will be preserved. Proceed?')) return;
    setIsResetting(true);
    try {
      const res = await fetch('/api/maintenance/reset-demo-data', { method: 'POST' });
      if (res.ok) {
        toast.success('Analytics and event history reset successfully');
      } else {
        throw new Error('Reset failed');
      }
    } catch (e) {
      toast.error(e.message);
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">System Settings</h2>
          <p className="text-muted-foreground text-sm">Configure AI vision pipeline parameters, stream quality defaults, and database maintenance.</p>
        </div>
        <Button onClick={handleSaveSettings} className="gap-2">
          <Check className="w-4 h-4" /> Save Preferences
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Detection Settings */}
        <Card className="border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">AI Detection & Classification</CardTitle>
            <CardDescription className="text-sm">Configure confidence filtering for YOLOv8 bounding boxes and ViT embeddings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <div className="flex justify-between items-center max-w-sm">
                <Label className="font-semibold text-foreground">Confidence Threshold</Label>
                <span className="font-mono text-sm font-bold text-primary">{Math.round(threshold * 100)}%</span>
              </div>
              <div className="flex items-center gap-4 max-w-sm">
                <Input 
                  type="range" 
                  min={0.3} 
                  max={0.95} 
                  step={0.05} 
                  value={threshold} 
                  onChange={e => setThreshold(parseFloat(e.target.value))}
                  className="flex-1 cursor-pointer"
                />
                <Input 
                  type="number" 
                  min={0.3} 
                  max={0.95} 
                  step={0.05} 
                  value={threshold} 
                  onChange={e => setThreshold(parseFloat(e.target.value))}
                  className="w-20 font-mono text-center h-9"
                />
              </div>
              <p className="text-xs text-muted-foreground">Detections with confidence below this score will be ignored to prevent false alarms.</p>
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-foreground">Save Unknown Interactions</Label>
                <p className="text-xs text-muted-foreground">Store video crops of unrecognized items for review.</p>
              </div>
              <Switch checked={saveUnknown} onCheckedChange={setSaveUnknown} />
            </div>

            <div className="flex items-center justify-between py-3 border-t">
              <div className="space-y-0.5">
                <Label className="text-sm font-semibold text-foreground">Audible Shelf Event Alerts</Label>
                <p className="text-xs text-muted-foreground">Play gentle chime when item is removed from shelf or critical alert fires.</p>
              </div>
              <Switch checked={soundAlerts} onCheckedChange={setSoundAlerts} />
            </div>

            <div className="py-3 border-t space-y-2 max-w-sm">
              <Label className="text-sm font-semibold text-foreground">Default Camera Stream Resolution</Label>
              <Select value={resPreset} onValueChange={setResPreset}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Resolution" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1080p">1080p Full HD (1920×1080)</SelectItem>
                  <SelectItem value="720p">720p HD (1280×720 - Recommended)</SelectItem>
                  <SelectItem value="480p">480p SD (854×480 - Low Latency)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Database & System Maintenance */}
        <Card className="border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">System Cleanliness & Maintenance</CardTitle>
            <CardDescription className="text-sm">Clean up test data, delete offline camera clutter, and maintain database health.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-muted/30 border">
              <div>
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Trash2 className="w-4 h-4 text-primary" /> Clean Up Offline Cameras
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  Removes offline test cameras and stale connection entries from previous test runs.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleCleanupCameras}
                disabled={isCleaning}
                className="shrink-0"
              >
                {isCleaning ? 'Cleaning...' : 'Clean Test Cameras'}
              </Button>
            </div>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl bg-muted/30 border">
              <div>
                <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                  <Database className="w-4 h-4 text-amber-500" /> Reset Event & Analytics History
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
                  Clears out test interactions and event audit logs to give you a pristine analytics dashboard.
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleResetData}
                disabled={isResetting}
                className="shrink-0 text-amber-700 hover:text-amber-800 border-amber-300 dark:text-amber-400"
              >
                {isResetting ? 'Resetting...' : 'Reset History'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cloudflare Tunnel Management */}
        <Card className="border bg-card shadow-xs">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-bold text-foreground flex items-center gap-2">
                  <Globe className="w-4 h-4 text-primary" /> Cloudflare Public Tunnel
                </CardTitle>
                <CardDescription className="text-sm">
                  Zero-config public HTTPS URL with valid Cloudflare SSL. Stream mobile phone cameras globally over 5G without router port forwarding.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-muted/30 border">
              <div>
                <p className="text-xs text-foreground/70 font-semibold">Global Tunnel Status</p>
                <p className="font-bold text-sm text-foreground flex items-center gap-2 mt-0.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  trycloudflare.com Remote Gateway Ready
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Access via Header status pill or launch directly from terminal using <code className="text-[11px] font-mono bg-muted px-1.5 py-0.5 rounded">tools/cloudflared tunnel --url http://localhost:8000</code>.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Service Status */}
        <Card className="border bg-card shadow-xs">
          <CardHeader>
            <CardTitle className="text-base font-bold text-foreground">Backend & AI Engine Status</CardTitle>
            <CardDescription className="text-sm">Live health telemetry from MetaRetail inference workers.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between py-2 border-b text-sm">
              <span className="font-medium text-muted-foreground">FastAPI Engine</span>
              <span className="text-emerald-700 dark:text-emerald-400 font-semibold flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"/>
                {health?.status === 'healthy' ? 'Online & Healthy' : (health?.status || 'Connecting...')}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b text-sm">
              <span className="font-medium text-muted-foreground">Vision AI Pipeline</span>
              <span className="font-semibold text-foreground">YOLOv8 ByteTrack + ViT Multi-Crop</span>
            </div>
            <div className="flex justify-between py-2 border-b text-sm">
              <span className="font-medium text-muted-foreground">Dual Streaming Server</span>
              <span className="font-mono text-xs font-semibold text-foreground">HTTP: 8000 / HTTPS: 8443</span>
            </div>
            <div className="flex justify-between py-2 text-sm">
              <span className="font-medium text-muted-foreground">Version</span>
              <span className="font-mono text-xs font-semibold text-foreground">1.0.0 (Production)</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
