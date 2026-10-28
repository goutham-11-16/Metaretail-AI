import React, { useState, useEffect } from 'react';
import { Clock, Filter, Package, Activity, Search } from 'lucide-react';
import { EmptyState } from '../components/widgets/EmptyState';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { cn } from '../lib/utils';

export function InteractionsPage() {
  const [interactions, setInteractions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState([]);
  
  // Filters
  const [actionFilter, setActionFilter] = useState('ALL');
  const [productFilter, setProductFilter] = useState('ALL');

  useEffect(() => {
    // Fetch products for filter
    fetch('/api/products').then(res => res.json()).then(setProducts).catch(console.error);
    
    // Fetch interactions with auto-polling
    const fetchTimeline = () => {
      fetch('/api/interactions/timeline')
        .then(res => res.json())
        .then(data => {
          setInteractions(data);
          setLoading(false);
        })
        .catch(err => {
          console.error(err);
          setLoading(false);
        });
    };

    fetchTimeline();
    const timer = setInterval(fetchTimeline, 3500);
    return () => clearInterval(timer);
  }, []);

  const filteredInteractions = interactions.filter(i => {
    if (actionFilter !== 'ALL' && i.action !== actionFilter) return false;
    if (productFilter !== 'ALL' && i.product_id?.toString() !== productFilter) return false;
    return true;
  });

  // Calculate stats
  const total = filteredInteractions.length;
  const replaced = filteredInteractions.filter(i => i.action === 'REPLACED').length;
  const replacementRate = total > 0 ? Math.round((replaced / total) * 100) : 0;
  
  const holdDurations = filteredInteractions.filter(i => i.hold_duration).map(i => i.hold_duration);
  const avgHold = holdDurations.length > 0 
    ? (holdDurations.reduce((a, b) => a + b, 0) / holdDurations.length).toFixed(1) 
    : 0;

  const getActionColor = (action) => {
    switch (action?.toUpperCase()) {
      case 'PICKED_UP':
      case 'PICKED UP': 
        return 'bg-blue-500/20 text-blue-300 border-blue-500/40';
      case 'REPLACED': 
        return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
      case 'TAKEN': 
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
      default: 
        return 'bg-slate-500/20 text-slate-300 border-slate-500/40';
    }
  };

  const getActionLabel = (action) => {
    return (action || 'UNKNOWN').replace('_', ' ');
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Interactions</h2>
        <p className="text-muted-foreground">Detailed timeline of customer-product engagements.</p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Total Interactions</p>
            <p className="text-2xl font-bold">{total}</p>
          </div>
          <div className="w-10 h-10 bg-primary/10 text-primary rounded-full flex items-center justify-center">
            <Activity className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Avg Hold Duration</p>
            <p className="text-2xl font-bold">{avgHold}s</p>
          </div>
          <div className="w-10 h-10 bg-blue-500/10 text-blue-500 rounded-full flex items-center justify-center">
            <Clock className="w-5 h-5" />
          </div>
        </div>
        <div className="bg-card border rounded-lg p-4 flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">Replacement Rate</p>
            <p className="text-2xl font-bold">{replacementRate}%</p>
          </div>
          <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 bg-card border rounded-lg p-2">
        <div className="flex-1 flex items-center gap-2 px-2">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium">Filters:</span>
        </div>
        <div className="w-full sm:w-48">
          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger><SelectValue placeholder="Action" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Actions</SelectItem>
              <SelectItem value="PICKED_UP">Picked Up</SelectItem>
              <SelectItem value="REPLACED">Replaced</SelectItem>
              <SelectItem value="TAKEN">Taken</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="w-full sm:w-64">
          <Select value={productFilter} onValueChange={setProductFilter}>
            <SelectTrigger><SelectValue placeholder="Product" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Products</SelectItem>
              {products.map(p => (
                <SelectItem key={p.id} value={p.id.toString()}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      {/* Timeline */}
      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">Loading timeline...</div>
      ) : filteredInteractions.length === 0 ? (
        <EmptyState icon={Clock} title="No interactions found" description="Try adjusting your filters or wait for new interactions." className="h-[400px]" />
      ) : (
        <div className="relative pl-6 ml-4 border-l-2 border-border space-y-8 pb-8">
          {filteredInteractions.map((interaction, i) => (
            <div key={interaction.id || i} className="relative">
              {/* Timeline dot */}
              <div className="absolute -left-[35px] w-4 h-4 rounded-full bg-background border-2 border-primary z-10" />
              
              <div className="bg-card border rounded-lg p-4 shadow-sm hover:shadow-md transition-shadow">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded bg-secondary flex items-center justify-center flex-shrink-0">
                      {interaction.product_image ? (
                        <img src={interaction.product_image} alt="" className="w-full h-full object-cover rounded" />
                      ) : (
                        <Package className="w-6 h-6 text-muted-foreground" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold">{interaction.product_name || 'Unknown Product'}</h4>
                        <Badge className={cn("text-xs font-bold", getActionColor(interaction.action))}>
                          {getActionLabel(interaction.action)}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{interaction.camera_name || 'Camera'} • {interaction.zone_name || 'Zone'}</p>
                        {interaction.hold_duration && (
                          <p>Held for {interaction.hold_duration.toFixed(1)} seconds</p>
                        )}
                        {interaction.inferred_reason && (
                          <p className="italic">Reason: {interaction.inferred_reason}</p>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  <div className="text-sm text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                    <Clock className="w-3 h-3" />
                    {new Date(interaction.timestamp || Date.now()).toLocaleTimeString()}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
