-- =====================================================
-- Australian Lighting & Fans POS - Test Seed Data
-- =====================================================

-- -----------------------------------------------------
-- 1. Roles (with discount rules)
-- -----------------------------------------------------
INSERT INTO roles (id, name, display_name, max_discount_percent, can_stack_discounts) VALUES
(1, 'sales_staff', 'Sales Staff', 10.00, FALSE),
(2, 'manager', 'Manager', 20.00, TRUE),
(3, 'admin', 'Admin', 100.00, TRUE);

-- -----------------------------------------------------
-- 2. Permissions
-- -----------------------------------------------------
-- Sales Staff permissions
INSERT INTO permissions (role_id, resource, action) VALUES
(1, 'products', 'read'),
(1, 'customers', 'read'),
(1, 'customers', 'create'),
(1, 'orders', 'read'),
(1, 'orders', 'create'),
(1, 'quotes', 'read'),
(1, 'quotes', 'create'),
(1, 'inquiries', 'read'),
(1, 'inquiries', 'create');

-- Manager permissions (all of sales staff plus more)
INSERT INTO permissions (role_id, resource, action) VALUES
(2, 'products', 'read'),
(2, 'customers', 'read'),
(2, 'customers', 'create'),
(2, 'customers', 'update'),
(2, 'orders', 'read'),
(2, 'orders', 'create'),
(2, 'orders', 'update'),
(2, 'orders', 'refund'),
(2, 'quotes', 'read'),
(2, 'quotes', 'create'),
(2, 'quotes', 'update'),
(2, 'inquiries', 'read'),
(2, 'inquiries', 'create'),
(2, 'inquiries', 'update'),
(2, 'reports', 'read'),
(2, 'sync', 'trigger');

-- Admin permissions (everything)
INSERT INTO permissions (role_id, resource, action) VALUES
(3, 'products', 'read'),
(3, 'products', 'create'),
(3, 'products', 'update'),
(3, 'products', 'delete'),
(3, 'customers', 'read'),
(3, 'customers', 'create'),
(3, 'customers', 'update'),
(3, 'customers', 'delete'),
(3, 'orders', 'read'),
(3, 'orders', 'create'),
(3, 'orders', 'update'),
(3, 'orders', 'delete'),
(3, 'orders', 'refund'),
(3, 'quotes', 'read'),
(3, 'quotes', 'create'),
(3, 'quotes', 'update'),
(3, 'quotes', 'delete'),
(3, 'inquiries', 'read'),
(3, 'inquiries', 'create'),
(3, 'inquiries', 'update'),
(3, 'inquiries', 'delete'),
(3, 'reports', 'read'),
(3, 'users', 'read'),
(3, 'users', 'create'),
(3, 'users', 'update'),
(3, 'users', 'delete'),
(3, 'settings', 'read'),
(3, 'settings', 'update'),
(3, 'sync', 'trigger');

-- -----------------------------------------------------
-- 3. Users (password: "password123" for all)
-- Hash generated with bcrypt, 10 rounds
-- -----------------------------------------------------
INSERT INTO users (id, role_id, email, password_hash, pin_code, first_name, last_name, is_active) VALUES
(1, 3, 'admin@auslighting.com.au', '$2b$10$rQZ5xzN8xQZ5xzN8xQZ5x.8xQZ5xzN8xQZ5xzN8xQZ5xzN8xQZ5xu', '1111', 'Store', 'Admin', TRUE),
(2, 2, 'manager@auslighting.com.au', '$2b$10$rQZ5xzN8xQZ5xzN8xQZ5x.8xQZ5xzN8xQZ5xzN8xQZ5xzN8xQZ5xu', '2222', 'Sarah', 'Manager', TRUE),
(3, 1, 'john@auslighting.com.au', '$2b$10$rQZ5xzN8xQZ5xzN8xQZ5x.8xQZ5xzN8xQZ5xzN8xQZ5xzN8xQZ5xu', '3333', 'John', 'Smith', TRUE),
(4, 1, 'jane@auslighting.com.au', '$2b$10$rQZ5xzN8xQZ5xzN8xQZ5x.8xQZ5xzN8xQZ5xzN8xQZ5xzN8xQZ5xu', '4444', 'Jane', 'Doe', TRUE);

