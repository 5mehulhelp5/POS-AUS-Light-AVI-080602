import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { MagnifyingGlassIcon, XMarkIcon, ChevronLeftIcon, ChevronRightIcon, PlusCircleIcon } from '@heroicons/react/24/outline';
import { RootState, AppDispatch } from '../../store';
import {
  fetchProducts,
  fetchCategories,
  fetchSubcategories,
  setSelectedCategory,
  setSelectedSubcategory,
  navigateToCategory,
  navigateToBreadcrumb,
  clearSubcategories,
} from '../../store/slices/productsSlice';
import { addItem, removeItem, updateQuantity, clearCart, setItemDiscount, setCartDiscount, setCustomer } from '../../store/slices/cartSlice';
import ProductGrid from './components/ProductGrid';
import CartPanel from './components/CartPanel';
import PaymentModal from './components/PaymentModal';

export default function POSPage() {
  const dispatch = useDispatch<AppDispatch>();
  const {
    items: products,
    categories,
    subcategories,
    isLoading,
    selectedCategory,
    selectedSubcategory,
    parentCategoryName,
    categoryPath,
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
  const pageSize = 48; // Products per page (good for grid layout)

  useEffect(() => {
    dispatch(fetchProducts({ limit: pageSize, page: 1 }));
    dispatch(fetchCategories());
  }, [dispatch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      // Determine category filter: use deepest level of navigation
      let categoryFilter: number | undefined;
      if (categoryPath.length > 0) {
        categoryFilter = categoryPath[categoryPath.length - 1].id;
      } else if (selectedCategory) {
        categoryFilter = selectedCategory;
      }

      dispatch(
        fetchProducts({
          search: searchQuery || undefined,
          category: categoryFilter,
          limit: pageSize,
          page: currentPage,
        })
      );
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, selectedCategory, categoryPath, currentPage, dispatch]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, categoryPath]);

  // Fetch subcategories when category path changes
  useEffect(() => {
    if (categoryPath.length > 0) {
      // Fetch children of the last category in the path
      const lastCategoryId = categoryPath[categoryPath.length - 1].id;
      dispatch(fetchSubcategories(lastCategoryId));
    } else if (selectedCategory) {
      dispatch(fetchSubcategories(selectedCategory));
    }
  }, [selectedCategory, categoryPath, dispatch]);

  const handleCategoryClick = (categoryId: number | null) => {
    dispatch(setSelectedCategory(categoryId));
  };

  // Handle clicking a subcategory - drill down if it has children
  const handleSubcategoryClick = (subcategory: { id: number; name: string } | null) => {
    if (subcategory === null) {
      dispatch(setSelectedSubcategory(null));
    } else {
      // Navigate into this category to see its children
      dispatch(navigateToCategory(subcategory));
    }
  };

  // Handle clicking "All [Category]" to just filter without drilling down
  const handleFilterByCurrentCategory = () => {
    dispatch(setSelectedSubcategory(null));
  };

  const handleBackToCategories = () => {
    dispatch(clearSubcategories());
    dispatch(setSelectedCategory(null));
  };

  // Handle breadcrumb navigation - go back to a specific level
  const handleBreadcrumbClick = (index: number) => {
    dispatch(navigateToBreadcrumb(index));
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
        productId: -Date.now(), // negative ID to distinguish custom items
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

  // Create stock map from products for cart validation
  const stockMap = products.reduce((acc, product) => {
    acc[product.id] = product.stockQty;
    return acc;
  }, {} as Record<number, number>);

  return (
    <div className="flex h-full">
      {/* Products Panel */}
      <div className="flex-1 min-w-0 flex flex-col p-4">
        {/* Search Bar */}
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search products by name, SKU, or barcode..."
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
          <button
            className="btn-sm bg-purple-600 text-white whitespace-nowrap flex items-center gap-1 px-4"
            onClick={() => setShowCustomItem(true)}
          >
            <PlusCircleIcon className="h-5 w-5" />
            Custom Item
          </button>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-col gap-2 mb-4">
          {/* Breadcrumb trail when navigating deep */}
          {categoryPath.length > 0 && (
            <div className="flex items-center gap-1 text-sm text-gray-400 mb-1">
              <button
                className="hover:text-white"
                onClick={() => handleBreadcrumbClick(-1)}
              >
                All
              </button>
              {categoryPath.map((crumb, index) => (
                <span key={crumb.id} className="flex items-center gap-1">
                  <span>/</span>
                  <button
                    className="hover:text-white"
                    onClick={() => handleBreadcrumbClick(index)}
                  >
                    {crumb.name}
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Category buttons */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {categoryPath.length > 0 || subcategories.length > 0 ? (
              <>
                {/* Back button */}
                <button
                  className="btn-sm whitespace-nowrap bg-gray-600 text-white flex items-center gap-1"
                  onClick={() => {
                    if (categoryPath.length > 1) {
                      handleBreadcrumbClick(categoryPath.length - 2);
                    } else {
                      handleBackToCategories();
                    }
                  }}
                >
                  <ChevronLeftIcon className="h-4 w-4" />
                  Back
                </button>
                {/* Show current level name - clicking shows all in this category */}
                <button
                  className={`btn-sm whitespace-nowrap ${
                    subcategories.length === 0 || !selectedSubcategory
                      ? 'bg-primary-600 text-white'
                      : 'bg-pos-accent text-gray-300'
                  }`}
                  onClick={handleFilterByCurrentCategory}
                >
                  All {categoryPath.length > 0 ? categoryPath[categoryPath.length - 1].name : parentCategoryName}
                </button>
                {/* Subcategories - click to drill down */}
                {subcategories.map((subcat) => (
                  <button
                    key={subcat.id}
                    className="btn-sm whitespace-nowrap bg-pos-accent text-gray-300 hover:bg-primary-600 hover:text-white"
                    onClick={() => handleSubcategoryClick({ id: subcat.id, name: subcat.name })}
                  >
                    {subcat.name}
                  </button>
                ))}
              </>
            ) : (
              <>
                {/* Main categories */}
                <button
                  className={`btn-sm whitespace-nowrap ${
                    !selectedCategory
                      ? 'bg-primary-600 text-white'
                      : 'bg-pos-accent text-gray-300'
                  }`}
                  onClick={() => handleCategoryClick(null)}
                >
                  All Products
                </button>
                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    className={`btn-sm whitespace-nowrap ${
                      selectedCategory === cat.id
                        ? 'bg-primary-600 text-white'
                        : 'bg-pos-accent text-gray-300'
                    }`}
                    onClick={() => handleCategoryClick(cat.id)}
                  >
                    {cat.name}
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Products Grid */}
        <ProductGrid
          products={products}
          isLoading={isLoading}
          onAddToCart={handleAddToCart}
        />

        {/* Pagination Controls */}
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
