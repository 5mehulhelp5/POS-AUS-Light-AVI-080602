-- =====================================================
-- Australian Lighting & Fans POS - Database Setup
-- Run this file to create and populate the database
-- =====================================================

-- Create database
CREATE DATABASE IF NOT EXISTS pos_aus_light
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

USE pos_aus_light;

-- =====================================================
-- TABLES
-- =====================================================

-- Roles
CREATE TABLE IF NOT EXISTS roles (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    display_name VARCHAR(100) NOT NULL,
    max_discount_percent DECIMAL(5,2) NOT NULL DEFAULT 0,
    can_stack_discounts BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_name (name)
) ENGINE=InnoDB;

-- Users
CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    pin_code VARCHAR(6) NULL,
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
) ENGINE=InnoDB;

-- Permissions
CREATE TABLE IF NOT EXISTS permissions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    role_id INT UNSIGNED NOT NULL,
    resource VARCHAR(50) NOT NULL,
    action VARCHAR(50) NOT NULL,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
    UNIQUE KEY unique_permission (role_id, resource, action)
) ENGINE=InnoDB;

-- User sessions
CREATE TABLE IF NOT EXISTS user_sessions (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token_hash VARCHAR(255) NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_token (token_hash),
    INDEX idx_expires (expires_at)
) ENGINE=InnoDB;

-- Categories
CREATE TABLE IF NOT EXISTS categories (
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
) ENGINE=InnoDB;

-- Products
CREATE TABLE IF NOT EXISTS products (
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
    parent_id INT UNSIGNED NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    synced_at TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_magento_id (magento_id),
    INDEX idx_sku (sku),
    INDEX idx_barcode (barcode),
    INDEX idx_name (name),
    INDEX idx_active_stock (is_active, is_in_stock),
    FULLTEXT INDEX ft_search (name, sku, description)
) ENGINE=InnoDB;

-- Product-Category mapping
CREATE TABLE IF NOT EXISTS product_categories (
    product_id INT UNSIGNED NOT NULL,
    category_id INT UNSIGNED NOT NULL,
    PRIMARY KEY (product_id, category_id),
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- Product attributes
CREATE TABLE IF NOT EXISTS product_attributes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    product_id INT UNSIGNED NOT NULL,
    attribute_code VARCHAR(100) NOT NULL,
    attribute_label VARCHAR(255) NOT NULL,
    attribute_value VARCHAR(255) NOT NULL,
    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
    INDEX idx_product (product_id),
    INDEX idx_code (attribute_code)
) ENGINE=InnoDB;

-- Customers
CREATE TABLE IF NOT EXISTS customers (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    magento_id INT UNSIGNED NULL UNIQUE,
    email VARCHAR(255) NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50) NULL,
    mobile VARCHAR(50) NULL,
    company VARCHAR(255) NULL,
    tax_number VARCHAR(50) NULL,
    billing_street VARCHAR(500) NULL,
    billing_city VARCHAR(100) NULL,
    billing_state VARCHAR(100) NULL,
    billing_postcode VARCHAR(20) NULL,
    billing_country VARCHAR(2) DEFAULT 'AU',
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
) ENGINE=InnoDB;

-- Orders
CREATE TABLE IF NOT EXISTS orders (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    magento_order_id VARCHAR(50) NULL,
    magento_increment_id VARCHAR(50) NULL,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,
    subtotal DECIMAL(12,4) NOT NULL,
    discount_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,4) NOT NULL,
    grand_total DECIMAL(12,4) NOT NULL,
    tax_rate DECIMAL(5,4) NOT NULL DEFAULT 0.1000,
    status ENUM('pending', 'processing', 'complete', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
    payment_status ENUM('pending', 'partial', 'paid', 'refunded') NOT NULL DEFAULT 'pending',
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
) ENGINE=InnoDB;

-- Order items
CREATE TABLE IF NOT EXISTS order_items (
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
    cost_price DECIMAL(12,4) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (product_id) REFERENCES products(id),
    INDEX idx_order (order_id),
    INDEX idx_product (product_id)
) ENGINE=InnoDB;

