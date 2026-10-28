import React, { useEffect, useRef } from 'react';
import { ScrollArea } from '../ui/scroll-area';
import { StatusBadge } from './StatusBadge';
import { cn } from '../../lib/utils';
import { EmptyState } from './EmptyState';
import { List } from 'lucide-react';
import { sharedAudioCues } from '../../lib/audioCues';

export function EventStream({ events = [], className }) {
  const scrollRef = useRef(null);
  const lastEventIdRef = useRef(null);

  useEffect(() => {
    if (events && events.length > 0) {
      const latest = events[events.length - 1];
      if (latest && latest.id !== lastEventIdRef.current) {
        lastEventIdRef.current = latest.id;
        const act = (latest.action || '').toUpperCase();
        if (act.includes('PICK') || act.includes('TAKE')) {
          sharedAudioCues.playPickup();
        } else if (act.includes('PUT') || act.includes('REPLACE') || act.includes('LEAVE')) {
          sharedAudioCues.playPutBack();
        } else if (act.includes('CHECKOUT') || act.includes('PURCHASE')) {
          sharedAudioCues.playCheckoutSuccess();
        } else if (act.includes('ALERT') || act.includes('SUSPICIOUS')) {
          sharedAudioCues.playSecurityAlert();
        }
      }
    }

    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector('[data-radix-scroll-area-viewport]');
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [events]);

  if (!events.length) {
    return <EmptyState icon={List} title="No events" description="Waiting for incoming events..." className={cn("h-[400px]", className)} />;
  }

  return (
    <ScrollArea ref={scrollRef} className={cn("h-[380px] pr-3", className)}>
      <div className="space-y-3">
        {events.map((event, i) => (
          <div key={event.id || i} className="flex gap-3 p-3 rounded-lg bg-card border text-sm animate-in fade-in slide-in-from-bottom-2 min-w-0">
            <div className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 font-mono shrink-0">
              {new Date(event.timestamp).toLocaleTimeString([], { hour12: false })}
            </div>
            <div className="flex-1 space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-medium text-xs sm:text-sm truncate max-w-[180px]">{event.product_name || 'Unknown Product'}</span>
                <StatusBadge status={event.action} />
              </div>
              <p className="text-muted-foreground text-xs break-words">{event.description}</p>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
