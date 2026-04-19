import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import toast from 'react-hot-toast';
import { RootState } from '../../store';
import { customersApi, ordersApi, quotesApi } from '../../services/api';
import {
  MagnifyingGlassIcon,
  UserIcon,
  PhoneIcon,
  EnvelopeIcon,
  PlusIcon,
  ArrowLeftIcon,
  ShoppingCartIcon,
  DocumentTextIcon,
  BanknotesIcon,
  ClockIcon,
} from '@heroicons/react/24/outline';

interface Customer {
  id: number;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company: string | null;
  billingStreet: string | null;
  billingCity: string | null;
  billingState: string | null;
  billingPostcode: string | null;
  shippingStreet: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingPostcode: string | null;
  taxNumber: string | null;
  notes: string | null;
  createdAt: string;
  isTrade?: boolean;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CustomersPage() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fetchIdRef = useRef(0);

  // Customer detail state
  const [detailTab, setDetailTab] = useState<'orders' | 'active_quotes' | 'previous_quotes' | 'store_credit'>('orders');
  const [customerStats, setCustomerStats] = useState<any>(null);

  // Store credit state
  const [storeCreditBalance, setStoreCreditBalance] = useState<number>(0);
  const [storeCreditTxs, setStoreCreditTxs] = useState<any[]>([]);
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [isAdjusting, setIsAdjusting] = useState(false);
  const { user: currentAuthUser } = useSelector((state: RootState) => state.auth);
  const isAdmin = currentAuthUser?.role?.name === 'admin';
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerOrdersPagination, setCustomerOrdersPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [ordersPage, setOrdersPage] = useState(1);
  const [customerActiveQuotes, setCustomerActiveQuotes] = useState<any[]>([]);
  const [activeQuotesPagination, setActiveQuotesPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [activeQuotesPage, setActiveQuotesPage] = useState(1);
  const [customerPreviousQuotes, setCustomerPreviousQuotes] = useState<any[]>([]);
  const [previousQuotesPagination, setPreviousQuotesPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [previousQuotesPage, setPreviousQuotesPage] = useState(1);
  const [viewingOrder, setViewingOrder] = useState<any>(null);

  // Load stats when a customer is opened
  useEffect(() => {
    if (!selectedCustomer) {
      setCustomerStats(null);
      return;
    }
    customersApi
      .getCustomerStats(selectedCustomer.id)
      .then((r) => setCustomerStats(r.data.data.stats))
      .catch(() => setCustomerStats(null));
  }, [selectedCustomer]);

  // Load orders when Orders tab is active
  useEffect(() => {
    if (!selectedCustomer || detailTab !== 'orders') return;
    ordersApi
      .getOrders({ customerId: selectedCustomer.id, page: ordersPage, limit: 20 })
      .then((r) => {
        setCustomerOrders(r.data.data.orders);
        setCustomerOrdersPagination(r.data.data.pagination);
      })
      .catch(() => {
        setCustomerOrders([]);
      });
  }, [selectedCustomer, detailTab, ordersPage]);

  // Load active quotes
  useEffect(() => {
    if (!selectedCustomer || detailTab !== 'active_quotes') return;
    quotesApi
      .getQuotes({ customerId: selectedCustomer.id, status: 'open', page: activeQuotesPage, limit: 20 })
      .then((r) => {
        const now = new Date();
        const filtered = (r.data.data.quotes || []).filter(
          (q: any) => new Date(q.expiresAt) >= now,
        );
        setCustomerActiveQuotes(filtered);
        setActiveQuotesPagination(r.data.data.pagination);
      })
      .catch(() => setCustomerActiveQuotes([]));
  }, [selectedCustomer, detailTab, activeQuotesPage]);

  // Load previous quotes (all statuses, we'll show non-active on this tab)
  useEffect(() => {
    if (!selectedCustomer || detailTab !== 'previous_quotes') return;
    quotesApi
      .getQuotes({ customerId: selectedCustomer.id, page: previousQuotesPage, limit: 20 })
      .then((r) => {
        const now = new Date();
        const filtered = (r.data.data.quotes || []).filter(
          (q: any) =>
            q.status !== 'open' || new Date(q.expiresAt) < now,
        );
        setCustomerPreviousQuotes(filtered);
        setPreviousQuotesPagination(r.data.data.pagination);
      })
      .catch(() => setCustomerPreviousQuotes([]));
  }, [selectedCustomer, detailTab, previousQuotesPage]);

  // Load store credit balance + transactions whenever a customer is opened
  useEffect(() => {
    if (!selectedCustomer) {
      setStoreCreditBalance(0);
      setStoreCreditTxs([]);
      return;
    }
    customersApi
      .getStoreCredit(selectedCustomer.id)
      .then((r) => {
        setStoreCreditBalance(Number(r.data.data.balance) || 0);
        setStoreCreditTxs(r.data.data.transactions || []);
      })
      .catch(() => {
        setStoreCreditBalance(0);
        setStoreCreditTxs([]);
      });
  }, [selectedCustomer]);

  const refreshStoreCredit = async () => {
    if (!selectedCustomer) return;
    const r = await customersApi.getStoreCredit(selectedCustomer.id);
    setStoreCreditBalance(Number(r.data.data.balance) || 0);
    setStoreCreditTxs(r.data.data.transactions || []);
  };

  const handleAdjust = async () => {
    if (!selectedCustomer) return;
    const amount = parseFloat(adjustAmount);
    if (!amount) {
      toast.error('Enter a non-zero amount');
      return;
    }
    if (!adjustNote.trim()) {
      toast.error('Note is required for manual adjustments');
      return;
    }
    setIsAdjusting(true);
    try {
      await customersApi.adjustStoreCredit(selectedCustomer.id, {
        amount,
        note: adjustNote.trim(),
      });
      toast.success('Store credit adjusted');
      setShowAdjustModal(false);
      setAdjustAmount('');
      setAdjustNote('');
      await refreshStoreCredit();
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to adjust credit');
    } finally {
      setIsAdjusting(false);
    }
  };

  const resetDetailState = () => {
    setSelectedCustomer(null);
    setCustomerStats(null);
    setDetailTab('orders');
    setCustomerOrders([]);
    setOrdersPage(1);
    setCustomerActiveQuotes([]);
    setActiveQuotesPage(1);
    setCustomerPreviousQuotes([]);
    setPreviousQuotesPage(1);
    setViewingOrder(null);
  };

  const openOrderDetail = async (orderId: number) => {
    try {
      const r = await ordersApi.getOrder(orderId);
      setViewingOrder(r.data.data.order);
    } catch {
      toast.error('Failed to load order');
    }
  };

  const handleCreateOrderForCustomer = () => {
    if (!selectedCustomer) return;
    navigate('/pos', {
      state: {
        preselectCustomer: {
          id: selectedCustomer.id,
          name: `${selectedCustomer.firstName} ${selectedCustomer.lastName}`,
        },
      },
    });
  };

  // Create Customer modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [newCustomer, setNewCustomer] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    mobile: '',
    company: '',
    taxNumber: '',
    isTrade: false,
    notes: '',
  });

