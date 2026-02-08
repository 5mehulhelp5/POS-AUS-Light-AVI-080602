# Discount Engine Logic

## Overview

The discount engine is a critical component that enforces role-based discount rules server-side. All discount validation happens on the backend - the frontend only displays options based on the user's role.

## Role-Based Rules Summary

| Role | Max Discount | Stacking Allowed |
|------|-------------|------------------|
| Sales Staff | 10% | NO |
| Manager | 20% | YES |
| Admin | Unlimited (100%) | YES |

## Discount Types

1. **Product-Level Discount**: Applied to individual line items
2. **Cart-Level Discount**: Applied to the entire cart subtotal
3. **Stacked Discount**: Multiple discounts applied together (product + cart)

## Discount Engine Pseudo-Code

```typescript
// =============================================================================
// DISCOUNT ENGINE - Core Logic
// =============================================================================

interface DiscountRequest {
  userId: number;
  items: CartItem[];
  cartDiscount?: {
    type: 'percent' | 'fixed';
    value: number;
    reason?: string;
  };
}

interface CartItem {
  productId: number;
  quantity: number;
  unitPrice: number;
  discountPercent?: number;
}

interface DiscountResult {
  isValid: boolean;
  errors: DiscountError[];
  warnings: string[];
  calculatedTotals: CartTotals;
  auditEntries: AuditEntry[];
}

interface UserRole {
  name: string;
  maxDiscountPercent: number;
  canStackDiscounts: boolean;
}

// =============================================================================
// MAIN VALIDATION FUNCTION
// =============================================================================

function validateAndCalculateDiscounts(
  request: DiscountRequest,
  userRole: UserRole
): DiscountResult {

  const errors: DiscountError[] = [];
  const warnings: string[] = [];
  const auditEntries: AuditEntry[] = [];

  // Step 1: Validate individual product discounts
  for (const item of request.items) {
    if (item.discountPercent && item.discountPercent > 0) {
      const validation = validateProductDiscount(
        item.discountPercent,
        userRole
      );

      if (!validation.isValid) {
        errors.push({
          code: 'DISCOUNT_EXCEEDS_LIMIT',
          message: `Product discount of ${item.discountPercent}% exceeds your maximum of ${userRole.maxDiscountPercent}%`,
          field: `items[${item.productId}].discountPercent`,
          attemptedValue: item.discountPercent,
          maxAllowed: userRole.maxDiscountPercent
        });

        // Log the rejected attempt
        auditEntries.push({
          type: 'product',
          wasRejected: true,
          attemptedPercent: item.discountPercent,
          rejectionReason: 'EXCEEDS_ROLE_LIMIT'
        });
      }
    }
  }

  // Step 2: Validate cart-level discount
  if (request.cartDiscount && request.cartDiscount.value > 0) {
    if (request.cartDiscount.type === 'percent') {
      const validation = validateCartDiscount(
        request.cartDiscount.value,
        userRole
      );

      if (!validation.isValid) {
        errors.push({
          code: 'DISCOUNT_EXCEEDS_LIMIT',
          message: `Cart discount of ${request.cartDiscount.value}% exceeds your maximum of ${userRole.maxDiscountPercent}%`,
          field: 'cartDiscount.value',
          attemptedValue: request.cartDiscount.value,
          maxAllowed: userRole.maxDiscountPercent
        });

        auditEntries.push({
          type: 'cart',
          wasRejected: true,
          attemptedPercent: request.cartDiscount.value,
          rejectionReason: 'EXCEEDS_ROLE_LIMIT'
        });
      }
    }
  }

  // Step 3: Check stacking rules
  const hasProductDiscounts = request.items.some(
    item => item.discountPercent && item.discountPercent > 0
  );
  const hasCartDiscount = request.cartDiscount && request.cartDiscount.value > 0;

  if (hasProductDiscounts && hasCartDiscount) {
    if (!userRole.canStackDiscounts) {
      errors.push({
        code: 'STACKING_NOT_ALLOWED',
        message: 'Your role does not allow combining product and cart discounts',
        field: 'cartDiscount'
      });

      auditEntries.push({
        type: 'cart',
        wasRejected: true,
        attemptedPercent: request.cartDiscount.value,
        rejectionReason: 'STACKING_NOT_ALLOWED'
      });
    }
  }

  // Step 4: Calculate totals (even if invalid, for preview)
  const calculatedTotals = calculateCartTotals(
    request.items,
    request.cartDiscount,
    errors.length > 0 // If errors, calculate without discounts
  );

  // Step 5: Add warnings for high discounts
  const totalDiscountPercent = calculateEffectiveDiscountPercent(
    request.items,
    request.cartDiscount
  );

  if (totalDiscountPercent > 15 && errors.length === 0) {
    warnings.push(
      `High discount alert: Effective discount is ${totalDiscountPercent.toFixed(1)}%`
    );
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    calculatedTotals,
    auditEntries
  };
}

// =============================================================================
// VALIDATION HELPERS
// =============================================================================

function validateProductDiscount(
  discountPercent: number,
  userRole: UserRole
): { isValid: boolean } {

  // Rule 1: Cannot be negative
  if (discountPercent < 0) {
    return { isValid: false };
  }

  // Rule 2: Cannot exceed 100%
  if (discountPercent > 100) {
    return { isValid: false };
  }

  // Rule 3: Must be within role's limit
  if (discountPercent > userRole.maxDiscountPercent) {
    return { isValid: false };
  }

  return { isValid: true };
}

function validateCartDiscount(
  discountPercent: number,
  userRole: UserRole
): { isValid: boolean } {
  // Same rules as product discount
  return validateProductDiscount(discountPercent, userRole);
}

// =============================================================================
// CALCULATION HELPERS
// =============================================================================

function calculateCartTotals(
  items: CartItem[],
  cartDiscount: CartDiscount | undefined,
  ignoreDiscounts: boolean = false
): CartTotals {

  const TAX_RATE = 0.10; // 10% GST

  let subtotal = 0;
  let itemDiscountTotal = 0;
  const calculatedItems: CalculatedItem[] = [];

  for (const item of items) {
    const lineSubtotal = item.unitPrice * item.quantity;
    subtotal += lineSubtotal;

    let discountAmount = 0;
    if (!ignoreDiscounts && item.discountPercent) {
      discountAmount = lineSubtotal * (item.discountPercent / 100);
      itemDiscountTotal += discountAmount;
    }

    const lineTotal = lineSubtotal - discountAmount;
    const lineTax = lineTotal * TAX_RATE;

    calculatedItems.push({
      productId: item.productId,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      discountPercent: ignoreDiscounts ? 0 : (item.discountPercent || 0),
      discountAmount: round(discountAmount),
      taxAmount: round(lineTax),
      rowTotal: round(lineTotal + lineTax)
    });
  }

  // Apply cart discount to subtotal after item discounts
  const afterItemDiscounts = subtotal - itemDiscountTotal;
  let cartDiscountAmount = 0;

  if (!ignoreDiscounts && cartDiscount && cartDiscount.value > 0) {
    if (cartDiscount.type === 'percent') {
      cartDiscountAmount = afterItemDiscounts * (cartDiscount.value / 100);
    } else {
      // Fixed amount discount
      cartDiscountAmount = Math.min(cartDiscount.value, afterItemDiscounts);
    }
  }

  const totalAfterDiscounts = afterItemDiscounts - cartDiscountAmount;
  const taxAmount = totalAfterDiscounts * TAX_RATE;
  const grandTotal = totalAfterDiscounts + taxAmount;

  return {
    items: calculatedItems,
    subtotal: round(subtotal),
    itemDiscounts: round(itemDiscountTotal),
    cartDiscount: round(cartDiscountAmount),
    totalDiscount: round(itemDiscountTotal + cartDiscountAmount),
    taxAmount: round(taxAmount),
    grandTotal: round(grandTotal)
  };
}

function calculateEffectiveDiscountPercent(
  items: CartItem[],
  cartDiscount: CartDiscount | undefined
): number {

  const subtotal = items.reduce(
    (sum, item) => sum + (item.unitPrice * item.quantity),
    0
  );

  if (subtotal === 0) return 0;

  const totals = calculateCartTotals(items, cartDiscount, false);
  const discountPercent = (totals.totalDiscount / subtotal) * 100;

  return discountPercent;
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

// =============================================================================
// AUDIT LOGGING
// =============================================================================

async function logDiscountAudit(
  orderId: number | null,
  userId: number,
  userRole: string,
  auditEntries: AuditEntry[],
  request: DiscountRequest
): Promise<void> {

  for (const entry of auditEntries) {
    await db.discountAuditLog.create({
      orderId,
      userId,
      userRole,
      discountType: entry.type,
      discountPercent: entry.attemptedPercent,
      wasRejected: entry.wasRejected,
      rejectionReason: entry.rejectionReason,
      reason: request.cartDiscount?.reason || null,
      createdAt: new Date()
    });
  }
}

// =============================================================================
// MANAGER APPROVAL FLOW (Optional Enhancement)
// =============================================================================

async function requestManagerApproval(
  userId: number,
  requestedDiscount: number,
  orderId: number
): Promise<{ approved: boolean; approvedBy?: number }> {

  // Create approval request
  const request = await db.discountApprovalRequests.create({
    requestedBy: userId,
    orderId,
    requestedDiscount,
    status: 'pending',
    createdAt: new Date()
  });

  // In a real system, this would:
  // 1. Notify manager via WebSocket/push notification
  // 2. Wait for manager to approve/reject
  // 3. Return result

  // For now, return pending
  return { approved: false };
}
```

