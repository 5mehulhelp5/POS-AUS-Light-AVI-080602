# API Contracts

## Base URL
```
Production: https://pos.australianlightingandfans.com.au/api/v1
Development: http://localhost:4000/api/v1
```

## Authentication

All endpoints except `/auth/login` require JWT authentication.

### Headers
```
Authorization: Bearer <jwt_token>
Content-Type: application/json
```

---

## 1. Authentication Endpoints

### POST /auth/login
Login with email and password.

**Request:**
```json
{
  "email": "staff@store.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": 1,
      "email": "staff@store.com",
      "firstName": "John",
      "lastName": "Smith",
      "role": {
        "id": 1,
        "name": "sales_staff",
        "displayName": "Sales Staff",
        "maxDiscountPercent": 10.00,
        "canStackDiscounts": false
      }
    },
    "accessToken": "eyJhbGciOiJIUzI1NiIs...",
    "expiresIn": 28800
  }
}
```

### POST /auth/pin-login
Quick login with PIN code.

**Request:**
```json
{
  "pinCode": "1234"
}
```

### POST /auth/logout
Invalidate current session.

**Response (200):**
```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

### GET /auth/me
Get current user profile.

---

## 2. User Management Endpoints

### GET /users
List all users. (Admin only)

**Query Parameters:**
- `page` (default: 1)
- `limit` (default: 20)
- `role` (filter by role name)
- `active` (true/false)

**Response (200):**
```json
{
  "success": true,
  "data": {
    "users": [...],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 45,
      "totalPages": 3
    }
  }
}
```

### POST /users
Create new user. (Admin only)

**Request:**
```json
{
  "email": "newstaff@store.com",
  "password": "tempPassword123",
  "firstName": "Jane",
  "lastName": "Doe",
  "roleId": 1,
  "pinCode": "5678"
}
```

### GET /users/:id
Get user by ID.

### PUT /users/:id
Update user. (Admin only)

### DELETE /users/:id
Deactivate user. (Admin only)

---

## 3. Product Endpoints

### GET /products
Search and list products.

**Query Parameters:**
- `search` - Search in name, SKU, barcode
- `category` - Category ID filter
- `inStock` - Only show in-stock items (true/false)
- `page`, `limit` - Pagination
- `sort` - Field to sort by
- `order` - asc/desc

**Response (200):**
```json
{
  "success": true,
  "data": {
    "products": [
      {
        "id": 1,
        "magentoId": 1234,
        "sku": "LAMP-001",
        "name": "Modern Floor Lamp - Black",
        "price": 299.00,
        "specialPrice": null,
        "stockQty": 15,
        "isInStock": true,
        "imageUrl": "https://...",
        "thumbnailUrl": "https://...",
        "barcode": "9312345678901",
        "taxClassId": 2,
        "categories": [
          {"id": 1, "name": "Floor Lamps"}
        ]
      }
    ],
    "pagination": {...}
  }
}
```

### GET /products/:id
Get product details.

### GET /products/barcode/:barcode
Lookup product by barcode.

### GET /products/sku/:sku
Lookup product by SKU.

### POST /products/sync
Trigger manual product sync. (Admin/Manager)

---

## 4. Category Endpoints

### GET /categories
Get category tree.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "categories": [
      {
        "id": 1,
        "magentoId": 10,
        "name": "Lighting",
        "children": [
          {
            "id": 2,
            "magentoId": 11,
            "name": "Floor Lamps",
            "children": []
          }
        ]
      }
    ]
  }
}
```

---

## 5. Customer Endpoints

### GET /customers
Search customers.

**Query Parameters:**
- `search` - Search in name, email, phone
- `page`, `limit`

### POST /customers
Create new customer.

**Request:**
```json
{
  "firstName": "Michael",
  "lastName": "Johnson",
  "email": "michael@example.com",
  "phone": "0412345678",
  "mobile": "0412345678",
  "company": "Johnson Interiors",
  "taxNumber": "12345678901",
  "billingStreet": "123 Main St",
  "billingCity": "Sydney",
  "billingState": "NSW",
  "billingPostcode": "2000"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "customer": {
      "id": 1,
      "magentoId": null,
      "syncStatus": "pending",
      ...
    }
  }
}
```

### GET /customers/:id
Get customer details with order history.

### PUT /customers/:id
Update customer.

### GET /customers/:id/orders
Get customer's order history.

---

## 6. Cart/Order Endpoints

### POST /cart/calculate
Calculate cart totals with discounts.

