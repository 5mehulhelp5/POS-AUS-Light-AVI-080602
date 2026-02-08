-- Comprehensive test data for POS system
-- Run this after the initial setup

-- Insert more customers (20 total, we already have 5)
INSERT INTO customers (magento_id, email, first_name, last_name, phone, mobile, company, billing_street, billing_city, billing_state, billing_postcode, sync_status) VALUES
(1006, 'david.wilson@email.com', 'David', 'Wilson', '02 9876 5432', '0412 345 678', 'Wilson Electrical', '123 King St', 'Sydney', 'NSW', '2000', 'synced'),
(1007, 'emma.taylor@email.com', 'Emma', 'Taylor', '03 8765 4321', '0423 456 789', NULL, '456 Queen St', 'Melbourne', 'VIC', '3000', 'synced'),
(1008, 'james.anderson@email.com', 'James', 'Anderson', '07 3456 7890', '0434 567 890', 'Anderson Homes', '789 George St', 'Brisbane', 'QLD', '4000', 'synced'),
(1009, 'olivia.martin@email.com', 'Olivia', 'Martin', '08 9012 3456', '0445 678 901', NULL, '321 Adelaide Tce', 'Perth', 'WA', '6000', 'synced'),
(1010, 'william.thompson@email.com', 'William', 'Thompson', '02 8765 4321', '0456 789 012', 'Thompson Builders', '654 Pitt St', 'Sydney', 'NSW', '2000', 'synced'),
(1011, 'sophia.garcia@email.com', 'Sophia', 'Garcia', '03 9876 5432', '0467 890 123', NULL, '987 Collins St', 'Melbourne', 'VIC', '3000', 'synced'),
(1012, 'benjamin.lee@email.com', 'Benjamin', 'Lee', '07 8765 4321', '0478 901 234', 'Lee Interiors', '147 Edward St', 'Brisbane', 'QLD', '4000', 'synced'),
(1013, 'isabella.white@email.com', 'Isabella', 'White', '08 7654 3210', '0489 012 345', NULL, '258 Hay St', 'Perth', 'WA', '6000', 'synced'),
(1014, 'mason.harris@email.com', 'Mason', 'Harris', '02 6543 2109', '0490 123 456', 'Harris Renovations', '369 Oxford St', 'Sydney', 'NSW', '2010', 'synced'),
(1015, 'mia.clark@email.com', 'Mia', 'Clark', '03 5432 1098', '0401 234 567', NULL, '741 Chapel St', 'Melbourne', 'VIC', '3141', 'synced'),
(1016, 'ethan.lewis@email.com', 'Ethan', 'Lewis', '07 4321 0987', '0412 345 678', 'Lewis Construction', '852 Ann St', 'Brisbane', 'QLD', '4000', 'synced'),
(1017, 'ava.walker@email.com', 'Ava', 'Walker', '08 3210 9876', '0423 456 789', NULL, '963 Murray St', 'Perth', 'WA', '6000', 'synced'),
(1018, 'liam.hall@email.com', 'Liam', 'Hall', '02 2109 8765', '0434 567 890', 'Hall & Associates', '159 George St', 'Sydney', 'NSW', '2000', 'synced'),
(1019, 'charlotte.allen@email.com', 'Charlotte', 'Allen', '03 1098 7654', '0445 678 901', NULL, '267 Bourke St', 'Melbourne', 'VIC', '3000', 'synced'),
(1020, 'noah.young@email.com', 'Noah', 'Young', '07 0987 6543', '0456 789 012', 'Young Designs', '378 Albert St', 'Brisbane', 'QLD', '4000', 'synced');

