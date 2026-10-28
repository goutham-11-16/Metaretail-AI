import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Package, Plus, Trash2, Edit, Search, Filter, PlusCircle, MinusCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select';
import { EmptyState } from '../components/widgets/EmptyState';
import { RegisterProductDialog } from '../components/products/RegisterProductDialog';
import { ProductImageViewer } from '../components/products/ProductImageViewer';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui/dialog';
import { cn } from '../lib/utils';

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const initialQ = searchParams.get('q') || '';
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [searchQuery, setSearchQuery] = useState(initialQ);
  const [categoryFilter, setCategoryFilter] = useState('ALL');

  useEffect(() => {
    const q = searchParams.get('q');
    if (q !== null) {
      setSearchQuery(q);
    }
  }, [searchParams]);

  const fetchProducts = async () => {
    try {
      const response = await fetch('/api/products');
      if (response.ok) {
        const data = await response.json();
        setProducts(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  const handleDelete = async (id, e) => {
    e.stopPropagation();
    if (!confirm('Are you sure you want to delete this product?')) return;
    
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Product deleted');
        fetchProducts();
      } else {
        throw new Error('Failed to delete');
      }
    } catch (err) {
      toast.error(err.message);
    }
  };

  const handleStockDelta = async (productId, delta, e) => {
    e.stopPropagation();
    try {
      const res = await fetch(`/api/products/${productId}/stock`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ delta })
      });
      if (res.ok) {
        const data = await res.json();
        setProducts(prev => prev.map(p => p.id === productId ? { ...p, current_stock: data.current_stock, stock: data.current_stock } : p));
        toast.success(`Stock updated: ${data.current_stock} units`);
      }
    } catch (err) {
      toast.error('Failed to update stock');
    }
  };

  const categories = ['ALL', ...new Set(products.map(p => p.category).filter(Boolean))];

  const filteredProducts = products.filter(p => {
    if (categoryFilter !== 'ALL' && p.category !== categoryFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (p.name && p.name.toLowerCase().includes(q)) ||
             (p.sku && p.sku.toLowerCase().includes(q)) ||
             (p.barcode && p.barcode.toLowerCase().includes(q)) ||
             (p.category && p.category.toLowerCase().includes(q));
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">Products & Inventory</h2>
          <p className="text-muted-foreground text-sm">Manage store inventory, catalog SKUs, and AI detection models ({products.length} registered).</p>
        </div>
        <Button onClick={() => setIsRegisterOpen(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Register Product
        </Button>
      </div>

      {/* Search and Category Filter Bar */}
      {products.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-3 bg-card border rounded-xl p-3 shadow-xs">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
            <Input 
              placeholder="Search by product name, SKU, or barcode..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
          <div className="w-full sm:w-52">
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-9">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map(cat => (
                  <SelectItem key={cat} value={cat}>
                    {cat === 'ALL' ? 'All Categories' : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="h-[400px] flex items-center justify-center text-muted-foreground">
          Loading products...
        </div>
      ) : products.length === 0 ? (
        <EmptyState 
          icon={Package}
          title="No products registered yet"
          description="Register products by scanning them with your camera to train the Vision AI model."
          action={<Button variant="outline" onClick={() => setIsRegisterOpen(true)}><Plus className="w-4 h-4 mr-2"/> Register Product</Button>}
          className="h-[400px]"
        />
      ) : filteredProducts.length === 0 ? (
        <EmptyState 
          icon={Search}
          title="No matching products"
          description="No products match your search query or selected category filter."
          action={<Button variant="outline" onClick={() => { setSearchQuery(''); setCategoryFilter('ALL'); }}>Clear Filters</Button>}
          className="h-[300px]"
        />
      ) : (
        <div className="border rounded-xl overflow-hidden shadow-xs bg-card">
          <div className="grid grid-cols-12 gap-4 p-4 font-semibold text-xs uppercase tracking-wider text-muted-foreground border-b bg-muted/40">
            <div className="col-span-4">Product Name</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-2">Price</div>
            <div className="col-span-2">Stock Level</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          <div className="divide-y divide-border">
            {filteredProducts.map(product => {
              const currentStock = product.current_stock ?? product.stock ?? 0;
              const rawPrice = product.unit_price ?? product.price ?? 0;
              const unitPrice = typeof rawPrice === 'number' ? rawPrice : (parseFloat(rawPrice) || 0);
              const minThreshold = product.min_stock_threshold ?? product.min_stock ?? 2;
              const isLow = currentStock <= minThreshold;

              return (
                <div 
                  key={product.id} 
                  className="grid grid-cols-12 gap-4 p-4 items-center hover:bg-muted/40 cursor-pointer transition-colors"
                  onClick={() => setSelectedProduct(product)}
                >
                  <div className="col-span-4 font-medium flex items-center gap-3">
                    <div className="w-11 h-11 bg-muted rounded-lg flex items-center justify-center overflow-hidden border shrink-0">
                      {product.images && product.images.length > 0 ? (
                        <img src={product.images[0].image_path} alt={product.name} className="w-full h-full object-cover" />
                      ) : product.image_url ? (
                        <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-5 h-5 text-muted-foreground" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="font-semibold text-foreground text-sm truncate">{product.name}</div>
                      <div className="text-xs text-muted-foreground font-mono font-normal">{product.sku}</div>
                    </div>
                  </div>
                  <div className="col-span-2 text-sm text-foreground/90 font-medium">{product.category}</div>
                  <div className="col-span-2 text-sm font-semibold text-foreground">₹{unitPrice.toFixed(2)}</div>
                  
                  {/* Stock Level with Quick Adjust Controls */}
                  <div className="col-span-2 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
                    <button
                      type="button"
                      title="Decrease Stock"
                      onClick={(e) => handleStockDelta(product.id, -1, e)}
                      disabled={currentStock <= 0}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 transition"
                    >
                      <MinusCircle className="w-4 h-4" />
                    </button>
                    <span className={cn(
                      "px-2.5 py-0.5 rounded text-xs font-bold font-mono border",
                      isLow 
                        ? "bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-950/50 dark:text-rose-300 dark:border-rose-800" 
                        : "bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-950/50 dark:text-emerald-300 dark:border-emerald-800"
                    )}>
                      {currentStock}
                    </span>
                    <button
                      type="button"
                      title="Increase Stock"
                      onClick={(e) => handleStockDelta(product.id, 1, e)}
                      className="p-1 rounded text-muted-foreground hover:text-foreground hover:bg-muted transition"
                    >
                      <PlusCircle className="w-4 h-4" />
                    </button>
                  </div>

                  <div className="col-span-2 flex justify-end gap-1">
                    <Button variant="ghost" size="icon" title="View Details" onClick={(e) => { e.stopPropagation(); setSelectedProduct(product); }}>
                      <Edit className="w-4 h-4 text-foreground/70" />
                    </Button>
                    <Button variant="ghost" size="icon" title="Delete Product" className="hover:text-destructive text-muted-foreground" onClick={(e) => handleDelete(product.id, e)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <RegisterProductDialog 
        open={isRegisterOpen} 
        onOpenChange={setIsRegisterOpen}
        onProductRegistered={fetchProducts}
      />

      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader>
            <DialogTitle>{selectedProduct?.name}</DialogTitle>
          </DialogHeader>
          {selectedProduct && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4">
              <div>
                <ProductImageViewer 
                  productId={selectedProduct.id} 
                  images={selectedProduct.images && selectedProduct.images.length > 0 
                    ? selectedProduct.images 
                    : selectedProduct.image_url 
                      ? [{ image_path: selectedProduct.image_url, angle: 'Front' }] 
                      : []
                  }
                  onImageUploaded={async () => {
                    await fetchProducts();
                    const updatedRes = await fetch('/api/products');
                    if (updatedRes.ok) {
                      const prods = await updatedRes.json();
                      const updatedSelected = prods.find(p => p.id === selectedProduct.id);
                      if (updatedSelected) setSelectedProduct(updatedSelected);
                    }
                  }}
                />

              </div>
              <div className="space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground mb-1">Details</h4>
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2 text-sm border">
                    <div className="flex justify-between"><span className="text-muted-foreground font-medium">Category</span><span className="font-semibold text-foreground">{selectedProduct.category}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground font-medium">Price</span><span className="font-semibold text-foreground">₹{(typeof (selectedProduct.unit_price ?? selectedProduct.price) === 'number' ? (selectedProduct.unit_price ?? selectedProduct.price) : (parseFloat(selectedProduct.unit_price ?? selectedProduct.price) || 0)).toFixed(2)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground font-medium">Stock</span><span className="font-semibold text-foreground">{selectedProduct.current_stock ?? selectedProduct.stock ?? 0} units</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground font-medium">SKU</span><span className="font-mono text-xs text-foreground">{selectedProduct.sku}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground font-medium">Barcode</span><span className="font-mono text-xs text-foreground">{selectedProduct.barcode || 'N/A'}</span></div>
                  </div>
                </div>
                {selectedProduct.description && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground mb-1">Description</h4>
                    <p className="text-sm bg-secondary/30 rounded-md p-3">{selectedProduct.description}</p>
                  </div>
                )}
                <div className="flex justify-end gap-2 pt-4">
                  <Button variant="outline" onClick={() => setSelectedProduct(null)}>Close</Button>
                  <Button variant="destructive" onClick={(e) => {
                    handleDelete(selectedProduct.id, e);
                    setSelectedProduct(null);
                  }}>Delete Product</Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