**Request:**
```json
{
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "discountPercent": 10
    },
    {
      "productId": 5,
      "quantity": 1,
      "discountPercent": 0
    }
  ],
  "cartDiscount": {
    "type": "percent",
    "value": 5
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "productId": 1,
        "sku": "LAMP-001",
        "name": "Modern Floor Lamp - Black",
        "quantity": 2,
        "unitPrice": 299.00,
        "discountPercent": 10,
        "discountAmount": 59.80,
        "taxAmount": 49.11,
        "rowTotal": 538.20
      }
    ],
    "subtotal": 748.00,
    "itemDiscounts": 59.80,
    "cartDiscount": 34.41,
    "totalDiscount": 94.21,
    "taxAmount": 59.44,
    "grandTotal": 653.79,
    "discountValidation": {
      "isValid": true,
      "warnings": []
    }
  }
}
```

### POST /orders
Create new order.

**Request:**
```json
{
  "customerId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "discountPercent": 10
    }
  ],
  "cartDiscount": {
    "type": "percent",
    "value": 5,
    "reason": "Loyal customer"
  },
  "payments": [
    {
      "method": "eftpos",
      "amount": 400.00,
      "reference": "TXN123456"
    },
    {
      "method": "cash",
      "amount": 253.79,
      "amountTendered": 260.00
    }
  ],
  "notes": "Customer will pick up tomorrow"
}
```

**Response (201):**
```json
{
  "success": true,
  "data": {
    "order": {
      "id": 1,
      "orderNumber": "POS-2024-000001",
      "status": "complete",
      "paymentStatus": "paid",
      "grandTotal": 653.79,
      "syncStatus": "pending",
      "createdAt": "2024-01-15T10:30:00Z"
    },
    "receipt": {
      "url": "/receipts/POS-2024-000001.pdf"
    }
  }
}
```

### GET /orders
List orders.

**Query Parameters:**
- `status` - Filter by status
- `userId` - Filter by staff member
- `customerId` - Filter by customer
- `dateFrom`, `dateTo` - Date range
- `page`, `limit`

### GET /orders/:id
Get order details.

### POST /orders/:id/refund
Process refund. (Manager/Admin)

**Request:**
```json
{
  "items": [
    {
      "orderItemId": 1,
      "quantity": 1,
      "reason": "Defective product"
    }
  ],
  "refundMethod": "cash"
}
```

---

## 7. Discount Validation Endpoint

### POST /discounts/validate
Validate discount before applying.

**Request:**
```json
{
  "discounts": [
    {
      "type": "product",
      "productId": 1,
      "percent": 15
    },
    {
      "type": "cart",
      "percent": 5
    }
  ]
}
```

**Response (200) - Valid:**
```json
{
  "success": true,
  "data": {
    "isValid": true,
    "appliedDiscounts": [...],
    "totalDiscountPercent": 19.25
  }
}
```

**Response (200) - Invalid:**
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "errors": [
      {
        "code": "DISCOUNT_EXCEEDS_LIMIT",
        "message": "Discount of 15% exceeds your maximum of 10%",
        "maxAllowed": 10
      },
      {
        "code": "STACKING_NOT_ALLOWED",
        "message": "Your role does not allow stacking discounts"
      }
    ]
  }
}
```

---

## 8. Quote Endpoints

### POST /quotes
Create new quote.

**Request:**
```json
{
  "customerId": 1,
  "items": [
    {
      "productId": 1,
      "quantity": 2,
      "discountPercent": 10
    }
  ],
  "cartDiscount": {
    "type": "percent",
    "value": 5
  },
  "expiresInDays": 14,
  "holdStock": false,
  "notes": "Customer comparing prices"
}
```

### GET /quotes
List quotes.

**Query Parameters:**
- `status` - open, expired, converted, cancelled
- `customerId`
- `userId`
- `page`, `limit`

### GET /quotes/:id
Get quote details.

### PUT /quotes/:id
Update quote.

### POST /quotes/:id/convert
Convert quote to order.

**Request:**
```json
{
  "payments": [
    {
      "method": "eftpos",
      "amount": 653.79
    }
  ]
}
```

### POST /quotes/:id/send
Email quote to customer.

### GET /quotes/:id/pdf
Download quote as PDF.

---

## 9. Inquiry/CRM Endpoints

### POST /inquiries
Log new inquiry.

**Request:**
```json
{
  "type": "phone_call",
  "customerId": null,
  "contactName": "Sarah Williams",
  "contactPhone": "0498765432",
  "subject": "Ceiling fan installation query",
  "description": "Customer asking about installation services for ceiling fans",
  "followUpDate": "2024-01-20"
}
```

### GET /inquiries
List inquiries.

**Query Parameters:**
- `type` - walk_in, phone_call, email
- `status` - new, in_progress, resolved, converted
- `userId`
- `followUpDate`
- `page`, `limit`

### PUT /inquiries/:id
Update inquiry.

### POST /inquiries/:id/convert-to-quote
Convert inquiry to quote.

---

## 10. Reporting Endpoints

### GET /reports/sales
Sales report.

**Query Parameters:**
- `dateFrom`, `dateTo` (required)
- `groupBy` - day, week, month
- `userId` - Filter by staff

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalOrders": 156,
      "totalRevenue": 45678.90,
      "totalTax": 4152.63,
      "averageOrderValue": 292.81
    },
    "byPeriod": [
      {
        "date": "2024-01-15",
        "orders": 12,
        "revenue": 3456.78,
        "tax": 314.25
      }
    ],
    "byPaymentMethod": {
      "cash": 12345.67,
      "eftpos": 33333.23
    }
  }
}
```