## Stacking Rules Explained

### Sales Staff (No Stacking)
```
Cart with $100 lamp:
✓ Apply 10% product discount = $90 (allowed)
✗ Then apply 5% cart discount = NOT ALLOWED

Must choose ONE discount type only.
```

### Manager (Stacking Allowed)
```
Cart with $100 lamp:
✓ Apply 15% product discount = $85 (allowed, under 20%)
✓ Then apply 5% cart discount = $80.75 (allowed, stacking permitted)

Effective discount: 19.25%
```

### Stacking Calculation Order
1. Product-level discounts applied first
2. Cart-level discount applied to subtotal AFTER product discounts
3. Tax calculated on final discounted amount

## Discount Limits Enforcement Flow

```
┌──────────────────────────────────────────────────────────────┐
│                    Frontend Request                          │
│  User attempts to apply discount                             │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│                    Backend Receives                          │
│  POST /cart/calculate or POST /orders                        │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Load User & Role from JWT                       │
│  Get maxDiscountPercent and canStackDiscounts                │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Validate Each Product Discount                  │
│  Check: discountPercent <= role.maxDiscountPercent          │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Validate Cart Discount                          │
│  Check: cartDiscount.value <= role.maxDiscountPercent       │
└────────────────────────────┬─────────────────────────────────┘
                             │
                             ▼
┌──────────────────────────────────────────────────────────────┐
│              Check Stacking Rules                            │
│  If hasProductDiscount AND hasCartDiscount:                  │
│    Check: role.canStackDiscounts === true                    │
└────────────────────────────┬─────────────────────────────────┘
                             │
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
     ┌────────────────┐            ┌────────────────┐
     │   VALID        │            │   INVALID      │
     │   Calculate    │            │   Return 400   │
     │   totals,      │            │   with errors  │
     │   proceed      │            │   Log attempt  │
     └────────────────┘            └────────────────┘
```

