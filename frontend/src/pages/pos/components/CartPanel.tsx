import { useState } from 'react';
import {
  TrashIcon,
  MinusIcon,
  PlusIcon,
  UserIcon,
  XMarkIcon,
  TagIcon,
  ExclamationTriangleIcon,
  MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';
import { CartItem, CartDiscount } from '../../../store/slices/cartSlice';
import { competitorApi, customersApi } from '../../../services/api';

interface CartPanelProps {
  items: CartItem[];
  subtotal: number;
  discount: number;
  tax: number;
  total: number;
  customerName: string | null;
  cartDiscount: CartDiscount | null;
  maxDiscountPercent: number;
  canStackDiscounts: boolean;
  stockMap?: Record<number, number>; // productId -> available stock
  onRemoveItem: (productId: number) => void;
  onUpdateQuantity: (productId: number, quantity: number) => void;
  onSetItemDiscount: (productId: number, discountPercent: number) => void;
  onSetItemUnitPrice: (productId: number, unitPrice: number) => void;
  onSetCartDiscount: (discount: CartDiscount | null) => void;
  onSetCustomer: (customer: { id: number; name: string } | null) => void;
  onClearCart: () => void;
  onCheckout: () => void;
}

export default function CartPanel({
  items,
  subtotal,
  discount,
  tax,
  total,
  customerName,
  cartDiscount,
  maxDiscountPercent,
  canStackDiscounts,
  stockMap = {},
  onRemoveItem,
  onUpdateQuantity,
  onSetItemDiscount,
  onSetItemUnitPrice,
  onSetCartDiscount,
  onSetCustomer,
  onClearCart,
  onCheckout,
}: CartPanelProps) {
  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [custResults, setCustResults] = useState<any[]>([]);
  const [custSearching, setCustSearching] = useState(false);
  const [showCreateCustomer, setShowCreateCustomer] = useState(false);
  const [newCustFirstName, setNewCustFirstName] = useState('');
  const [newCustLastName, setNewCustLastName] = useState('');
  const [newCustEmail, setNewCustEmail] = useState('');
  const [newCustPhone, setNewCustPhone] = useState('');
  const [createCustError, setCreateCustError] = useState('');
  const [discountType, setDiscountType] = useState<'percent' | 'fixed'>('percent');
  const [discountValue, setDiscountValue] = useState('');
  const [discountReason, setDiscountReason] = useState('');
  const [editingItemDiscount, setEditingItemDiscount] = useState<number | null>(null);
  const [itemDiscountValue, setItemDiscountValue] = useState('');
  const [editingUnitPrice, setEditingUnitPrice] = useState<number | null>(null);
  const [unitPriceInput, setUnitPriceInput] = useState('');
  const [editingQuantity, setEditingQuantity] = useState<number | null>(null);
  const [quantityInput, setQuantityInput] = useState('');
  const [competitorPrices, setCompetitorPrices] = useState<
    Record<number, { price: number | null; loading: boolean; error?: string; url?: string | null }>
  >({});

  const handleComparePrice = async (productId: number, productName: string, sku: string) => {
    // If already loaded, toggle visibility by clearing it
    if (competitorPrices[productId] && !competitorPrices[productId].loading) {
      setCompetitorPrices((prev) => {
        const next = { ...prev };
        delete next[productId];
        return next;
      });
      return;
    }

    setCompetitorPrices((prev) => ({
      ...prev,
      [productId]: { price: null, loading: true },
    }));

    try {
      const { data } = await competitorApi.getPrice(productName, sku);
      setCompetitorPrices((prev) => ({
        ...prev,
        [productId]: {
          price: data.price,
          loading: false,
          error: data.error,
          url: data.url,
        },
      }));
    } catch {
      setCompetitorPrices((prev) => ({
        ...prev,
        [productId]: { price: null, loading: false, error: 'Failed to fetch' },
      }));
    }
  };

  const handleQuantityBlur = (productId: number) => {
    setEditingQuantity(null);
    const qty = parseInt(quantityInput, 10);
    if (!isNaN(qty) && qty > 0) {
      onUpdateQuantity(productId, qty);
    } else if (qty === 0 || quantityInput === '') {
      // If 0 or empty, remove the item
      onRemoveItem(productId);
    }
  };

  const handleQuantityKeyDown = (e: React.KeyboardEvent, productId: number) => {
    if (e.key === 'Enter') {
      handleQuantityBlur(productId);
    } else if (e.key === 'Escape') {
      setEditingQuantity(null);
    }
  };

  const handleApplyCartDiscount = () => {
    const value = parseFloat(discountValue);
    if (value > 0) {
      if (discountType === 'percent' && value > maxDiscountPercent) {
        alert(`Maximum discount is ${maxDiscountPercent}%`);
        return;
      }
      onSetCartDiscount({
        type: discountType,
        value,
        reason: discountReason || undefined,
      });
    }
    setShowDiscountModal(false);
    setDiscountValue('');
    setDiscountReason('');
  };

  const handleApplyItemDiscount = (productId: number) => {
    const value = parseFloat(itemDiscountValue);
    if (value >= 0 && value <= maxDiscountPercent) {
      onSetItemDiscount(productId, value);
    } else if (value > maxDiscountPercent) {
      alert(`Maximum discount is ${maxDiscountPercent}%`);
      return;
    }
    setEditingItemDiscount(null);
    setItemDiscountValue('');
  };

  return (
    <div className="w-80 bg-pos-card border-l border-gray-700 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold">Current Sale</h2>
        {items.length > 0 && (
          <button
            className="text-red-400 hover:text-red-300 text-sm flex items-center gap-1"
            onClick={onClearCart}
          >
            <XMarkIcon className="h-4 w-4" />
            Clear
          </button>
        )}
      </div>

      {/* Customer */}
      <div className="p-4 border-b border-gray-700">
        {customerName ? (
          <div className="flex items-center justify-between bg-pos-accent rounded-lg px-3 py-2">
            <div className="flex items-center gap-2">
              <UserIcon className="h-5 w-5 text-primary-400" />
              <span className="font-medium">{customerName}</span>
            </div>
            <button
              className="text-gray-400 hover:text-red-400"
              onClick={() => onSetCustomer(null)}
              title="Remove customer"
            >
              <XMarkIcon className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <button
            className="w-full btn-secondary flex items-center justify-center gap-2"
            onClick={() => { setShowCustomerModal(true); setCustResults([]); setShowCreateCustomer(false); }}
          >
            <UserIcon className="h-5 w-5" />
            Create / Search Customer
          </button>
        )}
      </div>

      {/* Cart Items */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {items.length === 0 ? (
          <div className="h-full flex items-center justify-center text-gray-500">
            Cart is empty
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {items.map((item) => (
              <div key={item.productId} className="p-4">
                <div className="flex gap-3">
                  {/* Image */}
                  <div className="w-12 h-12 bg-pos-accent rounded overflow-hidden flex-shrink-0">
                    {item.imageUrl ? (
                      <img
                        src={item.imageUrl}
                        alt={item.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500 text-xs">
                        N/A
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm truncate">{item.name}</h3>
                    <p className="text-xs text-gray-400 font-mono">{item.sku}</p>
                    {item.isBackorder && (
                      <span className="inline-block mt-0.5 px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-cyan-600/30 text-cyan-300">
                        Backorder
                      </span>
                    )}
                    <div className="flex items-center justify-between mt-1">
                      {editingUnitPrice === item.productId ? (
                        <input
                          type="number"
                          step="0.01"
                          min={0}
                          autoFocus
                          className="input py-0.5 px-1.5 text-sm w-24"
                          value={unitPriceInput}
                          onChange={(e) => setUnitPriceInput(e.target.value)}
                          onBlur={() => {
                            const v = parseFloat(unitPriceInput);
                            if (!isNaN(v) && v >= 0) {
                              onSetItemUnitPrice(item.productId, v);
                            }
                            setEditingUnitPrice(null);
                            setUnitPriceInput('');
                          }}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const v = parseFloat(unitPriceInput);
                              if (!isNaN(v) && v >= 0) {
                                onSetItemUnitPrice(item.productId, v);
                              }
                              setEditingUnitPrice(null);
                              setUnitPriceInput('');
                            } else if (e.key === 'Escape') {
                              setEditingUnitPrice(null);
                              setUnitPriceInput('');
                            }
                          }}
                        />
                      ) : (
                        <button
                          className="text-sm hover:text-primary-400"
                          title="Click to edit unit price"
                          onClick={() => {
                            setEditingUnitPrice(item.productId);
                            setUnitPriceInput(item.unitPrice.toFixed(2));
                          }}
                        >
                          ${item.unitPrice.toFixed(2)}
                        </button>
                      )}
                      {item.discountPercent > 0 && (
                        <span className="text-xs text-green-400">
                          -{item.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Remove button */}
                  <button
                    className="text-gray-400 hover:text-red-400"
                    onClick={() => onRemoveItem(item.productId)}
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </div>

                {/* Quantity controls and item discount */}
                {(() => {
                  const stock = stockMap[item.productId];
                  const exceedsStock = stock !== undefined && item.quantity > stock;
                  return (
                    <>
                      <div className="flex items-center justify-between mt-3">
                        <div className="flex items-center gap-2">
                          <button
                            className="w-8 h-8 bg-pos-accent rounded flex items-center justify-center hover:bg-pos-bg"
                            onClick={() =>
                              onUpdateQuantity(item.productId, item.quantity - 1)
                            }
                          >
                            <MinusIcon className="h-4 w-4" />
                          </button>
                          {editingQuantity === item.productId ? (
                            <input
                              type="number"
                              className={`w-14 h-8 text-center font-mono bg-pos-bg border rounded text-sm ${
                                exceedsStock ? 'border-yellow-500' : 'border-gray-600'
                              }`}
                              value={quantityInput}
                              onChange={(e) => setQuantityInput(e.target.value)}
                              onBlur={() => handleQuantityBlur(item.productId)}
                              onKeyDown={(e) => handleQuantityKeyDown(e, item.productId)}
                              min={0}
                              autoFocus
                            />
                          ) : (
                            <button
                              className={`w-14 h-8 text-center font-mono bg-pos-bg border rounded hover:border-primary-500 ${
                                exceedsStock ? 'border-yellow-500 text-yellow-400' : 'border-gray-600'
                              }`}
                              onClick={() => {
                                setEditingQuantity(item.productId);
                                setQuantityInput(item.quantity.toString());
                              }}
                            >
                              {item.quantity}
                            </button>
                          )}
                          <button
                            className="w-8 h-8 bg-pos-accent rounded flex items-center justify-center hover:bg-pos-bg"
                            onClick={() =>
                              onUpdateQuantity(item.productId, item.quantity + 1)
                            }
                          >
                            <PlusIcon className="h-4 w-4" />
                          </button>
                          {/* Item discount button - blocked for SALE items */}
                          <button
                            className={`w-8 h-8 rounded flex items-center justify-center ${
                              item.isSaleItem
                                ? 'bg-red-900/50 text-red-400 cursor-not-allowed'
                                : item.discountPercent > 0
                                ? 'bg-green-600 text-white'
                                : 'bg-pos-accent hover:bg-pos-bg text-gray-400'
                            }`}
                            onClick={() => {
                              if (item.isSaleItem) {
                                alert('Cannot apply further discount on SALE/Clearance items');
                                return;
                              }
                              setEditingItemDiscount(item.productId);
                              setItemDiscountValue(item.discountPercent.toString());
                            }}
                            title={item.isSaleItem ? 'No discount on SALE items' : 'Apply item discount'}
                          >
                            <TagIcon className="h-4 w-4" />
                          </button>
                          {/* Compare competitor price button */}
                          <button
                            className={`w-8 h-8 rounded flex items-center justify-center ${
                              competitorPrices[item.productId]?.price
                                ? 'bg-blue-600 text-white'
                                : 'bg-pos-accent hover:bg-pos-bg text-gray-400 hover:text-primary-400'
                            }`}
                            onClick={() => handleComparePrice(item.productId, item.name, item.sku)}
                            title="Check competitor price"
                          >
                            {competitorPrices[item.productId]?.loading ? (
                              <div className="h-4 w-4 border-2 border-gray-400 border-t-white rounded-full animate-spin" />
                            ) : (
                              <MagnifyingGlassIcon className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                        <span className="font-bold">
                          ${item.rowTotal.toFixed(2)}
                        </span>
                      </div>
                      {/* Stock warning */}
                      {exceedsStock && (
                        <div className="mt-2 flex items-center gap-1 text-yellow-400 text-xs">
                          <ExclamationTriangleIcon className="h-4 w-4" />
                          <span>Only {stock} in stock</span>
                        </div>
                      )}
                      {/* Competitor price */}
                      {competitorPrices[item.productId] && !competitorPrices[item.productId].loading && (
                        <div className="mt-2 flex items-center gap-2 text-xs">
                          {competitorPrices[item.productId].price !== null ? (
                            <>
                              <span className="text-gray-400">Competitor:</span>
                              <span className={`font-bold ${
                                competitorPrices[item.productId].price! < item.unitPrice
                                  ? 'text-red-400'
                                  : competitorPrices[item.productId].price! > item.unitPrice
                                  ? 'text-green-400'
                                  : 'text-yellow-400'
                              }`}>
                                ${competitorPrices[item.productId].price!.toFixed(2)}
                              </span>
                              {competitorPrices[item.productId].price! < item.unitPrice && (
                                <span className="text-red-400">
                                  (${(item.unitPrice - competitorPrices[item.productId].price!).toFixed(2)} more)
                                </span>
                              )}
                              {competitorPrices[item.productId].price! > item.unitPrice && (
                                <span className="text-green-400">
                                  (${(competitorPrices[item.productId].price! - item.unitPrice).toFixed(2)} cheaper)
                                </span>
                              )}
                              {competitorPrices[item.productId].url && (
                                <a
                                  href={competitorPrices[item.productId].url!}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-blue-400 hover:text-blue-300 underline ml-auto"
                                >
                                  View
                                </a>
                              )}
                            </>
                          ) : (
                            <span className="text-gray-500">
                              {competitorPrices[item.productId].error || 'Not found on competitor site'}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Item discount input */}
                      {editingItemDiscount === item.productId && (
                        <div className="mt-2 flex gap-2">
                          <input
                            type="number"
                            className="input flex-1 text-sm py-1"
                            placeholder={maxDiscountPercent >= 100 ? 'No Limit' : `Max ${maxDiscountPercent}%`}
                            value={itemDiscountValue}
                            onChange={(e) => setItemDiscountValue(e.target.value)}
                            max={maxDiscountPercent}
                            min={0}
                            autoFocus
                          />
                          <button
                            className="btn-sm bg-green-600 text-white px-3"
                            onClick={() => handleApplyItemDiscount(item.productId)}
                          >
                            Apply
                          </button>
                          <button
                            className="btn-sm bg-gray-600 text-white px-2"
                            onClick={() => {
                              setEditingItemDiscount(null);
                              setItemDiscountValue('');
                            }}
                          >
                            <XMarkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}
                    </>
                  );
                })()}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Totals */}
      <div className="border-t border-gray-700 p-4 space-y-2">
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">Subtotal</span>
          <span>${subtotal.toFixed(2)}</span>
        </div>
        {discount > 0 && (
          <div className="flex justify-between text-sm text-green-400">
            <span className="flex items-center gap-1">
              Discount
              {cartDiscount && (
                <button
                  className="text-red-400 hover:text-red-300"
                  onClick={() => onSetCartDiscount(null)}
                  title="Remove cart discount"
                >
                  <XMarkIcon className="h-3 w-3" />
                </button>
              )}
            </span>
            <span>-${discount.toFixed(2)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-400">GST included</span>
          <span>${tax.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-xl font-bold pt-2 border-t border-gray-600">
          <span>Total (incl. GST)</span>
          <span className="text-primary-400">${total.toFixed(2)}</span>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="p-4 pt-0 space-y-2">
        {/* Cart Discount Button */}
        {items.length > 0 && (
          <button
            className={`w-full btn flex items-center justify-center gap-2 ${
              cartDiscount
                ? 'bg-green-600 text-white'
                : 'bg-pos-accent text-gray-300 hover:bg-pos-bg'
            }`}
            onClick={() => setShowDiscountModal(true)}
          >
            <TagIcon className="h-5 w-5" />
            {cartDiscount
              ? `Further Discount: ${cartDiscount.type === 'percent' ? `${cartDiscount.value}%` : `$${cartDiscount.value}`}`
              : 'Add Further Discount'}
          </button>
        )}

        {/* Checkout Button */}
        <button
          className="btn-success w-full btn-lg text-lg"
          onClick={onCheckout}
          disabled={items.length === 0}
        >
          Pay ${total.toFixed(2)}
        </button>
      </div>

      {/* Cart Discount Modal */}
      {showDiscountModal && (
        <div className="modal-backdrop" onClick={() => setShowDiscountModal(false)}>
          <div className="modal-content max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">Apply Further Discount</h3>
              <button
                className="text-gray-400 hover:text-white"
                onClick={() => setShowDiscountModal(false)}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            <p className="text-sm text-gray-400 mb-4">
              Max discount: {maxDiscountPercent >= 100 ? 'No Limit (Admin)' : `${maxDiscountPercent}%`} | Stacking: {canStackDiscounts ? 'Allowed' : 'Not allowed'}
            </p>

            {/* Discount Type */}
            <div className="flex gap-2 mb-4">
              <button
                className={`flex-1 py-2 rounded-lg border-2 transition-colors ${
                  discountType === 'percent'
                    ? 'border-primary-500 bg-primary-500/20'
                    : 'border-gray-600'
                }`}
                onClick={() => setDiscountType('percent')}
              >
                Percentage (%)
              </button>
              <button
                className={`flex-1 py-2 rounded-lg border-2 transition-colors ${
                  discountType === 'fixed'
                    ? 'border-primary-500 bg-primary-500/20'
                    : 'border-gray-600'
                }`}
                onClick={() => setDiscountType('fixed')}
              >
                Fixed ($)
              </button>
            </div>

            {/* Discount Value */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                {discountType === 'percent' ? (maxDiscountPercent >= 100 ? 'Discount % (No Limit)' : `Discount % (max ${maxDiscountPercent}%)`) : 'Discount Amount ($)'}
              </label>
              <input
                type="number"
                className="input"
                placeholder={discountType === 'percent' ? '10' : '50.00'}
                value={discountValue}
                onChange={(e) => setDiscountValue(e.target.value)}
                max={discountType === 'percent' ? maxDiscountPercent : undefined}
                min={0}
                autoFocus
              />
            </div>

            {/* Reason */}
            <div className="mb-4">
              <label className="block text-sm text-gray-400 mb-1">
                Reason (optional)
              </label>
              <input
                type="text"
                className="input"
                placeholder="e.g., Loyal customer, Price match"
                value={discountReason}
                onChange={(e) => setDiscountReason(e.target.value)}
              />
            </div>

            {/* Apply Button */}
            <button
              className="btn-primary w-full"
              onClick={handleApplyCartDiscount}
              disabled={!discountValue || parseFloat(discountValue) <= 0}
            >
              Apply Discount
            </button>
          </div>
        </div>
      )}

      {/* Customer Search / Create Modal */}
      {showCustomerModal && (
        <div className="modal-backdrop" onClick={() => setShowCustomerModal(false)}>
          <div className="modal-content max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold">
                {showCreateCustomer ? 'Create New Customer' : 'Create / Search Customer'}
              </h3>
              <button
                className="text-gray-400 hover:text-white"
                onClick={() => setShowCustomerModal(false)}
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>

            {!showCreateCustomer ? (
              <>
                {/* Separate search fields */}
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Customer ID</label>
                    <input
                      type="number"
                      placeholder="Enter customer ID"
                      className="input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val) {
                            setCustSearching(true);
                            customersApi
                              .getCustomers({ search: val, limit: 10 })
                              .then((res) => {
                                const all = res.data.data?.customers || [];
                                setCustResults(all.filter((c: any) => c.id === parseInt(val)));
                              })
                              .catch(() => setCustResults([]))
                              .finally(() => setCustSearching(false));
                          }
                        }
                      }}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Customer Name</label>
                    <input
                      type="text"
                      placeholder="Search by name"
                      className="input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val.length >= 2) {
                            setCustSearching(true);
                            customersApi
                              .getCustomers({ search: val, limit: 10 })
                              .then((res) => setCustResults(res.data.data?.customers || []))
                              .catch(() => setCustResults([]))
                              .finally(() => setCustSearching(false));
                          }
                        }
                      }}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Phone Number</label>
                    <input
                      type="tel"
                      placeholder="Search by phone"
                      className="input"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          const val = (e.target as HTMLInputElement).value.trim();
                          if (val.length >= 3) {
                            setCustSearching(true);
                            customersApi
                              .getCustomers({ search: val, limit: 10 })
                              .then((res) => setCustResults(res.data.data?.customers || []))
                              .catch(() => setCustResults([]))
                              .finally(() => setCustSearching(false));
                          }
                        }
                      }}
                    />
                  </div>
                </div>

                <p className="text-xs text-gray-500 mb-3">Type in any field and press Enter to search</p>

                {/* Results */}
                <div className="space-y-1 mb-4 max-h-48 overflow-auto">
                  {custSearching && (
                    <p className="text-sm text-gray-400 text-center py-2">Searching...</p>
                  )}
                  {!custSearching && custResults.length > 0 && (
                    <>
                      <p className="text-xs text-gray-400 mb-1">{custResults.length} result(s)</p>
                      {custResults.map((c: any) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-4 py-3 rounded-lg hover:bg-pos-accent border border-gray-700"
                          onClick={() => {
                            onSetCustomer({ id: c.id, name: `${c.firstName} ${c.lastName}` });
                            setShowCustomerModal(false);
                          }}
                        >
                          <p className="font-medium">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-400">
                            ID: {c.id} {c.email ? `| ${c.email}` : ''} {c.phone ? `| ${c.phone}` : ''}
                          </p>
                        </button>
                      ))}
                    </>
                  )}
                </div>

                {/* Create New button */}
                <button
                  className="btn-primary w-full"
                  onClick={() => {
                    setShowCreateCustomer(true);
                    setNewCustFirstName('');
                    setNewCustLastName('');
                    setNewCustEmail('');
                    setNewCustPhone('');
                    setCreateCustError('');
                  }}
                >
                  <PlusIcon className="h-5 w-5 mr-2 inline" />
                  Create New Customer
                </button>
              </>
            ) : (
              <>
                {/* Create Customer Form */}
                <div className="space-y-3 mb-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">First Name *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="First name"
                        value={newCustFirstName}
                        onChange={(e) => setNewCustFirstName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Last Name *</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Last name"
                        value={newCustLastName}
                        onChange={(e) => setNewCustLastName(e.target.value)}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Email</label>
                    <input
                      type="email"
                      className="input"
                      placeholder="email@example.com"
                      value={newCustEmail}
                      onChange={(e) => setNewCustEmail(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Phone Number *</label>
                    <input
                      type="tel"
                      className="input"
                      placeholder="04XX XXX XXX"
                      value={newCustPhone}
                      onChange={(e) => setNewCustPhone(e.target.value)}
                    />
                  </div>
                </div>

                {createCustError && (
                  <div className="bg-red-500/20 text-red-400 p-2 rounded text-sm mb-3">
                    {createCustError}
                  </div>
                )}

                <div className="flex gap-3">
                  <button
                    className="btn-secondary flex-1"
                    onClick={() => setShowCreateCustomer(false)}
                  >
                    Back
                  </button>
                  <button
                    className="btn-primary flex-1"
                    onClick={async () => {
                      if (!newCustFirstName.trim() || !newCustLastName.trim()) {
                        setCreateCustError('First and last name are required');
                        return;
                      }
                      if (!newCustPhone.trim()) {
                        setCreateCustError('Phone number is required');
                        return;
                      }
                      try {
                        const res = await customersApi.createCustomer({
                          firstName: newCustFirstName.trim(),
                          lastName: newCustLastName.trim(),
                          email: newCustEmail.trim() || null,
                          phone: newCustPhone.trim(),
                        });
                        const created = res.data.data?.customer || res.data.data;
                        onSetCustomer({
                          id: created.id,
                          name: `${created.firstName} ${created.lastName}`,
                        });
                        setShowCustomerModal(false);
                      } catch (err: any) {
                        setCreateCustError(
                          err.response?.data?.message || 'Failed to create customer'
                        );
                      }
                    }}
                  >
                    Create & Add
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