-- Insert 5 orders with items and payments
INSERT INTO orders (order_number, customer_id, user_id, subtotal, discount_amount, tax_amount, grand_total, tax_rate, status, payment_status, sync_status, notes, created_at) VALUES
('POS-2025-000001', 1, 3, 438.0000, 0.0000, 43.8000, 481.8000, 0.1000, 'complete', 'paid', 'synced', 'Walk-in customer purchase', '2025-12-30 09:15:00'),
('POS-2025-000002', 2, 4, 1098.0000, 109.8000, 98.8200, 1086.8200, 0.1000, 'complete', 'paid', 'synced', 'Business customer - bulk order', '2025-12-30 10:30:00'),
('POS-2025-000003', 6, 3, 627.0000, 31.3500, 59.5650, 655.2150, 0.1000, 'complete', 'paid', 'synced', NULL, '2025-12-30 14:00:00'),
('POS-2025-000004', NULL, 4, 268.0000, 0.0000, 26.8000, 294.8000, 0.1000, 'complete', 'paid', 'pending', 'Cash sale - no customer details', '2025-12-31 08:45:00'),
('POS-2025-000005', 8, 3, 847.0000, 84.7000, 76.2300, 838.5300, 0.1000, 'complete', 'paid', 'pending', 'Interior designer purchase', '2025-12-31 11:20:00');

-- Order items for Order 1
INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total, cost_price) VALUES
(1, 1, 'CL-PEND-001', 'Modern Pendant Light - Black', 2, 189.0000, 0.00, 0.0000, 37.8000, 415.8000, 95.0000),
(1, 10, 'TL-DESK-001', 'LED Desk Lamp - White', 1, 69.0000, 0.00, 0.0000, 6.9000, 75.9000, 35.0000);

-- Order items for Order 2
INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total, cost_price) VALUES
(2, 3, 'CL-CHAN-001', 'Crystal Chandelier - 6 Arm', 1, 599.0000, 10.00, 59.9000, 53.9100, 593.0100, 300.0000),
(2, 14, 'CF-52-001', '52" Ceiling Fan - White', 2, 249.0000, 10.00, 49.8000, 44.8200, 492.8200, 125.0000);

-- Order items for Order 3
INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total, cost_price) VALUES
(3, 6, 'FL-ARC-001', 'Arc Floor Lamp - Brass', 1, 349.0000, 5.00, 17.4500, 33.1550, 364.7050, 175.0000),
(3, 19, 'OL-WALL-001', 'Outdoor Wall Light - Black', 2, 89.0000, 5.00, 8.9000, 16.9100, 186.0100, 45.0000),
(3, 21, 'OL-FLOOD-001', 'LED Floodlight - 30W', 2, 49.0000, 5.00, 4.9000, 9.3100, 102.4100, 25.0000);

-- Order items for Order 4
INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total, cost_price) VALUES
(4, 2, 'CL-PEND-002', 'Modern Pendant Light - White', 1, 159.0000, 0.00, 0.0000, 15.9000, 174.9000, 80.0000),
(4, 11, 'TL-DESK-002', 'LED Desk Lamp - Black', 1, 89.0000, 0.00, 0.0000, 8.9000, 97.9000, 45.0000);

-- Order items for Order 5
INSERT INTO order_items (order_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total, cost_price) VALUES
(5, 4, 'CL-CHAN-002', 'Crystal Chandelier - 8 Arm', 1, 749.0000, 10.00, 74.9000, 67.4100, 741.5100, 375.0000),
(5, 12, 'TL-CERAMIC-001', 'Ceramic Table Lamp - Blue', 1, 149.0000, 10.00, 14.9000, 13.4100, 147.5100, 75.0000);

-- Payments for all orders
INSERT INTO payments (order_id, user_id, method, amount, reference, amount_tendered, change_given, status, created_at) VALUES
(1, 3, 'eftpos', 481.8000, 'TXN-001234', NULL, NULL, 'completed', '2025-12-30 09:16:00'),
(2, 4, 'eftpos', 1086.8200, 'TXN-001235', NULL, NULL, 'completed', '2025-12-30 10:32:00'),
(3, 3, 'cash', 655.2150, NULL, 700.0000, 44.7850, 'completed', '2025-12-30 14:02:00'),
(4, 4, 'cash', 294.8000, NULL, 300.0000, 5.2000, 'completed', '2025-12-31 08:47:00'),
(5, 3, 'eftpos', 838.5300, 'TXN-001236', NULL, NULL, 'completed', '2025-12-31 11:22:00');

