import { useState, useEffect } from 'react';
import { quotesApi, customersApi, productsApi } from '../../services/api';
import { MagnifyingGlassIcon, EyeIcon, ClockIcon, PlusIcon, PlusCircleIcon, TrashIcon, XMarkIcon } from '@heroicons/react/24/outline';

interface Quote {
  id: number;
  quoteNumber: string;
  status: string;
  grandTotal: number;
  customer: { id: number; firstName: string; lastName: string } | null;
  user: { id: number; firstName: string; lastName: string };
  itemCount: number;
  expiresAt: string;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface QuoteLineItem {
  productId: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  discountPercent: number;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

  // Create Quote modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');
  const [customerResults, setCustomerResults] = useState<any[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<any>(null);
  const [productSearch, setProductSearch] = useState('');
  const [productResults, setProductResults] = useState<any[]>([]);
  const [lineItems, setLineItems] = useState<QuoteLineItem[]>([]);
  const [quoteNotes, setQuoteNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createError, setCreateError] = useState('');
  const [showCustomItem, setShowCustomItem] = useState(false);
  const [customItemName, setCustomItemName] = useState('');
  const [customItemPrice, setCustomItemPrice] = useState('');
  const [customItemSku, setCustomItemSku] = useState('');
  const [quoteBuyerType, setQuoteBuyerType] = useState<'trade' | 'customer'>('customer');

  useEffect(() => {
    fetchQuotes();
  }, [pagination.page, statusFilter]);

  const fetchQuotes = async () => {
    try {
      setIsLoading(true);
      const response = await quotesApi.getQuotes({
        status: statusFilter || undefined,
        page: pagination.page,
        limit: 20,
      });
      setQuotes(response.data.data.quotes);
      setPagination(response.data.data.pagination);
    } catch (error) {
      console.error('Failed to fetch quotes:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const viewQuote = async (id: number) => {
    try {
      const response = await quotesApi.getQuote(id);
      setSelectedQuote(response.data.data.quote);
    } catch (error) {
      console.error('Failed to fetch quote:', error);
    }
  };

  // Customer search for create modal
  useEffect(() => {
    if (customerSearch.length < 2) {
      setCustomerResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await customersApi.getCustomers({ search: customerSearch, limit: 5 });
        setCustomerResults(response.data.data?.customers || []);
      } catch {
        setCustomerResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [customerSearch]);

  // Product search for create modal
  useEffect(() => {
    if (productSearch.length < 2) {
      setProductResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const response = await productsApi.getProducts({ search: productSearch, limit: 5 });
        setProductResults(response.data.data?.products || []);
      } catch {
        setProductResults([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [productSearch]);

  const addLineItem = (product: any) => {
    // Don't add duplicate
    if (lineItems.find((li) => li.productId === product.id)) return;
    setLineItems([
      ...lineItems,
      {
        productId: product.id,
        name: product.name,
        sku: product.sku,
        price: product.specialPrice || product.price,
        quantity: 1,
        discountPercent: 0,
      },
    ]);
    setProductSearch('');
    setProductResults([]);
  };

  const addCustomLineItem = () => {
    const price = parseFloat(customItemPrice);
    if (!customItemName.trim() || isNaN(price) || price <= 0) return;
    setLineItems([
      ...lineItems,
      {
        productId: -Date.now(),
        name: customItemName.trim(),
        sku: customItemSku.trim() || 'CUSTOM',
        price,
        quantity: 1,
        discountPercent: 0,
      },
    ]);
    setShowCustomItem(false);
    setCustomItemName('');
    setCustomItemPrice('');
    setCustomItemSku('');
  };

  const updateLineItem = (index: number, field: keyof QuoteLineItem, value: number) => {
    const updated = [...lineItems];
    (updated[index] as any)[field] = value;
    setLineItems(updated);
  };

  const removeLineItem = (index: number) => {
    setLineItems(lineItems.filter((_, i) => i !== index));
  };

  const getLineTotal = (item: QuoteLineItem) => {
    const sub = item.price * item.quantity;
    const disc = sub * (item.discountPercent / 100);
    return sub - disc;
  };

  const getQuoteSubtotal = () => lineItems.reduce((sum, li) => sum + li.price * li.quantity, 0);
  const getQuoteDiscount = () => lineItems.reduce((sum, li) => sum + (li.price * li.quantity * (li.discountPercent / 100)), 0);
  const getQuoteTax = () => (getQuoteSubtotal() - getQuoteDiscount()) * 0.1;
  const getQuoteTotal = () => getQuoteSubtotal() - getQuoteDiscount() + getQuoteTax();

  const handleCreateQuote = async () => {
    if (lineItems.length === 0) {
      setCreateError('Add at least one product');
      return;
    }
    setCreateError('');
    setIsSubmitting(true);
    try {
      const expiryDays = quoteBuyerType === 'trade' ? 90 : 30;
      const notesPrefix = `[${quoteBuyerType === 'trade' ? 'TRADE' : 'CUSTOMER'}]`;
      await quotesApi.createQuote({
        customerId: selectedCustomer?.id || undefined,
        items: lineItems.map((li) => ({
          productId: li.productId,
          quantity: li.quantity,
          unitPrice: li.price,
          discountPercent: li.discountPercent || 0,
        })),
        notes: `${notesPrefix} ${quoteNotes || ''}`.trim(),
        expiryDays,
      });
      // Reset and close
      setShowCreateModal(false);
      resetCreateForm();
      fetchQuotes();
    } catch (error: any) {
      setCreateError(error.response?.data?.message || 'Failed to create quote');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetCreateForm = () => {
    setSelectedCustomer(null);
    setCustomerSearch('');
    setProductSearch('');
    setLineItems([]);
    setQuoteNotes('');
    setCreateError('');
    setQuoteBuyerType('customer');
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      open: 'bg-blue-600',
      expired: 'bg-gray-600',
      converted: 'bg-green-600',
      cancelled: 'bg-red-600',
    };
    return (
      <span className={`px-2 py-1 rounded text-xs font-medium ${colors[status] || 'bg-gray-600'}`}>
        {status.toUpperCase()}
      </span>
    );
  };

  const isExpired = (expiresAt: string) => new Date() > new Date(expiresAt);

  const filteredQuotes = quotes.filter(
    (quote) =>
      quote.quoteNumber.toLowerCase().includes(search.toLowerCase()) ||
      quote.customer?.firstName?.toLowerCase().includes(search.toLowerCase()) ||
      quote.customer?.lastName?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Quotes</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Total: {pagination.total} quotes</span>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => { resetCreateForm(); setShowCreateModal(true); }}
          >
            <PlusIcon className="h-5 w-5" />
            Create Quote
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-4">
        <div className="relative flex-1">
          <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
          <input
            type="text"
            placeholder="Search by quote number or customer..."
            className="input pl-12"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <select
          className="input w-40"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">All Status</option>
          <option value="open">Open</option>
          <option value="expired">Expired</option>
          <option value="converted">Converted</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Quotes Table */}
      <div className="card overflow-hidden">
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">Loading quotes...</div>
        ) : filteredQuotes.length === 0 ? (
          <div className="p-8 text-center text-gray-400">No quotes found</div>
        ) : (
          <table className="w-full">
            <thead className="bg-pos-accent">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Quote #</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Customer</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Items</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Total</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Expires</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Created By</th>
                <th className="px-4 py-3 text-center text-sm font-medium text-gray-300">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              {filteredQuotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-pos-accent/50">
                  <td className="px-4 py-3 font-medium">{quote.quoteNumber}</td>
                  <td className="px-4 py-3">
                    {quote.customer
                      ? `${quote.customer.firstName} ${quote.customer.lastName}`
                      : 'Walk-in'}
                  </td>
                  <td className="px-4 py-3">{quote.itemCount}</td>
                  <td className="px-4 py-3 font-medium">${quote.grandTotal.toFixed(2)}</td>
                  <td className="px-4 py-3">{getStatusBadge(quote.status)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {isExpired(quote.expiresAt) && quote.status === 'open' && (
                        <ClockIcon className="h-4 w-4 text-red-500" />
                      )}
                      <span className={isExpired(quote.expiresAt) ? 'text-red-400' : ''}>
                        {formatDate(quote.expiresAt)}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3">{quote.user.firstName}</td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={() => viewQuote(quote.id)}
                      className="p-2 hover:bg-pos-accent rounded"
                      title="View Quote"
                    >
                      <EyeIcon className="h-5 w-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            className="btn-sm"
            disabled={pagination.page <= 1}
            onClick={() => setPagination((p) => ({ ...p, page: p.page - 1 }))}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            className="btn-sm"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => setPagination((p) => ({ ...p, page: p.page + 1 }))}
          >
            Next
          </button>
        </div>
      )}

      {/* Quote Detail Modal */}
      {selectedQuote && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-pos-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[80vh] overflow-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-xl font-bold">{selectedQuote.quoteNumber}</h2>
                <div className="flex items-center gap-2 mt-1">
                  {getStatusBadge(selectedQuote.status)}
                  <span className="text-sm text-gray-400">
                    Created {formatDate(selectedQuote.createdAt)}
                  </span>
                </div>
              </div>
              <button onClick={() => setSelectedQuote(null)} className="text-gray-400 hover:text-white">
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Customer</p>
                  <p>{selectedQuote.customer ? `${selectedQuote.customer.firstName} ${selectedQuote.customer.lastName}` : 'Walk-in'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Created By</p>
                  <p>{selectedQuote.user?.firstName} {selectedQuote.user?.lastName}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Expires</p>
                  <p className={isExpired(selectedQuote.expiresAt) ? 'text-red-400' : ''}>
                    {formatDate(selectedQuote.expiresAt)}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-gray-400 mb-2">Items</p>
                <div className="bg-pos-dark rounded p-3 space-y-2">
                  {selectedQuote.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between">
                      <span>{item.quantity}x {item.name}</span>
                      <span>${parseFloat(item.rowTotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="border-t border-gray-700 pt-4">
                <div className="flex justify-between text-sm">
                  <span>Subtotal</span>
                  <span>${parseFloat(selectedQuote.subtotal).toFixed(2)}</span>
                </div>
                {parseFloat(selectedQuote.discountAmount) > 0 && (
                  <div className="flex justify-between text-sm text-green-400">
                    <span>Discount</span>
                    <span>-${parseFloat(selectedQuote.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm">
                  <span>Tax</span>
                  <span>${parseFloat(selectedQuote.taxAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total</span>
                  <span>${parseFloat(selectedQuote.grandTotal).toFixed(2)}</span>
                </div>
              </div>

              {selectedQuote.notes && (
                <div>
                  <p className="text-sm text-gray-400">Notes</p>
                  <p className="text-sm">{selectedQuote.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Create Quote Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-pos-card rounded-lg p-6 max-w-3xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Create Quote</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="h-6 w-6" />
              </button>
            </div>

            {/* Buyer Type Toggle */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Quote Type</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                    quoteBuyerType === 'trade'
                      ? 'border-orange-500 bg-orange-500/20 text-orange-300'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                  onClick={() => setQuoteBuyerType('trade')}
                >
                  Trade (90 day expiry)
                </button>
                <button
                  type="button"
                  className={`p-3 rounded-lg border-2 font-medium transition-colors ${
                    quoteBuyerType === 'customer'
                      ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                      : 'border-gray-600 text-gray-400 hover:border-gray-500'
                  }`}
                  onClick={() => setQuoteBuyerType('customer')}
                >
                  Customer (30 day expiry)
                </button>
              </div>
            </div>

            {/* Customer Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Customer</label>
              {selectedCustomer ? (
                <div className="flex items-center justify-between bg-pos-accent rounded-lg p-3">
                  <div>
                    <p className="font-medium">{selectedCustomer.firstName} {selectedCustomer.lastName}</p>
                    <p className="text-sm text-gray-400">
                      {selectedCustomer.email && <span>{selectedCustomer.email}</span>}
                      {selectedCustomer.email && selectedCustomer.phone && <span> | </span>}
                      {selectedCustomer.phone && <span>{selectedCustomer.phone}</span>}
                    </p>
                  </div>
                  <button
                    onClick={() => { setSelectedCustomer(null); setCustomerSearch(''); }}
                    className="text-gray-400 hover:text-red-400"
                  >
                    <XMarkIcon className="h-5 w-5" />
                  </button>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-3 gap-3 mb-2">
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
                              setCustomerSearch(val);
                            }
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Email</label>
                      <input
                        type="email"
                        placeholder="Search by email"
                        className="input"
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            const val = (e.target as HTMLInputElement).value.trim();
                            if (val.length >= 2) {
                              setCustomerSearch(val);
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
                              setCustomerSearch(val);
                            }
                          }
                        }}
                      />
                    </div>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">Type in any field and press Enter to search</p>
                  {customerResults.length > 0 && (
                    <div className="bg-pos-accent border border-gray-600 rounded-lg max-h-48 overflow-auto">
                      {customerResults.map((c: any) => (
                        <button
                          key={c.id}
                          className="w-full text-left px-4 py-3 hover:bg-pos-card border-b border-gray-700 last:border-0"
                          onClick={() => {
                            setSelectedCustomer(c);
                            setCustomerSearch('');
                            setCustomerResults([]);
                          }}
                        >
                          <p className="font-medium">{c.firstName} {c.lastName}</p>
                          <p className="text-xs text-gray-400">
                            ID: {c.id} {c.email ? `| ${c.email}` : ''} {c.phone ? `| ${c.phone}` : ''}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Products Section */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Add Products</label>
              <div className="grid grid-cols-2 gap-3 mb-2">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Product Name / SKU</label>
                  <input
                    type="text"
                    placeholder="Search by name or SKU"
                    className="input"
                    value={productSearch}
                    onChange={(e) => setProductSearch(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Product ID</label>
                  <input
                    type="number"
                    placeholder="Enter product ID"
                    className="input"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        const val = (e.target as HTMLInputElement).value.trim();
                        if (val) {
                          setProductSearch(val);
                        }
                      }
                    }}
                  />
                </div>
              </div>
              {productResults.length > 0 && (
                <div className="bg-pos-accent border border-gray-600 rounded-lg max-h-48 overflow-auto">
                  {productResults.map((p: any) => (
                    <button
                      key={p.id}
                      className="w-full text-left px-4 py-3 hover:bg-pos-card border-b border-gray-700 last:border-0"
                      onClick={() => addLineItem(p)}
                    >
                      <div className="flex justify-between">
                        <div>
                          <p className="font-medium">{p.name}</p>
                          <p className="text-xs text-gray-400">ID: {p.id} | {p.sku}</p>
                        </div>
                        <p className="text-primary-400 font-bold">
                          ${(p.specialPrice || p.price).toFixed(2)}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              {/* Custom Item */}
              {!showCustomItem ? (
                <button
                  className="mt-2 btn-sm bg-purple-600 text-white flex items-center gap-1"
                  onClick={() => setShowCustomItem(true)}
                >
                  <PlusCircleIcon className="h-4 w-4" />
                  Custom Item
                </button>
              ) : (
                <div className="mt-2 bg-pos-accent border border-gray-600 rounded-lg p-3">
                  <div className="grid grid-cols-3 gap-2 mb-2">
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Item Name *</label>
                      <input
                        type="text"
                        className="input w-full"
                        placeholder="e.g. Custom Fitting"
                        value={customItemName}
                        onChange={(e) => setCustomItemName(e.target.value)}
                        autoFocus
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-400 mb-1">Price (incl. GST) *</label>
                      <input
                        type="number"
                        className="input w-full"
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
                        className="input w-full"
                        placeholder="CUSTOM-001"
                        value={customItemSku}
                        onChange={(e) => setCustomItemSku(e.target.value)}
                      />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      className="btn-sm bg-gray-600 text-white"
                      onClick={() => { setShowCustomItem(false); setCustomItemName(''); setCustomItemPrice(''); setCustomItemSku(''); }}
                    >
                      Cancel
                    </button>
                    <button
                      className="btn-sm bg-purple-600 text-white"
                      onClick={addCustomLineItem}
                      disabled={!customItemName.trim() || !customItemPrice || parseFloat(customItemPrice) <= 0}
                    >
                      Add to Quote
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Line Items Table */}
            {lineItems.length > 0 && (
              <div className="mb-6">
                <table className="w-full text-sm">
                  <thead className="bg-pos-accent">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-300">Product</th>
                      <th className="px-3 py-2 text-center text-gray-300 w-20">Qty</th>
                      <th className="px-3 py-2 text-right text-gray-300 w-24">Price</th>
                      <th className="px-3 py-2 text-center text-gray-300 w-24">Disc %</th>
                      <th className="px-3 py-2 text-right text-gray-300 w-24">Total</th>
                      <th className="px-3 py-2 w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {lineItems.map((item, idx) => (
                      <tr key={item.productId}>
                        <td className="px-3 py-2">
                          <p className="font-medium">{item.name}</p>
                          <p className="text-xs text-gray-400">{item.sku}</p>
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={1}
                            className="input text-center py-1 px-2 w-16 mx-auto block"
                            value={item.quantity}
                            onChange={(e) => updateLineItem(idx, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            className="input text-right py-1 px-2 w-20 mx-auto block"
                            value={item.price}
                            onChange={(e) => updateLineItem(idx, 'price', Math.max(0, parseFloat(e.target.value) || 0))}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            className="input text-center py-1 px-2 w-16 mx-auto block"
                            value={item.discountPercent}
                            onChange={(e) => updateLineItem(idx, 'discountPercent', Math.min(100, Math.max(0, parseFloat(e.target.value) || 0)))}
                          />
                        </td>
                        <td className="px-3 py-2 text-right font-medium">
                          ${getLineTotal(item).toFixed(2)}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            onClick={() => removeLineItem(idx)}
                            className="text-gray-400 hover:text-red-400"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Totals */}
                <div className="border-t border-gray-600 mt-2 pt-3 space-y-1 text-sm">
                  <div className="flex justify-between px-3">
                    <span className="text-gray-400">Subtotal</span>
                    <span>${getQuoteSubtotal().toFixed(2)}</span>
                  </div>
                  {getQuoteDiscount() > 0 && (
                    <div className="flex justify-between px-3 text-green-400">
                      <span>Discount</span>
                      <span>-${getQuoteDiscount().toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between px-3">
                    <span className="text-gray-400">GST (10%)</span>
                    <span>${getQuoteTax().toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between px-3 font-bold text-lg pt-1 border-t border-gray-700">
                    <span>Total</span>
                    <span>${getQuoteTotal().toFixed(2)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Notes */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-300 mb-2">Notes (optional)</label>
              <textarea
                className="input min-h-[60px]"
                placeholder="Add any notes for this quote..."
                value={quoteNotes}
                onChange={(e) => setQuoteNotes(e.target.value)}
              />
            </div>

            {/* Error */}
            {createError && (
              <div className="bg-red-500/20 text-red-400 p-3 rounded mb-4 text-sm">{createError}</div>
            )}

            {/* Actions */}
            <div className="flex justify-end gap-3">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateQuote}
                disabled={isSubmitting || lineItems.length === 0}
              >
                {isSubmitting ? 'Creating...' : 'Create Quote'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
