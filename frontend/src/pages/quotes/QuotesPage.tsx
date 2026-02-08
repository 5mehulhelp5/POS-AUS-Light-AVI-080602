import { useState, useEffect } from 'react';
import { quotesApi } from '../../services/api';
import { MagnifyingGlassIcon, EyeIcon, ClockIcon } from '@heroicons/react/24/outline';

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

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ page: 1, limit: 20, total: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedQuote, setSelectedQuote] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string>('');

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
        <div className="text-sm text-gray-400">
          Total: {pagination.total} quotes
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
    </div>
  );
}
