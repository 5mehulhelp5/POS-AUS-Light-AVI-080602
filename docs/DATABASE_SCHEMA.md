# Database Schema Design

## Entity Relationship Diagram (Conceptual)

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │       │    roles    │       │ permissions │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │───────│ id          │───────│ id          │
│ role_id     │       │ name        │       │ role_id     │
│ email       │       │ max_discount│       │ action      │
│ pin_code    │       │ can_stack   │       │ resource    │
└─────────────┘       └─────────────┘       └─────────────┘
      │
      │ 1:N
      ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│   orders    │───────│ order_items │       │  payments   │
├─────────────┤  1:N  ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ customer_id │       │ order_id    │       │ order_id    │
│ user_id     │       │ product_id  │       │ method      │
│ status      │       │ quantity    │       │ amount      │
└─────────────┘       │ discount    │       └─────────────┘
      │               └─────────────┘
      │ N:1
      ▼
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│  customers  │       │  products   │       │ categories  │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ magento_id  │       │ magento_id  │       │ magento_id  │
│ email       │       │ sku         │       │ name        │
│ phone       │       │ price       │       │ parent_id   │
└─────────────┘       │ stock_qty   │       └─────────────┘
                      └─────────────┘
```

## Complete Schema Definition

### 1. Users & Authentication

```sql
-- Roles table
CREATE TABLE roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    max_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    can_stack_discounts BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_name (name)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default roles
INSERT INTO roles (name, display_name, max_discount_percent, can_stack_discounts) VALUES
('sales_staff', 'Sales Staff', 10.00, FALSE),
('manager', 'Manager', 20.00, TRUE),
('admin', 'Admin', 100.00, TRUE);

-- Users table
CREATE TABLE users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    pin_code VARCHAR(6) NULL,  -- For quick POS login
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (role_id) REFERENCES roles(id),
    INDEX idx_email (email),
    INDEX idx_pin_code (pin_code),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Permissions table (fine-grained access control)