-- Insert 10 quotes
INSERT INTO quotes (quote_number, customer_id, user_id, subtotal, discount_amount, tax_amount, grand_total, status, expires_at, hold_stock, notes, created_at) VALUES
('QT-2025-000001', 7, 3, 1647.0000, 164.7000, 148.2300, 1630.5300, 'open', '2026-01-14 23:59:59', 1, 'Large home renovation project - pending final approval', '2025-12-28 10:00:00'),
('QT-2025-000002', 9, 4, 528.0000, 0.0000, 52.8000, 580.8000, 'open', '2026-01-10 23:59:59', 0, 'Office lighting upgrade', '2025-12-29 11:30:00'),
('QT-2025-000003', 11, 3, 897.0000, 89.7000, 80.7300, 888.0300, 'open', '2026-01-07 23:59:59', 1, 'Retail store fit-out', '2025-12-30 09:00:00'),
('QT-2025-000004', 13, 4, 349.0000, 0.0000, 34.9000, 383.9000, 'converted', '2025-12-31 23:59:59', 0, 'Converted to order #5', '2025-12-25 14:00:00'),
('QT-2025-000005', 15, 3, 1298.0000, 129.8000, 116.8200, 1285.0200, 'open', '2026-01-20 23:59:59', 1, 'Restaurant lighting design', '2025-12-30 16:00:00'),
('QT-2025-000006', 17, 4, 478.0000, 47.8000, 43.0200, 473.2200, 'expired', '2025-12-29 23:59:59', 0, 'Quote expired - customer did not respond', '2025-12-15 10:00:00'),
('QT-2025-000007', 10, 3, 756.0000, 0.0000, 75.6000, 831.6000, 'open', '2026-01-15 23:59:59', 0, 'New home construction', '2025-12-31 08:30:00'),
('QT-2025-000008', 12, 4, 1124.0000, 112.4000, 101.1600, 1112.7600, 'cancelled', '2026-01-05 23:59:59', 0, 'Customer went with competitor', '2025-12-22 13:00:00'),
('QT-2025-000009', 14, 3, 298.0000, 0.0000, 29.8000, 327.8000, 'open', '2026-01-12 23:59:59', 1, 'Bathroom lighting', '2025-12-31 10:15:00'),
('QT-2025-000010', 16, 4, 1876.0000, 187.6000, 168.8400, 1857.2400, 'open', '2026-01-25 23:59:59', 1, 'Commercial office building - 3 floors', '2025-12-31 11:00:00');

-- Quote items for Quote 1
INSERT INTO quote_items (quote_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total) VALUES
(1, 3, 'CL-CHAN-001', 'Crystal Chandelier - 6 Arm', 1, 599.0000, 10.00, 59.9000, 53.9100, 593.0100),
(1, 14, 'CF-52-001', '52" Ceiling Fan - White', 2, 249.0000, 10.00, 49.8000, 44.8200, 492.8200),
(1, 6, 'FL-ARC-001', 'Arc Floor Lamp - Brass', 1, 349.0000, 10.00, 34.9000, 31.4100, 345.5100),
(1, 19, 'OL-WALL-001', 'Outdoor Wall Light - Black', 2, 89.0000, 10.00, 17.8000, 16.0200, 176.2200);

-- Quote items for Quote 2
INSERT INTO quote_items (quote_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total) VALUES
(2, 1, 'CL-PEND-001', 'Modern Pendant Light - Black', 2, 189.0000, 0.00, 0.0000, 37.8000, 415.8000),
(2, 10, 'TL-DESK-001', 'LED Desk Lamp - White', 2, 69.0000, 0.00, 0.0000, 13.8000, 151.8000);