-- -----------------------------------------------------
-- 4. Categories
-- -----------------------------------------------------
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

-- -----------------------------------------------------
-- 5. Products
-- -----------------------------------------------------
INSERT INTO products (id, magento_id, sku, name, description, price, special_price, stock_qty, is_in_stock, tax_class_id, barcode, product_type, is_active) VALUES
-- Ceiling Lights
(1, 1001, 'CL-PEND-001', 'Modern Pendant Light - Black', 'Sleek modern pendant light with matte black finish. Perfect for kitchen islands and dining areas.', 189.00, NULL, 25, TRUE, 2, '9312345000001', 'simple', TRUE),
(2, 1002, 'CL-PEND-002', 'Modern Pendant Light - White', 'Sleek modern pendant light with matte white finish. Perfect for kitchen islands and dining areas.', 189.00, 159.00, 18, TRUE, 2, '9312345000002', 'simple', TRUE),
(3, 1003, 'CL-CHAN-001', 'Crystal Chandelier - 6 Arm', 'Elegant 6-arm crystal chandelier. Ideal for dining rooms and entryways.', 599.00, NULL, 8, TRUE, 2, '9312345000003', 'simple', TRUE),
(4, 1004, 'CL-CHAN-002', 'Crystal Chandelier - 8 Arm', 'Stunning 8-arm crystal chandelier. Makes a statement in any room.', 849.00, 749.00, 5, TRUE, 2, '9312345000004', 'simple', TRUE),
(5, 1005, 'CL-FLUSH-001', 'LED Flush Mount - Round', 'Energy-efficient LED flush mount ceiling light. 3000K warm white.', 79.00, NULL, 45, TRUE, 2, '9312345000005', 'simple', TRUE),

-- Floor Lamps
(6, 1006, 'FL-ARC-001', 'Arc Floor Lamp - Brass', 'Contemporary arc floor lamp with brushed brass finish and marble base.', 349.00, NULL, 12, TRUE, 2, '9312345000006', 'simple', TRUE),
(7, 1007, 'FL-ARC-002', 'Arc Floor Lamp - Chrome', 'Contemporary arc floor lamp with polished chrome finish and marble base.', 349.00, 299.00, 8, TRUE, 2, '9312345000007', 'simple', TRUE),
(8, 1008, 'FL-TRIPOD-001', 'Tripod Floor Lamp - Wood', 'Scandinavian-style tripod floor lamp with natural wood legs.', 229.00, NULL, 15, TRUE, 2, '9312345000008', 'simple', TRUE),
(9, 1009, 'FL-READ-001', 'Reading Floor Lamp - Adjustable', 'Adjustable reading floor lamp with LED. Dimmable with touch control.', 159.00, NULL, 22, TRUE, 2, '9312345000009', 'simple', TRUE),

-- Table Lamps
(10, 1010, 'TL-DESK-001', 'LED Desk Lamp - White', 'Modern LED desk lamp with USB charging port. 5 brightness levels.', 89.00, 69.00, 35, TRUE, 2, '9312345000010', 'simple', TRUE),
(11, 1011, 'TL-DESK-002', 'LED Desk Lamp - Black', 'Modern LED desk lamp with USB charging port. 5 brightness levels.', 89.00, NULL, 28, TRUE, 2, '9312345000011', 'simple', TRUE),
(12, 1012, 'TL-CERAMIC-001', 'Ceramic Table Lamp - Blue', 'Handcrafted ceramic table lamp with linen shade.', 149.00, NULL, 14, TRUE, 2, '9312345000012', 'simple', TRUE),
(13, 1013, 'TL-TOUCH-001', 'Touch Bedside Lamp - Gold', 'Elegant touch-activated bedside lamp with gold finish.', 79.00, NULL, 40, TRUE, 2, '9312345000013', 'simple', TRUE),