  const resetNewCustomer = () => {
    setNewCustomer({
      firstName: '',
      lastName: '',
      email: '',
      phone: '',
      mobile: '',
      company: '',
      taxNumber: '',
      isTrade: false,
      notes: '',
    });
  };

  const handleCreateCustomer = async () => {
    if (!newCustomer.firstName.trim() || !newCustomer.lastName.trim()) {
      toast.error('First and last name are required');
      return;
    }
    setIsCreating(true);
    try {
      await customersApi.createCustomer({
        firstName: newCustomer.firstName.trim(),
        lastName: newCustomer.lastName.trim(),
        email: newCustomer.email.trim() || null,
        phone: newCustomer.phone.trim() || null,
        mobile: newCustomer.mobile.trim() || null,
        company: newCustomer.company.trim() || null,
        taxNumber: newCustomer.taxNumber.trim() || null,
        isTrade: newCustomer.isTrade,
        notes: newCustomer.notes.trim() || null,
      });
      toast.success('Customer created');
      setShowCreateModal(false);
      resetNewCustomer();
      // refresh list
      setDebouncedSearch((s) => s);
      setCurrentPage(1);
      fetchIdRef.current++;
      const response = await customersApi.getCustomers({ page: 1, limit: 20 });
      setCustomers(response.data.data.customers);
      setPagination(response.data.data.pagination);
    } catch (e: any) {
      toast.error(e.response?.data?.error?.message || 'Failed to create customer');
    } finally {
      setIsCreating(false);
    }
  };

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
      setCurrentPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // Fetch customers when debounced search or page changes
  useEffect(() => {
    const id = ++fetchIdRef.current;

    const fetchCustomers = async () => {
      try {
        setIsLoading(true);
        const response = await customersApi.getCustomers({
          search: debouncedSearch || undefined,
          page: currentPage,
          limit: 20,
        });

        // Ignore stale responses
        if (id !== fetchIdRef.current) return;

        setCustomers(response.data.data.customers);
        setPagination(response.data.data.pagination);
      } catch (error) {
        if (id !== fetchIdRef.current) return;
        console.error('Failed to fetch customers:', error);
        setCustomers([]);
        setPagination({ page: currentPage, limit: 20, total: 0, totalPages: 0 });
      } finally {
        if (id === fetchIdRef.current) {
          setIsLoading(false);
        }
      }
    };

    fetchCustomers();
  }, [debouncedSearch, currentPage]);

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('en-AU', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div className="h-full p-6 overflow-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Customers</h1>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-400">Total: {pagination.total} customers</span>
          <button
            className="btn-primary flex items-center gap-2"
            onClick={() => { resetNewCustomer(); setShowCreateModal(true); }}
          >
            <PlusIcon className="h-5 w-5" />
            Create Customer
          </button>
        </div>
      </div>

      {/* Search Bar */}
      <div className="relative mb-4">
        <MagnifyingGlassIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
        <input
          type="text"
          placeholder="Search by name, email, phone, or company..."
          className="input pl-12"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Customers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {isLoading ? (
          <div className="col-span-full p-8 text-center text-gray-400">Loading customers...</div>
        ) : customers.length === 0 ? (
          <div className="col-span-full p-8 text-center text-gray-400">No customers found</div>
        ) : (
          customers.map((customer) => (
            <div
              key={customer.id}
              className="card p-4 cursor-pointer hover:bg-pos-accent/50 transition-colors"
              onClick={() => setSelectedCustomer(customer)}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-600 rounded-full">
                  <UserIcon className="h-6 w-6" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium truncate">
                      {customer.firstName} {customer.lastName}
                    </h3>
                    {customer.isTrade && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase bg-orange-600/30 text-orange-300">
                        Trade
                      </span>
                    )}
                  </div>
                  {customer.company && (
                    <p className="text-sm text-gray-400 truncate">{customer.company}</p>
                  )}
                  <div className="mt-2 space-y-1">
                    {customer.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <EnvelopeIcon className="h-4 w-4" />
                        <span className="truncate">{customer.email}</span>
                      </div>
                    )}
                    {(customer.phone || customer.mobile) && (
                      <div className="flex items-center gap-2 text-sm text-gray-400">
                        <PhoneIcon className="h-4 w-4" />
                        <span>{customer.mobile || customer.phone}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-4">
          <button
            className="btn-sm"
            disabled={currentPage <= 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="px-4 py-2 text-sm">
            Page {currentPage} of {pagination.totalPages}
          </span>
          <button
            className="btn-sm"
            disabled={currentPage >= pagination.totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="modal-backdrop">
          <div className="bg-pos-card w-full h-full flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-start p-6 pb-4 border-b border-gray-700">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-600 rounded-full">
                  <UserIcon className="h-8 w-8" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold">
                      {selectedCustomer.firstName} {selectedCustomer.lastName}
                    </h2>
                    {selectedCustomer.isTrade && (
                      <span className="px-2 py-0.5 rounded text-xs font-semibold uppercase bg-orange-600/30 text-orange-300">
                        Trade
                      </span>
                    )}
                  </div>
                  {selectedCustomer.company && (
                    <p className="text-sm text-gray-400">{selectedCustomer.company}</p>
                  )}
                  <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
                    {selectedCustomer.email && (
                      <span className="flex items-center gap-1">
                        <EnvelopeIcon className="h-3 w-3" />
                        {selectedCustomer.email}
                      </span>
                    )}
                    {(selectedCustomer.phone || selectedCustomer.mobile) && (
                      <span className="flex items-center gap-1">
                        <PhoneIcon className="h-3 w-3" />
                        {selectedCustomer.mobile || selectedCustomer.phone}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  className="btn-primary flex items-center gap-2 text-sm"
                  onClick={handleCreateOrderForCustomer}
                >
                  <ShoppingCartIcon className="h-4 w-4" />
                  Create Order
                </button>
                <button
                  onClick={resetDetailState}
                  className="modal-back-btn"
                >
                  <ArrowLeftIcon className="h-5 w-5" /> Back
                </button>
              </div>
            </div>

            {/* Stats strip */}
            <div className="grid grid-cols-6 gap-3 px-6 py-4 border-b border-gray-700">
              <div className="bg-pos-dark rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <BanknotesIcon className="h-4 w-4" />
                  Total Spent (net)
                </div>
                <p className="text-lg font-bold mt-1">
                  ${customerStats ? Number(customerStats.totalSpent).toFixed(2) : '—'}
                </p>
              </div>
              <div className="bg-pos-dark rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <ShoppingCartIcon className="h-4 w-4" />
                  Orders
                </div>
                <p className="text-lg font-bold mt-1">
                  {customerStats?.orderCount ?? '—'}
                </p>
              </div>
              <div className="bg-pos-dark rounded p-3 border border-purple-500/40 bg-purple-500/5">
                <div className="flex items-center gap-2 text-xs text-purple-300">
                  <BanknotesIcon className="h-4 w-4" />
                  Store Credit
                </div>
                <p className="text-lg font-bold mt-1 text-purple-300">
                  ${storeCreditBalance.toFixed(2)}
                </p>
              </div>
              <div className="bg-pos-dark rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <DocumentTextIcon className="h-4 w-4" />
                  Active Quotes
                </div>
                <p className="text-lg font-bold mt-1 text-blue-300">
                  {customerStats?.activeQuoteCount ?? '—'}
                </p>
              </div>
              <div className="bg-pos-dark rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <DocumentTextIcon className="h-4 w-4" />
                  Previous Quotes
                </div>
                <p className="text-lg font-bold mt-1 text-gray-400">
                  {customerStats?.previousQuoteCount ?? '—'}
                </p>
              </div>
              <div className="bg-pos-dark rounded p-3">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                  <ClockIcon className="h-4 w-4" />
                  Last Purchase
                </div>
                <p className="text-sm font-medium mt-1">
                  {customerStats?.lastPurchaseDate
                    ? formatDate(customerStats.lastPurchaseDate)
                    : '—'}
                </p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-700 px-6">
              {[
                { id: 'orders', label: `Orders${customerStats ? ` (${customerStats.orderCount})` : ''}` },
                { id: 'active_quotes', label: `Active Quotes${customerStats ? ` (${customerStats.activeQuoteCount})` : ''}` },
                { id: 'previous_quotes', label: `Previous Quotes${customerStats ? ` (${customerStats.previousQuoteCount})` : ''}` },
                { id: 'store_credit', label: `Store Credit ($${storeCreditBalance.toFixed(2)})` },
              ].map((t) => (
                <button
                  key={t.id}
                  className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                    detailTab === t.id
                      ? 'border-primary-500 text-white'
                      : 'border-transparent text-gray-400 hover:text-white'
                  }`}
                  onClick={() => setDetailTab(t.id as any)}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-6">
              {detailTab === 'orders' && (
                <>
                  {customerOrders.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No orders yet</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-pos-accent">
                        <tr>
                          <th className="px-3 py-2 text-left">Order #</th>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-center">Items</th>
                          <th className="px-3 py-2 text-right">Total</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {customerOrders.map((o: any) => (
                          <tr
                            key={o.id}
                            className="hover:bg-pos-accent/50 cursor-pointer"
                            onClick={() => openOrderDetail(o.id)}
                          >
                            <td className="px-3 py-2 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{o.orderNumber}</span>
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase ${
                                    o.source === 'magento'
                                      ? 'bg-purple-600/30 text-purple-300'
                                      : 'bg-blue-600/30 text-blue-300'
                                  }`}
                                >
                                  {o.source === 'magento' ? 'M2' : 'POS'}
                                </span>
                              </div>
                            </td>
                            <td className="px-3 py-2 text-gray-400">
                              {formatDate(o.createdAt)}
                            </td>
                            <td className="px-3 py-2 text-center">{o.itemCount}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              ${o.grandTotal.toFixed(2)}
                            </td>
                            <td className="px-3 py-2">
                              <span className="px-2 py-0.5 rounded text-xs bg-gray-700 uppercase">
                                {o.status.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-right text-gray-500">→</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {customerOrdersPagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4 text-sm">
                      <button
                        className="btn-sm"
                        disabled={ordersPage <= 1}
                        onClick={() => setOrdersPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">
                        Page {ordersPage} of {customerOrdersPagination.totalPages}
                      </span>
                      <button
                        className="btn-sm"
                        disabled={ordersPage >= customerOrdersPagination.totalPages}
                        onClick={() => setOrdersPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'active_quotes' && (
                <>
                  {customerActiveQuotes.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No active quotes</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-pos-accent">
                        <tr>
                          <th className="px-3 py-2 text-left">Quote #</th>
                          <th className="px-3 py-2 text-left">Created</th>
                          <th className="px-3 py-2 text-left">Expires</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-center">Items</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {customerActiveQuotes.map((q: any) => (
                          <tr key={q.id} className="hover:bg-pos-accent/50">
                            <td className="px-3 py-2 font-medium">{q.quoteNumber}</td>
                            <td className="px-3 py-2 text-gray-400">{formatDate(q.createdAt)}</td>
                            <td className="px-3 py-2 text-gray-400">{formatDate(q.expiresAt)}</td>
                            <td className="px-3 py-2">
                              <span className="text-xs uppercase text-gray-400">{q.buyerType || 'customer'}</span>
                            </td>
                            <td className="px-3 py-2 text-center">{q.itemCount}</td>
                            <td className="px-3 py-2 text-right font-medium">
                              ${q.grandTotal.toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {activeQuotesPagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4 text-sm">
                      <button
                        className="btn-sm"
                        disabled={activeQuotesPage <= 1}
                        onClick={() => setActiveQuotesPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">
                        Page {activeQuotesPage} of {activeQuotesPagination.totalPages}
                      </span>
                      <button
                        className="btn-sm"
                        disabled={activeQuotesPage >= activeQuotesPagination.totalPages}
                        onClick={() => setActiveQuotesPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'previous_quotes' && (
                <>
                  {customerPreviousQuotes.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">No previous quotes</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-pos-accent">
                        <tr>
                          <th className="px-3 py-2 text-left">Quote #</th>
                          <th className="px-3 py-2 text-left">Created</th>
                          <th className="px-3 py-2 text-left">Status</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-center">Items</th>
                          <th className="px-3 py-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {customerPreviousQuotes.map((q: any) => {
                          const status = q.status === 'open' ? 'expired' : q.status;
                          return (
                            <tr key={q.id} className="hover:bg-pos-accent/50">
                              <td className="px-3 py-2 font-medium">{q.quoteNumber}</td>
                              <td className="px-3 py-2 text-gray-400">{formatDate(q.createdAt)}</td>
                              <td className="px-3 py-2">
                                <span className="px-2 py-0.5 rounded text-xs bg-gray-700 uppercase">
                                  {status}
                                </span>
                              </td>
                              <td className="px-3 py-2">
                                <span className="text-xs uppercase text-gray-400">{q.buyerType || 'customer'}</span>
                              </td>
                              <td className="px-3 py-2 text-center">{q.itemCount}</td>
                              <td className="px-3 py-2 text-right font-medium">
                                ${q.grandTotal.toFixed(2)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  )}
                  {previousQuotesPagination.totalPages > 1 && (
                    <div className="flex justify-center gap-2 mt-4 text-sm">
                      <button
                        className="btn-sm"
                        disabled={previousQuotesPage <= 1}
                        onClick={() => setPreviousQuotesPage((p) => p - 1)}
                      >
                        Previous
                      </button>
                      <span className="px-3 py-1">
                        Page {previousQuotesPage} of {previousQuotesPagination.totalPages}
                      </span>
                      <button
                        className="btn-sm"
                        disabled={previousQuotesPage >= previousQuotesPagination.totalPages}
                        onClick={() => setPreviousQuotesPage((p) => p + 1)}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}

              {detailTab === 'store_credit' && (
                <>
                  <div className="flex justify-between items-center mb-4">
                    <div>
                      <p className="text-xs text-gray-400 uppercase">Current Balance</p>
                      <p className="text-3xl font-bold text-purple-300">
                        ${storeCreditBalance.toFixed(2)}
                      </p>
                    </div>
                    {isAdmin && (
                      <button
                        className="btn-secondary text-sm"
                        onClick={() => setShowAdjustModal(true)}
                      >
                        Manual Adjust
                      </button>
                    )}
                  </div>

                  {storeCreditTxs.length === 0 ? (
                    <p className="text-center text-gray-400 py-8">
                      No store credit activity yet
                    </p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead className="bg-pos-accent">
                        <tr>
                          <th className="px-3 py-2 text-left">Date</th>
                          <th className="px-3 py-2 text-left">Type</th>
                          <th className="px-3 py-2 text-left">Note / Link</th>
                          <th className="px-3 py-2 text-left">By</th>
                          <th className="px-3 py-2 text-right">Amount</th>
                          <th className="px-3 py-2 text-right">Balance After</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-700">
                        {storeCreditTxs.map((tx: any) => (
                          <tr key={tx.id}>
                            <td className="px-3 py-2 text-gray-400">
                              {formatDate(tx.createdAt)}
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`px-2 py-0.5 rounded text-xs uppercase ${
                                  tx.type === 'refund_issue'
                                    ? 'bg-blue-600/30 text-blue-300'
                                    : tx.type === 'redemption'
                                      ? 'bg-orange-600/30 text-orange-300'
                                      : 'bg-gray-600/30 text-gray-300'
                                }`}
                              >
                                {tx.type.replace(/_/g, ' ')}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400">
                              {tx.relatedRefundId
                                ? `Refund #${tx.relatedRefundId}`
                                : tx.relatedOrderId
                                  ? `Order #${tx.relatedOrderId}`
                                  : tx.note || '—'}
                            </td>
                            <td className="px-3 py-2 text-xs text-gray-400">
                              {tx.user ? `${tx.user.firstName} ${tx.user.lastName}` : '—'}
                            </td>
                            <td
                              className={`px-3 py-2 text-right font-medium ${
                                tx.amount >= 0 ? 'text-green-400' : 'text-red-400'
                              }`}
                            >
                              {tx.amount >= 0 ? '+' : ''}${Number(tx.amount).toFixed(2)}
                            </td>
                            <td className="px-3 py-2 text-right font-medium">
                              ${Number(tx.balanceAfter).toFixed(2)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Store Credit Manual Adjust Modal (admin only) */}
      {showAdjustModal && selectedCustomer && (
        <div className="modal-backdrop-top">
          <div className="modal-content">
            <div className="flex justify-between items-start mb-4">
              <button
                onClick={() => setShowAdjustModal(false)}
                className="modal-back-btn"
                disabled={isAdjusting}
              >
                <ArrowLeftIcon className="h-5 w-5" /> Back
              </button>
              <h3 className="text-lg font-bold">Adjust Store Credit</h3>
            </div>
            <p className="text-sm text-gray-400 mb-4">
              Positive amount adds to balance, negative deducts. Can go negative.
            </p>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">Amount ($)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="e.g. 25.00 or -10.00"
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Note (required)</label>
                <textarea
                  className="input min-h-[60px]"
                  placeholder="Reason for this adjustment"
                  value={adjustNote}
                  onChange={(e) => setAdjustNote(e.target.value)}
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 mt-4">
              <button
                className="btn-secondary"
                onClick={() => setShowAdjustModal(false)}
                disabled={isAdjusting}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleAdjust}
                disabled={isAdjusting}
              >
                {isAdjusting ? 'Saving...' : 'Apply'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Inline Order viewer (opened from the customer orders tab) */}
      {viewingOrder && (
        <div className="modal-backdrop-top">
          <div className="modal-content">
            <div className="flex justify-between items-start mb-4">
              <button onClick={() => setViewingOrder(null)} className="modal-back-btn">
                <ArrowLeftIcon className="h-5 w-5" /> Back
              </button>
              <div className="text-right">
                <h2 className="text-xl font-bold">{viewingOrder.orderNumber}</h2>
                <p className="text-sm text-gray-400">{formatDate(viewingOrder.createdAt)}</p>
              </div>
            </div>
            <div className="space-y-4">
              <div>
                <p className="text-sm text-gray-400 mb-2">Items</p>
                <div className="bg-pos-dark rounded p-3 space-y-2 text-sm">
                  {viewingOrder.items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        {item.quantity}x {item.name}
                      </span>
                      <span>${parseFloat(item.rowTotal).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="border-t border-gray-700 pt-4 text-sm">
                <div className="flex justify-between">
                  <span>Subtotal</span>
                  <span>${parseFloat(viewingOrder.subtotal).toFixed(2)}</span>
                </div>
                {parseFloat(viewingOrder.discountAmount) > 0 && (
                  <div className="flex justify-between text-green-400">
                    <span>Discount</span>
                    <span>-${parseFloat(viewingOrder.discountAmount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>Tax</span>
                  <span>${parseFloat(viewingOrder.taxAmount).toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-lg mt-2">
                  <span>Total</span>
                  <span>${parseFloat(viewingOrder.grandTotal).toFixed(2)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="modal-backdrop">
          <div className="modal-content">
            <div className="flex justify-between items-center mb-6">
              <button onClick={() => setShowCreateModal(false)} className="modal-back-btn">
                <ArrowLeftIcon className="h-5 w-5" /> Back
              </button>
              <h2 className="text-xl font-bold">Create Customer</h2>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1">First Name *</label>
                <input
                  type="text"
                  className="input"
                  value={newCustomer.firstName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, firstName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Last Name *</label>
                <input
                  type="text"
                  className="input"
                  value={newCustomer.lastName}
                  onChange={(e) => setNewCustomer({ ...newCustomer, lastName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Email</label>
                <input
                  type="email"
                  className="input"
                  value={newCustomer.email}
                  onChange={(e) => setNewCustomer({ ...newCustomer, email: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Phone</label>
                <input
                  type="tel"
                  className="input"
                  value={newCustomer.phone}
                  onChange={(e) => setNewCustomer({ ...newCustomer, phone: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Mobile</label>
                <input
                  type="tel"
                  className="input"
                  value={newCustomer.mobile}
                  onChange={(e) => setNewCustomer({ ...newCustomer, mobile: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Company</label>
                <input
                  type="text"
                  className="input"
                  value={newCustomer.company}
                  onChange={(e) => setNewCustomer({ ...newCustomer, company: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">ABN / Tax Number</label>
                <input
                  type="text"
                  className="input"
                  value={newCustomer.taxNumber}
                  onChange={(e) => setNewCustomer({ ...newCustomer, taxNumber: e.target.value })}
                />
              </div>
              <div className="col-span-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={newCustomer.isTrade}
                    onChange={(e) => setNewCustomer({ ...newCustomer, isTrade: e.target.checked })}
                    className="w-4 h-4 rounded border-gray-600 bg-gray-700"
                  />
                  <span className="text-gray-300">Trade Customer</span>
                </label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs text-gray-400 mb-1">Notes</label>
                <textarea
                  className="input min-h-[60px]"
                  value={newCustomer.notes}
                  onChange={(e) => setNewCustomer({ ...newCustomer, notes: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                className="btn-secondary"
                onClick={() => setShowCreateModal(false)}
                disabled={isCreating}
              >
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleCreateCustomer}
                disabled={isCreating}
              >
                {isCreating ? 'Creating...' : 'Create Customer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
