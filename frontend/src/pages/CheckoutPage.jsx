import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../components/ui/dialog';
import { ShoppingCart, CheckCircle2, Receipt, ArrowRight, Printer, RefreshCw, Sparkles, AlertTriangle, ShieldCheck, UserCheck, Clock, Download } from 'lucide-react';
import { toast } from 'sonner';
import { sharedAudioCues } from '../lib/audioCues';

export function CheckoutPage() {
  const [activeCarts, setActiveCarts] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [checkingOutId, setCheckingOutId] = useState(null);

  const fetchCartData = async () => {
    try {
      const [cartsRes, invRes] = await Promise.all([
        fetch('/api/cart/active'),
        fetch('/api/invoices')
      ]);
      if (cartsRes.ok) {
        const cartsData = await cartsRes.json();
        setActiveCarts(cartsData);
      }
      if (invRes.ok) {
        const invData = await invRes.json();
        setInvoices(invData);
      }
    } catch (err) {
      console.error('Error fetching cart data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCartData();
    const interval = setInterval(fetchCartData, 3000);
    return () => clearInterval(interval);
  }, []);

  const handleCheckout = async (trackId) => {
    setCheckingOutId(trackId);
    try {
      const res = await fetch(`/api/cart/${trackId}/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payment_method: 'AUTONOMOUS_JUST_WALK_OUT' })
      });
      if (res.ok) {
        const invoice = await res.json();
        sharedAudioCues.playCheckoutSuccess();
        toast.success(`Autonomous Checkout complete for Customer #${trackId}!`);
        setSelectedInvoice(invoice);
        fetchCartData();
      } else {
        const err = await res.json();
        toast.error(err.detail || 'Checkout failed');
      }
    } catch (err) {
      toast.error('Network error during checkout');
    } finally {
      setCheckingOutId(null);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadInvoice = () => {
    if (!selectedInvoice) return;
    const blob = new Blob([JSON.stringify(selectedInvoice, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `receipt_${selectedInvoice.invoice_number || 'invoice'}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Tax Invoice JSON downloaded');
  };

  return (
    <div className="space-y-8 pb-12">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-border/60 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Cashierless POS & Virtual Baskets</h1>
            <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 flex items-center gap-1 font-semibold">
              <Sparkles className="h-3 w-3" /> Autonomous Billing
            </Badge>
          </div>
          <p className="text-sm text-foreground/80 font-medium">
            Real-time "Just Walk Out" shopper baskets with itemized tax invoices (D-Mart & Reliance Retail Standard).
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchCartData} className="gap-2 font-medium">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </Button>
        </div>
      </div>

      {/* Active Shoppers Grid */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" /> Active In-Store Baskets ({activeCarts.length})
          </h2>
          <span className="text-xs text-foreground/70 font-medium">Auto-synced from shelf vision sensors</span>
        </div>

        {activeCarts.length === 0 ? (
          <Card className="border-dashed border-2 bg-card/50">
            <CardContent className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mb-3">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground text-base">No Active Shopper Baskets Currently</h3>
              <p className="text-sm text-foreground/70 max-w-md mt-1 font-medium">
                When customers lift items from shelves, their virtual baskets update automatically in real-time.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {activeCarts.map((cart) => (
              <Card key={cart.customer_track_id} className="border-border shadow-sm flex flex-col justify-between hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3 border-b border-border/40">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs">
                        #{cart.customer_track_id}
                      </div>
                      <div>
                        <CardTitle className="text-sm font-semibold text-foreground">Customer #{cart.customer_track_id}</CardTitle>
                        <CardDescription className="text-xs text-foreground/70 font-medium flex items-center gap-1">
                          <Clock className="h-3 w-3" /> Browsing Aisles
                        </CardDescription>
                      </div>
                    </div>
                    <Badge variant="secondary" className="font-semibold text-xs">
                      {cart.total_items} {cart.total_items === 1 ? 'item' : 'items'}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="pt-4 space-y-3 flex-1">
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {cart.items.map((it) => (
                      <div key={it.id} className="flex items-center justify-between text-xs p-2 rounded-lg bg-muted/40 border border-border/40">
                        <div className="flex-1 min-w-0 pr-2">
                          <p className="font-semibold text-foreground truncate">{it.product_name}</p>
                          <p className="text-[11px] text-foreground/70 font-medium">SKU: {it.sku} · Qty: {it.quantity}</p>
                        </div>
                        <span className="font-bold text-foreground">₹{it.total_price.toFixed(2)}</span>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2 border-t border-border/50 space-y-1 text-xs">
                    <div className="flex justify-between text-foreground/80 font-medium">
                      <span>Subtotal</span>
                      <span>₹{cart.subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-foreground/70 text-[11px] font-medium">
                      <span>GST (18% Total)</span>
                      <span>₹{cart.tax_amount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-foreground pt-1 border-t border-border/30">
                      <span>Grand Total</span>
                      <span className="text-primary font-mono text-base">₹{cart.grand_total.toFixed(2)}</span>
                    </div>
                  </div>
                </CardContent>

                <div className="p-4 pt-0 border-t border-border/40">
                  <Button
                    className="w-full gap-2 font-semibold"
                    size="sm"
                    disabled={checkingOutId === cart.customer_track_id}
                    onClick={() => handleCheckout(cart.customer_track_id)}
                  >
                    {checkingOutId === cart.customer_track_id ? (
                      <RefreshCw className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" /> Simulate Just-Walk-Out Exit
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Completed Invoices Table */}
      <div className="space-y-4 pt-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
              <Receipt className="h-5 w-5 text-emerald-600 dark:text-emerald-400" /> Completed Tax Invoices ({invoices.length})
            </h2>
            <p className="text-xs text-foreground/70 font-medium">Official GST-compliant retail transactions generated autonomously upon store exit</p>
          </div>
        </div>

        <Card className="border-border">
          <div className="overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead className="text-xs uppercase bg-muted/60 text-foreground/80 border-b border-border font-bold">
                <tr>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Items</th>
                  <th className="px-4 py-3">Subtotal</th>
                  <th className="px-4 py-3">GST (18%)</th>
                  <th className="px-4 py-3">Grand Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3 text-right">Receipt</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan="9" className="px-4 py-8 text-center text-sm text-foreground/70 font-medium">
                      No invoices generated yet. Use the checkout simulator above to generate official receipts.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-muted/30 transition-colors">
                      <td className="px-4 py-3 font-mono font-semibold text-foreground text-xs">{inv.invoice_number}</td>
                      <td className="px-4 py-3 text-foreground font-medium">Customer #{inv.customer_track_id}</td>
                      <td className="px-4 py-3 text-foreground/80 font-medium">{inv.items_count} units</td>
                      <td className="px-4 py-3 text-foreground/80 font-medium">₹{inv.subtotal.toFixed(2)}</td>
                      <td className="px-4 py-3 text-foreground/70 text-xs font-medium">₹{inv.tax_amount.toFixed(2)}</td>
                      <td className="px-4 py-3 font-bold text-foreground">₹{inv.total_amount.toFixed(2)}</td>
                      <td className="px-4 py-3">
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 text-[11px] font-semibold">
                          {inv.payment_status}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-xs text-foreground/70 font-medium">
                        {new Date(inv.created_at).toLocaleTimeString()}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 font-semibold text-xs text-primary"
                          onClick={() => setSelectedInvoice(inv)}
                        >
                          <Receipt className="h-3.5 w-3.5" /> View Receipt
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Printable Thermal Receipt Modal (D-Mart & Reliance Standard) */}
      <Dialog open={!!selectedInvoice} onOpenChange={(open) => !open && setSelectedInvoice(null)}>
        <DialogContent className="max-w-md p-0 overflow-hidden bg-background">
          <div className="p-6 bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 font-mono text-xs space-y-4 border rounded-lg m-4 shadow-xl">
            {/* Receipt Header */}
            <div className="text-center space-y-1 border-b border-dashed border-zinc-400 dark:border-zinc-700 pb-3">
              <h2 className="text-base font-black tracking-wider uppercase">METARETAIL SMART EXPRESS</h2>
              <p className="text-[11px] text-zinc-600 dark:text-zinc-400">Autonomous Retail Operations Hub</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500">Tech Plaza, Indiranagar, Bengaluru, 560038</p>
              <p className="text-[10px] text-zinc-500 dark:text-zinc-500">GSTIN: 29AABCU9603R1ZM · FSSAI: 11223344556677</p>
            </div>

            {/* Transaction Metadata */}
            {selectedInvoice && (
              <>
                <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-400 dark:border-zinc-700 pb-2">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">INVOICE NO:</span>
                    <span className="font-bold">{selectedInvoice.invoice_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">DATE & TIME:</span>
                    <span>{new Date(selectedInvoice.created_at).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">CUSTOMER:</span>
                    <span>Shopper #{selectedInvoice.customer_track_id} (Turnstile Exit)</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">CHECKOUT MODE:</span>
                    <span className="font-bold text-emerald-600 dark:text-emerald-400">AUTONOMOUS JUST-WALK-OUT</span>
                  </div>
                </div>

                {/* Line Items Table */}
                <div className="space-y-2 border-b border-dashed border-zinc-400 dark:border-zinc-700 pb-3">
                  <div className="flex justify-between font-bold text-[11px] text-zinc-600 dark:text-zinc-300">
                    <span>ITEM</span>
                    <span>QTY x RATE</span>
                    <span>AMOUNT</span>
                  </div>
                  {(selectedInvoice.items || []).map((it, idx) => (
                    <div key={idx} className="flex justify-between text-[11px]">
                      <div className="truncate max-w-[170px]">
                        <span className="font-medium">{it.product_name}</span>
                        <div className="text-[9px] text-zinc-500">HSN: 2202 · SKU: {it.sku}</div>
                      </div>
                      <span className="text-zinc-600 dark:text-zinc-400">{it.quantity} x ₹{it.unit_price.toFixed(2)}</span>
                      <span className="font-semibold">₹{it.total_price.toFixed(2)}</span>
                    </div>
                  ))}
                </div>

                {/* Tax Breakdown & Totals */}
                <div className="space-y-1 text-[11px] border-b border-dashed border-zinc-400 dark:border-zinc-700 pb-3">
                  <div className="flex justify-between">
                    <span className="text-zinc-500 dark:text-zinc-400">SUBTOTAL (EXCL. TAX):</span>
                    <span>₹{selectedInvoice.subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                    <span>CGST @ 9.0%:</span>
                    <span>₹{(selectedInvoice.tax_amount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-zinc-500 dark:text-zinc-400">
                    <span>SGST @ 9.0%:</span>
                    <span>₹{(selectedInvoice.tax_amount / 2).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold pt-1 border-t border-zinc-300 dark:border-zinc-700">
                    <span>NET AMOUNT PAYABLE:</span>
                    <span className="text-sm font-black">₹{selectedInvoice.total_amount.toFixed(2)}</span>
                  </div>
                </div>

                {/* Footer Barcode / QR Notice */}
                <div className="text-center pt-2 space-y-2">
                  <div className="inline-block py-1 px-4 bg-zinc-100 dark:bg-zinc-800 rounded text-[10px] tracking-widest font-mono">
                    * * * PAID VIA DIGITAL WALLET * * *
                  </div>
                  <p className="text-[10px] text-zinc-500">Thank you for shopping at MetaRetail! No cashier required.</p>
                </div>
              </>
            )}
          </div>

          <div className="p-4 bg-muted/40 border-t flex justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedInvoice(null)}>
              Close
            </Button>
            <Button variant="outline" size="sm" onClick={handleDownloadInvoice} className="gap-2 font-semibold border-border">
              <Download className="h-4 w-4" /> Export JSON
            </Button>
            <Button size="sm" onClick={handlePrint} className="gap-2 font-semibold">
              <Printer className="h-4 w-4" /> Print Tax Invoice
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
