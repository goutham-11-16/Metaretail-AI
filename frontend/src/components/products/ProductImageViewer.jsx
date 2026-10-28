import React, { useState, useRef } from 'react';
import { Package, Upload, Plus, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { cn } from '../../lib/utils';

const ANGLES = ['Front', 'Back', 'Left', 'Right', 'Top'];

export function ProductImageViewer({ productId, images = [], onImageUploaded }) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedAngle, setSelectedAngle] = useState('Front');
  const fileInputRef = useRef(null);

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !productId) return;

    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('angle', selectedAngle);

      const res = await fetch(`/api/products/${productId}/images`, {
        method: 'POST',
        body: formData
      });

      if (res.ok) {
        toast.success(`Uploaded and indexed ${selectedAngle} view for AI recognition!`);
        if (onImageUploaded) onImageUploaded();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.detail || 'Failed to upload photo');
      }
    } catch (err) {
      toast.error('Network error uploading photo');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedImage = images && images.length > 0 ? images[selectedIndex] : null;

  return (
    <div className="flex flex-col space-y-4 w-full">
      {/* Main Image or Empty State */}
      {selectedImage ? (
        <div className="relative w-full aspect-square rounded-lg overflow-hidden border bg-background group">
          <img 
            src={selectedImage.image_path || selectedImage.dataUrl} 
            alt={`Product angle: ${selectedImage.angle}`}
            className="w-full h-full object-contain transition-transform duration-300 group-hover:scale-105"
          />
          <div className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2.5 py-1 rounded-md backdrop-blur font-medium">
            {selectedImage.angle} View
          </div>
        </div>
      ) : (
        <div className="w-full aspect-square bg-secondary/50 rounded-lg flex flex-col items-center justify-center text-muted-foreground border border-dashed p-6 text-center">
          <Package className="w-16 h-16 mb-3 opacity-25" />
          <p className="text-sm font-semibold text-foreground mb-1">No reference photos yet</p>
          <p className="text-xs text-muted-foreground mb-4">Add photos so the AI vision system can recognize this product</p>
          <Button 
            size="sm" 
            variant="default"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="gap-1.5 text-xs"
          >
            <Upload className="w-3.5 h-3.5" /> Upload First Photo
          </Button>
        </div>
      )}

      {/* Thumbnail Strip */}
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 snap-x">
          {images.map((img, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedIndex(idx)}
              className={cn(
                "relative flex-shrink-0 w-16 h-16 rounded-md overflow-hidden border-2 snap-start transition-all",
                selectedIndex === idx ? "border-primary shadow-sm" : "border-transparent hover:border-primary/50 opacity-70 hover:opacity-100"
              )}
            >
              <img 
                src={img.image_path || img.dataUrl} 
                alt={img.angle}
                className="w-full h-full object-cover"
              />
              <div className="absolute bottom-0 left-0 right-0 bg-black/70 text-[9px] text-white text-center py-0.5">
                {img.angle}
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Add Another Reference Photo Action Bar */}
      <div className="flex items-center justify-between border-t pt-3 gap-2">
        <input 
          ref={fileInputRef}
          type="file" 
          accept="image/*" 
          className="hidden" 
          onChange={handleFileChange}
        />
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-medium">Angle:</span>
          <select
            value={selectedAngle}
            onChange={(e) => setSelectedAngle(e.target.value)}
            className="text-xs border rounded px-2 py-1 bg-background text-foreground cursor-pointer"
          >
            {ANGLES.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <Button 
          size="sm" 
          variant="outline"
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="gap-1.5 text-xs font-medium"
        >
          {isUploading ? (
            <span className="animate-spin text-xs">⏳</span>
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          {images.length > 0 ? '+ Add Angle Photo' : 'Upload Photo'}
        </Button>
      </div>
    </div>
  );
}

