import { useState, useEffect } from 'react';
import { reportsApi } from '../../services/api';
import {
  CurrencyDollarIcon,
  ShoppingCartIcon,
  ReceiptPercentIcon,
  DocumentTextIcon,
  CalendarIcon,
} from '@heroicons/react/24/outline';

interface SalesReport {
  summary: {
    orderCount: number;
    totalSales: number;
    totalDiscounts: number;
    totalTax: number;
    averageOrder: number;
  };
  salesByPeriod: Array<{
    period: string;
    orderCount: number;
    totalSales: number;
  }>;
}

interface SalesByUser {
  userId: number;
  firstName: string;
  lastName: string;
  orderCount: number;
  totalSales: number;
  totalDiscounts: number;
}

export default function ReportsPage() {
  const [activeTab, setActiveTab] = useState<'sales' | 'users' | 'discounts' | 'quotes'>('sales');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split('T')[0];
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().split('T')[0]);
  const [isLoading, setIsLoading] = useState(true);

  const [salesReport, setSalesReport] = useState<SalesReport | null>(null);
  const [salesByUser, setSalesByUser] = useState<SalesByUser[]>([]);
  const [discountReport, setDiscountReport] = useState<any[]>([]);
  const [quotesReport, setQuotesReport] = useState<any>(null);

  useEffect(() => {
    fetchReport();
  }, [activeTab, dateFrom, dateTo]);

  const fetchReport = async () => {
    try {
      setIsLoading(true);
      switch (activeTab) {
        case 'sales':
          const salesRes = await reportsApi.getSalesReport({ dateFrom, dateTo });
          setSalesReport(salesRes.data.data);
          break;
        case 'users':
          const usersRes = await reportsApi.getSalesByUser({ dateFrom, dateTo });
          setSalesByUser(usersRes.data.data.salesByUser);
          break;
        case 'discounts':
          const discountsRes = await reportsApi.getDiscountReport({ dateFrom, dateTo });
          setDiscountReport(discountsRes.data.data.discountUsage);
          break;
        case 'quotes':
          const quotesRes = await reportsApi.getQuotesReport({ dateFrom, dateTo });
          setQuotesReport(quotesRes.data.data);
          break;
      }
    } catch (error) {
      console.error('Failed to fetch report:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    { id: 'sales', label: 'Sales Summary', icon: CurrencyDollarIcon },
    { id: 'users', label: 'Sales by User', icon: ShoppingCartIcon },
    { id: 'discounts', label: 'Discounts', icon: ReceiptPercentIcon },
    { id: 'quotes', label: 'Quotes', icon: DocumentTextIcon },
  ];

  return (
    <div className="h-full p-6 overflow-auto">
      <h1 className="text-2xl font-bold mb-6">Reports</h1>

      {/* Date Range Picker */}
      <div className="flex items-center gap-4 mb-6">
        <CalendarIcon className="h-5 w-5 text-gray-400" />
        <div className="flex items-center gap-2">
          <input
            type="date"
            className="input w-40"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
          <span className="text-gray-400">to</span>
          <input
            type="date"
            className="input w-40"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-600 text-white'
                : 'bg-pos-accent text-gray-300 hover:bg-pos-accent/70'
            }`}
            onClick={() => setActiveTab(tab.id as any)}
          >
            <tab.icon className="h-5 w-5" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Report Content */}
      {isLoading ? (
        <div className="card p-8 text-center text-gray-400">Loading report...</div>
      ) : (
        <>
          {/* Sales Summary Tab */}
          {activeTab === 'sales' && salesReport && (
            <div className="space-y-6">
              {/* Summary Cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Total Orders</p>
                  <p className="text-2xl font-bold">{salesReport.summary.orderCount || 0}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Total Sales</p>
                  <p className="text-2xl font-bold text-green-400">
                    ${Number(salesReport.summary.totalSales || 0).toFixed(2)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Total Discounts</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    ${Number(salesReport.summary.totalDiscounts || 0).toFixed(2)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Total Tax</p>
                  <p className="text-2xl font-bold">
                    ${Number(salesReport.summary.totalTax || 0).toFixed(2)}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Avg Order Value</p>
                  <p className="text-2xl font-bold">
                    ${Number(salesReport.summary.averageOrder || 0).toFixed(2)}
                  </p>
                </div>
              </div>

              {/* Sales by Period */}
              {salesReport.salesByPeriod.length > 0 && (
                <div className="card p-4">
                  <h3 className="font-medium mb-4">Sales by Day</h3>
                  <div className="space-y-2">
                    {salesReport.salesByPeriod.map((period) => (
                      <div key={period.period} className="flex justify-between items-center py-2 border-b border-gray-700">
                        <span>{period.period}</span>
                        <div className="flex gap-8">
                          <span className="text-gray-400">{period.orderCount} orders</span>
                          <span className="font-medium">${parseFloat(String(period.totalSales)).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Sales by User Tab */}
          {activeTab === 'users' && (
            <div className="card overflow-hidden">
              {salesByUser.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No sales data for this period</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-pos-accent">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Staff Member</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Orders</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Total Sales</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Discounts Given</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {salesByUser.map((user) => (
                      <tr key={user.userId}>
                        <td className="px-4 py-3 font-medium">{user.firstName} {user.lastName}</td>
                        <td className="px-4 py-3 text-right">{user.orderCount}</td>
                        <td className="px-4 py-3 text-right text-green-400">
                          ${parseFloat(String(user.totalSales)).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right text-yellow-400">
                          ${parseFloat(String(user.totalDiscounts)).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Discounts Tab */}
          {activeTab === 'discounts' && (
            <div className="card overflow-hidden">
              {discountReport.length === 0 ? (
                <div className="p-8 text-center text-gray-400">No discount data for this period</div>
              ) : (
                <table className="w-full">
                  <thead className="bg-pos-accent">
                    <tr>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Role</th>
                      <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Type</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Usage Count</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Total Discount</th>
                      <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Avg %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-700">
                    {discountReport.map((item, idx) => (
                      <tr key={idx}>
                        <td className="px-4 py-3 font-medium capitalize">{item.userRole}</td>
                        <td className="px-4 py-3 capitalize">{item.discountType}</td>
                        <td className="px-4 py-3 text-right">{item.usageCount}</td>
                        <td className="px-4 py-3 text-right text-yellow-400">
                          ${parseFloat(String(item.totalDiscount)).toFixed(2)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {parseFloat(String(item.avgDiscountPercent)).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {/* Quotes Tab */}
          {activeTab === 'quotes' && quotesReport && (
            <div className="space-y-6">
              {/* Conversion Rate */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Total Quotes</p>
                  <p className="text-2xl font-bold">{quotesReport.conversionRate?.total || 0}</p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Converted</p>
                  <p className="text-2xl font-bold text-green-400">
                    {quotesReport.conversionRate?.converted || 0}
                  </p>
                </div>
                <div className="card p-4">
                  <p className="text-sm text-gray-400">Conversion Rate</p>
                  <p className="text-2xl font-bold">
                    {quotesReport.conversionRate?.total > 0
                      ? ((quotesReport.conversionRate.converted / quotesReport.conversionRate.total) * 100).toFixed(1)
                      : 0}
                    %
                  </p>
                </div>
              </div>

              {/* By Status */}
              <div className="card overflow-hidden">
                <div className="p-4 bg-pos-accent">
                  <h3 className="font-medium">Quotes by Status</h3>
                </div>
                {quotesReport.byStatus?.length === 0 ? (
                  <div className="p-8 text-center text-gray-400">No quotes for this period</div>
                ) : (
                  <table className="w-full">
                    <thead className="bg-pos-dark">
                      <tr>
                        <th className="px-4 py-3 text-left text-sm font-medium text-gray-300">Status</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Count</th>
                        <th className="px-4 py-3 text-right text-sm font-medium text-gray-300">Total Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-700">
                      {quotesReport.byStatus?.map((item: any) => (
                        <tr key={item.status}>
                          <td className="px-4 py-3 font-medium capitalize">{item.status}</td>
                          <td className="px-4 py-3 text-right">{item.count}</td>
                          <td className="px-4 py-3 text-right">
                            ${parseFloat(String(item.totalValue || 0)).toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
