# Magento Sync Strategy

## Overview

The POS system maintains a local MySQL cache of Magento data for fast in-store operations. This document describes the sync strategy between Magento (source of truth) and the POS database (local cache).

## Sync Directions

```
┌─────────────────────────────────────────────────────────────┐
│                    MAGENTO → POS                            │
│                    (Pull Sync)                              │
├─────────────────────────────────────────────────────────────┤
│  • Products (name, price, description, images)              │
│  • Categories                                               │
│  • Inventory levels                                         │
│  • Tax classes                                              │
│  • Product attributes                                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    POS → MAGENTO                            │
│                    (Push Sync)                              │
├─────────────────────────────────────────────────────────────┤
│  • New customers                                            │
│  • Orders (including line items, discounts)                 │
│  • Inventory adjustments (after sale)                       │
└─────────────────────────────────────────────────────────────┘
```

## Magento API Authentication

### Integration Token (Recommended for POS)

```typescript
// config/magento.config.ts
export const magentoConfig = {
  baseUrl: process.env.MAGENTO_BASE_URL, // https://store.example.com
  apiVersion: 'V1',
  accessToken: process.env.MAGENTO_ACCESS_TOKEN, // Integration token
  timeout: 30000,
  retryAttempts: 3,
  retryDelay: 1000
};

// API client setup
const magentoClient = axios.create({
  baseURL: `${magentoConfig.baseUrl}/rest/${magentoConfig.apiVersion}`,
  headers: {
    'Authorization': `Bearer ${magentoConfig.accessToken}`,
    'Content-Type': 'application/json'
  },
  timeout: magentoConfig.timeout
});
```

## Sync Schedules

| Sync Type | Frequency | Trigger |
|-----------|-----------|---------|
| Full Product Sync | Daily 2:00 AM | Cron job |
| Incremental Product Sync | Every 15 minutes | Cron job |
| Inventory Sync | Every 5 minutes | Cron job |
| Category Sync | Daily 2:00 AM | Cron job |
| Customer Push | Real-time | After creation |
| Order Push | Real-time | After completion |

## Product Sync (Magento → POS)

### Full Sync Strategy

```typescript
// sync/product-sync.service.ts

async function fullProductSync(): Promise<SyncResult> {
  const syncLog = await startSyncLog('products', 'magento_to_pos');

  try {
    let page = 1;
    const pageSize = 100;
    let hasMore = true;
    let processed = 0;
    let created = 0;
    let updated = 0;

    while (hasMore) {
      // Fetch products from Magento with pagination
      const response = await magentoClient.get('/products', {
        params: {
          'searchCriteria[pageSize]': pageSize,
          'searchCriteria[currentPage]': page,
          'searchCriteria[filterGroups][0][filters][0][field]': 'status',
          'searchCriteria[filterGroups][0][filters][0][value]': 1, // Enabled only
          'searchCriteria[filterGroups][0][filters][0][conditionType]': 'eq'
        }
      });

      const products = response.data.items;
      const totalCount = response.data.total_count;

      for (const magentoProduct of products) {
        await upsertProduct(magentoProduct);
        processed++;
      }

      hasMore = page * pageSize < totalCount;
      page++;
    }

    await completeSyncLog(syncLog.id, { processed, created, updated });
    return { success: true, processed, created, updated };

  } catch (error) {
    await failSyncLog(syncLog.id, error.message);
    throw error;
  }
}

async function upsertProduct(magentoProduct: MagentoProduct): Promise<void> {
  const existing = await productRepository.findOne({
    where: { magentoId: magentoProduct.id }
  });

  const productData = transformMagentoProduct(magentoProduct);

  if (existing) {
    await productRepository.update(existing.id, {
      ...productData,
      syncedAt: new Date()
    });
  } else {
    await productRepository.insert({
      ...productData,
      magentoId: magentoProduct.id,
      syncedAt: new Date()
    });
  }
}

function transformMagentoProduct(mp: MagentoProduct): ProductData {
  // Find custom attributes by code
  const getAttr = (code: string) =>
    mp.custom_attributes?.find(a => a.attribute_code === code)?.value;

  return {
    sku: mp.sku,
    name: mp.name,
    description: getAttr('description') || null,
    shortDescription: getAttr('short_description') || null,
    price: parseFloat(mp.price),
    specialPrice: getAttr('special_price') ? parseFloat(getAttr('special_price')) : null,
    specialPriceFrom: getAttr('special_from_date') || null,
    specialPriceTo: getAttr('special_to_date') || null,
    weight: mp.weight ? parseFloat(mp.weight) : null,
    taxClassId: mp.tax_class_id,
    imageUrl: getAttr('image') ? buildMediaUrl(getAttr('image')) : null,
    thumbnailUrl: getAttr('thumbnail') ? buildMediaUrl(getAttr('thumbnail')) : null,
    barcode: getAttr('barcode') || getAttr('upc') || null,
    productType: mp.type_id,
    isActive: mp.status === 1
  };
}
```

