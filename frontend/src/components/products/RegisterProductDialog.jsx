import React, { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { Package, ChevronRight, ChevronLeft, Check, AlertCircle } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { BarcodeScanner } from './BarcodeScanner';
import { ProductImageCapture } from './ProductImageCapture';

const CATEGORIES = ['Beverages', 'Snacks', 'Dairy', 'Bakery', 'Frozen', 'Personal Care', 'Household', 'Other'];

export function RegisterProductDialog({ open, onOpenChange, onProductRegistered }) {
  const [step, setStep] = useState(1);
  const [barcode, setBarcode] = useState('');
  const [images, setImages] = useState([]);
  const [zones, setZones] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: '',
    zone_id: '',
    sku: `SKU-${Date.now()}`,
    price: '',
    initialStock: '10',
    minStock: '5',
    description: ''
  });

  useEffect(() => {
    if (open) {
      fetch('/api/zones')
        .then(r => r.ok ? r.json() : [])
        .then(data => setZones(data))
        .catch(err => console.warn('Could not load zones:', err));
    }
  }, [open]);

  const handleScan = async (scannedBarcode) => {
    setBarcode(scannedBarcode);
    setFormData(prev => ({ ...prev, barcode: scannedBarcode }));
    
    // In a real app, this would be a GET request to lookup product details
    try {
      const response = await fetch(`/api/products/barcode/${scannedBarcode}`);
      if (response.ok) {
        const data = await response.json();
        setFormData(prev => ({
          ...prev,
          name: data.name || prev.name,
          category: data.category || prev.category,
          price: data.price || prev.price
        }));
        toast.success('Product details found!');
      } else {
        toast.info('Product not found, please enter details manually.');
      }
    } catch (err) {
      // Ignore errors for this mock
      toast.info('Enter product details manually.');
    }
    
    setStep(2);
  };

  const handleManualEntry = () => {
    // Take user to photo capture step so product has AI training images
    setStep(2);
  };

  const handleImagesComplete = (capturedImages) => {
    setImages(capturedImages);
    setStep(3);
  };


  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async () => {
    setIsSubmitting(true);
    try {
      // Create product payload compatible with schema
      const priceVal = parseFloat(formData.price) || 0.0;
      const stockVal = parseInt(formData.initialStock, 10) || 0;
      const minStockVal = parseInt(formData.minStock, 10) || 2;
      const payload = {
        name: formData.name.trim(),
        category: formData.category || 'General',
        sku: formData.sku?.trim() || `SKU-${Date.now()}`,
        barcode: barcode || formData.barcode || null,
        zone_id: formData.zone_id ? parseInt(formData.zone_id, 10) : null,
        price: priceVal,
        unit_price: priceVal,
        stock: stockVal,
        current_stock: stockVal,
        min_stock: minStockVal,
        min_stock_threshold: minStockVal,
        description: formData.description?.trim() || null
      };

      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        const errMsg = errJson.detail?.[0]?.msg || errJson.detail || 'Failed to create product';
        throw new Error(errMsg);
      }
      const product = await response.json();

      // Upload images
      for (const img of images) {
        const imageFormData = new FormData();
        imageFormData.append('file', img.blob, `${img.angle}.jpg`);
        imageFormData.append('angle', img.angle);
        
        await fetch(`/api/products/${product.id}/images`, {
          method: 'POST',
          body: imageFormData
        }).catch(err => console.error('Failed to upload image', err));
      }

      toast.success('Product registered successfully!');
      if (onProductRegistered) onProductRegistered(product);
      
      // Reset and close
      setStep(1);
      setBarcode('');
      setImages([]);
      setFormData({
        name: '', category: '', zone_id: '', sku: `SKU-${Date.now()}`, price: '', initialStock: '10', minStock: '5', description: ''
      });
      onOpenChange(false);
      
    } catch (error) {
      console.error(error);
      toast.error('Failed to register product: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between mb-4">
            <DialogTitle>Register New Product</DialogTitle>
            <div className="text-sm font-medium text-muted-foreground bg-secondary px-3 py-1 rounded-full">
              Step {step} of 4
            </div>
          </div>
          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
            <div 
              className="h-full bg-primary transition-all duration-300"
              style={{ width: `${(step / 4) * 100}%` }}
            />
          </div>
        </DialogHeader>

        <div className="mt-4">
          {step === 1 && (
            <div className="space-y-4">
              <DialogDescription>
                Scan the product barcode to automatically fetch details, or enter manually.
              </DialogDescription>
              <div className="flex justify-center p-4">
                <BarcodeScanner 
                  onScan={handleScan}
                  onManualEntry={handleManualEntry}
                />
              </div>
              <div className="flex justify-between">
                <Button variant="ghost" onClick={handleManualEntry}>Skip Barcode</Button>
                <Button onClick={() => setStep(2)}>Next <ChevronRight className="w-4 h-4 ml-2" /></Button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <DialogDescription>
                Capture multiple angles of the product to train the AI detection model.
              </DialogDescription>
              <ProductImageCapture 
                onComplete={handleImagesComplete}
                onBack={() => setStep(1)}
              />
            </div>
          )}

          {step === 3 && (
            <div className="space-y-4">
              <DialogDescription>
                Enter the product details and pricing information.
              </DialogDescription>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 space-y-2">
                  <Label htmlFor="name">Product Name *</Label>
                  <Input 
                    id="name" 
                    placeholder="e.g., Coca Cola 330ml" 
                    value={formData.name}
                    onChange={(e) => handleChange('name', e.target.value)}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={formData.category} onValueChange={(val) => handleChange('category', val)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      {CATEGORIES.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="zone">Store Aisle / Zone (Optional)</Label>
                  <Select 
                    value={formData.zone_id ? formData.zone_id.toString() : 'none'} 
                    onValueChange={(val) => handleChange('zone_id', val === 'none' ? '' : val)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Storewide / Any Zone" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Storewide / Any Zone</SelectItem>
                      {zones.map(z => (
                        <SelectItem key={z.id} value={z.id.toString()}>{z.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="price">Unit Price ($) *</Label>
                  <Input 
                    id="price" 
                    type="number" 
                    step="0.01" 
                    placeholder="0.00"
                    value={formData.price}
                    onChange={(e) => handleChange('price', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="sku">SKU</Label>
                  <Input 
                    id="sku" 
                    value={formData.sku}
                    onChange={(e) => handleChange('sku', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="barcode">Barcode</Label>
                  <Input 
                    id="barcode" 
                    value={barcode || formData.barcode}
                    onChange={(e) => {
                      setBarcode(e.target.value);
                      handleChange('barcode', e.target.value);
                    }}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="initialStock">Initial Stock</Label>
                  <Input 
                    id="initialStock" 
                    type="number" 
                    value={formData.initialStock}
                    onChange={(e) => handleChange('initialStock', e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="minStock">Min Threshold</Label>
                  <Input 
                    id="minStock" 
                    type="number" 
                    value={formData.minStock}
                    onChange={(e) => handleChange('minStock', e.target.value)}
                  />
                </div>
              </div>

              <div className="flex justify-between mt-6">
                <Button variant="outline" onClick={() => setStep(images.length ? 2 : 1)}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button 
                  onClick={() => setStep(4)}
                  disabled={!formData.name || !formData.category || !formData.price}
                >
                  Review <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="space-y-6">
              <div className="bg-secondary/50 rounded-lg p-6 border flex flex-col md:flex-row gap-6">
                <div className="w-full md:w-1/3 flex flex-col items-center justify-center gap-2">
                  {images.length > 0 ? (
                    <div className="relative w-full aspect-square rounded-md overflow-hidden bg-background">
                      <img src={images[0].dataUrl} alt="Product" className="object-cover w-full h-full" />
                      <div className="absolute bottom-2 right-2 bg-black/60 text-white text-xs px-2 py-1 rounded">
                        +{images.length - 1} photos
                      </div>
                    </div>
                  ) : (
                    <div className="w-full aspect-square bg-secondary rounded-md flex items-center justify-center text-muted-foreground">
                      <Package className="w-12 h-12 mb-2 opacity-50" />
                    </div>
                  )}
                </div>
                
                <div className="w-full md:w-2/3 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold">{formData.name}</h3>
                    <p className="text-sm text-muted-foreground">{formData.category}</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div>
                      <span className="text-muted-foreground block">Price</span>
                      <span className="font-medium">₹{parseFloat(formData.price || 0).toFixed(2)}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Stock</span>
                      <span className="font-medium">{formData.initialStock} units</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">SKU</span>
                      <span className="font-medium">{formData.sku}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground block">Barcode</span>
                      <span className="font-medium">{barcode || formData.barcode || 'N/A'}</span>
                    </div>
                    {formData.zone_id && (
                      <div className="col-span-2">
                        <span className="text-muted-foreground block">Store Aisle / Zone</span>
                        <span className="font-medium text-emerald-500">
                          {zones.find(z => z.id.toString() === formData.zone_id.toString())?.name || 'Assigned Zone'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(3)} disabled={isSubmitting}>
                  <ChevronLeft className="w-4 h-4 mr-2" /> Back
                </Button>
                <Button onClick={handleSubmit} disabled={isSubmitting} className="w-32">
                  {isSubmitting ? (
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                  ) : (
                    <Check className="w-4 h-4 mr-2" />
                  )}
                  Register
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
