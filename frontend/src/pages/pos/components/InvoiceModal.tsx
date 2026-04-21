import { useRef } from 'react';
import { XMarkIcon, PrinterIcon, ArrowDownTrayIcon } from '@heroicons/react/24/outline';
import { CartItem } from '../../../store/slices/cartSlice';

interface InvoiceData {
  orderNumber: string;
  date: string;
  buyerType: 'retail' | 'customer';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  customerAddress?: string;
  companyAbn?: string;
  // Each item may be flagged as backorder (not in stock) or lay-by held
  // (in stock but staying with the store). Used to group the lines on
  // the printed invoice.
  items: (CartItem & { isBackorder?: boolean; isLaybyHeld?: boolean })[];
  subtotal: number;
  itemDiscounts: number;
  cartDiscount: number;
  taxAmount: number;
  grandTotal: number;
  paymentMethod: string;
  cashTendered?: number;
  change?: number;
  // Deposit / balance metadata. Present when the order is a layby or
  // contains backorder items. If absent or balanceDue <= 0 the invoice
  // prints as a regular fully-paid receipt.
  isLayby?: boolean;
  isBackorder?: boolean;
  isMixed?: boolean; // has both take-now AND held lines
  amountPaid?: number;
  balanceDue?: number;
  takeNowSubtotal?: number;
  deferredSubtotal?: number;
}

interface InvoiceModalProps {
  invoice: InvoiceData;
  onClose: () => void;
}