### Incremental Sync (Changed Products Only)

```typescript
async function incrementalProductSync(): Promise<SyncResult> {
  const lastSync = await getLastSyncTime('products');
  const syncLog = await startSyncLog('products', 'magento_to_pos');

  try {
    // Fetch only products updated since last sync
    const response = await magentoClient.get('/products', {
      params: {
        'searchCriteria[filterGroups][0][filters][0][field]': 'updated_at',
        'searchCriteria[filterGroups][0][filters][0][value]': lastSync.toISOString(),
        'searchCriteria[filterGroups][0][filters][0][conditionType]': 'gt'
      }
    });

    for (const product of response.data.items) {
      await upsertProduct(product);
    }

    await completeSyncLog(syncLog.id, {
      processed: response.data.items.length
    });

  } catch (error) {
    await failSyncLog(syncLog.id, error.message);
    throw error;
  }
}
```

## Inventory Sync (Magento → POS)

### Stock Status Sync

```typescript
async function syncInventory(): Promise<SyncResult> {
  const syncLog = await startSyncLog('inventory', 'magento_to_pos');

  try {
    // Get all SKUs from POS database
    const localProducts = await productRepository.find({
      select: ['id', 'sku', 'magentoId']
    });

    // Batch SKUs for efficiency (100 at a time)
    const batches = chunk(localProducts, 100);

    for (const batch of batches) {
      const skus = batch.map(p => p.sku);

      // Use Magento inventory API
      const response = await magentoClient.get('/inventory/source-items', {
        params: {
          'searchCriteria[filterGroups][0][filters][0][field]': 'sku',
          'searchCriteria[filterGroups][0][filters][0][value]': skus.join(','),
          'searchCriteria[filterGroups][0][filters][0][conditionType]': 'in'
        }
      });

      for (const stockItem of response.data.items) {
        const product = batch.find(p => p.sku === stockItem.sku);
        if (product) {
          await productRepository.update(product.id, {
            stockQty: stockItem.quantity,
            isInStock: stockItem.status === 1,
            syncedAt: new Date()
          });
        }
      }
    }

    await completeSyncLog(syncLog.id, { processed: localProducts.length });

  } catch (error) {
    await failSyncLog(syncLog.id, error.message);
    throw error;
  }
}
```

## Customer Sync (POS → Magento)

### Create Customer in Magento

```typescript
async function syncCustomerToMagento(customerId: number): Promise<void> {
  const customer = await customerRepository.findOne(customerId);

  if (!customer || customer.magentoId) {
    return; // Already synced or doesn't exist
  }

  try {
    // Create customer in Magento
    const response = await magentoClient.post('/customers', {
      customer: {
        email: customer.email,
        firstname: customer.firstName,
        lastname: customer.lastName,
        store_id: 1, // Default store
        website_id: 1,
        addresses: buildMagentoAddresses(customer),
        custom_attributes: [
          { attribute_code: 'telephone', value: customer.phone || customer.mobile }
        ]
      }
    });

    // Store Magento ID back in POS
    await customerRepository.update(customerId, {
      magentoId: response.data.id,
      syncStatus: 'synced',
      syncedAt: new Date()
    });

  } catch (error) {
    // Queue for retry
    await addToSyncQueue('customer', customerId, 'create', error.message);

    await customerRepository.update(customerId, {
      syncStatus: 'failed'
    });
  }
}

function buildMagentoAddresses(customer: Customer): MagentoAddress[] {
  const addresses: MagentoAddress[] = [];

  if (customer.billingStreet) {
    addresses.push({
      firstname: customer.firstName,
      lastname: customer.lastName,
      street: [customer.billingStreet],
      city: customer.billingCity,
      region: { region: customer.billingState },
      postcode: customer.billingPostcode,
      country_id: customer.billingCountry || 'AU',
      telephone: customer.phone || customer.mobile || '0000000000',
      default_billing: true,
      default_shipping: !customer.shippingStreet
    });
  }

  if (customer.shippingStreet) {
    addresses.push({
      firstname: customer.firstName,
      lastname: customer.lastName,
      street: [customer.shippingStreet],
      city: customer.shippingCity,
      region: { region: customer.shippingState },
      postcode: customer.shippingPostcode,
      country_id: customer.shippingCountry || 'AU',
      telephone: customer.phone || customer.mobile || '0000000000',
      default_shipping: true
    });
  }

  return addresses;
}
```