-- Payments
CREATE TABLE IF NOT EXISTS payments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    order_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    method ENUM('cash', 'eftpos', 'credit_card', 'store_credit', 'other') NOT NULL,
    amount DECIMAL(12,4) NOT NULL,
    reference VARCHAR(100) NULL,
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
) ENGINE=InnoDB;

-- Discount audit log
CREATE TABLE IF NOT EXISTS discount_audit_log (
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
    is_stacked BOOLEAN NOT NULL DEFAULT FALSE,
    stacked_with_id INT UNSIGNED NULL,
    reason TEXT NULL,
    approved_by INT UNSIGNED NULL,
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
) ENGINE=InnoDB;

-- Quotes
CREATE TABLE IF NOT EXISTS quotes (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    quote_number VARCHAR(50) NOT NULL UNIQUE,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,
    subtotal DECIMAL(12,4) NOT NULL,
    discount_amount DECIMAL(12,4) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(12,4) NOT NULL,
    grand_total DECIMAL(12,4) NOT NULL,
    status ENUM('open', 'expired', 'converted', 'cancelled') NOT NULL DEFAULT 'open',
    expires_at TIMESTAMP NOT NULL,
    converted_order_id INT UNSIGNED NULL,
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
) ENGINE=InnoDB;

-- Quote items
CREATE TABLE IF NOT EXISTS quote_items (
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
) ENGINE=InnoDB;

-- Inquiries
CREATE TABLE IF NOT EXISTS inquiries (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    customer_id INT UNSIGNED NULL,
    user_id INT UNSIGNED NOT NULL,
    type ENUM('walk_in', 'phone_call', 'email', 'other') NOT NULL,
    subject VARCHAR(255) NULL,
    description TEXT NULL,
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
) ENGINE=InnoDB;

-- Sync logs
CREATE TABLE IF NOT EXISTS sync_logs (
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
) ENGINE=InnoDB;

-- Sync queue
CREATE TABLE IF NOT EXISTS sync_queue (
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
) ENGINE=InnoDB;

-- Activity logs
CREATE TABLE IF NOT EXISTS activity_logs (
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
) ENGINE=InnoDB;

-- Settings
CREATE TABLE IF NOT EXISTS settings (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    setting_key VARCHAR(100) NOT NULL UNIQUE,
    setting_value TEXT NULL,
    setting_type ENUM('string', 'number', 'boolean', 'json') DEFAULT 'string',
    description VARCHAR(255) NULL,
    updated_by INT UNSIGNED NULL,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (updated_by) REFERENCES users(id) ON DELETE SET NULL
) ENGINE=InnoDB;

-- =====================================================
-- SEED DATA
-- =====================================================

-- Roles
INSERT INTO roles (id, name, display_name, max_discount_percent, can_stack_discounts) VALUES
(1, 'sales_staff', 'Sales Staff', 10.00, FALSE),
(2, 'manager', 'Manager', 20.00, TRUE),
(3, 'admin', 'Admin', 100.00, TRUE);

-- Users (password: password123)
-- bcrypt hash for 'password123'
INSERT INTO users (id, role_id, email, password_hash, pin_code, first_name, last_name, is_active) VALUES
(1, 3, 'admin@auslighting.com.au', '$2b$10$8K1p/c1JKfZvPmH2D8TZHOQMzGHvN.K7xqJnE3vYBqFRjJy8B1gZu', '1111', 'Store', 'Admin', TRUE),
(2, 2, 'manager@auslighting.com.au', '$2b$10$8K1p/c1JKfZvPmH2D8TZHOQMzGHvN.K7xqJnE3vYBqFRjJy8B1gZu', '2222', 'Sarah', 'Manager', TRUE),
(3, 1, 'john@auslighting.com.au', '$2b$10$8K1p/c1JKfZvPmH2D8TZHOQMzGHvN.K7xqJnE3vYBqFRjJy8B1gZu', '3333', 'John', 'Smith', TRUE),
(4, 1, 'jane@auslighting.com.au', '$2b$10$8K1p/c1JKfZvPmH2D8TZHOQMzGHvN.K7xqJnE3vYBqFRjJy8B1gZu', '4444', 'Jane', 'Doe', TRUE);