-- Quote items for Quote 3
INSERT INTO quote_items (quote_id, product_id, sku, name, quantity, unit_price, discount_percent, discount_amount, tax_amount, row_total) VALUES
(3, 5, 'CL-FLUSH-001', 'LED Flush Mount - Round', 6, 79.0000, 10.00, 47.4000, 42.6600, 468.2600),
(3, 21, 'OL-FLOOD-001', 'LED Floodlight - 30W', 8, 49.0000, 10.00, 39.2000, 35.2800, 387.8800);

-- Insert 30 inquiries
INSERT INTO inquiries (customer_id, user_id, type, subject, description, contact_name, contact_phone, contact_email, status, follow_up_date, follow_up_notes, created_at) VALUES
(1, 3, 'walk_in', 'Ceiling fan recommendations', 'Customer looking for energy-efficient ceiling fans for 4 bedrooms', 'John Smith', '0412 345 678', 'john@email.com', 'resolved', NULL, 'Recommended CF-52-001, customer purchased 2', '2025-12-20 09:30:00'),
(2, 4, 'phone_call', 'Commercial lighting quote request', 'Need quote for warehouse lighting - 500sqm space', 'Sarah Johnson', '0423 456 789', 'sarah@email.com', 'converted', NULL, 'Converted to Quote QT-2025-000005', '2025-12-21 10:15:00'),
(NULL, 3, 'walk_in', 'Product availability check', 'Looking for crystal chandeliers in gold finish', 'Anonymous', NULL, NULL, 'resolved', NULL, 'Advised stock arriving next week', '2025-12-22 11:00:00'),
(6, 4, 'email', 'Bulk order inquiry', 'Interior design firm needing 20+ pendant lights', 'David Wilson', '0412 345 678', 'david.wilson@email.com', 'in_progress', '2026-01-05', 'Following up after holidays', '2025-12-23 14:30:00'),
(7, 3, 'phone_call', 'Installation services', 'Asking about installation for outdoor lighting', 'Emma Taylor', '0423 456 789', 'emma.taylor@email.com', 'resolved', NULL, 'Referred to partner installer', '2025-12-24 09:00:00'),
(NULL, 4, 'walk_in', 'Return inquiry', 'Faulty LED desk lamp - purchased last week', 'Walk-in Customer', NULL, NULL, 'resolved', NULL, 'Replaced under warranty', '2025-12-26 10:00:00'),
(8, 3, 'email', 'Project consultation', 'New build - 4 bedroom home, need full lighting plan', 'James Anderson', '0434 567 890', 'james.anderson@email.com', 'in_progress', '2026-01-03', 'Site visit scheduled', '2025-12-27 11:30:00'),
(9, 4, 'phone_call', 'Price match request', 'Found pendant light cheaper online', 'Olivia Martin', '0445 678 901', 'olivia.martin@email.com', 'resolved', NULL, 'Price matched - customer purchased', '2025-12-27 14:00:00'),
(10, 3, 'walk_in', 'Smart lighting options', 'Interested in smart home lighting integration', 'William Thompson', '0456 789 012', 'william.thompson@email.com', 'new', '2026-01-02', 'Need to research compatible products', '2025-12-28 09:30:00'),
(NULL, 4, 'phone_call', 'Warranty claim', 'Ceiling fan motor issue - 6 months old', 'Phone Caller', '0467 890 123', NULL, 'in_progress', '2026-01-04', 'Contacting manufacturer', '2025-12-28 11:00:00'),
(11, 3, 'email', 'Restaurant renovation', 'Need ambient lighting for 80-seat restaurant', 'Sophia Garcia', '0467 890 123', 'sophia.garcia@email.com', 'converted', NULL, 'Converted to Quote QT-2025-000003', '2025-12-28 15:00:00'),
(12, 4, 'walk_in', 'Trade account inquiry', 'Electrician wanting to set up trade pricing', 'Benjamin Lee', '0478 901 234', 'benjamin.lee@email.com', 'in_progress', '2026-01-06', 'Application submitted for review', '2025-12-29 09:00:00'),
(13, 3, 'phone_call', 'Delivery question', 'Checking delivery times for regional area', 'Isabella White', '0489 012 345', 'isabella.white@email.com', 'resolved', NULL, 'Confirmed 5-7 business days', '2025-12-29 10:30:00'),
(NULL, 4, 'walk_in', 'Product comparison', 'Comparing different ceiling fan brands', 'Walk-in Customer', NULL, NULL, 'resolved', NULL, 'Provided comparison sheet', '2025-12-29 14:00:00'),
(14, 3, 'email', 'Bathroom lighting advice', 'IP rated lights for bathroom renovation', 'Mason Harris', '0490 123 456', 'mason.harris@email.com', 'converted', NULL, 'Converted to Quote QT-2025-000009', '2025-12-29 16:00:00'),
(15, 4, 'phone_call', 'Stock availability', 'Checking stock for large order', 'Mia Clark', '0401 234 567', 'mia.clark@email.com', 'resolved', NULL, 'Reserved stock for 48 hours', '2025-12-30 08:30:00'),
(16, 3, 'walk_in', 'Showroom visit', 'Architect bringing client to view products', 'Ethan Lewis', '0412 345 678', 'ethan.lewis@email.com', 'resolved', NULL, 'Successful showroom visit', '2025-12-30 10:00:00'),
(NULL, 4, 'email', 'Catalogue request', 'Requesting product catalogue PDF', 'Unknown', NULL, 'info@company.com', 'resolved', NULL, 'Sent digital catalogue', '2025-12-30 11:00:00'),
(17, 3, 'phone_call', 'Special order', 'Custom pendant light in specific color', 'Ava Walker', '0423 456 789', 'ava.walker@email.com', 'in_progress', '2026-01-10', 'Checking with supplier', '2025-12-30 13:00:00'),
(18, 4, 'walk_in', 'Replacement parts', 'Need replacement glass shade for floor lamp', 'Liam Hall', '0434 567 890', 'liam.hall@email.com', 'resolved', NULL, 'Part ordered - arriving in 3 days', '2025-12-30 15:00:00'),
(19, 3, 'email', 'Energy efficiency inquiry', 'Looking for most energy-efficient options', 'Charlotte Allen', '0445 678 901', 'charlotte.allen@email.com', 'new', '2026-01-02', 'Preparing efficiency comparison', '2025-12-30 16:30:00'),
(20, 4, 'phone_call', 'Order status', 'Checking on pending order delivery', 'Noah Young', '0456 789 012', 'noah.young@email.com', 'resolved', NULL, 'Confirmed delivery for tomorrow', '2025-12-31 08:00:00'),
(NULL, 3, 'walk_in', 'Gift purchase', 'Looking for gift under $100', 'Walk-in Customer', NULL, NULL, 'resolved', NULL, 'Purchased LED Desk Lamp', '2025-12-31 09:00:00'),
(1, 4, 'phone_call', 'Follow-up purchase', 'Previous customer wanting more fans', 'John Smith', '0412 345 678', 'john@email.com', 'new', '2026-01-03', 'Wants same model for rental property', '2025-12-31 10:00:00'),
(6, 3, 'email', 'Payment plan inquiry', 'Asking about payment options for large order', 'David Wilson', '0412 345 678', 'david.wilson@email.com', 'in_progress', '2026-01-05', 'Reviewing finance options', '2025-12-31 11:00:00'),
(NULL, 4, 'walk_in', 'DIY installation query', 'Questions about self-installation', 'Walk-in Customer', NULL, NULL, 'resolved', NULL, 'Provided installation guide', '2025-12-31 12:00:00'),
(8, 3, 'phone_call', 'Quote revision', 'Requesting changes to existing quote', 'James Anderson', '0434 567 890', 'james.anderson@email.com', 'in_progress', '2026-01-04', 'Updating quote with new selections', '2025-12-31 13:00:00'),
(10, 4, 'email', 'Showroom appointment', 'Booking time to visit showroom', 'William Thompson', '0456 789 012', 'william.thompson@email.com', 'new', '2026-01-06', 'Appointment confirmed for Jan 6', '2025-12-31 14:00:00'),
(NULL, 3, 'walk_in', 'Complaint resolution', 'Unhappy with previous service', 'Walk-in Customer', '0478 901 234', NULL, 'resolved', NULL, 'Issue resolved with store credit', '2025-12-31 15:00:00'),
(12, 4, 'phone_call', 'Project timeline', 'Electrician checking lead times', 'Benjamin Lee', '0478 901 234', 'benjamin.lee@email.com', 'new', '2026-01-07', 'Preparing availability schedule', '2025-12-31 16:00:00');

