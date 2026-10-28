import React, { useState, useEffect } from 'react';
import { FileText, Search, Filter, RefreshCw, Layers } from 'lucide-react';
import { EmptyState } from '../components/widgets/EmptyState';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { cn } from '../lib/utils';

export function EventLogPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const fetchEvents = async () => {
    try {
      const res = await fetch('/api/events');
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch (err) {
      console.error('Failed to load events', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    const interval = setInterval(fetchEvents, 5000);
    return () => clearInterval(interval);
  }, []);

  const filteredEvents = events.filter(e => {
    if (filterType !== 'ALL' && e.event_type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (e.description && e.description.toLowerCase().includes(q)) ||
             (e.event_type && e.event_type.toLowerCase().includes(q));
    }
    return true;
  });

  const getEventBadge = (type) => {
    switch (type?.toUpperCase()) {
      case 'PRODUCT_REMOVED':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800';
      case 'PRODUCT_PUT_BACK':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
      case 'PURCHASE':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-400 dark:border-emerald-800';
      default:
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Event Log</h2>
          <p className="text-muted-foreground text-sm">Full chronological audit trail of all AI vision detections and retail events.</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchEvents} className="gap-2 self-start sm:self-auto">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </Button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-card border rounded-xl p-3 shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
          <Input 
            placeholder="Search description or product..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="h-9">
              <SelectValue placeholder="Event Type" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All Event Types</SelectItem>
              <SelectItem value="PRODUCT_REMOVED">Product Removed</SelectItem>
              <SelectItem value="PRODUCT_PUT_BACK">Product Put Back</SelectItem>
              <SelectItem value="INTERACTION">Interaction</SelectItem>
              <SelectItem value="ALERT">Alert</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Events Table / List */}
      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          Loading event audit log...
        </div>
      ) : filteredEvents.length === 0 ? (
        <EmptyState 
          icon={FileText} 
          title="No events recorded" 
          description="Vision and retail events will appear here in real time as cameras stream." 
          className="h-[450px]" 
        />
      ) : (
        <div className="border rounded-xl overflow-hidden bg-card shadow-xs">
          <div className="grid grid-cols-12 gap-4 p-3.5 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b bg-muted/40">
            <div className="col-span-2">Time</div>
            <div className="col-span-3">Type</div>
            <div className="col-span-7">Description</div>
          </div>
          <div className="divide-y divide-border">
            {filteredEvents.map((ev, i) => (
              <div key={ev.id || i} className="grid grid-cols-12 gap-4 p-3.5 items-center hover:bg-muted/30 transition-colors text-sm">
                <div className="col-span-2 font-mono text-xs text-muted-foreground whitespace-nowrap">
                  {ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString([], { hour12: false }) : 'Just now'}
                </div>
                <div className="col-span-3">
                  <span className={cn("px-2 py-0.5 text-[11px] font-bold rounded border inline-block", getEventBadge(ev.event_type))}>
                    {ev.event_type || 'EVENT'}
                  </span>
                </div>
                <div className="col-span-7 text-foreground font-medium truncate">
                  {ev.description}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
