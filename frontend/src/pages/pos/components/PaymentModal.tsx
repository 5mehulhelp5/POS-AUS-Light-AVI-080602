import { useState, useEffect } from 'react';
import {
  ArrowLeftIcon,
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

  // Layby state. The 20% minimum and 90-day default are also enforced
  // server-side; these constants just drive the UI defaults.
  const LAYBY_DEPOSIT_PERCENT = 20;
  const [isLayby, setIsLayby] = useState(false);
  const [laybyDeposit, setLaybyDeposit] = useState<string>('');

  // Per-item backorder flags (productId -> isBackorder). Cashier ticks
  // items that aren't in stock and will be fulfilled later. Seed from
  // cart.items.isBackorder so lines that were out of stock at add time
  // already have the flag on.
  const [backorderByProductId, setBackorderByProductId] = useState<
    Record<number, boolean>
  >(() =>
    Object.fromEntries(
      cart.items
        .filter((i) => i.isBackorder)
        .map((i) => [i.productId, true]),
    ),
  );

  // Does the current cart include at least one backorder line? Backorder
  // orders follow the same "deposit now, balance later" rule as laybys,
  // so the deposit UI appears automatically.
  const hasBackorderLine = Object.values(backorderByProductId).some((v) => v);
  // Any order that lets the customer pay less than the full grand total
  // now: explicit Lay By, or an order containing backorder items.
  const isDepositOrder = isLayby || hasBackorderLine;

  // Default the deposit input to the 20% minimum whenever a deposit-
  // based order is active (Lay By OR cart has backorder lines).
  useEffect(() => {
    if (isDepositOrder) {
      const min = Math.round((total * LAYBY_DEPOSIT_PERCENT) / 100 * 100) / 100;
      // Only reset if the current value isn't already meaningful
      setLaybyDeposit((prev) => {
        if (prev && parseFloat(prev) > 0) return prev;
        return min.toFixed(2);
      });
    } else {
      setLaybyDeposit('');
    }
  }, [isDepositOrder, total]);

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

  // Resolve the amount the cashier is actually collecting right now.
  // Deposit orders (lay by or backorder): whatever the deposit input
  // is. Normal sale: the cart total.
  const depositDue = isDepositOrder
    ? Math.max(0, Math.round((parseFloat(laybyDeposit) || 0) * 100) / 100)
    : total;
  const depositRemaining = Math.max(
    0,
    Math.round((depositDue - creditApplied) * 100) / 100,
  );

  const handlePayment = async () => {
    // Cash-at-register must cover the amount being collected right now
    // (deposit for laybys/backorders, full total otherwise), minus any
    // store credit.
    const dueNow = isDepositOrder ? depositRemaining : remainingDue;
    if (dueNow > 0 && method === 'cash' && cashAmount < dueNow) {
      toast.error('Insufficient cash tendered');
      return;
    }

    // Layby needs a DB customer record so we can track the balance and
    // (later) follow up on expiry. If the cashier only typed inline
    // invoice details, require at minimum a name and phone — we'll
    // auto-create the customer record before submitting the order.
    if (isLayby && !cart.customerId) {
      if (!customerName.trim() || !customerPhone.trim()) {
        toast.error(
          'Lay By needs a customer name and phone (or pick an existing customer)',
        );
        return;
      }
    }

    if (useStoreCredit && !cart.customerId) {
      toast.error('Store credit can only be used when a customer is selected');
      return;
    }

    if (useStoreCredit && creditApplied <= 0) {
      toast.error('Enter a store credit amount greater than 0');
      return;
    }

    // Block deposits (layby or backorder) that fall below the 20%
    // minimum. Server enforces too; fail fast on the client.
    if (isDepositOrder) {
      const minDeposit =
        Math.round((total * LAYBY_DEPOSIT_PERCENT) / 100 * 100) / 100;
      if (depositDue + 0.01 < minDeposit) {
        toast.error(
          `Deposit of $${depositDue.toFixed(2)} is below the ${LAYBY_DEPOSIT_PERCENT}% minimum ($${minDeposit.toFixed(2)}). A manager can override.`,
        );
        return;
      }
      if (depositDue > total + 0.01) {
        toast.error('Deposit cannot exceed the order total');
        return;
      }
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
        // Real payment via API — build a split payment array when store
        // credit is used. For laybys, only the deposit is charged now.
        const payments: any[] = [];
        const payableNow = isDepositOrder ? depositRemaining : remainingDue;
        if (creditApplied > 0) {
          payments.push({ method: 'store_credit', amount: creditApplied });
        }
        if (payableNow > 0) {
          payments.push({
            method,
            amount: payableNow,
            reference: method !== 'cash' ? eftposRef : undefined,
            amountTendered: method === 'cash' ? cashAmount : undefined,
          });
        }

        // Layby requires a DB customer record. If the cashier typed inline
        // details without picking/creating a customer first, auto-create
        // one here so the order can attach to it and we can follow up
        // later.
        let customerIdToUse = cart.customerId;
        if (isLayby && !customerIdToUse) {
          const parts = customerName.trim().split(/\s+/);
          const firstName = parts.shift() || customerName.trim();
          const lastName = parts.join(' ') || '—';
          const created = await customersApi.createCustomer({
            firstName,
            lastName,
            phone: customerPhone.trim() || undefined,
            email: customerEmail.trim() || undefined,
            street: customerStreet.trim() || undefined,
            city: customerCity.trim() || undefined,
            state: customerState || undefined,
            postcode: customerPostcode.trim() || undefined,
          });
          customerIdToUse = created.data?.data?.customer?.id || null;
          if (!customerIdToUse) {
            throw new Error('Could not create customer record for layby');
          }
        }

        const orderData = {
          customerId: customerIdToUse,
          orderType: isLayby ? 'layby' : 'standard',
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            discountPercent: item.discountPercent,
            isBackorder: !!backorderByProductId[item.productId],
            // Pass unitPrice so the server can honour manual overrides on
            // backorder lines (e.g. catalogue price is $0).
            unitPrice: item.unitPrice,
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
        if (isLayby) {
          toast.success(
            `Lay By ${orderNumber} created. Deposit $${depositDue.toFixed(2)} received. Balance $${(total - depositDue).toFixed(2)}.`,
          );
        } else {
          toast.success(`Order ${orderNumber} created successfully!`);
        }
      }

      // Prepare invoice data - include customer details for both buyer types if provided.
      // For deposit orders, also pass the actual amount paid now + the
      // balance owing so the invoice can show a deposit/balance split
      // rather than claiming the whole total is paid.
      const amountPaidNow = isDepositOrder ? depositDue : cart.grandTotal;
      const balanceOwing = Math.max(
        0,
        Math.round((cart.grandTotal - amountPaidNow) * 100) / 100,
      );
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
        // Deposit / balance metadata — absent means the whole total was paid
        isLayby,
        isBackorder: hasBackorderLine,
        amountPaid: amountPaidNow,
        balanceDue: balanceOwing,
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
    <div className="modal-backdrop">
      <div className="bg-pos-card w-full h-full flex overflow-hidden">
        {/* Main payment form column */}
        <div className="flex-1 overflow-y-auto p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <button onClick={onClose} className="modal-back-btn">
            <ArrowLeftIcon className="h-5 w-5" /> Back
          </button>
          <h2 className="text-xl font-bold">Payment</h2>
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
          {isDepositOrder && (
            <p className="text-sm text-amber-300 mt-1">
              Taking deposit now: <span className="font-bold">${depositDue.toFixed(2)}</span>
              {' · '}
              Balance owing: <span className="font-bold">${Math.max(0, total - depositDue).toFixed(2)}</span>
            </p>
          )}
          {creditApplied > 0 && (
            <p className="text-sm text-gray-400 mt-1">
              Store credit applied: <span className="text-purple-300 font-medium">-${creditApplied.toFixed(2)}</span>
              {' — '}
              Remaining: <span className="text-primary-400 font-bold">${(isDepositOrder ? depositRemaining : remainingDue).toFixed(2)}</span>
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

        {/* Lay By toggle. A DB customer record is required — if the cashier
            filled in ad-hoc customer details above, we auto-create one on
            submit, so allow the checkbox as long as we have a name + phone. */}
        {(() => {
          const hasLinkedCustomer = !!cart.customerId;
          const hasAdHocCustomer =
            !!customerName.trim() && !!customerPhone.trim();
          const canLayby = hasLinkedCustomer || hasAdHocCustomer;
          return (
        <div className="mb-6 p-3 rounded-lg border border-amber-500/40 bg-amber-500/5">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isLayby}
              onChange={(e) => setIsLayby(e.target.checked)}
              className="w-4 h-4"
              disabled={!canLayby}
            />
            <span className="font-medium text-amber-300">Create as Lay By</span>
            <span className="text-xs text-gray-400">
              {canLayby
                ? hasLinkedCustomer
                  ? '— customer pays deposit now, balance later'
                  : '— a customer record will be created from the details above'
                : '(fill in customer name + phone, or pick an existing customer)'}
            </span>
          </label>
          {hasBackorderLine && !isLayby && (
            <p className="text-xs text-cyan-300 mt-2">
              Cart has backorder items — a deposit of at least {LAYBY_DEPOSIT_PERCENT}%
              is required now, the balance is collected when stock arrives.
            </p>
          )}
          {isDepositOrder && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Deposit (min {LAYBY_DEPOSIT_PERCENT}% = ${((total * LAYBY_DEPOSIT_PERCENT) / 100).toFixed(2)})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min={0}
                  max={total}
                  className="input"
                  value={laybyDeposit}
                  onChange={(e) => setLaybyDeposit(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Balance owing</label>
                <p className="input flex items-center text-gray-300">
                  ${Math.max(0, total - (parseFloat(laybyDeposit) || 0)).toFixed(2)}
                </p>
              </div>
            </div>
          )}
        </div>
          );
        })()}

        {/* Complete Button */}
        <button
          className="btn-success w-full btn-lg text-lg"
          onClick={handlePayment}
          disabled={
            isProcessing ||
            (isDepositOrder
              ? depositRemaining > 0 && method === 'cash' && cashAmount < depositRemaining
              : remainingDue > 0 && method === 'cash' && cashAmount < remainingDue)
          }
        >
          {isProcessing
            ? (demoMode ? 'Simulating...' : 'Processing...')
            : isLayby
              ? `Create Lay By — Take Deposit $${depositRemaining.toFixed(2)}${creditApplied > 0 ? ' + credit' : ''}`
              : hasBackorderLine
                ? `Create Backorder — Take Deposit $${depositRemaining.toFixed(2)}${creditApplied > 0 ? ' + credit' : ''}`
                : remainingDue === 0 && creditApplied > 0
                  ? `Pay with Store Credit`
                  : `Complete Payment${creditApplied > 0 ? ` ($${remainingDue.toFixed(2)} + credit)` : ''}`}
        </button>
        </div>
        {/* End main payment column */}

        {/* Cart sidebar — always visible during payment so the cashier can verify items */}
        <aside className="w-96 border-l border-gray-700 bg-pos-dark flex flex-col">
          <div className="p-4 border-b border-gray-700">
            <h3 className="font-bold">Current Sale</h3>
            <p className="text-xs text-gray-400">
              {cart.items.length} item{cart.items.length === 1 ? '' : 's'}
              {cart.customerName && ` · ${cart.customerName}`}
            </p>
          </div>
          <div className="flex-1 overflow-y-auto divide-y divide-gray-800">
            {cart.items.length === 0 ? (
              <p className="p-4 text-sm text-gray-500">Cart is empty.</p>
            ) : (
              cart.items.map((item) => (
                <div key={item.productId} className="p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-xs text-gray-500 font-mono truncate">{item.sku}</p>
                    </div>
                    <p className="text-sm font-medium whitespace-nowrap">
                      ${item.rowTotal.toFixed(2)}
                    </p>
                  </div>
                  <div className="flex justify-between items-center mt-1 text-xs text-gray-400">
                    <span>
                      {item.quantity} × ${item.unitPrice.toFixed(2)}
                    </span>
                    {item.discountPercent > 0 && (
                      <span className="text-green-400">-{item.discountPercent}%</span>
                    )}
                  </div>
                  {/* Backorder toggle — tick for items not in stock that the
                      customer is happy to wait for. Stock isn't deducted and
                      the order is flagged for fulfilment when it arrives. */}
                  <label className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={!!backorderByProductId[item.productId]}
                      onChange={(e) =>
                        setBackorderByProductId((prev) => ({
                          ...prev,
                          [item.productId]: e.target.checked,
                        }))
                      }
                      className="w-3.5 h-3.5"
                    />
                    <span>Backorder (not in stock yet)</span>
                  </label>
                </div>
              ))
            )}
          </div>
          <div className="p-4 border-t border-gray-700 text-sm space-y-1">
            <div className="flex justify-between text-gray-400">
              <span>Subtotal</span>
              <span>${cart.subtotal.toFixed(2)}</span>
            </div>
            {cart.itemDiscounts > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Item discounts</span>
                <span>-${cart.itemDiscounts.toFixed(2)}</span>
              </div>
            )}
            {cart.cartDiscountAmount > 0 && (
              <div className="flex justify-between text-green-400">
                <span>Cart discount</span>
                <span>-${cart.cartDiscountAmount.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-gray-400">
              <span>GST (incl.)</span>
              <span>${cart.taxAmount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-700">
              <span>Total</span>
              <span className="text-primary-400">${cart.grandTotal.toFixed(2)}</span>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