## Frontend Hints

The frontend should:

1. **Hide options user can't use**: Don't show "Stack Discounts" checkbox to Sales Staff
2. **Limit input ranges**: Set max value on discount inputs based on role
3. **Show warnings**: Display "Near maximum discount" when approaching limit
4. **Validate locally first**: Prevent obviously invalid requests

However, **all rules are enforced server-side** - frontend validation is purely for UX.

## Database Audit Trail

Every discount action creates an audit record:

```sql
INSERT INTO discount_audit_log (
  order_id,
  order_item_id,
  user_id,
  user_role,
  discount_type,
  discount_percent,
  discount_amount,
  original_amount,
  final_amount,
  is_stacked,
  reason,
  was_rejected,
  rejection_reason,
  created_at
) VALUES (
  123,
  456,
  1,
  'sales_staff',
  'product',
  10.00,
  29.90,
  299.00,
  269.10,
  FALSE,
  'Loyal customer',
  FALSE,
  NULL,
  NOW()
);
```

## Edge Cases Handled

1. **Zero quantity items**: Skip discount calculation
2. **Negative discounts**: Reject with error
3. **Discounts > 100%**: Reject with error
4. **Fixed amount > subtotal**: Cap at subtotal
5. **Multiple same products**: Apply discount to each line item
6. **Quote conversion**: Re-validate discounts at conversion time
7. **Price changes**: Use current price, not quoted price (configurable)