export default function InvoiceModal({ invoice, onClose }: InvoiceModalProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Invoice ${invoice.orderNumber}</title>
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              padding: 20px;
              color: #333;
            }
            .invoice-container { max-width: 800px; margin: 0 auto; }
            .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #2563eb; padding-bottom: 20px; }
            .header h1 { color: #2563eb; font-size: 28px; margin-bottom: 5px; }
            .header p { color: #666; }
            .buyer-badge {
              display: inline-block;
              padding: 4px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              margin-top: 10px;
            }
            .buyer-retail { background: #fef3c7; color: #92400e; }
            .buyer-customer { background: #dbeafe; color: #1e40af; }
            .info-section { display: flex; justify-content: space-between; margin-bottom: 30px; }
            .info-box { flex: 1; }
            .info-box h3 { font-size: 14px; color: #666; margin-bottom: 8px; text-transform: uppercase; }
            .info-box p { margin: 4px 0; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
            th { background: #f3f4f6; padding: 12px; text-align: left; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
            td { padding: 12px; border-bottom: 1px solid #e5e7eb; }
            .text-right { text-align: right; }
            .totals { margin-left: auto; width: 300px; }
            .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
            .totals-row.total { font-size: 18px; font-weight: bold; border-top: 2px solid #333; padding-top: 12px; margin-top: 8px; }
            .discount { color: #dc2626; }
            .footer { margin-top: 40px; text-align: center; color: #666; font-size: 12px; border-top: 1px solid #e5e7eb; padding-top: 20px; }
            .category-section { margin-top: 20px; padding: 15px; background: #f9fafb; border-radius: 8px; }
            .category-section h4 { color: #374151; margin-bottom: 10px; }
            @media print {
              body { padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          ${printContent.innerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.print();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-AU', {
      dateStyle: 'long',
      timeStyle: 'short',
    });
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Action Bar */}
        <div className="sticky top-0 bg-gray-800 text-white p-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-bold">Invoice Preview</h2>
          <div className="flex items-center gap-3">
            <button
              className="btn-sm bg-primary-600 text-white flex items-center gap-2"
              onClick={handlePrint}
            >
              <PrinterIcon className="h-4 w-4" />
              Print
            </button>
            <button
              className="btn-sm bg-green-600 text-white flex items-center gap-2"
              onClick={handlePrint}
            >
              <ArrowDownTrayIcon className="h-4 w-4" />
              Save PDF
            </button>
            <button
              className="text-gray-400 hover:text-white"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Invoice Content */}
        <div ref={invoiceRef} className="invoice-container p-8" style={{ color: '#333', backgroundColor: '#fff' }}>
          {/* Header */}
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #2563eb', paddingBottom: '20px' }}>
            <h1 style={{ color: '#2563eb', fontSize: '28px', marginBottom: '5px' }}>Australian Lighting & Fans</h1>
            <p style={{ color: '#666', margin: '4px 0' }}>123 Light Street, Sydney NSW 2000</p>
            <p style={{ color: '#666', margin: '4px 0' }}>ABN: 12 345 678 901 | Phone: (02) 9123 4567</p>
            <span style={{
              display: 'inline-block',
              padding: '4px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 'bold',
              marginTop: '10px',
              backgroundColor: invoice.isLayby
                ? '#fef3c7'
                : invoice.isBackorder
                  ? '#cffafe'
                  : invoice.buyerType === 'retail'
                    ? '#fef3c7'
                    : '#dbeafe',
              color: invoice.isLayby
                ? '#92400e'
                : invoice.isBackorder
                  ? '#155e75'
                  : invoice.buyerType === 'retail'
                    ? '#92400e'
                    : '#1e40af',
            }}>
              {invoice.isLayby
                ? 'LAY BY — DEPOSIT RECEIPT'
                : invoice.isBackorder &&
                  typeof invoice.balanceDue === 'number' &&
                  invoice.balanceDue > 0.01
                  ? 'BACKORDER — DEPOSIT RECEIPT'
                  : invoice.buyerType === 'retail'
                    ? 'TRADE SALE'
                    : 'CUSTOMER SALE'}
            </span>
          </div>

          {/* Invoice Info */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '30px' }}>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>Invoice Details</h3>
              <p style={{ margin: '4px 0' }}><strong>Invoice #:</strong> {invoice.orderNumber}</p>
              <p style={{ margin: '4px 0' }}><strong>Date:</strong> {formatDate(invoice.date)}</p>
              <p style={{ margin: '4px 0' }}><strong>Payment:</strong> {invoice.paymentMethod.toUpperCase()}</p>
            </div>
            <div style={{ flex: 1, textAlign: 'right' }}>
              <h3 style={{ fontSize: '14px', color: '#666', marginBottom: '8px', textTransform: 'uppercase' }}>
                {invoice.buyerType === 'retail' ? 'Customer' : 'Bill To'}
              </h3>
              {invoice.buyerType === 'retail' ? (
                invoice.customerName || invoice.customerPhone || invoice.companyAbn ? (
                  <>
                    {invoice.customerName && <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: 'bold' }}>{invoice.customerName}</p>}
                    {invoice.companyAbn && <p style={{ margin: '4px 0' }}>ABN: {invoice.companyAbn}</p>}
                    {invoice.customerPhone && <p style={{ margin: '4px 0' }}>Ph: {invoice.customerPhone}</p>}
                    {invoice.customerEmail && <p style={{ margin: '4px 0' }}>{invoice.customerEmail}</p>}
                    {invoice.customerAddress && <p style={{ margin: '4px 0' }}>{invoice.customerAddress}</p>}
                  </>
                ) : (
                  <p style={{ margin: '4px 0' }}>Walk-in Customer</p>
                )
              ) : (
                <>
                  <p style={{ margin: '4px 0', fontSize: '16px', fontWeight: 'bold' }}>{invoice.customerName || 'N/A'}</p>
                  <p style={{ margin: '4px 0' }}>Ph: {invoice.customerPhone || 'N/A'}</p>
                  {invoice.customerEmail && <p style={{ margin: '4px 0' }}>{invoice.customerEmail}</p>}
                  {invoice.customerAddress && <p style={{ margin: '4px 0' }}>{invoice.customerAddress}</p>}
                </>
              )}
            </div>
          </div>

          {/* Items Table */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr>
                <th style={{ background: '#f3f4f6', padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Item</th>
                <th style={{ background: '#f3f4f6', padding: '12px', textAlign: 'left', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>SKU</th>
                <th style={{ background: '#f3f4f6', padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Qty</th>
                <th style={{ background: '#f3f4f6', padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Unit Price</th>
                {invoice.itemDiscounts > 0 && <th style={{ background: '#f3f4f6', padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Discount</th>}
                <th style={{ background: '#f3f4f6', padding: '12px', textAlign: 'right', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {/* Sort order: take-now first, then held, then backorder */}
              {[...invoice.items]
                .sort((a, b) => {
                  const rank = (it: typeof a) =>
                    it.isBackorder ? 2 : it.isLaybyHeld ? 1 : 0;
                  return rank(a) - rank(b);
                })
                .map((item) => {
                  const status = item.isBackorder
                    ? { label: 'ON BACKORDER', color: '#155e75', bg: '#cffafe' }
                    : item.isLaybyHeld
                      ? { label: 'ON LAY BY', color: '#92400e', bg: '#fef3c7' }
                      : { label: 'TAKING HOME', color: '#065f46', bg: '#d1fae5' };
                  return (
                    <tr key={item.productId}>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <span>{item.name}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              fontWeight: 700,
                              padding: '2px 6px',
                              borderRadius: '10px',
                              backgroundColor: status.bg,
                              color: status.color,
                            }}
                          >
                            {status.label}
                          </span>
                        </div>
                      </td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', color: '#666', fontSize: '14px' }}>{item.sku}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>{item.quantity}</td>
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>${item.unitPrice.toFixed(2)}</td>
                      {invoice.itemDiscounts > 0 && (
                        <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right', color: '#dc2626' }}>
                          {item.discountPercent > 0 ? `-${item.discountPercent}%` : '-'}
                        </td>
                      )}
                      <td style={{ padding: '12px', borderBottom: '1px solid #e5e7eb', textAlign: 'right' }}>${item.rowTotal.toFixed(2)}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>

          {/* Mixed-order split summary so the cashier and customer see at
              a glance what's going home vs. what's staying behind. */}
          {invoice.isMixed && (
            <div
              style={{
                padding: '12px',
                marginBottom: '16px',
                background: '#f9fafb',
                border: '1px solid #e5e7eb',
                borderRadius: '8px',
                fontSize: '13px',
                display: 'grid',
                gridTemplateColumns: '1fr 1fr',
                gap: '12px',
              }}
            >
              <div>
                <strong style={{ color: '#065f46' }}>Taking home today</strong>
                <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>
                  ${(invoice.takeNowSubtotal || 0).toFixed(2)}
                </p>
              </div>
              <div>
                <strong style={{ color: '#92400e' }}>On Lay By / Backorder</strong>
                <p style={{ margin: '4px 0 0', fontSize: '18px', fontWeight: 700 }}>
                  ${(invoice.deferredSubtotal || 0).toFixed(2)}
                </p>
              </div>
            </div>
          )}

          {/* Totals */}
          <div style={{ marginLeft: 'auto', width: '300px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>Subtotal:</span>
              <span>${invoice.subtotal.toFixed(2)}</span>
            </div>
            {invoice.itemDiscounts > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#dc2626' }}>
                <span>Item Discounts:</span>
                <span>-${invoice.itemDiscounts.toFixed(2)}</span>
              </div>
            )}
            {invoice.cartDiscount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', color: '#dc2626' }}>
                <span>Further Discount:</span>
                <span>-${invoice.cartDiscount.toFixed(2)}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0' }}>
              <span>GST (10%):</span>
              <span>${invoice.taxAmount.toFixed(2)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0 8px', fontSize: '18px', fontWeight: 'bold', borderTop: '2px solid #333', marginTop: '8px' }}>
              <span>Total:</span>
              <span>${invoice.grandTotal.toFixed(2)}</span>
            </div>

            {/* Deposit / balance split for laybys and backorder orders */}
            {typeof invoice.balanceDue === 'number' &&
              invoice.balanceDue > 0.01 && (
                <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#059669', fontWeight: 'bold' }}>
                    <span>
                      {invoice.isLayby ? 'Deposit paid today' : 'Paid today'}:
                    </span>
                    <span>${(invoice.amountPaid || 0).toFixed(2)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', color: '#b45309', fontWeight: 'bold' }}>
                    <span>Balance owing:</span>
                    <span>${invoice.balanceDue.toFixed(2)}</span>
                  </div>
                  <p style={{ marginTop: '8px', fontSize: '13px', color: '#666', fontStyle: 'italic' }}>
                    {invoice.isLayby
                      ? 'This is a Lay By deposit receipt. Goods will be released when the balance is paid in full.'
                      : 'Your order contains items that were not in stock. We will contact you when stock arrives and collect the balance on pickup/delivery.'}
                  </p>
                </div>
              )}

            {invoice.cashTendered && (
              <>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #e5e7eb' }}>
                  <span>Cash Tendered:</span>
                  <span>${invoice.cashTendered.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', fontWeight: 'bold', color: '#059669' }}>
                  <span>Change:</span>
                  <span>${invoice.change?.toFixed(2)}</span>
                </div>
              </>
            )}
          </div>

          {/* Category-specific sections */}
          {invoice.buyerType === 'customer' && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ color: '#374151', marginBottom: '10px' }}>Customer Account Information</h4>
              <p style={{ fontSize: '14px', color: '#666' }}>
                This purchase has been recorded to your account. For returns or exchanges,
                please present this invoice within 30 days of purchase. Trade customers
                may be eligible for additional discounts on future orders.
              </p>
            </div>
          )}

          {invoice.buyerType === 'retail' && (
            <div style={{ marginTop: '20px', padding: '15px', background: '#f9fafb', borderRadius: '8px' }}>
              <h4 style={{ color: '#374151', marginBottom: '10px' }}>Trade Purchase Policy</h4>
              <p style={{ fontSize: '14px', color: '#666' }}>
                Thank you for your purchase! Returns accepted within 14 days with original
                receipt. Items must be in original packaging and unused condition.
                Electrical items are covered by manufacturer warranty.
              </p>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: '40px', textAlign: 'center', color: '#666', fontSize: '12px', borderTop: '1px solid #e5e7eb', paddingTop: '20px' }}>
            <p>Thank you for shopping with Australian Lighting & Fans!</p>
            <p>www.auslighting.com.au | sales@auslighting.com.au</p>
            <p style={{ marginTop: '10px', fontSize: '11px' }}>
              * All prices include GST. E&OE. Terms and conditions apply.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
