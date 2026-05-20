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
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '../../../store';
import { ordersApi, customersApi, quotesApi } from '../../../services/api';
import { setTradeAutoDiscounts, setCustomer } from '../../../store/slices/cartSlice';
import InvoiceModal from './InvoiceModal';

interface PaymentModalProps {
  total: number;
  onClose: () => void;
  onComplete: () => void;
}

type PaymentMethod = 'cash' | 'eftpos' | 'bank_transfer';
type BuyerType = 'retail' | 'customer';
type DeliveryType = 'pickup' | 'delivery';

// Flat delivery fee — must match backend DELIVERY_FEE constant.
const DELIVERY_FEE = 60;

export default function PaymentModal({
  total,
  onClose,
  onComplete,
}: PaymentModalProps) {
  const cart = useSelector((state: RootState) => state.cart);
  const { user } = useSelector((state: RootState) => state.auth);
  const dispatch = useDispatch<AppDispatch>();
  // Manager / admin can override the layby/backorder deposit minimum
  // — including dropping it to $0 for established customers.
  const canOverrideDeposit =
    user?.role?.name === 'admin' || user?.role?.name === 'manager';

  const [method, setMethod] = useState<PaymentMethod>('eftpos');
  // Default to Trade when the selected customer is permanently flagged
  // trade — saves the cashier a click. They can still flip back to
  // 'customer' if needed.
  const [buyerType, setBuyerType] = useState<BuyerType>(
    cart.customerIsTrade ? 'retail' : 'customer',
  );
  const [deliveryType, setDeliveryType] = useState<DeliveryType>('pickup');
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
  // Trade buyers get separate Company / First Name / Last Name fields.
  // For non-trade orders we keep using `customerName` as a single field.
  const [tradeCompanyName, setTradeCompanyName] = useState('');
  const [tradeFirstName, setTradeFirstName] = useState('');
  const [tradeLastName, setTradeLastName] = useState('');
  const [orderNotes, setOrderNotes] = useState('');
  const [walkIn, setWalkIn] = useState(false);

  // Existing-customer-by-phone lookup. When the cashier types a full
  // 10-digit phone that already exists, we pop up an offer to pull the
  // saved details in (so they don't re-key name/address).
  const [phoneMatch, setPhoneMatch] = useState<any | null>(null);
  const [phoneLookedUp, setPhoneLookedUp] = useState<string>(''); // last phone we searched
  const [phoneMatchDismissed, setPhoneMatchDismissed] = useState<string>(''); // phone the user said "no" to

  // Strip to digits, cap at 10, and trigger an existing-customer lookup
  // once a full number is entered. Shared by the trade + customer phone
  // inputs.
  const handlePhoneChange = (raw: string) => {
    const digits = raw.replace(/\D/g, '').slice(0, 10);
    setCustomerPhone(digits);
    if (digits.length === 10 && digits !== phoneLookedUp) {
      setPhoneLookedUp(digits);
      customersApi
        .getCustomers({ search: digits, limit: 5 })
        .then((r) => {
          const list = r.data?.data?.customers || [];
          const exact = list.find((c: any) => (c.phone || '').replace(/\D/g, '') === digits);
          if (exact && digits !== phoneMatchDismissed) {
            setPhoneMatch(exact);
          }
        })
        .catch(() => {});
    }
  };

  // Fill the invoice fields from a matched customer and link them to
  // the cart so trade pricing / store credit pick up too.
  const applyMatchedCustomer = (c: any) => {
    const fullName = [c.firstName, c.lastName].filter(Boolean).join(' ').trim();
    setCustomerName(fullName);
    if (c.email) setCustomerEmail(c.email);
    if (c.billingStreet) setCustomerStreet(c.billingStreet);
    if (c.billingCity) setCustomerCity(c.billingCity);
    if (c.billingState) setCustomerState(c.billingState);
    if (c.billingPostcode) setCustomerPostcode(c.billingPostcode);
    if (c.phone) setCustomerPhone((c.phone || '').replace(/\D/g, '').slice(0, 10));
    // Trade layout fields
    setTradeFirstName(c.firstName || '');
    setTradeLastName(c.lastName || '');
    if (c.company) setTradeCompanyName(c.company);
    // Link to the cart (drives trade pricing + store credit)
    dispatch(
      setCustomer({ id: c.id, name: fullName, isTrade: !!c.isTrade }),
    );
    setPhoneMatch(null);
  };

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

  // Per-item "hold on lay by" flags. When ticked, stock for that line
  // stays with the store until the layby balance is paid — even though
  // the item is in stock. Lets an order mix take-now + held items.
  const [laybyHeldByProductId, setLaybyHeldByProductId] = useState<
    Record<number, boolean>
  >({});

  // Per-item backorder QUANTITY. When set and less than the cart line's
  // total quantity, the line splits at submit time: e.g. cart shows
  // 4 × Airbus, backorder ticked, backorderQty=2 -> 2 take-now + 2
  // backorder. Default = full quantity (entire line is backorder).
  const [backorderQtyByProductId, setBackorderQtyByProductId] = useState<
    Record<number, number>
  >({});

  // Per-item Lay By held QUANTITY — same idea as backorderQtyByProductId
  // but for the "Hold on Lay By" path. Lets the customer take some
  // units home today and leave the rest on the shelf until the balance
  // is paid (e.g. 4 ordered, 2 take home, 2 held on layby).
  const [laybyHeldQtyByProductId, setLaybyHeldQtyByProductId] = useState<
    Record<number, number>
  >({});

  // Does the current cart include at least one backorder / held line?
  const hasBackorderLine = Object.values(backorderByProductId).some((v) => v);
  const hasLaybyHeldLine = Object.values(laybyHeldByProductId).some((v) => v);
  // Any order that lets the customer pay less than the full grand total
  // now: explicit Lay By toggle, any held line, or any backorder line.
  const isDepositOrder = isLayby || hasBackorderLine || hasLaybyHeldLine;

  // Split the cart into take-now (full price now) vs deferred (held or
  // backorder — 20% deposit now). When the Lay By toggle is on but no
  // per-line overrides were made, treat every non-backorder line as held.
  const LAYBY_ALL_FROM_TOGGLE = isLayby && !hasLaybyHeldLine;
  const { takeNowSubtotal, deferredSubtotal } = (() => {
    let takeNow = 0;
    let deferred = 0;
    for (const it of cart.items) {
      const isBack = !!backorderByProductId[it.productId];
      const isHeld =
        !!laybyHeldByProductId[it.productId] ||
        (LAYBY_ALL_FROM_TOGGLE && !isBack);
      if (isBack) {
        // Backorder may be a partial split (e.g. 2 of 4 backordered).
        // Default to full quantity if no split was set.
        const backQty = Math.min(
          it.quantity,
          Math.max(
            0,
            backorderQtyByProductId[it.productId] ?? it.quantity,
          ),
        );
        const perUnit = it.quantity > 0 ? it.rowTotal / it.quantity : 0;
        deferred += perUnit * backQty;
        takeNow += perUnit * (it.quantity - backQty);
      } else if (isHeld) {
        // Layby may also be a partial split (e.g. 2 of 4 left behind on
        // the shelf, 2 walked out today). Default to full quantity.
        const heldQty = Math.min(
          it.quantity,
          Math.max(
            0,
            laybyHeldQtyByProductId[it.productId] ?? it.quantity,
          ),
        );
        const perUnit = it.quantity > 0 ? it.rowTotal / it.quantity : 0;
        deferred += perUnit * heldQty;
        takeNow += perUnit * (it.quantity - heldQty);
      } else {
        takeNow += it.rowTotal;
      }
    }
    return {
      takeNowSubtotal: Math.round(takeNow * 100) / 100,
      deferredSubtotal: Math.round(deferred * 100) / 100,
    };
  })();
  // Minimum deposit when there's a mix of take-now and deferred items:
  //   full price for the items the customer is walking out with today
  //   + 20% on the items the store is holding (lay-by held / backorder).
  // Pure layby with no take-now items becomes 20% of the whole order;
  // pure take-now becomes the full amount.
  const minDepositForOrder =
    Math.round(
      (takeNowSubtotal + (deferredSubtotal * LAYBY_DEPOSIT_PERCENT) / 100) *
        100,
    ) / 100;

  // (Trade buyers can lay by / backorder too — Avi reversed the
  // earlier "trade is take-now only" rule. The clear-on-flip effect was
  // removed so flags stick when the cashier toggles between trade and
  // retail.)

  // Trade pricing in the cart can be triggered TWO ways:
  //   (1) the selected customer is permanently flagged isTrade=true
  //       — handled by POSPage's effect before this modal even opens.
  //   (2) the cashier hits the "Trade" button here for a walk-in /
  //       non-flagged customer — that's what this effect handles.
  // Whenever buyerType flips OR the cart's product set changes while
  // Trade is on, refetch and apply the auto-discount per line. When the
  // cashier flips back to Customer AND the selected customer isn't
  // permanently trade, clear the auto so the cart snaps back to retail.
  const tradeCartIdsKey = cart.items
    .map((i) => i.productId)
    .sort()
    .join(',');
  useEffect(() => {
    const shouldBeTradePriced =
      buyerType === 'retail' || cart.customerIsTrade;
    if (!shouldBeTradePriced) {
      // Only clear if there's actually something to clear.
      if (cart.items.some((i) => (i.autoDiscountPercent || 0) > 0)) {
        dispatch(setTradeAutoDiscounts({}));
      }
      return;
    }
    const ids = cart.items
      .map((i) => i.productId)
      .filter((id) => Number.isFinite(id) && id > 0);
    if (ids.length === 0) return;
    let cancelled = false;
    quotesApi
      .tradeDiscountPreview(ids)
      .then((r) => {
        if (cancelled) return;
        const map = r.data?.data?.discounts || {};
        dispatch(setTradeAutoDiscounts(map));
      })
      .catch(() => {
        // Preview is non-essential — server re-applies on order create.
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [buyerType, cart.customerIsTrade, tradeCartIdsKey, dispatch]);

  // Snap the deposit input to the live minimum whenever the cart split
  // changes. Without this, the field keeps a stale value (e.g. cashier
  // changes layby qty and the box still shows the old $880 deposit
  // instead of the new $489 minimum). If the cashier wants to take a
  // bigger deposit, they re-type AFTER making qty changes.
  useEffect(() => {
    if (isDepositOrder) {
      setLaybyDeposit(minDepositForOrder.toFixed(2));
    } else {
      setLaybyDeposit('');
    }
  }, [isDepositOrder, minDepositForOrder]);

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
      setStoreCreditAmount(Math.min(storeCreditBalance, totalWithDelivery));
    } else {
      setStoreCreditAmount(0);
    }
  }, [useStoreCredit, storeCreditBalance, total]);

  // Delivery fee is added on top of the cart grand total (`total`
  // prop). Backend recomputes the same way, so the cashier's
  // displayed total and the server total agree.
  const deliveryFeeApplied = deliveryType === 'delivery' ? DELIVERY_FEE : 0;
  const totalWithDelivery =
    Math.round((total + deliveryFeeApplied) * 100) / 100;

  const creditApplied = useStoreCredit
    ? Math.min(storeCreditAmount, storeCreditBalance, totalWithDelivery)
    : 0;
  const remainingDue = Math.max(
    0,
    Math.round((totalWithDelivery - creditApplied) * 100) / 100,
  );

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
    : totalWithDelivery;
  const depositRemaining = Math.max(
    0,
    Math.round((depositDue - creditApplied) * 100) / 100,
  );

  // Confirm-before-submit popup: when the cashier clicks Complete Payment
  // we validate, then ask "Has the customer paid $X via Y?" instead of
  // submitting straight away. Prevents accidental double-clicks and
  // forces a deliberate yes-paid confirmation.
  const [showPayConfirm, setShowPayConfirm] = useState(false);

  const handlePayment = async (skipConfirm: boolean = false) => {
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

    // Block deposits that fall below the minimum = full price for
    // take-now items + 20% of held / backorder items. Manager / admin
    // can override (including dropping the deposit all the way to $0
    // for trusted customers). Server enforces the same rule.
    if (isDepositOrder) {
      if (depositDue + 0.01 < minDepositForOrder && !canOverrideDeposit) {
        toast.error(
          `Deposit of $${depositDue.toFixed(2)} is below the minimum $${minDepositForOrder.toFixed(2)} ` +
            `(take-now $${takeNowSubtotal.toFixed(2)} + ${LAYBY_DEPOSIT_PERCENT}% on deferred $${deferredSubtotal.toFixed(2)}). ` +
            `A manager can override.`,
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

    // Phone, if entered for any buyer type, must be exactly 10 digits.
    // Strip spaces/dashes before counting. Cashiers commonly drop a
    // digit when typing fast — server enforces too but we want to fail
    // fast on the client.
    if (customerPhone.trim()) {
      const phoneDigits = customerPhone.replace(/\D+/g, '');
      if (phoneDigits.length !== 10) {
        toast.error(
          `Phone must be exactly 10 digits — you entered ${phoneDigits.length}`,
        );
        return;
      }
    }

    // All validations passed — pause and ask the cashier to confirm
    // they've actually received payment before we hit the API. The
    // confirm dialog calls handlePayment(true) on Yes which skips this
    // gate.
    if (!skipConfirm && !demoMode) {
      setShowPayConfirm(true);
      return;
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
          // Last name is optional now; only send it if the cashier
          // typed a multi-word name. Phone is sent digits-only since
          // server validates exactly 10.
          const lastName = parts.join(' ') || null;
          const phoneDigits = customerPhone.trim().replace(/\D+/g, '');
          if (phoneDigits && phoneDigits.length !== 10) {
            throw new Error('Phone must be exactly 10 digits to create a layby customer');
          }
          const created = await customersApi.createCustomer({
            firstName,
            lastName,
            phone: phoneDigits || undefined,
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
          // Tell the server when the cashier explicitly marked this as a
          // trade order via the PaymentModal Trade button. Server uses
          // this OR'd with customer.isTrade to decide if trade auto-
          // discounts should apply.
          isTradeOrder: buyerType === 'retail',
          // Pickup is free, delivery adds a flat fee on top — server
          // re-applies it from a constant so the totals can't drift.
          deliveryType,
          items: cart.items.map((item) => {
            const isBack = !!backorderByProductId[item.productId];
            // If the top-level Lay By toggle is on with no per-line
            // overrides, every non-backorder line is treated as held.
            const isHeld =
              !!laybyHeldByProductId[item.productId] ||
              (LAYBY_ALL_FROM_TOGGLE && !isBack);
            // For partial backorders (e.g. order 4, take 2, backorder 2)
            // pass the split count. Server splits the line into two
            // order_items: one take-now, one backorder.
            const splitBackQty =
              isBack && backorderQtyByProductId[item.productId] != null
                ? Math.min(
                    item.quantity,
                    Math.max(0, backorderQtyByProductId[item.productId]),
                  )
                : undefined;
            // Same idea for partial Lay By holds (e.g. take 2 home, hold
            // 2 on the shelf).
            const splitHeldQty =
              isHeld && laybyHeldQtyByProductId[item.productId] != null
                ? Math.min(
                    item.quantity,
                    Math.max(0, laybyHeldQtyByProductId[item.productId]),
                  )
                : undefined;
            return {
              productId: item.productId,
              quantity: item.quantity,
              discountPercent: item.discountPercent,
              isBackorder: isBack,
              backorderQty: splitBackQty,
              isLaybyHeld: isHeld,
              laybyHeldQty: splitHeldQty,
              // Pass unitPrice so the server can honour manual overrides on
              // backorder lines (e.g. catalogue price is $0).
              unitPrice: item.unitPrice,
            };
          }),
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
      // Tag each invoice line so the invoice template can group them
      // into "Taking home today" vs "On Lay By" vs "On Backorder".
      const invoiceItems = cart.items.map((item) => {
        const isBack = !!backorderByProductId[item.productId];
        const isHeld =
          !!laybyHeldByProductId[item.productId] ||
          (LAYBY_ALL_FROM_TOGGLE && !isBack);
        return { ...item, isBackorder: isBack, isLaybyHeld: isHeld };
      });
      const invoice = {
        orderNumber,
        date: new Date().toISOString(),
        buyerType,
        customerName: walkIn ? 'Walk-in Customer' : (customerName.trim() || undefined),
        customerPhone: customerPhone.trim() || undefined,
        customerEmail: customerEmail.trim() || undefined,
        customerAddress: [customerStreet, customerCity, customerState, customerPostcode].filter(s => s.trim()).join(', ') || undefined,
        companyAbn: buyerType === 'retail' && companyAbn.trim() ? companyAbn.trim() : undefined,
        items: invoiceItems,
        subtotal: cart.subtotal,
        itemDiscounts: cart.itemDiscounts,
        cartDiscount: cart.cartDiscountAmount,
        taxAmount: cart.taxAmount,
        grandTotal: cart.grandTotal,
        paymentMethod: method,
        cashTendered: method === 'cash' ? cashAmount : undefined,
        change: method === 'cash' ? change : undefined,
        // Deposit / balance metadata — absent means the whole total was paid
        isLayby: isLayby || hasLaybyHeldLine,
        isBackorder: hasBackorderLine,
        isMixed: hasLaybyHeldLine && takeNowSubtotal > 0,
        amountPaid: amountPaidNow,
        balanceDue: balanceOwing,
        takeNowSubtotal,
        deferredSubtotal,
        salesPerson: user
          ? [user.firstName, user.lastName].filter(Boolean).join(' ')
          : undefined,
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
      {/* Existing-customer-found popup. Offers to pull saved details
          from a matched phone number so the cashier doesn't re-key. */}
      {phoneMatch && (
        <div
          className="modal-backdrop-small-top"
          onClick={() => {
            setPhoneMatchDismissed(customerPhone);
            setPhoneMatch(null);
          }}
        >
          <div
            className="modal-content-small max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Existing customer found</h3>
            <p className="text-sm text-gray-300 mb-1">
              <span className="font-medium">
                {[phoneMatch.firstName, phoneMatch.lastName]
                  .filter(Boolean)
                  .join(' ')}
              </span>{' '}
              — {phoneMatch.phone}
              {phoneMatch.isTrade && (
                <span className="ml-2 text-xs text-orange-400 font-semibold">
                  TRADE
                </span>
              )}
            </p>
            {phoneMatch.email && (
              <p className="text-xs text-gray-400">{phoneMatch.email}</p>
            )}
            {(phoneMatch.billingStreet || phoneMatch.billingCity) && (
              <p className="text-xs text-gray-400 mb-3">
                {[
                  phoneMatch.billingStreet,
                  phoneMatch.billingCity,
                  phoneMatch.billingState,
                  phoneMatch.billingPostcode,
                ]
                  .filter(Boolean)
                  .join(', ')}
              </p>
            )}
            <p className="text-sm text-gray-400 mb-4">
              Fill in their saved details automatically?
            </p>
            <div className="flex gap-3">
              <button
                className="btn-primary flex-1"
                onClick={() => applyMatchedCustomer(phoneMatch)}
              >
                Use saved details
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => {
                  setPhoneMatchDismissed(customerPhone);
                  setPhoneMatch(null);
                }}
              >
                No, new customer
              </button>
            </div>
          </div>
        </div>
      )}
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
            ${totalWithDelivery.toFixed(2)}
          </p>
          {deliveryFeeApplied > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              ${total.toFixed(2)} + ${deliveryFeeApplied.toFixed(2)} delivery
            </p>
          )}
          {isDepositOrder && (
            <p className="text-sm text-amber-300 mt-1">
              Taking deposit now: <span className="font-bold">${depositDue.toFixed(2)}</span>
              {' · '}
              Balance owing: <span className="font-bold">${Math.max(0, totalWithDelivery - depositDue).toFixed(2)}</span>
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
                  max={Math.min(storeCreditBalance, totalWithDelivery)}
                  step="0.01"
                  value={storeCreditAmount}
                  onChange={(e) =>
                    setStoreCreditAmount(
                      Math.max(
                        0,
                        Math.min(
                          Math.min(storeCreditBalance, totalWithDelivery),
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
                  onClick={() => setStoreCreditAmount(Math.min(storeCreditBalance, totalWithDelivery))}
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

        {/* Pickup vs Delivery — pickup is free, delivery adds a flat
            $60 to the order total. Mirrors a backend constant. */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-400 mb-2">
            Fulfilment
          </label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                deliveryType === 'pickup'
                  ? 'border-green-500 bg-green-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setDeliveryType('pickup')}
            >
              <span className="font-medium">Pick Up</span>
              <span className="text-xs text-gray-400">Free</span>
            </button>
            <button
              type="button"
              className={`p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-colors ${
                deliveryType === 'delivery'
                  ? 'border-cyan-500 bg-cyan-500/20'
                  : 'border-gray-600 hover:border-gray-500'
              }`}
              onClick={() => setDeliveryType('delivery')}
            >
              <span className="font-medium">Delivery</span>
              <span className="text-xs text-gray-400">+${DELIVERY_FEE}</span>
            </button>
          </div>
        </div>

        {/* Order Notes — placed above customer details so the cashier
            can jot a quick note before getting into invoice fields. */}
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
          {buyerType === 'retail' ? (
            <>
              {/* Trade buyers: Company name on its own row, then First /
                  Last name + Phone underneath. customerName is kept in
                  sync as "Company — First Last" so downstream invoice
                  / order code that reads customerName still works. */}
              <div>
                <label className="block text-xs text-gray-400 mb-1">Company Name</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="ABC Trading Pty Ltd"
                  value={tradeCompanyName}
                  onChange={(e) => {
                    const v = e.target.value;
                    setTradeCompanyName(v);
                    const contact = [tradeFirstName, tradeLastName]
                      .filter(Boolean)
                      .join(' ');
                    setCustomerName(
                      [v, contact].filter(Boolean).join(' — ').trim(),
                    );
                  }}
                />
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs text-gray-400 mb-1">First Name</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="First name"
                    value={tradeFirstName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTradeFirstName(v);
                      const contact = [v, tradeLastName].filter(Boolean).join(' ');
                      setCustomerName(
                        [tradeCompanyName, contact].filter(Boolean).join(' — ').trim(),
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">Last Name</label>
                  <input
                    type="text"
                    className="input text-sm"
                    placeholder="Last name"
                    value={tradeLastName}
                    onChange={(e) => {
                      const v = e.target.value;
                      setTradeLastName(v);
                      const contact = [tradeFirstName, v].filter(Boolean).join(' ');
                      setCustomerName(
                        [tradeCompanyName, contact].filter(Boolean).join(' — ').trim(),
                      );
                    }}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-400 mb-1">
                    Phone <span className="text-gray-500">(10 digits)</span>
                  </label>
                  <input
                    type="tel"
                    className="input text-sm"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="0434310130"
                    value={customerPhone}
                    onChange={(e) => handlePhoneChange(e.target.value)}
                  />
                </div>
              </div>
            </>
          ) : (
            // Phone first (so an existing customer can be recognised and
            // their details pulled in), then name.
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Phone * <span className="text-gray-500">(10 digits)</span>
                </label>
                <input
                  type="tel"
                  className="input text-sm"
                  inputMode="numeric"
                  maxLength={10}
                  placeholder="0434310130"
                  value={customerPhone}
                  onChange={(e) => handlePhoneChange(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1">Name *</label>
                <input
                  type="text"
                  className="input text-sm"
                  placeholder="Customer name"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                />
              </div>
            </div>
          )}
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

        {/* Lay By toggle. A DB customer record is required — if the cashier
            filled in ad-hoc customer details above, we auto-create one on
            submit, so allow the checkbox as long as we have a name + phone.
            (Trade buyers can lay by too — Avi reversed the earlier
            "trade is take-now only" rule.) */}
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
          {(hasBackorderLine || hasLaybyHeldLine) && !isLayby && (
            <p className="text-xs text-cyan-300 mt-2">
              Take-now items must be paid in full; a minimum {LAYBY_DEPOSIT_PERCENT}%
              deposit is required on the items left behind.
            </p>
          )}
          {isDepositOrder && (
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-400 mb-1">
                  Deposit (min ${minDepositForOrder.toFixed(2)}
                  {canOverrideDeposit ? ', manager can drop to $0' : ''})
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
                <p className="text-[11px] text-gray-500 mt-1">
                  Take-now ${takeNowSubtotal.toFixed(2)} + {LAYBY_DEPOSIT_PERCENT}% of
                  deferred ${deferredSubtotal.toFixed(2)} = ${minDepositForOrder.toFixed(2)}
                  {canOverrideDeposit && ' · manager can override'}
                </p>
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
          onClick={() => handlePayment()}
          disabled={
            isProcessing ||
            (isDepositOrder
              ? depositRemaining > 0 && method === 'cash' && cashAmount < depositRemaining
              : remainingDue > 0 && method === 'cash' && cashAmount < remainingDue)
          }
        >
          {isProcessing
            ? (demoMode ? 'Simulating...' : 'Processing...')
            : isLayby || hasLaybyHeldLine
              ? `Create Lay By — Take $${depositRemaining.toFixed(2)}${creditApplied > 0 ? ' + credit' : ''}`
              : hasBackorderLine
                ? `Create Backorder — Take $${depositRemaining.toFixed(2)}${creditApplied > 0 ? ' + credit' : ''}`
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
                  {/* Backorder + Hold-on-LayBy controls. Available to both
                      retail and trade — trade can also stage backorder /
                      lay-by lines (rule changed by Avi). */}
                  {true && (
                    <>
                      {/* Backorder toggle — tick for items not in stock that the
                          customer is happy to wait for. Stock isn't deducted and
                          the order is flagged for fulfilment when it arrives. */}
                      <label className="flex items-center gap-1.5 mt-2 text-xs text-gray-400 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!!backorderByProductId[item.productId]}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setBackorderByProductId((prev) => ({
                              ...prev,
                              [item.productId]: checked,
                            }));
                            // Default split to "all of this line is backorder"
                            // when toggled on; clear when toggled off.
                            setBackorderQtyByProductId((prev) => {
                              const next = { ...prev };
                              if (checked) next[item.productId] = item.quantity;
                              else delete next[item.productId];
                              return next;
                            });
                          }}
                          className="w-3.5 h-3.5"
                        />
                        <span>Backorder — ordering from supplier</span>
                      </label>
                      {/* Per-line backorder quantity split. Only relevant
                          when qty > 1 — otherwise the line is all-or-
                          nothing. Defaults to the full quantity. */}
                      {backorderByProductId[item.productId] &&
                        item.quantity > 1 && (
                          <div className="flex items-center gap-2 mt-1 ml-5 text-xs text-cyan-300">
                            <span>How many on backorder?</span>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              step={1}
                              className="input py-0.5 px-1.5 text-xs w-14"
                              value={
                                backorderQtyByProductId[item.productId] ??
                                item.quantity
                              }
                              onChange={(e) => {
                                const n = Math.min(
                                  item.quantity,
                                  Math.max(1, parseInt(e.target.value, 10) || 1),
                                );
                                setBackorderQtyByProductId((prev) => ({
                                  ...prev,
                                  [item.productId]: n,
                                }));
                              }}
                            />
                            <span>of {item.quantity}</span>
                            {(backorderQtyByProductId[item.productId] ??
                              item.quantity) <
                              item.quantity && (
                              <span className="text-gray-500">
                                · {item.quantity -
                                  (backorderQtyByProductId[item.productId] ??
                                    item.quantity)}{' '}
                                taking home today
                              </span>
                            )}
                          </div>
                        )}
                      {/* Hold on Lay By — tick for in-stock items the customer is
                          leaving behind until balance is paid. Mixed orders can
                          have some lines held and others handed over today. */}
                      {!backorderByProductId[item.productId] && (
                        <label className="flex items-center gap-1.5 mt-1 text-xs text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={
                              !!laybyHeldByProductId[item.productId] ||
                              LAYBY_ALL_FROM_TOGGLE
                            }
                            onChange={(e) => {
                              const checked = e.target.checked;
                              setLaybyHeldByProductId((prev) => ({
                                ...prev,
                                [item.productId]: checked,
                              }));
                              setLaybyHeldQtyByProductId((prev) => {
                                const next = { ...prev };
                                if (checked) next[item.productId] = item.quantity;
                                else delete next[item.productId];
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5"
                          />
                          <span>Hold on Lay By (customer leaves it here)</span>
                        </label>
                      )}
                      {/* Per-line lay-by quantity split. Same model as
                          backorder — defaults to full quantity, but the
                          cashier can keep some on the shelf and hand the
                          rest over today. */}
                      {!backorderByProductId[item.productId] &&
                        (laybyHeldByProductId[item.productId] ||
                          LAYBY_ALL_FROM_TOGGLE) &&
                        item.quantity > 1 && (
                          <div className="flex items-center gap-2 mt-1 ml-5 text-xs text-amber-300">
                            <span>How many on Lay By?</span>
                            <input
                              type="number"
                              min={1}
                              max={item.quantity}
                              step={1}
                              className="input py-0.5 px-1.5 text-xs w-14"
                              value={
                                laybyHeldQtyByProductId[item.productId] ??
                                item.quantity
                              }
                              onChange={(e) => {
                                const n = Math.min(
                                  item.quantity,
                                  Math.max(1, parseInt(e.target.value, 10) || 1),
                                );
                                setLaybyHeldQtyByProductId((prev) => ({
                                  ...prev,
                                  [item.productId]: n,
                                }));
                              }}
                            />
                            <span>of {item.quantity}</span>
                            {(laybyHeldQtyByProductId[item.productId] ??
                              item.quantity) <
                              item.quantity && (
                              <span className="text-gray-500">
                                · {item.quantity -
                                  (laybyHeldQtyByProductId[item.productId] ??
                                    item.quantity)}{' '}
                                taking home today
                              </span>
                            )}
                          </div>
                        )}
                    </>
                  )}
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

      {/* Payment confirmation popup. Stops accidental clicks on
          Complete Payment from closing out an order before the cashier
          has actually received money. */}
      {showPayConfirm && (
        <div
          className="modal-backdrop-small-top"
          onClick={() => setShowPayConfirm(false)}
        >
          <div
            className="modal-content-small max-w-sm text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">Has the customer paid?</h3>
            <p className="text-sm text-gray-400 mb-4">
              Confirm you've received{' '}
              <span className="font-bold text-primary-400">
                ${(isDepositOrder ? depositRemaining : remainingDue).toFixed(2)}
              </span>{' '}
              via{' '}
              <span className="font-semibold text-gray-200 uppercase">
                {method === 'eftpos'
                  ? 'EFTPOS'
                  : method === 'cash'
                    ? 'Cash'
                    : 'Bank Transfer'}
              </span>
              {creditApplied > 0 && (
                <>
                  {' '}+ <span className="text-purple-300 font-medium">${creditApplied.toFixed(2)} store credit</span>
                </>
              )}
              .
              {isDepositOrder && (
                <span className="block mt-2 text-amber-300 text-xs">
                  Deposit only — balance ${(total - depositDue).toFixed(2)} owing.
                </span>
              )}
            </p>
            <div className="flex gap-3">
              <button
                className="btn-secondary flex-1"
                onClick={() => setShowPayConfirm(false)}
              >
                No, go back
              </button>
              <button
                className="btn-success flex-1"
                onClick={() => {
                  setShowPayConfirm(false);
                  handlePayment(true);
                }}
                autoFocus
              >
                Yes, complete order
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