-- Categories
INSERT INTO categories (id, magento_id, parent_id, name, path, level, is_active) VALUES
(1, 10, NULL, 'Lighting', '1', 0, TRUE),
(2, 11, 1, 'Ceiling Lights', '1/2', 1, TRUE),
(3, 12, 1, 'Floor Lamps', '1/3', 1, TRUE),
(4, 13, 1, 'Table Lamps', '1/4', 1, TRUE),
(5, 14, 1, 'Wall Lights', '1/5', 1, TRUE),
(6, 15, 1, 'Outdoor Lighting', '1/6', 1, TRUE),
(7, 20, NULL, 'Ceiling Fans', '7', 0, TRUE),
(8, 21, 7, 'Indoor Fans', '7/8', 1, TRUE),
(9, 22, 7, 'Outdoor Fans', '7/9', 1, TRUE),
(10, 23, 7, 'Fan Accessories', '7/10', 1, TRUE),
(11, 30, NULL, 'Smart Home', '11', 0, TRUE),
(12, 31, 11, 'Smart Bulbs', '11/12', 1, TRUE),
(13, 32, 11, 'Smart Switches', '11/13', 1, TRUE);

-- Products
INSERT INTO products (id, magento_id, sku, name, description, price, special_price, stock_qty, is_in_stock, tax_class_id, barcode, product_type, is_active) VALUES
(1, 1001, 'CL-PEND-001', 'Modern Pendant Light - Black', 'Sleek modern pendant light with matte black finish.', 189.00, NULL, 25, TRUE, 2, '9312345000001', 'simple', TRUE),
(2, 1002, 'CL-PEND-002', 'Modern Pendant Light - White', 'Sleek modern pendant light with matte white finish.', 189.00, 159.00, 18, TRUE, 2, '9312345000002', 'simple', TRUE),
(3, 1003, 'CL-CHAN-001', 'Crystal Chandelier - 6 Arm', 'Elegant 6-arm crystal chandelier.', 599.00, NULL, 8, TRUE, 2, '9312345000003', 'simple', TRUE),
(4, 1004, 'CL-CHAN-002', 'Crystal Chandelier - 8 Arm', 'Stunning 8-arm crystal chandelier.', 849.00, 749.00, 5, TRUE, 2, '9312345000004', 'simple', TRUE),
(5, 1005, 'CL-FLUSH-001', 'LED Flush Mount - Round', 'Energy-efficient LED flush mount ceiling light.', 79.00, NULL, 45, TRUE, 2, '9312345000005', 'simple', TRUE),
(6, 1006, 'FL-ARC-001', 'Arc Floor Lamp - Brass', 'Contemporary arc floor lamp with brushed brass finish.', 349.00, NULL, 12, TRUE, 2, '9312345000006', 'simple', TRUE),
(7, 1007, 'FL-ARC-002', 'Arc Floor Lamp - Chrome', 'Contemporary arc floor lamp with polished chrome finish.', 349.00, 299.00, 8, TRUE, 2, '9312345000007', 'simple', TRUE),
(8, 1008, 'FL-TRIPOD-001', 'Tripod Floor Lamp - Wood', 'Scandinavian-style tripod floor lamp.', 229.00, NULL, 15, TRUE, 2, '9312345000008', 'simple', TRUE),
(9, 1009, 'FL-READ-001', 'Reading Floor Lamp - Adjustable', 'Adjustable reading floor lamp with LED.', 159.00, NULL, 22, TRUE, 2, '9312345000009', 'simple', TRUE),
(10, 1010, 'TL-DESK-001', 'LED Desk Lamp - White', 'Modern LED desk lamp with USB charging port.', 89.00, 69.00, 35, TRUE, 2, '9312345000010', 'simple', TRUE),
(11, 1011, 'TL-DESK-002', 'LED Desk Lamp - Black', 'Modern LED desk lamp with USB charging port.', 89.00, NULL, 28, TRUE, 2, '9312345000011', 'simple', TRUE),
(12, 1012, 'TL-CERAMIC-001', 'Ceramic Table Lamp - Blue', 'Handcrafted ceramic table lamp.', 149.00, NULL, 14, TRUE, 2, '9312345000012', 'simple', TRUE),
(13, 1013, 'TL-TOUCH-001', 'Touch Bedside Lamp - Gold', 'Elegant touch-activated bedside lamp.', 79.00, NULL, 40, TRUE, 2, '9312345000013', 'simple', TRUE),
(14, 2001, 'CF-52-001', '52" Ceiling Fan - White', 'Classic 52-inch ceiling fan with remote.', 249.00, NULL, 20, TRUE, 2, '9312345000014', 'simple', TRUE),
(15, 2002, 'CF-52-002', '52" Ceiling Fan - Black', 'Classic 52-inch ceiling fan with remote.', 249.00, 219.00, 16, TRUE, 2, '9312345000015', 'simple', TRUE),
(16, 2003, 'CF-56-001', '56" Ceiling Fan with Light', 'Large 56-inch ceiling fan with LED light.', 399.00, NULL, 10, TRUE, 2, '9312345000016', 'simple', TRUE),
(17, 2004, 'CF-42-001', '42" Ceiling Fan - Compact', 'Compact 42-inch ceiling fan.', 179.00, NULL, 25, TRUE, 2, '9312345000017', 'simple', TRUE),
(18, 2005, 'CF-OUTDOOR-001', 'Outdoor Ceiling Fan - IP44', 'Weather-resistant outdoor ceiling fan.', 329.00, 289.00, 12, TRUE, 2, '9312345000018', 'simple', TRUE),
(19, 1020, 'OL-WALL-001', 'Outdoor Wall Light - Black', 'Modern outdoor wall light, IP65 rated.', 89.00, NULL, 30, TRUE, 2, '9312345000019', 'simple', TRUE),
(20, 1021, 'OL-POST-001', 'Garden Post Light - 90cm', '90cm garden post light.', 149.00, NULL, 18, TRUE, 2, '9312345000020', 'simple', TRUE),
(21, 1022, 'OL-FLOOD-001', 'LED Floodlight - 30W', '30W LED floodlight with motion sensor.', 69.00, 49.00, 50, TRUE, 2, '9312345000021', 'simple', TRUE),
(22, 1023, 'OL-SOLAR-001', 'Solar Path Lights - 6 Pack', 'Set of 6 solar-powered path lights.', 59.00, NULL, 35, TRUE, 2, '9312345000022', 'simple', TRUE),
(23, 3001, 'SH-BULB-001', 'Smart LED Bulb - E27', 'WiFi smart bulb with RGB.', 29.00, NULL, 100, TRUE, 2, '9312345000023', 'simple', TRUE),
(24, 3002, 'SH-BULB-002', 'Smart LED Bulb - B22', 'WiFi smart bulb with RGB.', 29.00, 24.00, 85, TRUE, 2, '9312345000024', 'simple', TRUE),
(25, 3003, 'SH-STRIP-001', 'Smart LED Strip - 5m', '5 meter smart LED strip.', 49.00, NULL, 40, TRUE, 2, '9312345000025', 'simple', TRUE),
(26, 3004, 'SH-SWITCH-001', 'Smart Light Switch - Single', 'WiFi smart light switch.', 45.00, NULL, 55, TRUE, 2, '9312345000026', 'simple', TRUE),
(27, 3005, 'SH-SWITCH-002', 'Smart Light Switch - Double', 'WiFi smart double switch.', 65.00, 55.00, 42, TRUE, 2, '9312345000027', 'simple', TRUE),
(28, 1030, 'WL-SCONCE-001', 'Wall Sconce - Brass', 'Elegant brass wall sconce.', 119.00, NULL, 20, TRUE, 2, '9312345000028', 'simple', TRUE),
(29, 1031, 'WL-SCONCE-002', 'Wall Sconce - Chrome', 'Modern chrome wall sconce.', 99.00, NULL, 24, TRUE, 2, '9312345000029', 'simple', TRUE),
(30, 1032, 'WL-PICTURE-001', 'LED Picture Light - 60cm', '60cm LED picture light.', 89.00, 79.00, 15, TRUE, 2, '9312345000030', 'simple', TRUE);