### GET /reports/sales-by-user
Sales by staff member.

### GET /reports/discounts
Discount usage report.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalDiscountAmount": 2345.67,
      "discountCount": 89,
      "averageDiscountPercent": 8.5,
      "rejectedDiscounts": 3
    },
    "byUser": [
      {
        "userId": 1,
        "userName": "John Smith",
        "role": "sales_staff",
        "discountCount": 45,
        "totalAmount": 1234.56,
        "averagePercent": 7.2
      }
    ],
    "rejections": [
      {
        "userId": 2,
        "attemptedPercent": 25,
        "maxAllowed": 10,
        "timestamp": "2024-01-15T14:30:00Z"
      }
    ]
  }
}
```

### GET /reports/quotes
Quotes vs conversions report.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalQuotes": 45,
      "convertedQuotes": 28,
      "expiredQuotes": 12,
      "openQuotes": 5,
      "conversionRate": 62.22,
      "totalQuotedValue": 67890.12,
      "totalConvertedValue": 45678.90
    }
  }
}
```

### GET /reports/products/top-sellers
Top selling products.

---

## 11. Sync Endpoints

### GET /sync/status
Get sync status.

**Response (200):**
```json
{
  "success": true,
  "data": {
    "lastSync": {
      "products": "2024-01-15T08:00:00Z",
      "categories": "2024-01-15T08:00:00Z",
      "inventory": "2024-01-15T10:30:00Z"
    },
    "pendingSync": {
      "customers": 2,
      "orders": 1
    },
    "failedSync": {
      "customers": 0,
      "orders": 0
    }
  }
}
```

### POST /sync/products
Trigger product sync. (Admin/Manager)

### POST /sync/inventory
Trigger inventory sync. (Admin/Manager)

### GET /sync/logs
Get sync history.

### POST /sync/retry-failed
Retry failed sync items. (Admin)

---

## 12. Settings Endpoints

### GET /settings
Get all settings. (Admin)

### PUT /settings
Update settings. (Admin)

**Request:**
```json
{
  "settings": [
    {"key": "store_phone", "value": "02 1234 5678"},
    {"key": "receipt_footer", "value": "Thank you!"}
  ]
}
```

---

## Error Response Format

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      {
        "field": "email",
        "message": "Email is required"
      }
    ]
  }
}
```

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| UNAUTHORIZED | 401 | Missing or invalid token |
| FORBIDDEN | 403 | Insufficient permissions |
| NOT_FOUND | 404 | Resource not found |
| VALIDATION_ERROR | 400 | Invalid input data |
| DISCOUNT_EXCEEDS_LIMIT | 400 | Discount above role limit |
| STACKING_NOT_ALLOWED | 400 | Role cannot stack discounts |
| INSUFFICIENT_STOCK | 400 | Not enough inventory |
| SYNC_FAILED | 500 | Magento sync error |
| INTERNAL_ERROR | 500 | Server error |

---

## Rate Limiting

- Standard endpoints: 100 requests/minute
- Sync endpoints: 10 requests/minute
- Login endpoint: 5 requests/minute per IP

---

## Webhooks (Future)

For Magento to notify POS of changes:

```
POST /webhooks/magento
X-Magento-Signature: sha256=...

{
  "event": "product.updated",
  "data": {...}
}
```
