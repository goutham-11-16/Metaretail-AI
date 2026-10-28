import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Progress } from '../components/ui/progress';
import { Layers, AlertTriangle, CheckCircle2, RefreshCw, Plus, ArrowUpRight, Sparkles, Box, ShieldCheck, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';

export function PlanogramPage() {
  const [zones, setZones] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedAisle, setSelectedAisle] = useState('ALL');

  const fetchData = async () => {
    try {
      const [zonesRes, prodsRes] = await Promise.all([
        fetch('/api/zones'),
        fetch('/api/products')
      ]);

      if (zonesRes.ok && prodsRes.ok) {
        setZones(await zonesRes.json());
        setProducts(await prodsRes.json());
      }
    } catch (err) {
      console.error('Failed to load planogram data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 4500);
    return () => clearInterval(interval);
  }, []);

  const handleRestock = async (productId, currentStock) => {
    try {
      const newStock = (currentStock || 0) + 10;
      const res = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ current_stock: newStock })
      });
      if (res.ok) {
        toast.success(`Restocked +10 units (New Total: ${newStock})`);
        fetchData();
      } else {
        toast.error('Failed to restock item');
      }
    } catch (err) {
      toast.error('Network error during restock');
    }
  };

  // Group products by assigned zone or category
  const filteredProducts = selectedAisle === 'ALL'
    ? products
    : products.filter(p => (p.category || '').toLowerCase().includes(selectedAisle.toLowerCase()));

  const totalSlots = products.length;
  const lowStockCount = products.filter(p => (p.current_stock ?? 10) <= 3).length;
  const outOfStockCount = products.filter(p => (p.current_stock ?? 10) === 0).length;
  const healthyCount = totalSlots - lowStockCount;

  return (
    <div className="space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Smart Shelf Planogram & Inventory Health</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> Live Vision Shelf Sync
            </Badge>
          </div>
          <p className="text-sm text-foreground/80 font-medium">
            Slot-level planogram compliance, virtual weight & camera inventory reconciliation, and automated restocking queues.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-2 font-medium">
            <RefreshCw className="h-3.5 w-3.5" /> Reconcile Shelves
          </Button>
        </div>
      </div>

      {/* KPI Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Planogram Slots</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{totalSlots}</h3>
              <span className="text-[11px] text-muted-foreground">Active shelf locations</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Optimal Fill</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{healthyCount}</h3>
              <span className="text-[11px] text-emerald-500 font-medium">{totalSlots > 0 ? Math.round((healthyCount / totalSlots) * 100) : 100}% compliance</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Low Stock Risk</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{lowStockCount}</h3>
              <span className="text-[11px] text-amber-500 font-medium">≤ 3 units on shelf</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border shadow-sm">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center font-bold">
              <Box className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Empty Slots</p>
              <h3 className="text-2xl font-bold text-foreground mt-0.5">{outOfStockCount}</h3>
              <span className="text-[11px] text-rose-500 font-medium">Needs immediate restock</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Aisle Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        {['ALL', 'Beverage', 'Snack', 'Fresh', 'Electronics'].map((aisle) => (
          <button
            key={aisle}
            onClick={() => setSelectedAisle(aisle)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all shrink-0 ${
              selectedAisle === aisle
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:text-foreground'
            }`}
          >
            {aisle === 'ALL' ? 'All Aisles' : `${aisle} Shelf Bay`}
          </button>
        ))}
      </div>

      {/* Shelf Rack Planogram Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredProducts.map((prod) => {
          const stock = prod.current_stock ?? 10;
          const capacity = 15;
          const fillPct = Math.min(100, Math.round((stock / capacity) * 100));
          const isLow = stock <= 3 && stock > 0;
          const isOut = stock === 0;

          return (
            <Card key={prod.id} className="border-border shadow-sm overflow-hidden flex flex-col justify-between">
              <div>
                {/* Visual Shelf Header */}
                <div className="p-3 bg-muted/30 border-b flex items-center justify-between">
                  <span className="text-[11px] font-mono font-bold text-muted-foreground uppercase">
                    SLOT #{prod.id.toString().padStart(3, '0')}
                  </span>
                  <Badge 
                    variant="outline" 
                    className={
                      isOut ? "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-[10px]" :
                      isLow ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 text-[10px]" :
                      "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px]"
                    }
                  >
                    {isOut ? "OUT OF STOCK" : isLow ? "LOW STOCK" : "OPTIMAL"}
                  </Badge>
                </div>

                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 rounded-lg border bg-muted/20 flex items-center justify-center overflow-hidden shrink-0">
                      {prod.image_url ? (
                        <img src={prod.image_url} alt={prod.name} className="w-full h-full object-cover" />
                      ) : (
                        <Box className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-semibold text-sm text-foreground truncate" title={prod.name}>
                        {prod.name}
                      </h4>
                      <p className="text-xs text-muted-foreground capitalize mt-0.5">{prod.category || 'General'}</p>
                      <p className="text-xs font-mono font-bold text-primary mt-1">₹{Number(prod.price || 0).toFixed(2)}</p>
                    </div>
                  </div>

                  {/* Stock Fill Level Bar */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Shelf Capacity</span>
                      <span className="font-semibold text-foreground">{stock} / {capacity} units ({fillPct}%)</span>
                    </div>
                    <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all ${
                          isOut ? 'bg-rose-500' : isLow ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${fillPct}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Action Footer */}
              <div className="p-3 bg-muted/20 border-t flex items-center justify-between gap-2">
                <span className="text-[11px] text-muted-foreground font-mono">
                  BARCODE: {prod.barcode || 'N/A'}
                </span>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleRestock(prod.id, stock)}
                  className="h-8 text-xs font-semibold gap-1.5 border-primary/30 hover:bg-primary/10 text-primary"
                >
                  <Plus className="w-3.5 h-3.5" /> Restock +10
                </Button>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
