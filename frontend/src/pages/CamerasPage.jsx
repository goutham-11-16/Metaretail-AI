import React, { useState, useEffect } from 'react';
import { Camera, Plus, LayoutGrid, Grid3X3, Maximize2, Shield, RefreshCw, Sparkles, Download } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { CameraGrid } from '../components/cameras/CameraGrid';
import { LiveCameraCard } from '../components/widgets/LiveCameraCard';
import { AddCameraDialog } from '../components/cameras/AddCameraDialog';
import { CameraFullView } from '../components/cameras/CameraFullView';
import { HumanMotionLabModal } from '../components/cameras/HumanMotionLabModal';

export function CamerasPage() {
  const [cameras, setCameras] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [isLabOpen, setIsLabOpen] = useState(false);
  const [selectedCameraId, setSelectedCameraId] = useState(null);
  const [matrixMode, setMatrixMode] = useState('grid'); // 'grid' | '2x2' | '3x3' | 'cctv_wall'

  const fetchCameras = async () => {
    try {
      const res = await fetch('/api/cameras');
      if (res.ok) {
        setCameras(await res.json());
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCameras();
    const interval = setInterval(fetchCameras, 3500);
    return () => clearInterval(interval);
  }, []);

  const handleCameraAdded = (newCam) => {
    if (newCam && newCam.id) {
      setCameras(prev => {
        if (prev.some(c => c.id === newCam.id)) {
          return prev.map(c => c.id === newCam.id ? { ...c, ...newCam } : c);
        }
        return [...prev, newCam];
      });
    }
    fetchCameras();
  };

  const handleDeleteCamera = async (id) => {
    if (!confirm('Are you sure you want to remove this camera?')) return;
    try {
      const res = await fetch(`/api/cameras/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Camera removed');
        setCameras(prev => prev.filter(c => c.id !== id));
      } else {
        throw new Error('Failed to delete camera');
      }
    } catch (e) {
      toast.error(e.message);
    }
  };

  const getMatrixGridClass = () => {
    switch (matrixMode) {
      case '2x2':
        return 'grid grid-cols-1 md:grid-cols-2 gap-4';
      case '3x3':
        return 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3';
      case 'cctv_wall':
        return 'grid grid-cols-1 lg:grid-cols-3 gap-4';
      default:
        return 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6';
    }
  };

  return (
    <div className="space-y-6 pb-12">
      {/* Header with Matrix Mode Toggles */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Vision Sensors & Multi-Cam Matrix</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> Live CCTV Hub
            </Badge>
          </div>
          <p className="text-sm text-foreground/80 font-medium">
            Synchronized camera telemetry, automated object detection, and multi-angle security matrix wall ({cameras.length} active).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Matrix View Selector */}
          <div className="inline-flex rounded-lg border border-border p-1 bg-muted/50 text-xs font-semibold">
            <button
              onClick={() => setMatrixMode('grid')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                matrixMode === 'grid' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/70 hover:text-foreground'
              }`}
              title="Standard Feed Grid"
            >
              <LayoutGrid className="h-3.5 w-3.5" /> Grid
            </button>
            <button
              onClick={() => setMatrixMode('2x2')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                matrixMode === '2x2' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/70 hover:text-foreground'
              }`}
              title="2x2 CCTV Matrix"
            >
              <Grid3X3 className="h-3.5 w-3.5" /> 2×2 Matrix
            </button>
            <button
              onClick={() => setMatrixMode('cctv_wall')}
              className={`px-3 py-1.5 rounded-md transition-all flex items-center gap-1.5 ${
                matrixMode === 'cctv_wall' ? 'bg-background shadow-sm text-foreground' : 'text-foreground/70 hover:text-foreground'
              }`}
              title="Perimeter Security Wall"
            >
              <Shield className="h-3.5 w-3.5 text-primary" /> CCTV Wall
            </button>
          </div>

          <Button 
            variant="outline"
            onClick={() => setIsLabOpen(true)}
            className="gap-2 font-semibold border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 shadow-xs"
          >
            <Sparkles className="w-4 h-4 text-emerald-500 animate-pulse" />
            Human Motion Lab
          </Button>

          <Button onClick={() => setIsAddOpen(true)} className="gap-2 font-semibold">
            <Plus className="w-4 h-4" />
            Add Camera
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-foreground/70 font-medium">
          Loading camera feeds...
        </div>
      ) : matrixMode === 'grid' ? (
        <CameraGrid 
          cameras={cameras} 
          onCameraSelect={setSelectedCameraId}
          onAddCamera={() => setIsAddOpen(true)}
          onCameraDelete={handleDeleteCamera}
        />
      ) : (
        <div className={getMatrixGridClass()}>
          {cameras.length === 0 ? (
            <div className="col-span-full py-12 text-center text-foreground/70">
              No active cameras connected for matrix view.
            </div>
          ) : (
            cameras.map((camera, index) => (
              <div 
                key={camera.id}
                className={matrixMode === 'cctv_wall' && index === 0 ? 'lg:col-span-2 lg:row-span-2' : ''}
              >
                <LiveCameraCard 
                  camera={camera} 
                  onClick={() => setSelectedCameraId(camera.id)}
                  onDelete={handleDeleteCamera}
                />
              </div>
            ))
          )}
        </div>
      )}

      <AddCameraDialog 
        open={isAddOpen} 
        onOpenChange={setIsAddOpen}
        onCameraAdded={handleCameraAdded}
      />

      <CameraFullView 
        cameraId={selectedCameraId}
        open={!!selectedCameraId}
        onClose={() => setSelectedCameraId(null)}
      />

      <HumanMotionLabModal
        open={isLabOpen}
        onClose={() => setIsLabOpen(false)}
      />
    </div>
  );
}
