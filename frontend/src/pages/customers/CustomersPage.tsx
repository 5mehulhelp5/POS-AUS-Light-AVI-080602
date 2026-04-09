import { useState, useEffect, useRef } from 'react';
import toast from 'react-hot-toast';
import { customersApi } from '../../services/api';
import { MagnifyingGlassIcon, UserIcon, PhoneIcon, EnvelopeIcon, PlusIcon, XMarkIcon } from '@heroicons/react/24/outline';

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
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const fetchIdRef = useRef(0);

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
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-pos-card rounded-lg p-6 max-w-lg w-full mx-4">
            <div className="flex justify-between items-start mb-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-primary-600 rounded-full">
                  <UserIcon className="h-8 w-8" />
                </div>
                <div>
                  <h2 className="text-xl font-bold">
                    {selectedCustomer.firstName} {selectedCustomer.lastName}
                  </h2>
                  {selectedCustomer.company && (
                    <p className="text-gray-400">{selectedCustomer.company}</p>
                  )}
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomer(null)}
                className="text-gray-400 hover:text-white"
              >
                Close
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-400">Email</p>
                  <p>{selectedCustomer.email || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Phone</p>
                  <p>{selectedCustomer.phone || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">Mobile</p>
                  <p>{selectedCustomer.mobile || '-'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-400">ABN / Tax Number</p>
                  <p>{selectedCustomer.taxNumber || '-'}</p>
                </div>
              </div>

              {(selectedCustomer.billingStreet || selectedCustomer.billingCity) && (
                <div>
                  <p className="text-sm text-gray-400">Billing Address</p>
                  <p>
                    {selectedCustomer.billingStreet && <span>{selectedCustomer.billingStreet}<br /></span>}
                    {selectedCustomer.billingCity && <span>{selectedCustomer.billingCity} </span>}
                    {selectedCustomer.billingState && <span>{selectedCustomer.billingState} </span>}
                    {selectedCustomer.billingPostcode && <span>{selectedCustomer.billingPostcode}</span>}
                  </p>
                </div>
              )}

              {(selectedCustomer.shippingStreet || selectedCustomer.shippingCity) && (
                <div>
                  <p className="text-sm text-gray-400">Shipping Address</p>
                  <p>
                    {selectedCustomer.shippingStreet && <span>{selectedCustomer.shippingStreet}<br /></span>}
                    {selectedCustomer.shippingCity && <span>{selectedCustomer.shippingCity} </span>}
                    {selectedCustomer.shippingState && <span>{selectedCustomer.shippingState} </span>}
                    {selectedCustomer.shippingPostcode && <span>{selectedCustomer.shippingPostcode}</span>}
                  </p>
                </div>
              )}

              {selectedCustomer.notes && (
                <div>
                  <p className="text-sm text-gray-400">Notes</p>
                  <p className="text-sm">{selectedCustomer.notes}</p>
                </div>
              )}

              <div className="border-t border-gray-700 pt-4">
                <p className="text-sm text-gray-400">
                  Customer since {formatDate(selectedCustomer.createdAt)}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Create Customer Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-pos-card rounded-lg p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold">Create Customer</h2>
              <button onClick={() => setShowCreateModal(false)} className="text-gray-400 hover:text-white">
                <XMarkIcon className="h-6 w-6" />
              </button>
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
