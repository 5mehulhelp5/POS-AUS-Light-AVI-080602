import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { RootState, AppDispatch } from '../../store';
import {
  fetchProducts,
  fetchCategories,
  fetchSubcategories,
} from '../../store/slices/productsSlice';
import { productsApi } from '../../services/api';
import { addItem, removeItem, updateQuantity, clearCart, setItemDiscount, setCartDiscount, setCustomer } from '../../store/slices/cartSlice';
import ProductGrid from './components/ProductGrid';
import CartPanel from './components/CartPanel';
import PaymentModal from './components/PaymentModal';

// View mode: categories → subcategories → products
type ViewMode = 'categories' | 'subcategories' | 'products';

export default function POSPage() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: products,
    categories,
    subcategories,
    isLoading,
    pagination,
  } = useSelector((state: RootState) => state.products);
  const cart = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);

  // Get user's discount permissions
  const maxDiscountPercent = user?.role?.maxDiscountPercent ?? 0;
  const canStackDiscounts = user?.role?.canStackDiscounts ?? false;

  const [searchQuery, setSearchQuery] = useState('');
  const [showPayment, setShowPayment] = useState(false);
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemSku, setCustomItemSku] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 48;

  const [viewMode, setViewMode] = useState<ViewMode>('categories');
  const [activeCategoryId, setActiveCategoryId] = useState<number | null>(null);
  const [activeCategoryName, setActiveCategoryName] = useState<string>('');

  // Search bar dropdowns
  const [searchCatId, setSearchCatId] = useState<string>('');
  const [searchSubcatId, setSearchSubcatId] = useState<string>('');
  const [searchSubcats, setSearchSubcats] = useState<any[]>([]);
  const [loadingSearchSubcats, setLoadingSearchSubcats] = useState(false);

  useEffect(() => {
    dispatch(fetchCategories());
  }, [dispatch]);

  // Fetch subcategories for search dropdown when category changes
  useEffect(() => {
    if (!searchCatId) {
      setSearchSubcats([]);
      setSearchSubcatId('');
      return;
    }
    setSearchSubcatId('');
    setLoadingSearchSubcats(true);
    productsApi.getSubcategories(Number(searchCatId))
      .then(res => {
        setSearchSubcats(res.data?.subcategories || res.data || []);
      })
      .catch(() => setSearchSubcats([]))
      .finally(() => setLoadingSearchSubcats(false));
  }, [searchCatId]);

  // Fetch products only when in product view or searching via dropdowns
  useEffect(() => {
    // If searching via dropdowns, category is required
    if (searchCatId) {
      // If subcats exist but none selected, don't fetch yet
      if (searchSubcats.length > 0 && !searchSubcatId) return;

      const timer = setTimeout(() => {
        dispatch(
          fetchProducts({
            search: searchQuery || undefined,
            category: searchSubcatId ? Number(searchSubcatId) : Number(searchCatId),
            limit: pageSize,
            page: currentPage,
          })
        );
      }, 300);
      return () => clearTimeout(timer);
    }

    // Normal tile navigation
    if (viewMode !== 'products') return;

    const timer = setTimeout(() => {
      dispatch(
        fetchProducts({
          search: searchQuery || undefined,
          category: activeCategoryId || undefined,
          limit: pageSize,
          page: currentPage,
        })
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, activeCategoryId, viewMode, currentPage, dispatch, searchCatId, searchSubcatId, searchSubcats.length]);

  // Reset page on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, activeCategoryId, searchCatId, searchSubcatId]);

  // When search dropdowns are used, switch to products view
  useEffect(() => {
    if (searchCatId) {
      setViewMode('products');
      setActiveCategoryId(null);
    }
  }, [searchCatId, searchSubcatId]);

  const handleCategorySelect = (cat: { id: number; name: string }) => {
    setActiveCategoryId(cat.id);
    setActiveCategoryName(cat.name);
    dispatch(fetchSubcategories(cat.id));
    setViewMode('subcategories');
  };

  const handleSubcategorySelect = (subcat: { id: number; name: string }) => {
    setActiveCategoryId(subcat.id);
    setActiveCategoryName(subcat.name);
    // Check if this subcategory has its own children
    dispatch(fetchSubcategories(subcat.id));
    setViewMode('products');
    dispatch(
      fetchProducts({
        category: subcat.id,
        limit: pageSize,
        page: 1,
      })
    );
  };

  const handleBackToCategories = () => {
    setViewMode('categories');
    setActiveCategoryId(null);
    setActiveCategoryName('');
    setSearchQuery('');
  };

  const handleBackToSubcategories = () => {
    // Go back to the parent category's subcategories
    const parentCat = categories.find(c =>
      c.id === activeCategoryId || c.children?.some(sc => sc.id === activeCategoryId)
    );
    if (parentCat) {
      setActiveCategoryId(parentCat.id);
      setActiveCategoryName(parentCat.name);
      dispatch(fetchSubcategories(parentCat.id));
    }
    setViewMode('subcategories');
  };

  const handleViewAllProducts = () => {
    setActiveCategoryId(null);
    setActiveCategoryName('');
    setViewMode('products');
    dispatch(fetchProducts({ limit: pageSize, page: 1 }));
  };

  const handleAddToCart = (product: any) => {
    dispatch(
      addItem({
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.specialPrice || product.price,
        imageUrl: product.thumbnailUrl,
        isSaleItem: !!product.specialPrice,
      })
    );
  };

  const handleAddCustomItem = () => {
    const price = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(price) || price <= 0) return;
    dispatch(
      addItem({
        productId: -Date.now(),
        sku: customItemSku.trim() || 'CUSTOM',
        name: customItemName.trim(),
        price,
      })
    );
    setShowCustomItem(false);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemSku('');
  };

  const handleCheckout = () => {
    if (cart.items.length === 0) return;
    setShowPayment(true);
  };

  const stockMap = products.reduce((acc, product) => {
    acc[product.id] = product.stockQty;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="flex h-full">
      {/* Main Panel */}
      <div className="flex-1 min-w-0 flex flex-col p-4">
        {/* Search Bar with Category/Subcategory dropdowns */}
        <div className="flex gap-2 mb-4">
          {/* Category dropdown (required) */}
          <select
            className="input w-48 shrink-0"
            value={searchCatId}
            onChange={(e) => {
              setSearchCatId(e.target.value);
              if (!e.target.value) {
                setViewMode('categories');
                setActiveCategoryId(null);
                setSearchQuery('');
              }
            }}
          >
            <option value="">Select Category *</option>
            {categories.map((cat) => (
              <option key={cat.id} value={cat.id}>{cat.name}</option>
            ))}
          </select>

          {/* Subcategory dropdown (required if subcats exist) */}
          {searchCatId && (
            <select
              className="input w-48 shrink-0"
              value={searchSubcatId}
              onChange={(e) => setSearchSubcatId(e.target.value)}
              disabled={loadingSearchSubcats}
            >
              <option value="">
                {loadingSearchSubcats ? 'Loading...' : searchSubcats.length > 0 ? 'Select Subcategory *' : 'No subcategories'}
              </option>
              {searchSubcats.map((sc: any) => (
                <option key={sc.id} value={sc.id}>{sc.name}</option>
              ))}
            </select>
          )}

          {/* Text search (optional) */}
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, SKU, or barcode (optional)..."
              className="input pl-12 pr-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
            {searchQuery && (
              <button
                className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                onClick={() => setSearchQuery('')}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            )}
          </div>

          {/* Clear all filters */}
          {searchCatId && (
            <button
              className="btn-sm bg-gray-700 text-gray-300 whitespace-nowrap px-3 hover:bg-gray-600"
              onClick={() => {
                setSearchCatId('');
                setSearchSubcatId('');
                setSearchQuery('');
                setViewMode('categories');
                setActiveCategoryId(null);
              }}
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          )}

          <button
            className="btn-sm bg-purple-600 text-white whitespace-nowrap flex items-center gap-1 px-4"
            onClick={() => setShowCustomItem(true)}
          >
            <PlusCircleIcon className="h-5 w-5" />
            Custom Item
          </button>
        </div>

        {/* Navigation breadcrumb */}
        {viewMode !== 'categories' && !searchCatId && (
          <div className="flex items-center gap-2 mb-4 text-sm">
            <button
              className="text-gray-400 hover:text-white flex items-center gap-1"
              onClick={handleBackToCategories}
            >
              <ChevronLeftIcon className="h-4 w-4" />
              Categories
            </button>
            {viewMode === 'products' && activeCategoryName && (
              <>
                <span className="text-gray-600">/</span>
                <button
                  className="text-gray-400 hover:text-white"
                  onClick={handleBackToSubcategories}
                >
                  {activeCategoryName}
                </button>
              </>
            )}
          </div>
        )}

        {/* CATEGORIES VIEW */}
        {viewMode === 'categories' && !searchCatId && (
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-4 gap-4">
              {/* All Products tile */}
              <button
                className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-center hover:from-primary-500 hover:to-primary-700 transition-all shadow-lg"
                onClick={handleViewAllProducts}
              >
                <div className="text-white font-semibold text-lg">All Products</div>
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  className="bg-gradient-to-br from-pos-accent to-gray-800 rounded-xl p-6 text-center hover:from-gray-600 hover:to-gray-700 transition-all shadow-lg border border-gray-700"
                  onClick={() => handleCategorySelect(cat)}
                >
                  <div className="text-white font-semibold text-lg">{cat.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* SUBCATEGORIES VIEW */}
        {viewMode === 'subcategories' && !searchCatId && (
          <div className="flex-1 overflow-y-auto">
            <h2 className="text-lg font-bold text-white mb-4">{activeCategoryName}</h2>
            <div className="grid grid-cols-4 gap-4">
              {/* All in this category tile */}
              <button
                className="bg-gradient-to-br from-primary-600 to-primary-800 rounded-xl p-6 text-center hover:from-primary-500 hover:to-primary-700 transition-all shadow-lg"
                onClick={() => {
                  setViewMode('products');
                  dispatch(fetchProducts({ category: activeCategoryId!, limit: pageSize, page: 1 }));
                }}
              >
                <div className="text-white font-semibold text-lg">All {activeCategoryName}</div>
              </button>
              {subcategories.map((subcat) => (
                <button
                  key={subcat.id}
                  className="bg-gradient-to-br from-pos-accent to-gray-800 rounded-xl p-6 text-center hover:from-gray-600 hover:to-gray-700 transition-all shadow-lg border border-gray-700"
                  onClick={() => handleSubcategorySelect(subcat)}
                >
                  <div className="text-white font-semibold text-lg">{subcat.name}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* PRODUCTS VIEW */}
        {(viewMode === 'products' || searchCatId) && (
          <>
            <ProductGrid
              products={products}
              isLoading={isLoading}
              onAddToCart={handleAddToCart}
            />

            {pagination.totalPages > 1 && (
              <div className="flex items-center justify-between mt-4 pt-4 border-t border-gray-700">
                <div className="text-sm text-gray-400">
                  Showing {((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, pagination.total)} of {pagination.total} products
                </div>
                <div className="flex items-center gap-2">
                  <button
                    className="btn-sm bg-pos-accent text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeftIcon className="h-4 w-4" />
                  </button>
                  <span className="text-sm text-gray-300 px-2">
                    Page {currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    className="btn-sm bg-pos-accent text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => setCurrentPage(p => Math.min(pagination.totalPages, p + 1))}
                    disabled={currentPage === pagination.totalPages}
                  >
                    <ChevronRightIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Cart Panel */}
      <CartPanel
        items={cart.items}
        subtotal={cart.subtotal}
        discount={cart.itemDiscounts + cart.cartDiscountAmount}
        tax={cart.taxAmount}
        total={cart.grandTotal}
        customerName={cart.customerName}
        cartDiscount={cart.cartDiscount}
        maxDiscountPercent={maxDiscountPercent}
        canStackDiscounts={canStackDiscounts}
        stockMap={stockMap}
        onRemoveItem={(productId) => dispatch(removeItem(productId))}
        onUpdateQuantity={(productId, qty) =>
          dispatch(updateQuantity({ productId, quantity: qty }))
        }
        onSetItemDiscount={(productId, discountPercent) =>
          dispatch(setItemDiscount({ productId, discountPercent }))
        }
        onSetCartDiscount={(discount) => dispatch(setCartDiscount(discount))}
        onSetCustomer={(customer) => dispatch(setCustomer(customer))}
        onClearCart={() => dispatch(clearCart())}
        onCheckout={handleCheckout}
      />

      {/* Payment Modal */}
      {showPayment && (
        <PaymentModal
          total={cart.grandTotal}
          onClose={() => setShowPayment(false)}
          onComplete={() => {
            setShowPayment(false);
            dispatch(clearCart());
          }}
        />
      )}

      {/* Custom Item Modal */}
      {showCustomItem && (
        <div className="modal-backdrop" onClick={() => setShowCustomItem(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Add Custom Item</h3>
              <button className="text-gray-400 hover:text-white" onClick={() => setShowCustomItem(false)}>
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 mb-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Item Name *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Custom Light Fitting"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  autoFocus
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Price (incl. GST) *</label>
                <input
                  type="number"
                  className="input"
                  placeholder="0.00"
                  min={0}
                  step={0.01}
                  value={customItemPrice}
                  onChange={(e) => setCustomItemPrice(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">SKU (optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="CUSTOM-001"
                  value={customItemSku}
                  onChange={(e) => setCustomItemSku(e.target.value)}
                />
              </div>
            </div>
            <button
              className="btn-primary w-full"
              onClick={handleAddCustomItem}
              disabled={!customItemName.trim() || !customItemPrice || parseFloat(customItemPrice) <= 0}
            >
              Add to Cart
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