-- Ceiling Fans
(14, 2001, 'CF-52-001', '52" Ceiling Fan - White', 'Classic 52-inch ceiling fan with 3-speed remote control. Reversible blades.', 249.00, NULL, 20, TRUE, 2, '9312345000014', 'simple', TRUE),
(15, 2002, 'CF-52-002', '52" Ceiling Fan - Black', 'Classic 52-inch ceiling fan with 3-speed remote control. Reversible blades.', 249.00, 219.00, 16, TRUE, 2, '9312345000015', 'simple', TRUE),
(16, 2003, 'CF-56-001', '56" Ceiling Fan with Light', 'Large 56-inch ceiling fan with integrated LED light kit. DC motor.', 399.00, NULL, 10, TRUE, 2, '9312345000016', 'simple', TRUE),
(17, 2004, 'CF-42-001', '42" Ceiling Fan - Compact', 'Compact 42-inch ceiling fan. Perfect for smaller rooms.', 179.00, NULL, 25, TRUE, 2, '9312345000017', 'simple', TRUE),
(18, 2005, 'CF-OUTDOOR-001', 'Outdoor Ceiling Fan - IP44', 'Weather-resistant outdoor ceiling fan with IP44 rating.', 329.00, 289.00, 12, TRUE, 2, '9312345000018', 'simple', TRUE),

-- Outdoor Lighting
(19, 1020, 'OL-WALL-001', 'Outdoor Wall Light - Black', 'Modern outdoor wall light with black aluminum frame. IP65 rated.', 89.00, NULL, 30, TRUE, 2, '9312345000019', 'simple', TRUE),
(20, 1021, 'OL-POST-001', 'Garden Post Light - 90cm', '90cm garden post light with frosted glass diffuser.', 149.00, NULL, 18, TRUE, 2, '9312345000020', 'simple', TRUE),
(21, 1022, 'OL-FLOOD-001', 'LED Floodlight - 30W', '30W LED floodlight with motion sensor. 3000 lumens.', 69.00, 49.00, 50, TRUE, 2, '9312345000021', 'simple', TRUE),
(22, 1023, 'OL-SOLAR-001', 'Solar Path Lights - 6 Pack', 'Set of 6 solar-powered garden path lights.', 59.00, NULL, 35, TRUE, 2, '9312345000022', 'simple', TRUE),

-- Smart Home
(23, 3001, 'SH-BULB-001', 'Smart LED Bulb - E27', 'WiFi smart bulb with RGB and tunable white. Works with Alexa and Google.', 29.00, NULL, 100, TRUE, 2, '9312345000023', 'simple', TRUE),
(24, 3002, 'SH-BULB-002', 'Smart LED Bulb - B22', 'WiFi smart bulb with RGB and tunable white. Works with Alexa and Google.', 29.00, 24.00, 85, TRUE, 2, '9312345000024', 'simple', TRUE),
(25, 3003, 'SH-STRIP-001', 'Smart LED Strip - 5m', '5 meter smart LED strip with music sync. 16 million colors.', 49.00, NULL, 40, TRUE, 2, '9312345000025', 'simple', TRUE),
(26, 3004, 'SH-SWITCH-001', 'Smart Light Switch - Single', 'WiFi smart light switch. No hub required.', 45.00, NULL, 55, TRUE, 2, '9312345000026', 'simple', TRUE),
(27, 3005, 'SH-SWITCH-002', 'Smart Light Switch - Double', 'WiFi smart double light switch. No hub required.', 65.00, 55.00, 42, TRUE, 2, '9312345000027', 'simple', TRUE),

