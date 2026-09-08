/* eslint-disable */
/**
 * Phase 1 initial schema — King of Barbecue.
 *
 * Design notes:
 * - TEXT columns + CHECK constraints instead of native PG enums: adding a
 *   status/role later is an additive migration (no ALTER TYPE dance).
 * - All money is integer minor units (kobo).
 * - Append-oriented history tables (order_status_history,
 *   payment_status_history) preserve the full timeline for analytics/AI.
 * - Branch/org-scope columns are deliberately NOT added yet — they arrive
 *   with the multi-branch module via additive migrations.
 */

exports.up = (pgm) => {
  // ---------- users ----------
  pgm.createTable('users', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    email: { type: 'text', notNull: true },
    phone: { type: 'text' },
    full_name: { type: 'text', notNull: true },
    password_hash: { type: 'text', notNull: true },
    role: {
      type: 'text',
      notNull: true,
      default: 'CUSTOMER',
      check:
        "role IN ('CUSTOMER','CASHIER','OPERATIONS_STAFF','MANAGER','OWNER','SUPPLIER','INVENTORY_STAFF','KITCHEN_STAFF','LOGISTICS','DELIVERY_PARTNER','ADMIN')",
    },
    is_active: { type: 'boolean', notNull: true, default: true },
    last_login_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('users', [{ name: 'lower(email)' }], { unique: true, name: 'uq_users_email_lower' });
  pgm.createIndex('users', ['phone']);
  pgm.createIndex('users', ['role']);

  // ---------- product categories ----------
  pgm.createTable('product_categories', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'text', notNull: true },
    slug: { type: 'text', notNull: true, unique: true },
    description: { type: 'text' },
    image_url: { type: 'text' },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    is_active: { type: 'boolean', notNull: true, default: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // ---------- products ----------
  pgm.createTable('products', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    category_id: {
      type: 'uuid',
      notNull: true,
      references: 'product_categories',
      onDelete: 'RESTRICT',
    },
    name: { type: 'text', notNull: true },
    slug: { type: 'text', notNull: true, unique: true },
    description: { type: 'text' },
    price_minor: { type: 'integer', notNull: true, check: 'price_minor >= 0' },
    image_url: { type: 'text' },
    is_available: { type: 'boolean', notNull: true, default: true },
    is_featured: { type: 'boolean', notNull: true, default: false },
    sort_order: { type: 'integer', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('products', ['category_id']);
  pgm.createIndex('products', ['is_available', 'is_featured']);
  pgm.createIndex('products', ['sort_order']);

  // ---------- orders ----------
  pgm.createTable('orders', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    public_code: { type: 'text', notNull: true, unique: true },
    idempotency_key: { type: 'text', unique: true },
    user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    guest_name: { type: 'text', notNull: true },
    guest_email: { type: 'text', notNull: true },
    guest_phone: { type: 'text', notNull: true },
    fulfillment_method: {
      type: 'text',
      notNull: true,
      check: "fulfillment_method IN ('PICKUP','DELIVERY')",
    },
    delivery_address: { type: 'text' },
    delivery_area: { type: 'text' },
    delivery_instructions: { type: 'text' },
    special_instructions: { type: 'text' },
    subtotal_minor: { type: 'integer', notNull: true, check: 'subtotal_minor >= 0' },
    delivery_fee_minor: { type: 'integer', notNull: true, default: 0, check: 'delivery_fee_minor >= 0' },
    total_minor: { type: 'integer', notNull: true, check: 'total_minor >= 0' },
    currency: { type: 'text', notNull: true, default: 'NGN' },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check:
        "status IN ('PENDING','APPROVED','IN_PREPARATION','READY','OUT_FOR_DELIVERY','COMPLETED','REJECTED','FAILED','CANCELLED')",
    },
    payment_status: {
      type: 'text',
      notNull: true,
      default: 'UNPAID',
      check:
        "payment_status IN ('UNPAID','PENDING','PAID','FAILED','REFUNDED','CASH_ON_DELIVERY')",
    },
    rejection_reason_code: { type: 'text' },
    rejection_note: { type: 'text' },
    cancelled_at: { type: 'timestamptz' },
    completed_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  // Indexes supporting real query patterns:
  pgm.createIndex('orders', ['created_at']); // ordering lists / analytics time windows
  pgm.createIndex('orders', ['status', 'created_at']); // ops board columns
  pgm.createIndex('orders', ['payment_status']);
  pgm.createIndex('orders', ['fulfillment_method']);
  pgm.createIndex('orders', ['user_id', 'created_at']); // customer dashboard
  pgm.createIndex('orders', [{ name: 'lower(guest_email)' }]); // guest linking
  pgm.createIndex('orders', ['guest_phone']);

  // ---------- order items (price snapshots) ----------
  pgm.createTable('order_items', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    product_id: { type: 'uuid', references: 'products', onDelete: 'SET NULL' },
    name: { type: 'text', notNull: true },
    unit_price_minor: { type: 'integer', notNull: true, check: 'unit_price_minor >= 0' },
    quantity: { type: 'integer', notNull: true, check: 'quantity > 0' },
    instructions: { type: 'text', notNull: true, default: '' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('order_items', ['order_id']);
  pgm.createIndex('order_items', ['product_id']);

  // ---------- order status history (append-only) ----------
  pgm.createTable('order_status_history', {
    id: { type: 'bigserial', primaryKey: true },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    from_status: { type: 'text' },
    to_status: {
      type: 'text',
      notNull: true,
      check:
        "to_status IN ('PENDING','APPROVED','IN_PREPARATION','READY','OUT_FOR_DELIVERY','COMPLETED','REJECTED','FAILED','CANCELLED')",
    },
    actor_type: {
      type: 'text',
      notNull: true,
      default: 'SYSTEM',
      check: "actor_type IN ('SYSTEM','STAFF','CUSTOMER')",
    },
    actor_user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    actor_role: { type: 'text' },
    reason_code: { type: 'text' },
    note: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('order_status_history', ['order_id', 'created_at']);
  pgm.createIndex('order_status_history', ['to_status', 'created_at']);

  // ---------- payments ----------
  pgm.createTable('payments', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    order_id: { type: 'uuid', notNull: true, references: 'orders', onDelete: 'CASCADE' },
    method: {
      type: 'text',
      notNull: true,
      check: "method IN ('MANUAL','CASH_ON_DELIVERY','GATEWAY')",
    },
    status: {
      type: 'text',
      notNull: true,
      default: 'UNPAID',
      check: "status IN ('UNPAID','PENDING','PAID','FAILED','REFUNDED','CASH_ON_DELIVERY')",
    },
    amount_minor: { type: 'integer', notNull: true, check: 'amount_minor >= 0' },
    currency: { type: 'text', notNull: true, default: 'NGN' },
    paid_at: { type: 'timestamptz' },
    external_ref: { type: 'text' },
    idempotency_key: { type: 'text', unique: true },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('payments', ['order_id']);
  pgm.createIndex('payments', ['status']);

  // ---------- payment status history (append-only) ----------
  pgm.createTable('payment_status_history', {
    id: { type: 'bigserial', primaryKey: true },
    payment_id: { type: 'uuid', notNull: true, references: 'payments', onDelete: 'CASCADE' },
    from_status: { type: 'text' },
    to_status: { type: 'text', notNull: true },
    actor_type: { type: 'text', notNull: true, default: 'SYSTEM' },
    actor_user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    actor_role: { type: 'text' },
    note: { type: 'text' },
    metadata: { type: 'jsonb', notNull: true, default: '{}' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });
  pgm.createIndex('payment_status_history', ['payment_id', 'created_at']);

  // ---------- store settings (singleton row) ----------
  pgm.createTable('store_settings', {
    id: { type: 'smallint', primaryKey: true, default: 1, check: 'id = 1' },
    is_paused: { type: 'boolean', notNull: true, default: false },
    paused_at: { type: 'timestamptz' },
    paused_by_user_id: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    pause_reason: { type: 'text' },
    pause_note: { type: 'text' },
    restaurant_name: { type: 'text', notNull: true, default: 'King of Barbecue' },
    phone: { type: 'text' },
    address: { type: 'text' },
    opening_hours: { type: 'jsonb', notNull: true, default: '{}' },
    socials: { type: 'jsonb', notNull: true, default: '{}' },
    delivery_fee_minor: { type: 'integer', notNull: true, default: 0, check: 'delivery_fee_minor >= 0' },
    // Extensible config: SLA thresholds, area fees, branding, later branches.
    config: { type: 'jsonb', notNull: true, default: '{}' },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  // ---------- outbox (transactional outbox for notifications) ----------
  pgm.createTable('outbox_messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    type: { type: 'text', notNull: true },
    recipient: { type: 'text', notNull: true },
    subject: { type: 'text', notNull: true },
    body: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    status: {
      type: 'text',
      notNull: true,
      default: 'PENDING',
      check: "status IN ('PENDING','SENT','FAILED')",
    },
    attempts: { type: 'integer', notNull: true, default: 0 },
    next_retry_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    last_error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    processed_at: { type: 'timestamptz' },
  });
  pgm.createIndex('outbox_messages', ['status', 'next_retry_at']);

  // ---------- webhook events (idempotency + audit) ----------
  pgm.createTable('webhook_events', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    provider: { type: 'text', notNull: true },
    event_id: { type: 'text', notNull: true },
    payload: { type: 'jsonb', notNull: true, default: '{}' },
    status: {
      type: 'text',
      notNull: true,
      default: 'RECEIVED',
      check: "status IN ('RECEIVED','PROCESSED','FAILED','IGNORED')",
    },
    error: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    processed_at: { type: 'timestamptz' },
  });
  pgm.createIndex('webhook_events', ['provider', 'event_id'], { unique: true });
  pgm.createIndex('webhook_events', ['status', 'created_at']);

  // ---------- updated_at trigger ----------
  pgm.sql(`
    CREATE OR REPLACE FUNCTION set_updated_at() RETURNS trigger AS $$
    BEGIN
      NEW.updated_at = now();
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;

    CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER products_set_updated_at BEFORE UPDATE ON products
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER product_categories_set_updated_at BEFORE UPDATE ON product_categories
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER orders_set_updated_at BEFORE UPDATE ON orders
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER payments_set_updated_at BEFORE UPDATE ON payments
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();
    CREATE TRIGGER store_settings_set_updated_at BEFORE UPDATE ON store_settings
      FOR EACH ROW EXECUTE FUNCTION set_updated_at();

    INSERT INTO store_settings (id) VALUES (1);
  `);
};

exports.down = (pgm) => {
  pgm.dropTable('webhook_events');
  pgm.dropTable('outbox_messages');
  pgm.dropTable('store_settings');
  pgm.dropTable('payment_status_history');
  pgm.dropTable('payments');
  pgm.dropTable('order_status_history');
  pgm.dropTable('order_items');
  pgm.dropTable('orders');
  pgm.dropTable('products');
  pgm.dropTable('product_categories');
  pgm.dropTable('users');
};