CREATE TABLE permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    resource VARCHAR(50) NOT NULL,  -- e.g., 'orders', 'reports', 'users'
    action VARCHAR(50) NOT NULL,    -- e.g., 'create', 'read', 'update', 'delete'

    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_permission (role_id, resource, action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- User sessions (for token invalidation)
CREATE TABLE user_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 2. Products (Cached from Magento)

```sql
-- Categories table
CREATE TABLE categories (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    magento_id INT UNSIGNED NOT NULL UNIQUE,
    parent_id INT UNSIGNED NULL,
    name VARCHAR(255) NOT NULL,
    path VARCHAR(500) NULL,
    level INT UNSIGNED NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (parent_id) REFERENCES categories(id) ON DELETE SET NULL,
    INDEX idx_magento_id (magento_id),
    INDEX idx_parent (parent_id),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Products table
CREATE TABLE products (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    magento_id INT UNSIGNED NOT NULL UNIQUE,
    sku VARCHAR(100) NOT NULL UNIQUE,
    name VARCHAR(255) NOT NULL,
    description TEXT NULL,
    short_description TEXT NULL,
    price DECIMAL(12,4) NOT NULL,
    special_price DECIMAL(12,4) NULL,
    special_price_from DATE NULL,
    special_price_to DATE NULL,
    cost DECIMAL(12,4) NULL,
    weight DECIMAL(10,4) NULL,
    stock_qty INT NOT NULL DEFAULT 0,
    is_in_stock BOOLEAN NOT NULL DEFAULT TRUE,
    manage_stock BOOLEAN NOT NULL DEFAULT TRUE,
    tax_class_id INT UNSIGNED NULL,
    image_url VARCHAR(500) NULL,
    thumbnail_url VARCHAR(500) NULL,
    barcode VARCHAR(100) NULL,
    product_type ENUM('simple', 'configurable', 'bundle', 'grouped', 'virtual') NOT NULL DEFAULT 'simple',
    parent_id INT UNSIGNED NULL,  -- For configurable variants
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_magento_id (magento_id),
    INDEX idx_sku (sku),
    INDEX idx_barcode (barcode),
    INDEX idx_name (name),
    INDEX idx_active_stock (is_active, is_in_stock),
    INDEX idx_parent (parent_id),
    FULLTEXT INDEX ft_search (name, sku, description)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product-Category mapping
CREATE TABLE product_categories (
    product_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,

    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Product attributes (for configurable options)
CREATE TABLE product_attributes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    attribute_code VARCHAR(100) NOT NULL,
    attribute_label VARCHAR(255) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,

    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_code (attribute_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 3. Customers

```sql
-- Customers table
CREATE TABLE customers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    magento_id INT UNSIGNED NULL UNIQUE,
    email VARCHAR(255) NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NULL,
    mobile VARCHAR(50) NULL,
    company VARCHAR(255) NULL,
    tax_number VARCHAR(50) NULL,  -- ABN for Australian businesses

    -- Billing address
    billing_street VARCHAR(500) NULL,
    billing_city VARCHAR(100) NULL,
    billing_state VARCHAR(100) NULL,
    billing_postcode VARCHAR(20) NULL,
    billing_country VARCHAR(2) DEFAULT 'AU',

    -- Shipping address (if different)
    shipping_street VARCHAR(500) NULL,
    shipping_city VARCHAR(100) NULL,
    shipping_state VARCHAR(100) NULL,
    shipping_postcode VARCHAR(20) NULL,
    shipping_country VARCHAR(2) DEFAULT 'AU',

    notes TEXT NULL,
    is_guest BOOLEAN NOT NULL DEFAULT FALSE,
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_magento_id (magento_id),
    INDEX idx_email (email),
    INDEX idx_phone (phone),
    INDEX idx_name (last_name, first_name),
    INDEX idx_sync_status (sync_status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 4. Orders

```sql
-- Orders table
CREATE TABLE orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    magento_order_id VARCHAR(50) NULL,
    magento_increment_id VARCHAR(50) NULL,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,  -- Staff who created the order

    -- Totals
    subtotal DECIMAL(12,4) NOT NULL,
    discount_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,4) NOT NULL,
    grand_total DECIMAL(12,4) NOT NULL,

    -- Tax details (Australian GST)
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000,  -- 10% GST

    status ENUM('pending', 'processing', 'complete', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    payment_status ENUM('pending', 'partial', 'paid', 'refunded') NOT NULL DEFAULT 'pending',

    -- Sync tracking
    sync_status ENUM('pending', 'synced', 'failed') DEFAULT 'pending',
    sync_attempts INT UNSIGNED DEFAULT 0,
    sync_error TEXT NULL,
    synced_at TIMESTAMP NULL,

    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_order_number (order_number),
    INDEX idx_magento_order (magento_order_id),
    INDEX idx_customer (customer_id),
    INDEX idx_user (user_id),
    INDEX idx_status (status),
    INDEX idx_sync_status (sync_status),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Order items table
CREATE TABLE order_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,4) NOT NULL,
    row_total DECIMAL(12,4) NOT NULL,

    -- Snapshot of product at time of sale
    cost_price DECIMAL(12,4) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order (order_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 5. Payments

```sql
-- Payments table
CREATE TABLE payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,  -- Staff who processed payment
    method ENUM('cash', 'eftpos', 'credit_card', 'store_credit', 'other') NOT NULL,
    amount DECIMAL(12,4) NOT NULL,
    reference VARCHAR(100) NULL,  -- EFTPOS reference, etc.

    -- For cash payments
    amount_tendered DECIMAL(12,4) NULL,
    change_given DECIMAL(12,4) NULL,

    status ENUM('pending', 'completed', 'failed', 'refunded') NOT NULL DEFAULT 'completed',
    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_order (order_id),
    INDEX idx_method (method),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 6. Discounts & Audit

```sql
-- Discount audit log (CRITICAL for compliance)
CREATE TABLE discount_audit_log (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NULL,
    order_item_id INT UNSIGNED NULL,
    quote_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,
    user_role VARCHAR(50) NOT NULL,

    discount_type ENUM('product', 'cart', 'manual') NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL,
    discount_amount DECIMAL(12,4) NOT NULL,
    original_amount DECIMAL(12,4) NOT NULL,
    final_amount DECIMAL(12,4) NOT NULL,

    -- For stacked discounts
    is_stacked BOOLEAN NOT NULL DEFAULT FALSE,
    stacked_with_id INT UNSIGNED NULL,  -- Reference to previous discount in stack

    reason TEXT NULL,
    approved_by INT UNSIGNED NULL,  -- Manager approval if required

    -- Rejection tracking
    was_rejected BOOLEAN NOT NULL DEFAULT FALSE,
    rejection_reason VARCHAR(255) NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL,
    FOREIGN KEY (order_item_id) REFERENCES order_items(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (approved_by) REFERENCES users(id),
    INDEX idx_order (order_id),
    INDEX idx_user (user_id),
    INDEX idx_created (created_at),
    INDEX idx_rejected (was_rejected)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 7. Quotes

```sql
-- Quotes table
CREATE TABLE quotes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,  -- Staff who created quote

    -- Totals
    subtotal DECIMAL(12,4) NOT NULL,
    discount_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,4) NOT NULL,
    grand_total DECIMAL(12,4) NOT NULL,

    status ENUM('open', 'expired', 'converted', 'cancelled') NOT NULL DEFAULT 'open',
    expires_at TIMESTAMP NOT NULL,
    converted_order_id INT UNSIGNED NULL,

    -- Stock hold (default: no hold)
    hold_stock BOOLEAN NOT NULL DEFAULT FALSE,

    notes TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    INDEX idx_quote_number (quote_number),
    INDEX idx_customer (customer_id),
    INDEX idx_status (status),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Quote items table
CREATE TABLE quote_items (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quote_id INT UNSIGNED NOT NULL,
    product_id INT UNSIGNED NOT NULL,
    sku VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    quantity INT UNSIGNED NOT NULL,
    unit_price DECIMAL(12,4) NOT NULL,
    discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,4) NOT NULL,
    row_total DECIMAL(12,4) NOT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (quote_id) REFERENCES quotes(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_quote (quote_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 8. CRM - Inquiries & Calls

```sql
-- Inquiries table (walk-ins, phone calls)
CREATE TABLE inquiries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,  -- Staff who logged inquiry

    type ENUM('walk_in', 'phone_call', 'email', 'other') NOT NULL,
    subject VARCHAR(255) NULL,
    description TEXT NULL,

    -- Contact details if no customer record
    contact_name VARCHAR(200) NULL,
    contact_phone VARCHAR(50) NULL,
    contact_email VARCHAR(255) NULL,

    status ENUM('new', 'in_progress', 'resolved', 'converted') NOT NULL DEFAULT 'new',
    converted_quote_id INT UNSIGNED NULL,
    converted_order_id INT UNSIGNED NULL,

    follow_up_date DATE NULL,
    follow_up_notes TEXT NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE SET NULL,
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (converted_quote_id) REFERENCES quotes(id) ON DELETE SET NULL,
    FOREIGN KEY (converted_order_id) REFERENCES orders(id) ON DELETE SET NULL,
    INDEX idx_customer (customer_id),
    INDEX idx_user (user_id),
    INDEX idx_type (type),
    INDEX idx_status (status),
    INDEX idx_follow_up (follow_up_date),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 9. Sync Logs

```sql
-- Sync logs table
CREATE TABLE sync_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    sync_type ENUM('products', 'categories', 'inventory', 'customers', 'orders') NOT NULL,
    direction ENUM('magento_to_pos', 'pos_to_magento') NOT NULL,
    status ENUM('started', 'completed', 'failed', 'partial') NOT NULL,

    records_processed INT UNSIGNED DEFAULT 0,
    records_created INT UNSIGNED DEFAULT 0,
    records_updated INT UNSIGNED DEFAULT 0,
    records_failed INT UNSIGNED DEFAULT 0,

    error_message TEXT NULL,
    error_details JSON NULL,

    started_at TIMESTAMP NOT NULL,
    completed_at TIMESTAMP NULL,
    duration_seconds INT UNSIGNED NULL,

    INDEX idx_type (sync_type),
    INDEX idx_status (status),
    INDEX idx_started (started_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Sync queue for failed/pending items
CREATE TABLE sync_queue (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    entity_type ENUM('customer', 'order') NOT NULL,
    entity_id INT UNSIGNED NOT NULL,
    action ENUM('create', 'update') NOT NULL,
    payload JSON NOT NULL,

    attempts INT UNSIGNED DEFAULT 0,
    max_attempts INT UNSIGNED DEFAULT 5,
    last_error TEXT NULL,

    status ENUM('pending', 'processing', 'completed', 'failed') DEFAULT 'pending',
    process_after TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    INDEX idx_status (status),
    INDEX idx_process_after (process_after),
    INDEX idx_entity (entity_type, entity_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 10. Activity/Audit Log

```sql
-- General activity log for all user actions
CREATE TABLE activity_logs (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NULL,
    entity_id INT UNSIGNED NULL,
    description TEXT NULL,
    old_values JSON NULL,
    new_values JSON NULL,
    ip_address VARCHAR(45) NULL,
    user_agent VARCHAR(500) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id),
    INDEX idx_user (user_id),
    INDEX idx_action (action),
    INDEX idx_entity (entity_type, entity_id),
    INDEX idx_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 11. System Configuration

```sql
-- System settings
CREATE TABLE settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description VARCHAR(255) NULL,
    updated_by INT UNSIGNED NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Default settings
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('store_name', 'Australian Lighting & Fans', 'string', 'Store display name'),
('store_abn', '', 'string', 'Australian Business Number'),
('store_address', '', 'string', 'Store address for receipts'),
('store_phone', '', 'string', 'Store phone number'),
('tax_rate', '0.10', 'number', 'GST rate (10%)'),
('quote_expiry_days', '14', 'number', 'Default quote expiry in days'),
('receipt_footer', 'Thank you for shopping at Australian Lighting & Fans!', 'string', 'Receipt footer text'),
('magento_base_url', '', 'string', 'Magento store URL'),
('sync_interval_minutes', '15', 'number', 'Product sync interval');
```

## Indexes Summary

All tables include appropriate indexes for:
- Primary keys (auto-generated)
- Foreign keys (for JOIN performance)
- Search fields (email, phone, sku, name)
- Status/filter fields
- Date/time fields for reporting
- Full-text search on products

## Data Retention

| Table | Retention Policy |
|-------|-----------------|
| orders, order_items | 7 years (tax compliance) |
| payments | 7 years (tax compliance) |
| discount_audit_log | 7 years (audit requirement) |
| activity_logs | 2 years |
| sync_logs | 90 days |
| sync_queue | 30 days (completed items) |
