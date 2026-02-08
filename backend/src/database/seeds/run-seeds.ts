import { DataSource } from 'typeorm';
import * as bcrypt from 'bcrypt';
import * as dotenv from 'dotenv';

dotenv.config();

const dataSource = new DataSource({
  type: 'mysql',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  username: process.env.DB_USERNAME || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_DATABASE || 'pos_aus_light',
  synchronize: false,
  logging: true,
});

async function seed() {
  console.log('🌱 Starting database seed...\n');

  try {
    await dataSource.initialize();
    console.log('✅ Database connected\n');

    const queryRunner = dataSource.createQueryRunner();

    // Generate password hash
    const passwordHash = await bcrypt.hash('password123', 10);
    console.log('Generated password hash for "password123"');

    // Clear existing data (in reverse order of dependencies)
    console.log('\n🗑️  Clearing existing data...');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 0');
    await queryRunner.query('TRUNCATE TABLE discount_audit_log');
    await queryRunner.query('TRUNCATE TABLE activity_logs');
    await queryRunner.query('TRUNCATE TABLE sync_queue');
    await queryRunner.query('TRUNCATE TABLE sync_logs');
    await queryRunner.query('TRUNCATE TABLE payments');
    await queryRunner.query('TRUNCATE TABLE order_items');
    await queryRunner.query('TRUNCATE TABLE orders');
    await queryRunner.query('TRUNCATE TABLE quote_items');
    await queryRunner.query('TRUNCATE TABLE quotes');
    await queryRunner.query('TRUNCATE TABLE inquiries');
    await queryRunner.query('TRUNCATE TABLE product_categories');
    await queryRunner.query('TRUNCATE TABLE product_attributes');
    await queryRunner.query('TRUNCATE TABLE products');
    await queryRunner.query('TRUNCATE TABLE categories');
    await queryRunner.query('TRUNCATE TABLE customers');
    await queryRunner.query('TRUNCATE TABLE user_sessions');
    await queryRunner.query('TRUNCATE TABLE permissions');
    await queryRunner.query('TRUNCATE TABLE users');
    await queryRunner.query('TRUNCATE TABLE roles');
    await queryRunner.query('TRUNCATE TABLE settings');
    await queryRunner.query('SET FOREIGN_KEY_CHECKS = 1');
    console.log('✅ Tables cleared\n');

    // 1. Roles
    console.log('📝 Seeding roles...');
    await queryRunner.query(`
      INSERT INTO roles (id, name, display_name, max_discount_percent, can_stack_discounts) VALUES
      (1, 'sales_staff', 'Sales Staff', 10.00, FALSE),
      (2, 'manager', 'Manager', 20.00, TRUE),
      (3, 'admin', 'Admin', 100.00, TRUE)
    `);
    console.log('✅ Roles created\n');

    // 2. Users
    console.log('📝 Seeding users...');
    await queryRunner.query(`
      INSERT INTO users (id, role_id, email, password_hash, pin_code, first_name, last_name, is_active) VALUES
      (1, 3, 'admin@auslighting.com.au', '${passwordHash}', '1111', 'Store', 'Admin', TRUE),
      (2, 2, 'manager@auslighting.com.au', '${passwordHash}', '2222', 'Sarah', 'Manager', TRUE),
      (3, 1, 'john@auslighting.com.au', '${passwordHash}', '3333', 'John', 'Smith', TRUE),
      (4, 1, 'jane@auslighting.com.au', '${passwordHash}', '4444', 'Jane', 'Doe', TRUE)
    `);
    console.log('✅ Users created\n');

    // 3. Categories
    console.log('📝 Seeding categories...');
    await queryRunner.query(`
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
      (13, 32, 11, 'Smart Switches', '11/13', 1, TRUE)
    `);
    console.log('✅ Categories created\n');

    // 4. Products
    console.log('📝 Seeding products...');
    await queryRunner.query(`
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
      (30, 1032, 'WL-PICTURE-001', 'LED Picture Light - 60cm', '60cm LED picture light.', 89.00, 79.00, 15, TRUE, 2, '9312345000030', 'simple', TRUE)
    `);
    console.log('✅ Products created\n');

    // 5. Product-Category associations
    console.log('📝 Seeding product categories...');
    await queryRunner.query(`
      INSERT INTO product_categories (product_id, category_id) VALUES
      (1, 1), (1, 2), (2, 1), (2, 2), (3, 1), (3, 2), (4, 1), (4, 2), (5, 1), (5, 2),
      (6, 1), (6, 3), (7, 1), (7, 3), (8, 1), (8, 3), (9, 1), (9, 3),
      (10, 1), (10, 4), (11, 1), (11, 4), (12, 1), (12, 4), (13, 1), (13, 4),
      (14, 7), (14, 8), (15, 7), (15, 8), (16, 7), (16, 8), (17, 7), (17, 8), (18, 7), (18, 9),
      (19, 1), (19, 6), (20, 1), (20, 6), (21, 1), (21, 6), (22, 1), (22, 6),
      (23, 11), (23, 12), (24, 11), (24, 12), (25, 11), (25, 12), (26, 11), (26, 13), (27, 11), (27, 13),
      (28, 1), (28, 5), (29, 1), (29, 5), (30, 1), (30, 5)
    `);
    console.log('✅ Product categories linked\n');

    // 6. Customers
    console.log('📝 Seeding customers...');
    await queryRunner.query(`
      INSERT INTO customers (id, magento_id, email, first_name, last_name, phone, mobile, company, billing_street, billing_city, billing_state, billing_postcode, sync_status) VALUES
      (1, 5001, 'john.customer@email.com', 'John', 'Williams', '02 9876 5432', '0412 345 678', NULL, '123 Main Street', 'Sydney', 'NSW', '2000', 'synced'),
      (2, 5002, 'sarah.builder@email.com', 'Sarah', 'Johnson', '02 9765 4321', '0423 456 789', 'Johnson Constructions', '45 Builder Lane', 'Parramatta', 'NSW', '2150', 'synced'),
      (3, 5003, 'mike.designer@email.com', 'Michael', 'Brown', NULL, '0434 567 890', 'MB Interior Design', '78 Design Ave', 'Bondi', 'NSW', '2026', 'synced'),
      (4, NULL, 'lisa.walkin@email.com', 'Lisa', 'Davis', '02 8765 4321', '0445 678 901', NULL, '22 Residential St', 'Chatswood', 'NSW', '2067', 'pending'),
      (5, 5004, 'peter.electrician@email.com', 'Peter', 'Wilson', NULL, '0456 789 012', 'Spark Electrical Services', '99 Trade Road', 'Alexandria', 'NSW', '2015', 'synced')
    `);
    console.log('✅ Customers created\n');

    // 7. Settings
    console.log('📝 Seeding settings...');
    await queryRunner.query(`
      INSERT INTO settings (setting_key, setting_value, setting_type, description) VALUES
      ('store_name', 'Australian Lighting & Fans', 'string', 'Store display name'),
      ('store_abn', '12 345 678 901', 'string', 'Australian Business Number'),
      ('store_address', '123 Lighting Street, Sydney NSW 2000', 'string', 'Store address'),
      ('store_phone', '02 1234 5678', 'string', 'Store phone number'),
      ('tax_rate', '0.10', 'number', 'GST rate (10%)'),
      ('quote_expiry_days', '14', 'number', 'Default quote expiry in days')
    `);
    console.log('✅ Settings created\n');

    console.log('════════════════════════════════════════════');
    console.log('🎉 Seed completed successfully!');
    console.log('════════════════════════════════════════════\n');
    console.log('Test Credentials:');
    console.log('─────────────────────────────────────────────');
    console.log('Admin:    admin@auslighting.com.au / password123 (PIN: 1111)');
    console.log('Manager:  manager@auslighting.com.au / password123 (PIN: 2222)');
    console.log('Staff:    john@auslighting.com.au / password123 (PIN: 3333)');
    console.log('Staff:    jane@auslighting.com.au / password123 (PIN: 4444)');
    console.log('─────────────────────────────────────────────\n');

    await dataSource.destroy();
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  }
}

seed();
