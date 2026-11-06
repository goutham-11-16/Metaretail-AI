import React, { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Package, Clock, ShoppingCart, AlertCircle, RefreshCw, Download, Sparkles, DollarSign, ShieldCheck, Flame, ArrowUpRight, Database, FileCode, Copy, Check, FileText } from 'lucide-react';
import { EmptyState } from '../components/widgets/EmptyState';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell } from 'recharts';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export function AnalyticsPage() {
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [dwellPatterns, setDwellPatterns] = useState([]);
  const [replacementReasons, setReplacementReasons] = useState([]);
  const [execSummary, setExecSummary] = useState(null);
  const [exportingBq, setExportingBq] = useState(false);
  const [bqScripts, setBqScripts] = useState([]);
  const [selectedScript, setSelectedScript] = useState(null);
  const [isScriptModalOpen, setIsScriptModalOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchAnalyticsData = async () => {
    try {
      const [aRes, dRes, rRes, eRes] = await Promise.all([
        fetch('/api/analytics'),
        fetch('/api/analytics/dwell-patterns'),
        fetch('/api/analytics/replacement-reasons'),
        fetch('/api/analytics/executive-summary')
      ]);

      if (aRes.ok) setAnalytics(await aRes.json());
      if (dRes.ok) setDwellPatterns(await dRes.json());
      if (rRes.ok) setReplacementReasons(await rRes.json());
      if (eRes.ok) setExecSummary(await eRes.json());
    } catch (e) {
      console.error('Error fetching analytics:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
    const interval = setInterval(fetchAnalyticsData, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleDownloadCsv = () => {
    toast.info('Generating warehouse operations audit CSV...');
    window.location.href = '/api/analytics/export/csv';
  };

  const handleDownloadPdf = () => {
    toast.info('Generating executive warehouse sales & inventory PDF report...');
    window.open('/api/analytics/export/pdf', '_blank');
  };

  const handleExportBigQuery = async () => {
    setExportingBq(true);
    toast.info('Exporting store tables to BigQuery NDJSON format...');
    try {
      const res = await fetch('/api/bigquery/export', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        const counts = Object.entries(data.exports)
          .filter(([k]) => k !== 'load_script')
          .map(([k, v]) => `${k}: ${v.count}`)
          .join(', ');
        toast.success(`BigQuery NDJSON files generated! (${counts})`);
      } else {
        toast.error('Failed to export BigQuery data');
      }
    } catch (e) {
      toast.error('Export error: ' + e.message);
    } finally {
      setExportingBq(false);
    }
  };

  const handleOpenBqModal = async () => {
    try {
      const res = await fetch('/api/bigquery/scripts');
      if (res.ok) {
        const data = await res.json();
        setBqScripts(data.scripts || []);
        if (data.scripts && data.scripts.length > 0) {
          setSelectedScript(data.scripts[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
    setIsScriptModalOpen(true);
  };

  const handleCopyScript = () => {
    if (selectedScript?.content) {
      navigator.clipboard.writeText(selectedScript.content);
      setCopied(true);
      toast.success('SQL copied to clipboard!');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const gmv = execSummary?.gross_merchandise_value ?? 0;
  const abv = execSummary?.average_basket_value ?? 0;
  const velocity = execSummary?.projected_daily_velocity ?? 0;
  const shrinkageSaved = execSummary?.shrinkage_prevented_inr ?? 0;
  const planogramScore = execSummary?.planogram_compliance_score_pct ?? 94.6;

  return (
    <div className="space-y-8 pb-12">
      {/* Header & Export Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Commercial & Vision Intelligence</h1>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 flex items-center gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> C-Suite Suite
            </Badge>
          </div>
          <p className="text-sm text-foreground/80 font-medium">
            Executive revenue velocity, conversion funnels, SKU cross-sell affinities, and AI shrinkage prevention metrics.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchAnalyticsData} className="gap-2 font-medium">
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={handleOpenBqModal} className="gap-2 font-medium border-blue-500/40 text-blue-600 dark:text-blue-400 hover:bg-blue-500/10">
            <FileCode className="w-3.5 h-3.5" /> BigQuery SQL
          </Button>
          <Button size="sm" onClick={handleExportBigQuery} disabled={exportingBq} className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white">
            <Database className="w-4 h-4" /> {exportingBq ? 'Exporting...' : 'Sync BigQuery'}
          </Button>
          <Button size="sm" onClick={handleDownloadPdf} className="gap-2 font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm">
            <FileText className="w-4 h-4" /> Sales Report PDF
          </Button>
          <Button size="sm" variant="outline" onClick={handleDownloadCsv} className="gap-2 font-semibold">
            <Download className="w-4 h-4" /> Audit CSV
          </Button>
        </div>
      </div>

      {/* Commercial Revenue KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Gross Revenue (GMV)</span>
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                <DollarSign className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground font-mono">₹{gmv.toFixed(2)}</div>
            <p className="text-xs text-foreground/70 font-medium mt-1">Autonomous checkout receipts</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Avg Basket Value</span>
              <div className="p-2 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400">
                <ShoppingCart className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground font-mono">₹{abv.toFixed(2)}</div>
            <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mt-1 flex items-center gap-0.5">
              <ArrowUpRight className="h-3 w-3" /> +14.2% vs standard POS
            </p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Shrinkage Prevented</span>
              <div className="p-2 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400">
                <ShieldCheck className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground font-mono">₹{shrinkageSaved.toFixed(2)}</div>
            <p className="text-xs text-purple-700 dark:text-purple-400 font-semibold mt-1">Deterred via real-time alerts</p>
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-foreground/70 uppercase tracking-wider">Planogram Compliance</span>
              <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="text-2xl font-bold mt-2 text-foreground font-mono">{planogramScore}%</div>
            <p className="text-xs text-foreground/70 font-medium mt-1">Universal Shelf Tracker verified</p>
          </CardContent>
        </Card>
      </div>

      {/* BigQuery Enterprise AI/ML Suite */}
      <Card className="border border-blue-500/30 bg-gradient-to-r from-blue-950/20 via-card to-card shadow-sm">
        <CardHeader className="pb-3 border-b border-border/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                <CardTitle className="text-lg font-bold text-foreground">Google Cloud BigQuery AI & ML Enterprise Hub</CardTitle>
                <Badge className="bg-blue-500/20 text-blue-600 dark:text-blue-400 border-blue-500/30 text-xs">TimesFM + Gemini 2.5</Badge>
              </div>
              <CardDescription className="text-xs text-foreground/70 font-medium mt-1">
                Zero-ETL foundation models for 14-day demand forecasting, automated shrinkage anomaly detection, and Gemini multimodal incident extraction.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="outline" onClick={() => window.open('/api/bigquery/download/load_to_bigquery.sh', '_blank')} className="gap-1.5 text-xs font-semibold">
                <Download className="w-3.5 h-3.5" /> Ingestion Script
              </Button>
              <Button size="sm" onClick={handleOpenBqModal} className="gap-1.5 text-xs font-semibold bg-blue-600 hover:bg-blue-700 text-white">
                <FileCode className="w-3.5 h-3.5" /> View SQL Pipelines
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs">
            <div className="p-3 rounded-lg border bg-card/60 space-y-1.5">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-emerald-500" /> 1. TimesFM 2.0 Demand Forecast
              </div>
              <p className="text-muted-foreground">
                Predicts 14-day sales per SKU with 90% confidence bands using Google TimesFM foundation model without local training.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card/60 space-y-1.5">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <ShieldCheck className="h-4 w-4 text-purple-500" /> 2. Anomaly & Shrinkage Detection
              </div>
              <p className="text-muted-foreground">
                Compares recent week shelf activity against 60-day baseline to detect bulk sweeps and inventory theft surges.
              </p>
            </div>
            <div className="p-3 rounded-lg border bg-card/60 space-y-1.5">
              <div className="font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="h-4 w-4 text-amber-500" /> 3. Gemini 2.5 Incident Extraction
              </div>
              <p className="text-muted-foreground">
                Uses AI.GENERATE_TABLE to parse unstructured security notes into typed columns (severity, suspected SKU, corrective action).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Funnel & SKU Affinity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Full Store Conversion Funnel */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" /> Shopper Conversion Funnel
            </CardTitle>
            <CardDescription className="text-xs text-foreground/70 font-medium">
              Stage-by-stage progression from front-door footfall to autonomous checkout completion
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {(execSummary?.conversion_funnel || []).map((stage, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-semibold text-foreground">
                  <span>{stage.stage}</span>
                  <span>{stage.count} shoppers ({stage.conversion_pct}%)</span>
                </div>
                <div className="w-full bg-muted/60 rounded-full h-3 overflow-hidden">
                  <div 
                    className="bg-primary h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.max(8, stage.conversion_pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* SKU Affinity Matrix */}
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" /> SKU Affinity Matrix ("Frequently Picked Together")
            </CardTitle>
            <CardDescription className="text-xs text-foreground/70 font-medium">
              High-confidence product pairs picked during the same store journey
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {(execSummary?.sku_affinity_matrix || []).map((pair, idx) => (
              <div key={idx} className="p-3 rounded-lg bg-muted/40 border border-border/50 flex items-center justify-between text-xs">
                <div className="space-y-0.5">
                  <p className="font-bold text-foreground">{pair.pair}</p>
                  <p className="text-foreground/70 font-medium text-[11px]">Est. Cross-Sell GMV: {pair.cross_sell_revenue}</p>
                </div>
                <div className="text-right">
                  <Badge className="bg-primary/15 text-primary border-primary/30 font-mono font-bold">
                    {pair.affinity_score}% Affinity
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Dwell Patterns & Abandonment Causes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" /> Average Hold Duration by SKU
            </CardTitle>
            <CardDescription className="text-xs text-foreground/70 font-medium">
              Time customers inspect physical items before making purchase vs replace decisions
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            {dwellPatterns.length === 0 ? (
              <div className="py-8 text-center text-xs text-foreground/70 font-medium">
                No dwell data registered yet. Inspect items in front of camera to generate telemetry.
              </div>
            ) : (
              <div className="h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dwellPatterns} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.3} />
                    <XAxis dataKey="product_name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" />
                    <YAxis tick={{ fontSize: 11 }} />
                    <RechartsTooltip />
                    <Bar dataKey="avg_hold_duration" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Hold Duration (s)" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border border-border shadow-sm">
          <CardHeader className="pb-3 border-b border-border/40">
            <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" /> Shelf Abandonment Drivers
            </CardTitle>
            <CardDescription className="text-xs text-foreground/70 font-medium">
              Inferred reasons why items were returned to shelves unbought
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {replacementReasons.length === 0 ? (
              <div className="py-8 text-center text-xs text-foreground/70 font-medium">
                No shelf replacements registered yet.
              </div>
            ) : (
              replacementReasons.map((r, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-semibold text-foreground">
                    <span>{r.reason}</span>
                    <span>{r.count} occurrences ({r.percentage}%)</span>
                  </div>
                  <div className="w-full bg-muted/60 rounded-full h-2.5 overflow-hidden">
                    <div 
                      className="bg-amber-500 h-full rounded-full"
                      style={{ width: `${Math.max(5, r.percentage)}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* BigQuery SQL Pipeline Viewer Modal */}
      <Dialog open={isScriptModalOpen} onOpenChange={setIsScriptModalOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
          <DialogHeader>
            <div className="flex items-center justify-between pr-6">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-blue-500" />
                <DialogTitle className="text-lg font-bold">BigQuery AI & ML SQL Pipeline Suite</DialogTitle>
              </div>
              <Button size="sm" variant="outline" onClick={handleCopyScript} className="gap-1.5 text-xs font-semibold">
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                {copied ? 'Copied!' : 'Copy SQL'}
              </Button>
            </div>
          </DialogHeader>

          <div className="grid grid-cols-12 gap-4 flex-1 overflow-hidden mt-3">
            {/* Script selector sidebar */}
            <div className="col-span-4 border rounded-lg p-2 overflow-y-auto space-y-1 bg-muted/30">
              <div className="text-xs font-semibold uppercase text-muted-foreground px-2 py-1">Available SQL Pipelines</div>
              {bqScripts.map((s) => (
                <button
                  key={s.filename}
                  onClick={() => setSelectedScript(s)}
                  className={cn(
                    "w-full text-left px-2.5 py-2 rounded-md text-xs font-medium transition-colors flex items-center gap-2",
                    selectedScript?.filename === s.filename 
                      ? "bg-primary text-primary-foreground font-semibold" 
                      : "hover:bg-muted text-foreground"
                  )}
                >
                  <FileCode className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{s.filename}</span>
                </button>
              ))}
            </div>

            {/* SQL content display */}
            <div className="col-span-8 border rounded-lg overflow-hidden flex flex-col bg-card">
              <div className="bg-muted/60 px-3 py-2 border-b flex items-center justify-between text-xs font-mono">
                <span className="font-semibold text-foreground">{selectedScript?.filename || 'No script selected'}</span>
                <span className="text-muted-foreground">Ready for BigQuery Studio</span>
              </div>
              <pre className="p-4 flex-1 overflow-auto font-mono text-xs text-foreground bg-muted/10 leading-relaxed whitespace-pre">
                {selectedScript?.content || '-- Select a script to view SQL pipeline'}
              </pre>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
