import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface CartItem {
  productId: number;
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  discountPercent: number;
  discountAmount: number;
  taxAmount: number;
  rowTotal: number;
  imageUrl?: string;
  isSaleItem?: boolean;
  // Item was out of stock when it was added to cart. PaymentModal uses
  // this to default the "Backorder" checkbox to on, and — combined with
  // the manual toggle — this is what gets submitted as `isBackorder` on
  // the order item.
  isBackorder?: boolean;
}

export interface CartDiscount {
  type: 'percent' | 'fixed';
  value: number;
  reason?: string;
}

interface CartState {
  items: CartItem[];
  customerId: number | null;
  customerName: string | null;
  cartDiscount: CartDiscount | null;
  subtotal: number;
  itemDiscounts: number;
  cartDiscountAmount: number;
  taxAmount: number;
  grandTotal: number;
  notes: string;
}

const initialState: CartState = {
  items: [],
  customerId: null,
  customerName: null,
  cartDiscount: null,
  subtotal: 0,
  itemDiscounts: 0,
  cartDiscountAmount: 0,
  taxAmount: 0,
  grandTotal: 0,
  notes: '',
};

// Australian prices are GST-inclusive. GST = price / 11 (i.e. 1/11th of the inclusive price).
const GST_DIVISOR = 11;

function recalculateTotals(state: CartState): void {
  // Calculate item totals (all prices are GST-inclusive)
  let subtotal = 0;
  let itemDiscounts = 0;

  state.items.forEach((item) => {
    const lineSubtotal = item.unitPrice * item.quantity;
    const discount = lineSubtotal * (item.discountPercent / 100);
    const afterDiscount = lineSubtotal - discount;
    // GST is included in the price, extract it: GST = inclusive / 11
    const tax = afterDiscount / GST_DIVISOR;

    item.discountAmount = Math.round(discount * 100) / 100;
    item.taxAmount = Math.round(tax * 100) / 100;
    // rowTotal = afterDiscount (price already includes GST)
    item.rowTotal = Math.round(afterDiscount * 100) / 100;

    subtotal += lineSubtotal;
    itemDiscounts += discount;
  });

  state.subtotal = Math.round(subtotal * 100) / 100;
  state.itemDiscounts = Math.round(itemDiscounts * 100) / 100;

  // Calculate cart discount
  const afterItemDiscounts = subtotal - itemDiscounts;
  let cartDiscountAmount = 0;

  if (state.cartDiscount && state.cartDiscount.value > 0) {
    if (state.cartDiscount.type === 'percent') {
      cartDiscountAmount = afterItemDiscounts * (state.cartDiscount.value / 100);
    } else {
      cartDiscountAmount = Math.min(state.cartDiscount.value, afterItemDiscounts);
    }
  }

  state.cartDiscountAmount = Math.round(cartDiscountAmount * 100) / 100;

  // Grand total = after all discounts (GST already included in prices)
  const afterAllDiscounts = afterItemDiscounts - cartDiscountAmount;
  // Extract GST component for display
  state.taxAmount = Math.round(afterAllDiscounts / GST_DIVISOR * 100) / 100;
  state.grandTotal = Math.round(afterAllDiscounts * 100) / 100;
}

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addItem: (
      state,
      action: PayloadAction<{
        productId: number;
        sku: string;
        name: string;
        price: number;
        imageUrl?: string;
        isSaleItem?: boolean;
        isBackorder?: boolean;
      }>
    ) => {
      const { productId, sku, name, price, imageUrl, isSaleItem, isBackorder } =
        action.payload;

      const existingItem = state.items.find((i) => i.productId === productId);

      if (existingItem) {
        existingItem.quantity += 1;
        // If we're adding a backorder copy of an item, upgrade the flag so
        // the cashier sees it tagged even if the first add was in-stock.
        if (isBackorder) existingItem.isBackorder = true;
      } else {
        state.items.push({
          productId,
          sku,
          name,
          quantity: 1,
          unitPrice: price,
          discountPercent: 0,
          discountAmount: 0,
          taxAmount: 0,
          rowTotal: 0,
          imageUrl,
          isSaleItem,
          isBackorder,
        });
      }

      recalculateTotals(state);
    },

    removeItem: (state, action: PayloadAction<number>) => {
      state.items = state.items.filter((i) => i.productId !== action.payload);
      recalculateTotals(state);
    },

    updateQuantity: (
      state,
      action: PayloadAction<{ productId: number; quantity: number }>
    ) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find((i) => i.productId === productId);

      if (item) {
        if (quantity <= 0) {
          state.items = state.items.filter((i) => i.productId !== productId);
        } else {
          item.quantity = quantity;
        }
      }

      recalculateTotals(state);
    },

    setItemDiscount: (
      state,
      action: PayloadAction<{ productId: number; discountPercent: number }>
    ) => {
      const { productId, discountPercent } = action.payload;
      const item = state.items.find((i) => i.productId === productId);

      if (item) {
        item.discountPercent = Math.max(0, Math.min(100, discountPercent));
      }

      recalculateTotals(state);
    },

    // Allow the cashier to override the unit price on a cart line —
    // needed for backorder/quote-style items where the catalogue price
    // is $0 or out of date. Backend only honours overrides for items
    // flagged isBackorder.
    setItemUnitPrice: (
      state,
      action: PayloadAction<{ productId: number; unitPrice: number }>,
    ) => {
      const { productId, unitPrice } = action.payload;
      const item = state.items.find((i) => i.productId === productId);
      if (item) {
        item.unitPrice = Math.max(0, unitPrice);
      }
      recalculateTotals(state);
    },

    setCartDiscount: (state, action: PayloadAction<CartDiscount | null>) => {
      state.cartDiscount = action.payload;
      recalculateTotals(state);
    },

    setCustomer: (
      state,
      action: PayloadAction<{ id: number; name: string } | null>
    ) => {
      if (action.payload) {
        state.customerId = action.payload.id;
        state.customerName = action.payload.name;
      } else {
        state.customerId = null;
        state.customerName = null;
      }
    },

    setNotes: (state, action: PayloadAction<string>) => {
      state.notes = action.payload;
    },

    clearCart: (state) => {
      state.items = [];
      state.customerId = null;
      state.customerName = null;
      state.cartDiscount = null;
      state.subtotal = 0;
      state.itemDiscounts = 0;
      state.cartDiscountAmount = 0;
      state.taxAmount = 0;
      state.grandTotal = 0;
      state.notes = '';
    },

    applyCalculatedTotals: (
      state,
      action: PayloadAction<{
        items: CartItem[];
        subtotal: number;
        itemDiscounts: number;
        cartDiscount: number;
        taxAmount: number;
        grandTotal: number;
      }>
    ) => {
      // Apply server-calculated totals
      const { items, subtotal, itemDiscounts, cartDiscount, taxAmount, grandTotal } =
        action.payload;

      state.items = items;
      state.subtotal = subtotal;
      state.itemDiscounts = itemDiscounts;
      state.cartDiscountAmount = cartDiscount;
      state.taxAmount = taxAmount;
      state.grandTotal = grandTotal;
    },
  },
});

export const {
  addItem,
  removeItem,
  updateQuantity,
  setItemDiscount,
  setItemUnitPrice,
  setCartDiscount,
  setCustomer,
  setNotes,
  clearCart,
  applyCalculatedTotals,
} = cartSlice.actions;

export default cartSlice.reducer;
