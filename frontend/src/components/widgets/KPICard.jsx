import React from 'react';
import { Card, CardContent } from '../ui/card';
import { NumberTicker } from './NumberTicker';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '../../lib/utils';

export function KPICard({ title, value, icon: Icon, trend, trendValue, className }) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardContent className="p-6 flex flex-col justify-between h-full relative">
        <div className="absolute right-0 top-0 p-6 opacity-10 pointer-events-none">
          {Icon && <Icon className="w-16 h-16" />}
        </div>
        <div className="flex items-center gap-2 mb-3">
          <div className="p-2 rounded-md bg-primary/10 text-primary shrink-0">
            {Icon && <Icon className="w-5 h-5" />}
          </div>
          <span className="text-sm font-semibold text-foreground/80 truncate">{title}</span>
        </div>
        
        <div>
          <div className="text-2xl sm:text-3xl font-bold tracking-tight mb-1 text-foreground truncate">
            <NumberTicker value={value} />
          </div>
          
          {trend && (
            <div className={cn("flex items-center text-xs font-semibold", trend === 'up' ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400")}>
              {trend === 'up' ? <TrendingUp className="w-3.5 h-3.5 mr-1" /> : <TrendingDown className="w-3.5 h-3.5 mr-1" />}
              {trendValue} vs last week
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