-- Wall Lights
(28, 1030, 'WL-SCONCE-001', 'Wall Sconce - Brass', 'Elegant brass wall sconce with fabric shade.', 119.00, NULL, 20, TRUE, 2, '9312345000028', 'simple', TRUE),
(29, 1031, 'WL-SCONCE-002', 'Wall Sconce - Chrome', 'Modern chrome wall sconce with glass shade.', 99.00, NULL, 24, TRUE, 2, '9312345000029', 'simple', TRUE),
(30, 1032, 'WL-PICTURE-001', 'LED Picture Light - 60cm', '60cm LED picture light with adjustable head.', 89.00, 79.00, 15, TRUE, 2, '9312345000030', 'simple', TRUE);

-- -----------------------------------------------------
-- 6. Product-Category Associations
-- -----------------------------------------------------
INSERT INTO product_categories (product_id, category_id) VALUES
-- Ceiling Lights
(1, 1), (1, 2),
(2, 1), (2, 2),
(3, 1), (3, 2),
(4, 1), (4, 2),
(5, 1), (5, 2),
-- Floor Lamps
(6, 1), (6, 3),
(7, 1), (7, 3),
(8, 1), (8, 3),
(9, 1), (9, 3),
-- Table Lamps
(10, 1), (10, 4),
(11, 1), (11, 4),
(12, 1), (12, 4),
(13, 1), (13, 4),
-- Ceiling Fans
(14, 7), (14, 8),
(15, 7), (15, 8),
(16, 7), (16, 8),
(17, 7), (17, 8),
(18, 7), (18, 9),
-- Outdoor Lighting
(19, 1), (19, 6),
(20, 1), (20, 6),
(21, 1), (21, 6),
(22, 1), (22, 6),
-- Smart Home
(23, 11), (23, 12),
(24, 11), (24, 12),
(25, 11), (25, 12),
(26, 11), (26, 13),
(27, 11), (27, 13),
-- Wall Lights
(28, 1), (28, 5),
(29, 1), (29, 5),
(30, 1), (30, 5);

-- -----------------------------------------------------
-- 7. Customers
-- -----------------------------------------------------
INSERT INTO customers (id, magento_id, email, first_name, last_name, phone, mobile, company, billing_street, billing_city, billing_state, billing_postcode, sync_status) VALUES
(1, 5001, 'john.customer@email.com', 'John', 'Williams', '02 9876 5432', '0412 345 678', NULL, '123 Main Street', 'Sydney', 'NSW', '2000', 'synced'),
(2, 5002, 'sarah.builder@email.com', 'Sarah', 'Johnson', '02 9765 4321', '0423 456 789', 'Johnson Constructions', '45 Builder Lane', 'Parramatta', 'NSW', '2150', 'synced'),
(3, 5003, 'mike.designer@email.com', 'Michael', 'Brown', NULL, '0434 567 890', 'MB Interior Design', '78 Design Ave', 'Bondi', 'NSW', '2026', 'synced'),
(4, NULL, 'lisa.walkin@email.com', 'Lisa', 'Davis', '02 8765 4321', '0445 678 901', NULL, '22 Residential St', 'Chatswood', 'NSW', '2067', 'pending'),
(5, 5004, 'peter.electrician@email.com', 'Peter', 'Wilson', NULL, '0456 789 012', 'Spark Electrical Services', '99 Trade Road', 'Alexandria', 'NSW', '2015', 'synced');

-- -----------------------------------------------------
-- 8. Settings
-- -----------------------------------------------------
INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
('store_name', 'Australian Lighting & Fans', 'string', 'Store display name'),
('store_abn', '12 345 678 901', 'string', 'Australian Business Number'),
('store_address', '123 Lighting Street, Sydney NSW 2000', 'string', 'Store address for receipts'),
('store_phone', '02 1234 5678', 'string', 'Store phone number'),
('store_email', 'sales@auslighting.com.au', 'string', 'Store email'),
('tax_rate', '0.10', 'number', 'GST rate (10%)'),
('quote_expiry_days', '14', 'number', 'Default quote expiry in days'),
('receipt_footer', 'Thank you for shopping at Australian Lighting & Fans!\nAll prices include GST.\nReturns accepted within 30 days with receipt.', 'string', 'Receipt footer text'),
('low_stock_threshold', '5', 'number', 'Low stock warning threshold');

