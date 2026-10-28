import React from 'react';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

export function StatusBadge({ status, className }) {
  const getStatusStyles = () => {
    switch (status?.toUpperCase()) {
      case 'ONLINE':
      case 'LIVE':
      case 'TAKEN':
        return 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-300 dark:border-emerald-500/30';
      case 'OFFLINE':
      case 'CRITICAL':
        return 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-500/20 dark:text-rose-300 dark:border-rose-500/30';
      case 'LOW_STOCK':
      case 'WARNING':
      case 'REPLACED':
        return 'bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-300 dark:border-amber-500/30';
      case 'PICKED UP':
      case 'PICKED_UP':
        return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-500/20 dark:text-blue-300 dark:border-blue-500/30';
      default:
        return 'bg-slate-100 text-slate-800 border-slate-300 dark:bg-slate-700/30 dark:text-slate-300 dark:border-slate-600/30';
    }
  };

  const isPulsing = status?.toUpperCase() === 'LIVE';

  return (
    <Badge variant="outline" className={cn("font-semibold text-[11px] gap-1.5 px-2 py-0.5", getStatusStyles(), className)}>
      {isPulsing && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 dark:bg-emerald-400 animate-pulse-live" />}
      {status}
    </Badge>
  );
}