## Order Sync (POS → Magento)

### Create Order in Magento

```typescript
async function syncOrderToMagento(orderId: number): Promise<void> {
  const order = await orderRepository.findOne(orderId, {
    relations: ['items', 'customer', 'payments']
  });

  if (!order || order.magentoOrderId) {
    return; // Already synced
  }

  try {
    // Step 1: Create cart in Magento
    let cartId: string;

    if (order.customer?.magentoId) {
      // Customer cart
      const cartResponse = await magentoClient.post(
        `/customers/${order.customer.magentoId}/carts`
      );
      cartId = cartResponse.data;
    } else {
      // Guest cart
      const cartResponse = await magentoClient.post('/guest-carts');
      cartId = cartResponse.data;
    }

    // Step 2: Add items to cart
    for (const item of order.items) {
      const product = await productRepository.findOne(item.productId);

      await magentoClient.post(
        order.customer?.magentoId
          ? `/carts/${cartId}/items`
          : `/guest-carts/${cartId}/items`,
        {
          cartItem: {
            sku: product.sku,
            qty: item.quantity,
            quote_id: cartId
          }
        }
      );
    }

    // Step 3: Set shipping/billing address (pickup = store address)
    const storeAddress = await getStoreBillingAddress();

    await magentoClient.post(
      order.customer?.magentoId
        ? `/carts/${cartId}/billing-address`
        : `/guest-carts/${cartId}/billing-address`,
      { address: storeAddress }
    );

    // Step 4: Set shipping method (in-store pickup)
    await magentoClient.post(
      order.customer?.magentoId
        ? `/carts/${cartId}/shipping-information`
        : `/guest-carts/${cartId}/shipping-information`,
      {
        addressInformation: {
          shipping_address: storeAddress,
          billing_address: storeAddress,
          shipping_carrier_code: 'instore',
          shipping_method_code: 'pickup'
        }
      }
    );

    // Step 5: Place order
    const orderResponse = await magentoClient.post(
      order.customer?.magentoId
        ? `/carts/${cartId}/payment-information`
        : `/guest-carts/${cartId}/payment-information`,
      {
        paymentMethod: {
          method: mapPaymentMethod(order.payments[0]?.method)
        },
        billing_address: storeAddress
      }
    );

    const magentoOrderId = orderResponse.data;

    // Step 6: Get increment ID
    const magentoOrder = await magentoClient.get(`/orders/${magentoOrderId}`);

    // Step 7: Update POS order with Magento references
    await orderRepository.update(orderId, {
      magentoOrderId: magentoOrderId.toString(),
      magentoIncrementId: magentoOrder.data.increment_id,
      syncStatus: 'synced',
      syncedAt: new Date()
    });

    // Step 8: Apply discount if needed (via order comment or custom endpoint)
    if (order.discountAmount > 0) {
      await addOrderComment(magentoOrderId,
        `POS Discount Applied: $${order.discountAmount.toFixed(2)}`
      );
    }

  } catch (error) {
    // Queue for retry
    await addToSyncQueue('order', orderId, 'create', error.message);

    await orderRepository.update(orderId, {
      syncStatus: 'failed',
      syncError: error.message,
      syncAttempts: order.syncAttempts + 1
    });
  }
}

function mapPaymentMethod(posMethod: string): string {
  const mapping: Record<string, string> = {
    'cash': 'cashondelivery',
    'eftpos': 'pos_eftpos',
    'credit_card': 'pos_card'
  };
  return mapping[posMethod] || 'checkmo';
}
```

## Sync Queue Processing

### Queue Worker

