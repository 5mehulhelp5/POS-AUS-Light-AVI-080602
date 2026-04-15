import { useState, useEffect } from 'react';
import {
  XMarkIcon,
  BanknotesIcon,
  CreditCardIcon,
  UserIcon,
  BuildingStorefrontIcon,
  BuildingLibraryIcon,
  GiftIcon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { useSelector } from 'react-redux';
import { RootState } from '../../../store';
import { ordersApi, customersApi } from '../../../services/api';
import InvoiceModal from './InvoiceModal';

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onComplete: () => void;
}

type PaymentMethod = 'cash' | 'eftpos' | 'bank_transfer';
type BuyerType = 'retail' | 'customer';

export default function PaymentModal({
  total,
  onClose,
  onComplete,
}: PaymentModalProps) {
  const cart = useSelector((state: RootState) => state.cart);

  const [method, setMethod] = useState<PaymentMethod>('eftpos');
  const [buyerType, setBuyerType] = useState<BuyerType>('customer');
  const [cashTendered, setCashTendered] = useState('');
  const [eftposRef, setEftposRef] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [demoMode, setDemoMode] = useState(true); // Demo mode enabled by default
  const [showInvoice, setShowInvoice] = useState(false);
  const [invoiceData, setInvoiceData] = useState<any>(null);

  // Customer details for invoice
  const [customerName, setCustomerName] = useState(cart.customerName || '');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerStreet, setCustomerStreet] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  const [customerState, setCustomerState] = useState('');
  const [customerPostcode, setCustomerPostcode] = useState('');
  const [companyAbn, setCompanyAbn] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [walkIn, setWalkIn] = useState(false);

  // Store credit state
  const [storeCreditBalance, setStoreCreditBalance] = useState(0);
  const [useStoreCredit, setUseStoreCredit] = useState(false);
  const [storeCreditAmount, setStoreCreditAmount] = useState(0);

  // Fetch store credit balance when a customer is attached to the cart
  useEffect(() => {
    if (!cart.customerId) {
      setStoreCreditBalance(0);
      setUseStoreCredit(false);
      setStoreCreditAmount(0);
      return;
    }
    customersApi
      .getStoreCredit(cart.customerId)
      .then((r) => setStoreCreditBalance(Number(r.data.data.balance) || 0))
      .catch(() => setStoreCreditBalance(0));
  }, [cart.customerId]);

  // When store credit is toggled on, default it to min(balance, total)
  useEffect(() => {
    if (useStoreCredit) {
      setStoreCreditAmount(Math.min(storeCreditBalance, total));
    } else {
      setStoreCreditAmount(0);
    }
  }, [useStoreCredit, storeCreditBalance, total]);

  const creditApplied = useStoreCredit ? Math.min(storeCreditAmount, storeCreditBalance, total) : 0;
  const remainingDue = Math.max(0, Math.round((total - creditApplied) * 100) / 100);

  const cashAmount = parseFloat(cashTendered) || 0;
  const change = cashAmount - remainingDue;

  const quickCashAmounts = [20, 50, 100, 200, 500];

  const generateOrderNumber = () => {
    const date = new Date();
    const year = date.getFullYear().toString().slice(-2);
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `INV-${year}${month}${day}-${random}`;
  };

  const handlePayment = async () => {
    if (remainingDue > 0 && method === 'cash' && cashAmount < remainingDue) {
      toast.error('Insufficient cash tendered');
      return;
    }

    if (useStoreCredit && !cart.customerId) {
      toast.error('Store credit can only be used when a customer is selected');
      return;
    }

    if (useStoreCredit && creditApplied <= 0) {
      toast.error('Enter a store credit amount greater than 0');
      return;
    }

    // Validate customer details if customer type (skip when walk-in)
    if (buyerType === 'customer' && !walkIn) {
      if (!customerName.trim()) {
        toast.error('Please enter customer name');
        return;
      }
      if (!customerPhone.trim()) {
        toast.error('Please enter customer phone number');
        return;
      }
    }

    setIsProcessing(true);

    try {
      let orderNumber: string;

      if (demoMode) {
        // Fake payment - simulate success
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate processing delay
        orderNumber = generateOrderNumber();
        toast.success(`Demo Order ${orderNumber} created successfully!`);
      } else {
        // Real payment via API — build a split payment array when store credit is used
        const payments: any[] = [];
        if (creditApplied > 0) {
          payments.push({ method: 'store_credit', amount: creditApplied });
        }
        if (remainingDue > 0) {
          payments.push({
            method,
            amount: remainingDue,
            reference: method !== 'cash' ? eftposRef : undefined,
            amountTendered: method === 'cash' ? cashAmount : undefined,
          });
        }

        const orderData = {
          customerId: cart.customerId,
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
          })),
          cartDiscount: cart.cartDiscount || undefined,
          payments,
          notes: orderNotes.trim() || cart.notes || undefined,
        };

        const response = await ordersApi.createOrder(orderData);

        if (!response.data.success) {
          throw new Error('Order creation failed');
        }

        orderNumber = response.data.data.order.orderNumber;
        toast.success(`Order ${orderNumber} created successfully!`);
      }

      // Prepare invoice data - include customer details for both buyer types if provided
      const invoice = {
        orderNumber,
        date: new Date().toISOString(),
        buyerType,
        customerName: walkIn ? 'Walk-in Customer' : (customerName.trim() || undefined),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: [customerStreet, customerCity, customerState, customerPostcode].filter(s => s.trim()).join(', ') || undefined,
        companyAbn: buyerType === 'retail' && companyAbn.trim() ? companyAbn.trim() : undefined,
        items: cart.items,
        subtotal: cart.subtotal,
        itemDiscounts: cart.itemDiscounts,
        cartDiscount: cart.cartDiscountAmount,
        taxAmount: cart.taxAmount,
        grandTotal: cart.grandTotal,
        paymentMethod: method,
        cashTendered: method === 'cash' ? cashAmount : undefined,
        change: method === 'cash' ? change : undefined,
      };

      setInvoiceData(invoice);
      setShowInvoice(true);

    } catch (error: any) {
      // Dig through NestJS's error envelope to find something human-readable.
      const body = error?.response?.data;
      console.error('Payment error — full response:', body, error);
      const msg =
        body?.error?.message ||
        body?.message ||
        (Array.isArray(body?.message) ? body.message.join(', ') : null) ||
        body?.errors?.[0]?.message ||
        (typeof body === 'string' ? body : null) ||
        error?.message ||
        'Failed to process payment';
      toast.error(String(msg).slice(0, 300));
      setIsProcessing(false);
    }
  };

  const handleInvoiceClose = () => {
    setShowInvoice(false);
    onComplete();
  };

  // Show invoice modal if payment was successful
  if (showInvoice && invoiceData) {
    return <InvoiceModal invoice={invoiceData} onClose={handleInvoiceClose} />;
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-content max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold">Payment</h2>
          <div className="flex items-center gap-4">
            {/* Demo Mode Toggle */}
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={demoMode}
                onChange={(e) => setDemoMode(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-primary-500 focus:ring-primary-500"
              />
              <span className={demoMode ? 'text-yellow-400' : 'text-gray-400'}>
                Demo Mode
              </span>
            </label>
            <button
              className="text-gray-400 hover:text-white"
              onClick={onClose}
            >
              <XMarkIcon className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Demo Mode Banner */}
        {demoMode && (
          <div className="bg-yellow-500/20 border border-yellow-500/50 rounded-lg p-3 mb-4">
            <p className="text-yellow-400 text-sm text-center">
              Demo Mode: Payments will be simulated (no real transactions)
            </p>
          </div>
        )}

        {/* Total */}
        <div className="text-center mb-4">
          <p className="text-gray-400 text-sm">Order Total</p>
          <p className="text-4xl font-bold text-primary-400">
            ${total.toFixed(2)}
          </p>
          {creditApplied > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Store credit applied: <span className="text-purple-300 font-medium">-${creditApplied.toFixed(2)}</span>
              {' — '}
              Remaining: <span className="text-primary-400 font-bold">${remainingDue.toFixed(2)}</span>
            </p>
          )}
        </div>

        {/* Store Credit */}
        {cart.customerId && storeCreditBalance > 0 && (
          <div className="mb-4 p-3 rounded-lg border border-purple-500/40 bg-purple-500/10">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={useStoreCredit}
                  onChange={(e) => setUseStoreCredit(e.target.checked)}
                  className="w-4 h-4"
                />
                <GiftIcon className="h-5 w-5 text-purple-300" />
                <span className="text-sm font-medium text-purple-200">
                  Apply store credit
                </span>
              </label>
              <span className="text-xs text-gray-400">
                Available: <span className="text-purple-300 font-semibold">${storeCreditBalance.toFixed(2)}</span>
              </span>
            </div>
            {useStoreCredit && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs text-gray-400">Amount to use:</span>
                <input
                  type="number"
                  min={0}
                  max={Math.min(storeCreditBalance, total)}
                  step="0.01"
                  value={storeCreditAmount}
                  onChange={(e) =>
                    setStoreCreditAmount(
                      Math.max(
                        0,
                        Math.min(
                          Math.min(storeCreditBalance, total),
                          parseFloat(e.target.value) || 0,
                        ),
                      ),
                    )
                  }
                  className="input w-28 py-1 px-2 text-sm"
                />
                <button
                  type="button"
                  className="btn-sm bg-purple-700 text-white text-xs"
                  onClick={() => setStoreCreditAmount(Math.min(storeCreditBalance, total))}
                >
                  Max
                </button>
              </div>
            )}
          </div>
        )}

        {/* Buyer Type Selection */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Buyer Type (for Invoice)
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                buyerType === 'retail'
                  ? 'border-orange-500 bg-orange-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setBuyerType('retail')}
            >
              <BuildingStorefrontIcon className="h-5 w-5" />
              <span className="font-medium">Trade</span>
            </button>
            <button
              className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                buyerType === 'customer'
                  ? 'border-blue-500 bg-blue-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setBuyerType('customer')}
            >
              <UserIcon className="h-5 w-5" />
              <span className="font-medium">Customer</span>
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {buyerType === 'retail'
              ? 'Walk-in customer - standard trade invoice'
              : 'Registered customer - invoice with account details'}
          </p>
          {buyerType === 'customer' && (
            <label className="flex items-center gap-2 mt-3 text-sm">
              <input
                type="checkbox"
                checked={walkIn}
                onChange={(e) => setWalkIn(e.target.checked)}
                className="w-4 h-4 rounded border-gray-600 bg-gray-700"
              />
              <span className="text-gray-300">Walk-in (skip customer details)</span>
            </label>
          )}
        </div>

        {/* Customer/Company Details (for Invoice) */}
        {!walkIn && (
        <div className={`mb-6 p-4 rounded-lg space-y-3 ${
          buyerType === 'retail'
            ? 'bg-orange-500/10 border border-orange-500/30'
            : 'bg-blue-500/10 border border-blue-500/30'
        }`}>
          <h3 className={`text-sm font-medium mb-2 ${
            buyerType === 'retail' ? 'text-orange-400' : 'text-blue-400'
          }`}>
            {buyerType === 'retail' ? 'Company/Customer Details (Optional)' : 'Customer Details (for Invoice)'}
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {buyerType === 'retail' ? 'Company/Name' : 'Name *'}
              </label>
              <input
                type="text"
                className="input text-sm"
                placeholder={buyerType === 'retail' ? 'Company or customer name' : 'Customer name'}
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">
                {buyerType === 'retail' ? 'Phone' : 'Phone *'}
              </label>
              <input
                type="tel"
                className="input text-sm"
                placeholder="Phone number"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">Email</label>
              <input
                type="email"
                className="input text-sm"
                placeholder="Email address"
                value={customerEmail}
                onChange={(e) => setCustomerEmail(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Street Address</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="123 Main St"
                value={customerStreet}
                onChange={(e) => setCustomerStreet(e.target.value)}
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs text-gray-400 mb-1">City / Suburb</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="Sydney"
                value={customerCity}
                onChange={(e) => setCustomerCity(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">State</label>
              <select
                className="input text-sm"
                value={customerState}
                onChange={(e) => setCustomerState(e.target.value)}
              >
                <option value="">Select</option>
                <option value="NSW">NSW</option>
                <option value="VIC">VIC</option>
                <option value="QLD">QLD</option>
                <option value="WA">WA</option>
                <option value="SA">SA</option>
                <option value="TAS">TAS</option>
                <option value="ACT">ACT</option>
                <option value="NT">NT</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1">Postcode</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="2000"
                value={customerPostcode}
                onChange={(e) => setCustomerPostcode(e.target.value)}
                maxLength={4}
              />
            </div>
          </div>
          {buyerType === 'retail' && (
            <div>
              <label className="block text-xs text-gray-400 mb-1">Company ABN</label>
              <input
                type="text"
                className="input text-sm"
                placeholder="XX XXX XXX XXX"
                value={companyAbn}
                onChange={(e) => setCompanyAbn(e.target.value)}
              />
            </div>
          )}
        </div>
        )}

        {/* Payment Method */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button
            className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
              method === 'eftpos'
                ? 'border-primary-500 bg-primary-500/20'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => setMethod('eftpos')}
          >
            <CreditCardIcon className="h-7 w-7" />
            <span className="font-medium text-sm">EFTPOS</span>
          </button>
          <button
            className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
              method === 'cash'
                ? 'border-primary-500 bg-primary-500/20'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => setMethod('cash')}
          >
            <BanknotesIcon className="h-7 w-7" />
            <span className="font-medium text-sm">Cash</span>
          </button>
          <button
            className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-colors ${
              method === 'bank_transfer'
                ? 'border-primary-500 bg-primary-500/20'
                : 'border-gray-600 hover:border-gray-500'
            }`}
            onClick={() => setMethod('bank_transfer')}
          >
            <BuildingLibraryIcon className="h-7 w-7" />
            <span className="font-medium text-sm">Bank Transfer</span>
          </button>
        </div>

        {/* Cash Payment */}
        {method === 'cash' && (
          <div className="space-y-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-400 mb-2">
                Cash Tendered
              </label>
              <input
                type="number"
                className="input input-lg text-center text-2xl font-mono"
                placeholder="0.00"
                value={cashTendered}
                onChange={(e) => setCashTendered(e.target.value)}
                autoFocus
              />
            </div>

            {/* Quick amounts */}
            <div className="flex flex-wrap gap-2">
              {quickCashAmounts.map((amount) => (
                <button
                  key={amount}
                  className="btn-secondary flex-1"
                  onClick={() => setCashTendered(amount.toString())}
                >
                  ${amount}
                </button>
              ))}
              <button
                className="btn-secondary flex-1"
                onClick={() => setCashTendered(Math.ceil(total).toString())}
              >
                Exact
              </button>
            </div>

            {/* Change */}
            {cashAmount >= total && (
              <div className="text-center p-4 bg-green-500/20 rounded-lg">
                <p className="text-sm text-gray-400">Change</p>
                <p className="text-2xl font-bold text-green-400">
                  ${change.toFixed(2)}
                </p>
              </div>
            )}
          </div>
        )}

        {/* EFTPOS Payment */}
        {method === 'eftpos' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Reference (Optional)
            </label>
            <input
              type="text"
              className="input"
              placeholder="Transaction reference"
              value={eftposRef}
              onChange={(e) => setEftposRef(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-2">
              {demoMode
                ? 'Demo mode: Click Complete Payment to simulate transaction.'
                : 'Process payment on EFTPOS terminal, then click Complete Payment.'}
            </p>
          </div>
        )}

        {/* Bank Transfer Payment */}
        {method === 'bank_transfer' && (
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-400 mb-2">
              Transfer Reference
            </label>
            <input
              type="text"
              className="input"
              placeholder="Bank transfer reference / receipt no."
              value={eftposRef}
              onChange={(e) => setEftposRef(e.target.value)}
            />
            <p className="text-sm text-gray-500 mt-2">
              Confirm funds received before clicking Complete Payment.
            </p>
          </div>
        )}

        {/* Order Notes */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Order Notes (optional)
          </label>
          <textarea
            className="input"
            rows={2}
            placeholder="Internal notes for this order..."
            value={orderNotes}
            onChange={(e) => setOrderNotes(e.target.value)}
          />
        </div>

        {/* Complete Button */}
        <button
          className="btn-success w-full btn-lg text-lg"
          onClick={handlePayment}
          disabled={
            isProcessing ||
            (remainingDue > 0 && method === 'cash' && cashAmount < remainingDue)
          }
        >
          {isProcessing
            ? (demoMode ? 'Simulating...' : 'Processing...')
            : remainingDue === 0 && creditApplied > 0
              ? `Pay with Store Credit`
              : `Complete Payment${creditApplied > 0 ? ` ($${remainingDue.toFixed(2)} + credit)` : ''}`}
        </button>
      </div>
    </div>
  );
}