-- -----------------------------------------------------
-- 9. Sample Orders (for testing reports)
-- -----------------------------------------------------
INSERT INTO orders (id, order_number, customer_id, user_id, subtotal, discount_amount, tax_amount, grand_total, tax_rate, status, payment_status, sync_status, created_at) VALUES
(1, 'POS-2024-000001', 1, 3, 378.00, 0, 37.80, 415.80, 0.10, 'complete', 'paid', 'synced', DATE_SUB(NOW(), INTERVAL 7 DAY)),
(2, 'POS-2024-000002', 2, 3, 848.00, 84.80, 76.32, 839.52, 0.10, 'complete', 'paid', 'synced', DATE_SUB(NOW(), INTERVAL 6 DAY)),
(3, 'POS-2024-000003', NULL, 4, 159.00, 15.90, 14.31, 157.41, 0.10, 'complete', 'paid', 'synced', DATE_SUB(NOW(), INTERVAL 5 DAY)),
(4, 'POS-2024-000004', 3, 2, 1198.00, 239.60, 95.84, 1054.24, 0.10, 'complete', 'paid', 'synced', DATE_SUB(NOW(), INTERVAL 4 DAY)),
(5, 'POS-2024-000005', 4, 3, 249.00, 0, 24.90, 273.90, 0.10, 'complete', 'paid', 'pending', DATE_SUB(NOW(), INTERVAL 2 DAY));

INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total) VALUES
(1, 1, 'CL-PEND-001', 'Modern Pendant Light - Black', 2, 189.00, 0, 0, 37.80, 415.80),
(2, 3, 'CL-CHAN-001', 'Crystal Chandelier - 6 Arm', 1, 599.00, 10, 59.90, 53.91, 593.01),
(2, 5, 'CL-FLUSH-001', 'LED Flush Mount - Round', 2, 79.00, 10, 15.80, 14.22, 156.42),
(2, 23, 'SH-BULB-001', 'Smart LED Bulb - E27', 3, 29.00, 10, 8.70, 7.83, 86.13),
(3, 2, 'CL-PEND-002', 'Modern Pendant Light - White', 1, 159.00, 10, 15.90, 14.31, 157.41),
(4, 4, 'CL-CHAN-002', 'Crystal Chandelier - 8 Arm', 1, 749.00, 20, 149.80, 59.92, 659.12),
(4, 6, 'FL-ARC-001', 'Arc Floor Lamp - Brass', 1, 349.00, 20, 69.80, 27.92, 307.12),
(4, 13, 'TL-TOUCH-001', 'Touch Bedside Lamp - Gold', 1, 79.00, 20, 15.80, 6.32, 69.52),
(5, 14, 'CF-52-001', '52" Ceiling Fan - White', 1, 249.00, 0, 0, 24.90, 273.90);

INSERT INTO payments (order_id, user_id, method, amount, reference, amount_tendered, change_given, status) VALUES
(1, 3, 'eftpos', 415.80, 'TXN001234', NULL, NULL, 'completed'),
(2, 3, 'eftpos', 839.52, 'TXN001235', NULL, NULL, 'completed'),
(3, 4, 'cash', 157.41, NULL, 160.00, 2.59, 'completed'),
(4, 2, 'eftpos', 1054.24, 'TXN001236', NULL, NULL, 'completed'),
(5, 3, 'cash', 273.90, NULL, 300.00, 26.10, 'completed');

-- -----------------------------------------------------
-- 10. Sample Quotes
-- -----------------------------------------------------
INSERT INTO quotes (id, quote_number, customer_id, user_id, subtotal, discount_amount, tax_amount, grand_total, status, expires_at, hold_stock, notes) VALUES
(1, 'QT-2024-000001', 2, 3, 1647.00, 164.70, 148.23, 1630.53, 'open', DATE_ADD(NOW(), INTERVAL 14 DAY), FALSE, 'Customer comparing with competitor quote'),
(2, 'QT-2024-000002', 5, 2, 498.00, 99.60, 39.84, 438.24, 'open', DATE_ADD(NOW(), INTERVAL 7 DAY), FALSE, 'Bulk order for renovation project'),
(3, 'QT-2024-000003', 3, 4, 229.00, 0, 22.90, 251.90, 'expired', DATE_SUB(NOW(), INTERVAL 3 DAY), FALSE, NULL);

