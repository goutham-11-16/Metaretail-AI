import React from 'react';
import { Camera } from 'lucide-react';
import { LiveCameraCard } from '../widgets/LiveCameraCard';
import { EmptyState } from '../widgets/EmptyState';
import { Button } from '../ui/button';

export function CameraGrid({ cameras = [], onCameraSelect, onAddCamera, onCameraDelete }) {
  if (!cameras || cameras.length === 0) {
    return (
      <EmptyState
        icon={Camera}
        title="No cameras configured"
        description="Add a camera to start monitoring your store zones."
        action={
          onAddCamera && (
            <Button onClick={onAddCamera}>Add First Camera</Button>
          )
        }
        className="h-[400px]"
      />
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
      {cameras.map((camera) => (
        <div key={camera.id} className="cursor-pointer transition-transform hover:scale-[1.02]" onClick={() => onCameraSelect(camera.id)}>
          <LiveCameraCard
            camera={camera}
            cameraId={camera.id}
            name={camera.name}
            status={camera.status || 'OFFLINE'}
            zone={camera.zone_name || 'Unassigned'}
            resolution={camera.resolution}
            fps={camera.fps}
            quality_preset={camera.quality_preset}
            lens={camera.lens}
            onDelete={onCameraDelete}
          />
        </div>
      ))}
    </div>
  );
}