-- Update converted quote
UPDATE quotes SET converted_order_id = 5 WHERE id = 4;

-- Update converted inquiry
UPDATE inquiries SET converted_quote_id = 5 WHERE id = 2;
UPDATE inquiries SET converted_quote_id = 3 WHERE id = 11;
UPDATE inquiries SET converted_quote_id = 9 WHERE id = 15;

-- Insert discount audit logs for orders with discounts
INSERT INTO discount_audit_log (order_id, order_item_id, user_id, user_role, discount_type, discount_percent, discount_amount, original_amount, final_amount, is_stacked, reason, created_at) VALUES
(2, 3, 4, 'sales_staff', 'product', 10.00, 59.9000, 599.0000, 593.0100, 0, 'Bulk purchase discount', '2025-12-30 10:31:00'),
(2, 4, 4, 'sales_staff', 'product', 10.00, 49.8000, 498.0000, 492.8200, 0, 'Bulk purchase discount', '2025-12-30 10:31:00'),
(3, 5, 3, 'sales_staff', 'product', 5.00, 17.4500, 349.0000, 364.7050, 0, 'Loyal customer', '2025-12-30 14:01:00'),
(3, 6, 3, 'sales_staff', 'product', 5.00, 8.9000, 178.0000, 186.0100, 0, 'Loyal customer', '2025-12-30 14:01:00'),
(3, 7, 3, 'sales_staff', 'product', 5.00, 4.9000, 98.0000, 102.4100, 0, 'Loyal customer', '2025-12-30 14:01:00'),
(5, 8, 3, 'sales_staff', 'product', 10.00, 74.9000, 749.0000, 741.5100, 0, 'Trade pricing', '2025-12-31 11:21:00'),
(5, 9, 3, 'sales_staff', 'product', 10.00, 14.9000, 149.0000, 147.5100, 0, 'Trade pricing', '2025-12-31 11:21:00');