INSERT INTO quote_items (quote_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total) VALUES
(1, 4, 'CL-CHAN-002', 'Crystal Chandelier - 8 Arm', 1, 749.00, 10, 74.90, 67.41, 741.51),
(1, 6, 'FL-ARC-001', 'Arc Floor Lamp - Brass', 2, 349.00, 10, 69.80, 62.82, 691.02),
(1, 28, 'WL-SCONCE-001', 'Wall Sconce - Brass', 2, 119.00, 10, 23.80, 21.42, 235.62),
(2, 14, 'CF-52-001', '52" Ceiling Fan - White', 2, 249.00, 20, 99.60, 39.84, 438.24),
(3, 8, 'FL-TRIPOD-001', 'Tripod Floor Lamp - Wood', 1, 229.00, 0, 0, 22.90, 251.90);

-- -----------------------------------------------------
-- 11. Sample Inquiries
-- -----------------------------------------------------
INSERT INTO inquiries (id, customer_id, user_id, type, subject, description, contact_name, contact_phone, status, follow_up_date) VALUES
(1, NULL, 3, 'phone_call', 'Ceiling fan installation query', 'Customer called asking about installation services for ceiling fans. Interested in 3 x 52" fans for new home.', 'David Thompson', '0467 890 123', 'new', DATE_ADD(NOW(), INTERVAL 2 DAY)),
(2, 2, 4, 'walk_in', 'Commercial lighting project', 'Builder came in to discuss lighting for new apartment complex. Need quote for 50+ units.', NULL, NULL, 'in_progress', DATE_ADD(NOW(), INTERVAL 1 DAY)),
(3, NULL, 3, 'phone_call', 'Smart home setup advice', 'Customer wants advice on converting to smart lighting throughout home.', 'Emma Clark', '0478 901 234', 'resolved', NULL);

-- -----------------------------------------------------
-- 12. Discount Audit Log (sample entries)
-- -----------------------------------------------------
INSERT INTO discount_audit_log (order_id, order_item_id, user_id, user_role, discount_type, discount_percent, discount_amount, original_amount, final_amount, is_stacked, was_rejected, created_at) VALUES
(2, 2, 3, 'sales_staff', 'product', 10.00, 59.90, 599.00, 539.10, FALSE, FALSE, DATE_SUB(NOW(), INTERVAL 6 DAY)),
(2, 3, 3, 'sales_staff', 'product', 10.00, 15.80, 158.00, 142.20, FALSE, FALSE, DATE_SUB(NOW(), INTERVAL 6 DAY)),
(4, 6, 2, 'manager', 'product', 20.00, 149.80, 749.00, 599.20, FALSE, FALSE, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(4, 7, 2, 'manager', 'product', 20.00, 69.80, 349.00, 279.20, TRUE, FALSE, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(NULL, NULL, 3, 'sales_staff', 'product', 15.00, 0, 0, 0, FALSE, TRUE, DATE_SUB(NOW(), INTERVAL 3 DAY));

-- Set the last entry's rejection reason
UPDATE discount_audit_log SET rejection_reason = 'EXCEEDS_ROLE_LIMIT' WHERE was_rejected = TRUE;

-- -----------------------------------------------------
-- Done!
-- -----------------------------------------------------
SELECT 'Seed data loaded successfully!' AS status;
SELECT CONCAT(COUNT(*), ' products') AS products FROM products;
SELECT CONCAT(COUNT(*), ' customers') AS customers FROM customers;
SELECT CONCAT(COUNT(*), ' users') AS users FROM users;
SELECT CONCAT(COUNT(*), ' orders') AS orders FROM orders;
