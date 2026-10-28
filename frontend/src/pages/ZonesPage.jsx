import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Trash2, Camera, Package, ChevronDown, X, Activity, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/widgets/EmptyState';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';

export function ZonesPage() {
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', description: '', location: '' });

  const [availableCameras, setAvailableCameras] = useState([]);
  const [availableProducts, setAvailableProducts] = useState([]);

  // Assignment dialog states
  const [assignZone, setAssignZone] = useState(null);
  const [assignType, setAssignType] = useState(null); // 'camera' or 'product'
  const [selectedItemId, setSelectedItemId] = useState('');

  const fetchData = async () => {
    try {
      const [zonesRes, camsRes, prodsRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/cameras'),
        fetch('/api/products')
      ]);
      if (zonesRes.ok) setZones(await zonesRes.json());
      if (camsRes.ok) setAvailableCameras(await camsRes.json());
      if (prodsRes.ok) setAvailableProducts(await prodsRes.json());
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const timer = setInterval(fetchData, 4000);
    return () => clearInterval(timer);
  }, []);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/zones', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newZone)
      });
      if (res.ok) {
        toast.success('Zone created');
        setIsCreateOpen(false);
        setNewZone({ name: '', description: '', location: '' });
        fetchData();
      } else {
        throw new Error('Failed to create zone');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this zone?')) return;
    try {
      const res = await fetch(`/api/zones/${id}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Zone deleted');
        fetchData();
      } else {
        throw new Error('Failed to delete zone');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleAssign = async () => {
    if (!selectedItemId || !assignZone) return;
    
    try {
      const url = assignType === 'camera' 
        ? `/api/zones/${assignZone.id}/cameras` 
        : `/api/zones/${assignZone.id}/products`;
        
      const body = assignType === 'camera' 
        ? { camera_id: selectedItemId } 
        : { product_id: selectedItemId };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      
      if (res.ok) {
        toast.success(`${assignType === 'camera' ? 'Camera' : 'Product'} assigned`);
        setAssignZone(null);
        setSelectedItemId('');
        fetchData();
      } else {
        throw new Error('Assignment failed');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleUnassignCamera = async (zoneId, cameraId) => {
    try {
      const res = await fetch(`/api/zones/${zoneId}/cameras/${cameraId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Camera unassigned from zone');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to unassign camera');
    }
  };

  const handleUnassignProduct = async (zoneId, productId) => {
    try {
      const res = await fetch(`/api/zones/${zoneId}/products/${productId}`, { method: 'DELETE' });
      if (res.ok) {
        toast.success('Product unassigned from zone');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to unassign product');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Store Zones</h2>
          <p className="text-muted-foreground text-sm">Configure physical store layout, monitored shelf zones, and vision sensor coverage.</p>
        </div>
        <Button onClick={() => setIsCreateOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Create Zone
        </Button>
      </div>
      
      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading zones...</div>
      ) : zones.length === 0 ? (
        <EmptyState 
          icon={MapPin}
          title="No zones created yet"
          description="Zones help you group physical shelf areas, camera angles, and product inventory."
          action={<Button variant="outline" onClick={() => setIsCreateOpen(true)}><Plus className="w-4 h-4 mr-2"/> Create Zone</Button>}
          className="h-[400px]"
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {zones.map(zone => {
            const activeCamsCount = (zone.cameras || []).filter(c => c.status === 'LIVE' || c.status === 'ONLINE').length;
            const totalStock = (zone.products || []).reduce((acc, p) => acc + (p.stock || 0), 0);

            return (
              <div key={zone.id} className="bg-card border rounded-xl overflow-hidden flex flex-col shadow-xs transition-shadow hover:shadow-md">
                <div className="p-4 border-b flex justify-between items-start bg-muted/40">
                  <div>
                    <h3 className="font-bold text-base text-foreground flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-primary" /> {zone.name}
                    </h3>
                    {zone.location && <p className="text-xs text-muted-foreground mt-0.5">{zone.location}</p>}
                  </div>
                  <Button variant="ghost" size="icon" className="hover:text-destructive -mr-2 text-muted-foreground" title="Delete Zone" onClick={() => handleDelete(zone.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="p-4 flex-1 space-y-5">
                  {zone.description && <p className="text-xs text-muted-foreground bg-muted/20 p-2.5 rounded-lg border border-border/60">{zone.description}</p>}

                  {/* Summary Metric Pills */}
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="bg-background rounded-lg p-2 border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Cameras</span>
                      <span className="font-semibold text-foreground flex items-center gap-1 mt-0.5">
                        <span className={`w-2 h-2 rounded-full ${activeCamsCount > 0 ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`} />
                        {activeCamsCount} Active / {zone.cameras?.length || 0}
                      </span>
                    </div>
                    <div className="bg-background rounded-lg p-2 border">
                      <span className="text-[10px] uppercase font-bold text-muted-foreground block">Shelf Stock</span>
                      <span className="font-semibold text-foreground font-mono mt-0.5 block">
                        {totalStock} items
                      </span>
                    </div>
                  </div>
                  
                  {/* Cameras Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Camera className="w-3.5 h-3.5 text-primary"/> Cameras ({zone.cameras?.length || 0})
                      </h4>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-primary font-semibold" onClick={() => { setAssignZone(zone); setAssignType('camera'); }}>
                        + Assign
                      </Button>
                    </div>
                    {zone.cameras && zone.cameras.length > 0 ? (
                      <div className="flex gap-2 flex-wrap">
                        {zone.cameras.map(c => (
                          <div key={c.id} className="bg-muted/80 pl-2 pr-1.5 py-1 rounded-md text-xs font-medium flex items-center gap-1.5 border shadow-2xs">
                            <div className={`w-2 h-2 rounded-full ${(c.status === 'LIVE' || c.status === 'ONLINE') ? 'bg-emerald-500 animate-pulse' : 'bg-slate-400'}`}></div>
                            <span className="text-foreground">{c.name}</span>
                            <button
                              type="button"
                              onClick={() => handleUnassignCamera(zone.id, c.id)}
                              className="ml-1 text-muted-foreground hover:text-destructive transition p-0.5 rounded"
                              title="Unassign camera"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-dashed text-center">No cameras assigned yet</div>
                    )}
                  </div>

                  {/* Products Section */}
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <Package className="w-3.5 h-3.5 text-primary"/> Products ({zone.products?.length || 0})
                      </h4>
                      <Button variant="ghost" size="sm" className="h-6 text-xs px-2 text-primary font-semibold" onClick={() => { setAssignZone(zone); setAssignType('product'); }}>
                        + Assign
                      </Button>
                    </div>
                    {zone.products && zone.products.length > 0 ? (
                      <div className="space-y-1.5">
                        {zone.products.slice(0, 4).map(p => (
                          <div key={p.id} className="text-xs flex justify-between items-center p-1.5 rounded-md bg-muted/40 border border-border/40">
                            <span className="font-medium text-foreground truncate pr-2">{p.name}</span>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-muted-foreground font-mono text-[11px] font-semibold">{p.stock ?? 0} units</span>
                              <button
                                type="button"
                                onClick={() => handleUnassignProduct(zone.id, p.id)}
                                className="text-muted-foreground hover:text-destructive transition p-0.5 rounded"
                                title="Unassign product"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          </div>
                        ))}
                        {zone.products.length > 4 && (
                          <div className="text-xs text-center text-muted-foreground pt-0.5 font-medium">+{zone.products.length - 4} more products</div>
                        )}
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg border border-dashed text-center">No products assigned yet</div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create New Zone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Zone Name *</Label>
              <Input value={newZone.name} onChange={e => setNewZone({...newZone, name: e.target.value})} placeholder="e.g., Aisle 1 - Beverages" />
            </div>
            <div className="space-y-2">
              <Label>Location</Label>
              <Input value={newZone.location} onChange={e => setNewZone({...newZone, location: e.target.value})} placeholder="e.g., Ground Floor, North Wing" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Input value={newZone.description} onChange={e => setNewZone({...newZone, description: e.target.value})} placeholder="Optional description" />
            </div>
            <Button className="w-full" onClick={handleCreate} disabled={!newZone.name}>Create Zone</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Assign Dialog */}
      <Dialog open={!!assignZone} onOpenChange={(open) => !open && setAssignZone(null)}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Assign {assignType === 'camera' ? 'Camera' : 'Product'} to {assignZone?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="space-y-2">
              <Label>Select {assignType === 'camera' ? 'Camera' : 'Product'}</Label>
              <Select value={selectedItemId} onValueChange={setSelectedItemId}>
                <SelectTrigger>
                  <SelectValue placeholder={`Select ${assignType}...`} />
                </SelectTrigger>
                <SelectContent>
                  {assignType === 'camera' ? (
                    availableCameras.filter(c => !assignZone?.cameras?.find(zc => zc.id === c.id)).map(c => (
                      <SelectItem key={c.id} value={c.id.toString()}>{c.name}</SelectItem>
                    ))
                  ) : (
                    availableProducts.filter(p => !assignZone?.products?.find(zp => zp.id === p.id)).map(p => (
                      <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
            <Button className="w-full" onClick={handleAssign} disabled={!selectedItemId}>Assign</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
