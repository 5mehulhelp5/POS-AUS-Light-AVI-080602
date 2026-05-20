// Build the InvoiceModal's `invoice` payload from a fetched order
// (ordersApi.getOrder(...).data.data.order). Shared by the POS "Last
// Invoice" button and the Customers page re-print so the mapping lives
// in one place.
export function buildInvoiceData(o: any, fallbackCustomer?: any) {
  const cust = o.customer || fallbackCustomer || null;
  const addr = cust
    ? [
        cust.billingStreet,
        cust.billingCity,
        cust.billingState,
        cust.billingPostcode,
      ]
        .filter(Boolean)
        .join(', ')
    : '';
  const items = (o.items || []).map((it: any) => ({
    productId: it.productId ?? 0,
    sku: it.sku || '',
    name: it.name || it.productName || '',
    quantity: it.quantity,
    unitPrice: parseFloat(it.unitPrice),
    discountPercent: parseFloat(it.discountPercent || 0),
    discountAmount: parseFloat(it.discountAmount || 0),
    taxAmount: parseFloat(it.taxAmount || 0),
    rowTotal: parseFloat(it.rowTotal ?? it.unitPrice * it.quantity),
    isBackorder: !!it.isBackorder,
    isLaybyHeld: !!it.isLaybyHeld,
  }));
  const firstPayment = (o.payments || [])[0];
  return {
    orderNumber: o.orderNumber,
    date: o.createdAt,
    buyerType: cust?.isTrade ? 'retail' : 'customer',
    customerName: cust
      ? [cust.firstName, cust.lastName].filter(Boolean).join(' ')
      : undefined,
    customerEmail: cust?.email || undefined,
    customerPhone: cust?.phone || cust?.mobile || undefined,
    customerAddress: addr || undefined,
    items,
    subtotal: parseFloat(o.subtotal),
    itemDiscounts: parseFloat(o.discountAmount || 0),
    cartDiscount: 0,
    taxAmount: parseFloat(o.taxAmount || 0),
    grandTotal: parseFloat(o.grandTotal),
    paymentMethod: firstPayment?.method || 'eftpos',
  };
}