```typescript
// sync/queue-worker.service.ts

@Injectable()
export class SyncQueueWorker {
  private readonly logger = new Logger(SyncQueueWorker.name);

  @Cron('*/1 * * * *') // Every minute
  async processQueue(): Promise<void> {
    const pendingItems = await syncQueueRepository.find({
      where: {
        status: 'pending',
        processAfter: LessThanOrEqual(new Date()),
        attempts: LessThan(Raw(alias => `${alias}.max_attempts`))
      },
      order: { createdAt: 'ASC' },
      take: 10
    });

    for (const item of pendingItems) {
      await this.processQueueItem(item);
    }
  }

  private async processQueueItem(item: SyncQueueItem): Promise<void> {
    await syncQueueRepository.update(item.id, { status: 'processing' });

    try {
      switch (item.entityType) {
        case 'customer':
          await syncCustomerToMagento(item.entityId);
          break;
        case 'order':
          await syncOrderToMagento(item.entityId);
          break;
      }

      await syncQueueRepository.update(item.id, { status: 'completed' });

    } catch (error) {
      const newAttempts = item.attempts + 1;
      const nextRetry = this.calculateNextRetry(newAttempts);

      await syncQueueRepository.update(item.id, {
        status: newAttempts >= item.maxAttempts ? 'failed' : 'pending',
        attempts: newAttempts,
        lastError: error.message,
        processAfter: nextRetry
      });
    }
  }

  private calculateNextRetry(attempts: number): Date {
    // Exponential backoff: 1min, 5min, 15min, 30min, 60min
    const delays = [1, 5, 15, 30, 60];
    const delayMinutes = delays[Math.min(attempts - 1, delays.length - 1)];
    return new Date(Date.now() + delayMinutes * 60 * 1000);
  }
}
```

## Error Handling & Retry Logic

### Retry Configuration

```typescript
interface RetryConfig {
  maxAttempts: 5,
  baseDelay: 1000, // 1 second
  maxDelay: 60000, // 1 minute
  backoffMultiplier: 2
}

async function withRetry<T>(
  operation: () => Promise<T>,
  config: RetryConfig
): Promise<T> {
  let lastError: Error;
  let delay = config.baseDelay;

  for (let attempt = 1; attempt <= config.maxAttempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;

      if (attempt < config.maxAttempts) {
        await sleep(delay);
        delay = Math.min(delay * config.backoffMultiplier, config.maxDelay);
      }
    }
  }

  throw lastError;
}
```

### Error Categories

| Error Type | Action | Retry |
|------------|--------|-------|
| Network timeout | Queue for retry | Yes, with backoff |
| 401 Unauthorized | Alert admin, pause sync | No |
| 404 Product not found | Skip, log warning | No |
| 429 Rate limited | Delay and retry | Yes, after delay |
| 500 Server error | Queue for retry | Yes, with backoff |
| Validation error | Log, skip item | No |

## Monitoring & Alerting

### Sync Health Checks

```typescript
async function checkSyncHealth(): Promise<SyncHealthStatus> {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

  // Check last successful syncs
  const lastProductSync = await syncLogRepository.findOne({
    where: { syncType: 'products', status: 'completed' },
    order: { completedAt: 'DESC' }
  });

  const lastInventorySync = await syncLogRepository.findOne({
    where: { syncType: 'inventory', status: 'completed' },
    order: { completedAt: 'DESC' }
  });

  // Check pending queue size
  const pendingCount = await syncQueueRepository.count({
    where: { status: 'pending' }
  });

  const failedCount = await syncQueueRepository.count({
    where: { status: 'failed' }
  });

  return {
    status: determineOverallStatus({
      lastProductSync,
      lastInventorySync,
      pendingCount,
      failedCount
    }),
    lastProductSync: lastProductSync?.completedAt,
    lastInventorySync: lastInventorySync?.completedAt,
    pendingQueueSize: pendingCount,
    failedQueueSize: failedCount,
    alerts: generateAlerts({
      lastProductSync,
      lastInventorySync,
      failedCount
    })
  };
}
```

## Conflict Resolution

### Price Discrepancies

```
Scenario: Product price in Magento updated while POS has cached old price

Resolution:
1. Magento price ALWAYS wins
2. POS updates on next sync
3. Active carts recalculate totals before checkout
4. Orders use price at time of order creation (locked in)
```

### Inventory Conflicts

```
Scenario: POS sells item while Magento shows 0 stock

Resolution:
1. Allow sale in POS (don't lose the sale)
2. Magento inventory goes negative
3. Alert manager to reconcile
4. Log for investigation
```

## Webhook Integration (Future Enhancement)

```typescript
// For real-time updates from Magento
@Post('/webhooks/magento')
async handleMagentoWebhook(
  @Headers('X-Magento-Signature') signature: string,
  @Body() payload: MagentoWebhookPayload
): Promise<void> {

  // Verify signature
  if (!verifyMagentoSignature(signature, payload)) {
    throw new UnauthorizedException('Invalid signature');
  }

  switch (payload.event) {
    case 'catalog_product_save_after':
      await queueProductUpdate(payload.data.product_id);
      break;

    case 'cataloginventory_stock_item_save_after':
      await queueInventoryUpdate(payload.data.product_id);
      break;

    case 'catalog_product_delete_after':
      await markProductDeleted(payload.data.product_id);
      break;
  }
}
```
