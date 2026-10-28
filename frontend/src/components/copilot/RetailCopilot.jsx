import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Bot, Sparkles, X, Minimize2, Maximize2, Send, ArrowRight, 
  RotateCcw, AlertTriangle, TrendingUp, Package, ShieldCheck, 
  CheckCircle, Database, Play, Square, ExternalLink
} from 'lucide-react';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { toast } from 'sonner';
import { sharedAudioCues } from '../../lib/audioCues';

export function RetailCopilot({ isOpen, setIsOpen }) {
  const navigate = useNavigate();
  const [messages, setMessages] = useState([
    {
      id: 'msg-welcome',
      role: 'assistant',
      text: `👋 **Welcome to MetaRetail AI Copilot!**

I am your autonomous store operating system assistant, grounded in live real-time telemetry, shelf sensors, and BigQuery AI/ML models.

Here is what you can ask me:
- *"Which products are at risk of stockout?"*
- *"What is today's gross revenue and sales velocity?"*
- *"Restock Doritos by 15"*
- *"Explain BigQuery TimesFM 2.0 demand forecasting"*
- *"Are there any active shrinkage incidents?"*`,
      followups: [
        'Which items are low on stock?',
        "What is today's revenue and footfall?",
        'Explain BigQuery TimesFM forecasting',
        'Start store simulation'
      ]
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen && !isMinimized) {
      scrollToBottom();
    }
  }, [messages, isOpen, isMinimized]);

  const handleSend = async (queryToSend = null) => {
    const text = (queryToSend || inputQuery).trim();
    if (!text || isLoading) return;

    sharedAudioCues.playPickup();

    const userMsg = {
      id: `user-${Date.now()}`,
      role: 'user',
      text: text
    };

    setMessages(prev => [...prev, userMsg]);
    if (!queryToSend) setInputQuery('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/copilot/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: text })
      });

      if (res.ok) {
        const data = await res.json();
        const botMsg = {
          id: `bot-${Date.now()}`,
          role: 'assistant',
          text: data.reply || data.answer || 'Response processed.',
          action: data.action,
          followups: data.suggested_followups || data.recommendations || []
        };
        setMessages(prev => [...prev, botMsg]);
      } else {
        setMessages(prev => [
          ...prev, 
          {
            id: `err-${Date.now()}`,
            role: 'assistant',
            text: '⚠️ Unable to process query against store telemetry. Please verify backend connection.'
          }
        ]);
      }
    } catch (e) {
      setMessages(prev => [
        ...prev, 
        {
          id: `err-${Date.now()}`,
          role: 'assistant',
          text: '⚠️ Network connection to MetaRetail Copilot service failed.'
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleActionClick = (action) => {
    if (!action) return;
    sharedAudioCues.playPickup();
    if (action.type === 'NAVIGATE' && action.route) {
      navigate(action.route);
      toast.info(`Navigated to ${action.route}`);
    } else if (action.type === 'RESTOCK_COMPLETED') {
      toast.success('Stock refreshed on shelf!');
      navigate('/planogram');
    }
  };

  const clearChat = () => {
    setMessages([
      {
        id: 'msg-welcome',
        role: 'assistant',
        text: '🧹 Chat cleared. Ask me anything about store telemetry, inventory, or BigQuery ML models!',
        followups: [
          'Which items are low on stock?',
          "What is today's revenue and footfall?",
          'Toggle simulation'
        ]
      }
    ]);
  };

  // Render markdown-like text with bolding and lists
  const renderFormattedText = (rawText) => {
    const lines = rawText.split('\n');
    return (
      <div className="space-y-1.5 text-xs sm:text-sm leading-relaxed">
        {lines.map((line, idx) => {
          if (!line.trim()) return <div key={idx} className="h-1" />;

          // Bullet points
          if (line.trim().startsWith('- ') || line.trim().startsWith('• ')) {
            const content = line.trim().replace(/^[-•]\s*/, '');
            return (
              <div key={idx} className="flex items-start gap-2 pl-2">
                <span className="text-primary mt-1 text-xs">•</span>
                <span dangerouslySetInnerHTML={{ __html: formatInline(content) }} />
              </div>
            );
          }

          return (
            <p key={idx} dangerouslySetInnerHTML={{ __html: formatInline(line) }} />
          );
        })}
      </div>
    );
  };

  const formatInline = (str) => {
    return str
      .replace(/\*\*(.*?)\*\*/g, '<strong class="font-bold text-foreground">$1</strong>')
      .replace(/\*(.*?)\*/g, '<em class="italic text-foreground/80">$1</em>')
      .replace(/`([^`]+)`/g, '<code class="bg-muted px-1 py-0.5 rounded text-[11px] font-mono text-primary">$1</code>');
  };

  return (
    <>
      {/* Floating Launcher Button */}
      {!isOpen && (
        <button
          onClick={() => { setIsOpen(true); setIsMinimized(false); }}
          className="fixed bottom-6 right-6 z-40 p-3.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 text-white shadow-xl hover:shadow-2xl hover:scale-105 transition-all duration-200 flex items-center gap-2 group cursor-pointer border border-white/20"
          title="Open MetaRetail AI Copilot"
        >
          <div className="relative">
            <Bot className="h-6 w-6" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full animate-ping" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full" />
          </div>
          <span className="hidden sm:inline font-bold text-xs tracking-wide pr-1">
            Retail Copilot
          </span>
          <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-pulse hidden sm:inline" />
        </button>
      )}

      {/* Copilot Chat Window */}
      {isOpen && (
        <div 
          className={`fixed bottom-6 right-6 z-50 bg-card border border-border/80 shadow-2xl rounded-2xl overflow-hidden flex flex-col transition-all duration-200 text-foreground ${
            isMinimized 
              ? 'w-72 h-14' 
              : 'w-[92vw] sm:w-[460px] h-[580px] max-h-[85vh]'
          }`}
        >
          {/* Header */}
          <div className="p-3 bg-muted/40 border-b border-border flex items-center justify-between select-none">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-purple-600 text-white flex items-center justify-center shadow-xs">
                <Bot className="h-4 w-4" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-xs font-bold text-foreground">MetaRetail AI Copilot</h3>
                  <Badge variant="outline" className="text-[9px] bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 py-0">
                    Live Telemetry
                  </Badge>
                </div>
                {!isMinimized && (
                  <p className="text-[10px] text-foreground/60">Grounded in TimesFM & ViT Vision Engine</p>
                )}
              </div>
            </div>

            <div className="flex items-center gap-1">
              {!isMinimized && (
                <button
                  onClick={clearChat}
                  className="p-1 rounded text-foreground/60 hover:text-foreground hover:bg-muted"
                  title="Clear conversation"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setIsMinimized(prev => !prev)}
                className="p-1 rounded text-foreground/60 hover:text-foreground hover:bg-muted"
                title={isMinimized ? 'Expand' : 'Minimize'}
              >
                {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minimize2 className="h-3.5 w-3.5" />}
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-foreground/60 hover:text-foreground hover:bg-muted"
                title="Close Copilot"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {/* Body */}
          {!isMinimized && (
            <>
              {/* Message History */}
              <div className="flex-1 p-3.5 overflow-y-auto space-y-4 bg-background/50">
                {messages.map((msg) => (
                  <div 
                    key={msg.id}
                    className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div 
                      className={`max-w-[88%] p-3 rounded-2xl ${
                        msg.role === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-xs'
                          : 'bg-muted/70 text-foreground border border-border/50 rounded-tl-xs shadow-xs'
                      }`}
                    >
                      {renderFormattedText(msg.text)}

                      {/* Embedded Action Button */}
                      {msg.action && (
                        <div className="mt-3 pt-2 border-t border-border/50 flex items-center justify-between">
                          <span className="text-[11px] font-semibold text-foreground/70">
                            Action Available
                          </span>
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => handleActionClick(msg.action)}
                            className="h-7 text-xs font-semibold gap-1 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20"
                          >
                            <span>
                              {msg.action.type === 'NAVIGATE' ? 'Open View' : 'Execute'}
                            </span>
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Followup Question Pills */}
                    {msg.followups && msg.followups.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5 max-w-[90%]">
                        {msg.followups.map((q, qIdx) => (
                          <button
                            key={qIdx}
                            onClick={() => handleSend(q)}
                            disabled={isLoading}
                            className="text-[11px] px-2.5 py-1 rounded-full bg-muted/60 hover:bg-primary/10 hover:text-primary text-foreground/80 border border-border/60 transition-all font-medium text-left"
                          >
                            {q}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                ))}

                {isLoading && (
                  <div className="flex items-center gap-2 p-3 rounded-2xl bg-muted/70 border border-border/50 text-foreground/70 max-w-[70%]">
                    <Sparkles className="h-4 w-4 text-primary animate-spin" />
                    <span className="text-xs font-medium">Querying store telemetry & TimesFM...</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Form */}
              <div className="p-2.5 border-t border-border bg-card">
                <form 
                  onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                  className="flex items-center gap-2"
                >
                  <input
                    type="text"
                    placeholder="Ask Copilot (e.g. 'restock milk by 10', 'revenue velocity')..."
                    value={inputQuery}
                    onChange={(e) => setInputQuery(e.target.value)}
                    disabled={isLoading}
                    className="flex-1 bg-muted/50 border border-border/60 rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-foreground/45 focus:outline-none focus:ring-1 focus:ring-primary"
                  />
                  <Button
                    type="submit"
                    size="sm"
                    disabled={isLoading || !inputQuery.trim()}
                    className="h-8 w-8 p-0 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    <Send className="h-3.5 w-3.5" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
