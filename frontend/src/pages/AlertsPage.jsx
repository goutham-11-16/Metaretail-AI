import React, { useState, useEffect } from 'react';
import { Bell, CheckCircle2, AlertTriangle, ShieldAlert, Info } from 'lucide-react';
import { EmptyState } from '../components/widgets/EmptyState';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Card, CardContent } from '../components/ui/card';
import { toast } from 'sonner';
import { cn } from '../lib/utils';

export function AlertsPage() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = async () => {
    try {
      const res = await fetch('/api/alerts');
      if (res.ok) {
        const data = await res.json();
        setAlerts(data);
      }
    } catch (err) {
      console.error('Failed to load alerts', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAlerts();
    const interval = setInterval(fetchAlerts, 4000);
    return () => clearInterval(interval);
  }, []);

  const handleResolve = async (id) => {
    try {
      const res = await fetch(`/api/alerts/${id}/resolve`, { method: 'POST' });
      if (res.ok) {
        toast.success('Alert marked as resolved');
        setAlerts(prev => prev.filter(a => a.id !== id));
      } else {
        throw new Error('Failed to resolve');
      }
    } catch (e) {
      toast.error('Error resolving alert');
    }
  };

  const getSeverityBadge = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-400 dark:border-rose-800';
      case 'WARNING':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-950/50 dark:text-amber-400 dark:border-amber-800';
      default:
        return 'bg-blue-100 text-blue-900 border-blue-300 dark:bg-blue-950/50 dark:text-blue-400 dark:border-blue-800';
    }
  };

  const getSeverityIcon = (sev) => {
    switch (sev?.toUpperCase()) {
      case 'CRITICAL':
        return <ShieldAlert className="w-5 h-5 text-rose-600 dark:text-rose-400" />;
      case 'WARNING':
        return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400" />;
      default:
        return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Alerts</h2>
          <p className="text-muted-foreground text-sm">System notifications and real-time inventory attention items.</p>
        </div>
        {alerts.length > 0 && (
          <Badge variant="outline" className="text-xs font-semibold px-2.5 py-1">
            {alerts.length} Active Alert{alerts.length > 1 ? 's' : ''}
          </Badge>
        )}
      </div>

      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          Loading alerts...
        </div>
      ) : alerts.length === 0 ? (
        <EmptyState 
          icon={Bell} 
          title="All caught up!" 
          description="There are no unresolved inventory or system alerts right now." 
          className="h-[450px]" 
        />
      ) : (
        <div className="grid gap-4">
          {alerts.map((alert) => (
            <Card key={alert.id} className="border bg-card shadow-xs transition-shadow hover:shadow-md">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-start gap-3.5">
                  <div className="p-2 rounded-lg bg-muted/60 border mt-0.5">
                    {getSeverityIcon(alert.severity)}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-foreground text-sm">{alert.message}</h4>
                      <span className={cn("px-2 py-0.5 text-[11px] font-bold rounded-md border", getSeverityBadge(alert.severity))}>
                        {alert.severity || 'INFO'}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">
                      Type: {alert.alert_type} • {alert.created_at ? new Date(alert.created_at).toLocaleString() : 'Just now'}
                    </p>
                  </div>
                </div>

                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => handleResolve(alert.id)}
                  className="gap-1.5 hover:bg-emerald-50 hover:text-emerald-700 hover:border-emerald-300 dark:hover:bg-emerald-950/30"
                >
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  Resolve
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