-- Insert some activity logs
INSERT INTO activity_logs (user_id, action, entity_type, entity_id, description, created_at) VALUES
(1, 'login', 'user', 1, 'Admin logged in via PIN', '2025-12-30 08:00:00'),
(3, 'login', 'user', 3, 'Sales staff logged in via PIN', '2025-12-30 08:30:00'),
(4, 'login', 'user', 4, 'Sales staff logged in via PIN', '2025-12-30 08:45:00'),
(3, 'create_order', 'order', 1, 'Created order POS-2025-000001', '2025-12-30 09:15:00'),
(4, 'create_order', 'order', 2, 'Created order POS-2025-000002', '2025-12-30 10:30:00'),
(3, 'create_order', 'order', 3, 'Created order POS-2025-000003', '2025-12-30 14:00:00'),
(3, 'create_quote', 'quote', 1, 'Created quote QT-2025-000001', '2025-12-28 10:00:00'),
(4, 'create_quote', 'quote', 2, 'Created quote QT-2025-000002', '2025-12-29 11:30:00'),
(1, 'update_settings', 'settings', NULL, 'Updated tax rate settings', '2025-12-29 09:00:00'),
(2, 'approve_discount', 'order', 2, 'Approved 10% discount for bulk order', '2025-12-30 10:29:00');

SELECT 'Test data inserted successfully!' as result;
SELECT COUNT(*) as total_customers FROM customers;
SELECT COUNT(*) as total_orders FROM orders;
SELECT COUNT(*) as total_quotes FROM quotes;
SELECT COUNT(*) as total_inquiries FROM inquiries;
