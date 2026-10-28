import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Camera, X, Check, Keyboard } from 'lucide-react';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

export function BarcodeScanner({ onScan, onManualEntry, onClose }) {
  const videoRef = useRef(null);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [scanning, setScanning] = useState(true);

  useEffect(() => {
    let stream = null;
    let scanInterval = null;

    const startCamera = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: 'environment' } 
        });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (err) {
        setError('Camera access denied or unavailable.');
        console.error('Camera access error:', err);
      }
    };

    const processFrame = async () => {
      if (!videoRef.current || !scanning) return;
      
      try {
        if ('BarcodeDetector' in window) {
          const barcodeDetector = new window.BarcodeDetector({ formats: ['ean_13', 'upc_a', 'code_128', 'qr_code'] });
          const barcodes = await barcodeDetector.detect(videoRef.current);
          if (barcodes.length > 0) {
            handleScanSuccess(barcodes[0].rawValue);
          }
        } else {
          // Fallback: capture frame and send to backend
          const canvas = document.createElement('canvas');
          canvas.width = videoRef.current.videoWidth;
          canvas.height = videoRef.current.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(videoRef.current, 0, 0, canvas.width, canvas.height);
          
          canvas.toBlob(async (blob) => {
            if (!blob) return;
            const formData = new FormData();
            formData.append('frame', blob, 'frame.jpg');
            
            try {
              const response = await fetch('/api/products/scan-barcode', {
                method: 'POST',
                body: formData
              });
              if (response.ok) {
                const data = await response.json();
                if (data.barcode) {
                  handleScanSuccess(data.barcode);
                }
              }
            } catch (err) {
              // Silently fail and retry
            }
          }, 'image/jpeg');
        }
      } catch (err) {
        console.error('Barcode detection error:', err);
      }
    };

    if (scanning && !success) {
      startCamera();
      // Only process frames when stream is ready and video is playing
      scanInterval = setInterval(() => {
        if (videoRef.current?.readyState === videoRef.current?.HAVE_ENOUGH_DATA) {
          processFrame();
        }
      }, 500);
    }

    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      if (scanInterval) {
        clearInterval(scanInterval);
      }
    };
  }, [scanning, success]);

  const handleScanSuccess = useCallback((barcode) => {
    setScanning(false);
    setSuccess(true);
    setTimeout(() => {
      onScan(barcode);
    }, 1000);
  }, [onScan]);

  return (
    <div className="relative w-full max-w-md mx-auto overflow-hidden bg-black rounded-lg aspect-[3/4] sm:aspect-square flex flex-col items-center justify-center">
      {onClose && (
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-2 right-2 z-50 text-white hover:bg-black/50"
          onClick={onClose}
        >
          <X className="w-6 h-6" />
        </Button>
      )}

      {error ? (
        <div className="text-center text-white p-6">
          <Camera className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <p className="text-destructive mb-4">{error}</p>
          <Button onClick={onManualEntry} variant="outline" className="w-full">
            <Keyboard className="w-4 h-4 mr-2" />
            Enter manually
          </Button>
        </div>
      ) : (
        <>
          <video 
            ref={videoRef}
            autoPlay 
            playsInline 
            muted 
            className={cn("absolute inset-0 w-full h-full object-cover", success && "opacity-50")}
          />
          
          {!success && (
            <div className="absolute inset-0 pointer-events-none border-[40px] border-black/40">
              <div className="w-full h-full border-2 border-primary/50 relative">
                {/* Corner markers */}
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary -translate-x-0.5 -translate-y-0.5"></div>
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary translate-x-0.5 -translate-y-0.5"></div>
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary -translate-x-0.5 translate-y-0.5"></div>
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary translate-x-0.5 translate-y-0.5"></div>
                
                {/* Scanning line animation */}
                <div className="absolute top-0 left-0 w-full h-0.5 bg-primary/80 animate-scan shadow-[0_0_8px_2px_rgba(var(--primary),0.5)]"></div>
              </div>
            </div>
          )}

          {success && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10 animate-in fade-in duration-300">
              <div className="bg-primary text-primary-foreground p-4 rounded-full">
                <Check className="w-12 h-12" />
              </div>
            </div>
          )}

          {!success && (
            <div className="absolute bottom-6 left-0 right-0 px-6 z-20">
              <Button onClick={onManualEntry} variant="secondary" className="w-full bg-background/80 backdrop-blur">
                <Keyboard className="w-4 h-4 mr-2" />
                Enter manually
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