-- Product-Category associations
INSERT INTO product_categories (product_id, category_id) VALUES
(1, 1), (1, 2), (2, 1), (2, 2), (3, 1), (3, 2), (4, 1), (4, 2), (5, 1), (5, 2),
(6, 1), (6, 3), (7, 1), (7, 3), (8, 1), (8, 3), (9, 1), (9, 3),
(10, 1), (10, 4), (11, 1), (11, 4), (12, 1), (12, 4), (13, 1), (13, 4),
(14, 7), (14, 8), (15, 7), (15, 8), (16, 7), (16, 8), (17, 7), (17, 8), (18, 7), (18, 9),
(19, 1), (19, 6), (20, 1), (20, 6), (21, 1), (21, 6), (22, 1), (22, 6),
(23, 11), (23, 12), (24, 11), (24, 12), (25, 11), (25, 12), (26, 11), (26, 13), (27, 11), (27, 13),
(28, 1), (28, 5), (29, 1), (29, 5), (30, 1), (30, 5);

-- Customers
INSERT INTO customers (id, magento_id, email, first_name, last_name, phone, mobile, company, billing_street, billing_city, billing_state, billing_postcode, sync_status) VALUES
(1, 5001, 'john.customer@email.com', 'John', 'Williams', '02 9876 5432', '0412 345 678', NULL, '123 Main Street', 'Sydney', 'NSW', '2000', 'synced'),
(2, 5002, 'sarah.builder@email.com', 'Sarah', 'Johnson', '02 9765 4321', '0423 456 789', 'Johnson Constructions', '45 Builder Lane', 'Parramatta', 'NSW', '2150', 'synced'),
(3, 5003, 'mike.designer@email.com', 'Michael', 'Brown', NULL, '0434 567 890', 'MB Interior Design', '78 Design Ave', 'Bondi', 'NSW', '2026', 'synced'),
(4, NULL, 'lisa.walkin@email.com', 'Lisa', 'Davis', '02 8765 4321', '0445 678 901', NULL, '22 Residential St', 'Chatswood', 'NSW', '2067', 'pending'),
(5, 5004, 'peter.electrician@email.com', 'Peter', 'Wilson', NULL, '0456 789 012', 'Spark Electrical Services', '99 Trade Road', 'Alexandria', 'NSW', '2015', 'synced');

-- Settings
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('store_name', 'Australian Lighting & Fans', 'string', 'Store display name'),
('store_abn', '12 345 678 901', 'string', 'Australian Business Number'),
('store_address', '123 Lighting Street, Sydney NSW 2000', 'string', 'Store address'),
('store_phone', '02 1234 5678', 'string', 'Store phone number'),
('tax_rate', '0.10', 'number', 'GST rate (10%)'),
('quote_expiry_days', '14', 'number', 'Default quote expiry in days');

-- =====================================================
-- DONE!
-- =====================================================
SELECT '✅ Database setup complete!' AS status;
SELECT CONCAT('Products: ', COUNT(*)) AS summary FROM products
UNION ALL
SELECT CONCAT('Categories: ', COUNT(*)) FROM categories
UNION ALL
SELECT CONCAT('Users: ', COUNT(*)) FROM users
UNION ALL
SELECT CONCAT('Customers: ', COUNT(*)) FROM customers;
