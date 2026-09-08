import { getEnv } from '../config/env';
import { getPool, query, queryOne } from './index';
import { hashPassword } from '../utils/password';
import { Role } from '@kob/core';
import { logger } from '../config/logger';

interface SeedCategory {
  name: string;
  slug: string;
  description: string;
  sortOrder: number;
}

interface SeedProduct {
  categorySlug: string;
  name: string;
  slug: string;
  description: string;
  priceMinor: number; // kobo — ₦4,500.00 = 450000
  imageUrl: string;
  isFeatured?: boolean;
  sortOrder: number;
}

const CATEGORIES: SeedCategory[] = [
  { name: 'Grills', slug: 'grills', description: 'Fire-kissed specialties from our open charcoal grill.', sortOrder: 1 },
  { name: 'Rice Meals', slug: 'rice-meals', description: 'Comforting rice dishes, smoky and rich.', sortOrder: 2 },
  { name: 'Fish', slug: 'fish', description: 'Fresh fish, grilled to perfection.', sortOrder: 3 },
  { name: 'Chicken', slug: 'chicken', description: 'Juicy chicken, flame-grilled or crispy-fried.', sortOrder: 4 },
  { name: 'Sides', slug: 'sides', description: 'Perfect accompaniments to every meal.', sortOrder: 5 },
  { name: 'Drinks', slug: 'drinks', description: 'Chilled local favourites and refreshments.', sortOrder: 6 },
];

const PRODUCTS: SeedProduct[] = [
  { categorySlug: 'grills', name: 'Suya Beef Skewers', slug: 'suya-beef-skewers', description: 'Prime beef skewers dusted in spicy yaji peanut rub, sliced onions & fresh tomatoes.', priceMinor: 450000, imageUrl: '/images/suya-beef.jpg', isFeatured: true, sortOrder: 1 },
  { categorySlug: 'rice-meals', name: 'Smoky Jollof Rice & Chicken', slug: 'smoky-jollof-rice-chicken', description: 'Party-style smoky jollof rice served with flame-grilled chicken and fried plantain.', priceMinor: 550000, imageUrl: '/images/jollof-rice.jpg', isFeatured: true, sortOrder: 2 },
  { categorySlug: 'fish', name: 'Grilled Tilapia', slug: 'grilled-tilapia', description: 'Whole tilapia grilled over charcoal with lime, grilled peppers and onions.', priceMinor: 650000, imageUrl: '/images/grilled-tilapia.jpg', isFeatured: true, sortOrder: 3 },
  { categorySlug: 'chicken', name: 'Flame-Grilled Half Chicken', slug: 'flame-grilled-half-chicken', description: 'Half chicken with charred golden skin, glazed and served with grilled peppers.', priceMinor: 520000, imageUrl: '/images/grilled-chicken.jpg', isFeatured: true, sortOrder: 4 },
  { categorySlug: 'chicken', name: 'Crispy Fried Chicken', slug: 'crispy-fried-chicken', description: 'Golden, crunchy fried chicken pieces with spicy pepper dip.', priceMinor: 480000, imageUrl: '/images/fried-chicken.jpg', isFeatured: true, sortOrder: 5 },
  { categorySlug: 'sides', name: 'Fried Plantain', slug: 'fried-plantain', description: 'Sweet golden plantain slices, lightly salted.', priceMinor: 150000, imageUrl: '/images/fried-plantain.jpg', isFeatured: false, sortOrder: 1 },
  { categorySlug: 'sides', name: 'Peppered Fries', slug: 'peppered-fries', description: 'Crispy fries tossed in our signature pepper spice, served with dip.', priceMinor: 200000, imageUrl: '/images/peppered-fries.jpg', isFeatured: false, sortOrder: 2 },
  { categorySlug: 'drinks', name: 'Chilled Zobo', slug: 'chilled-zobo', description: 'Refreshing hibiscus drink with mint and a twist of lemon.', priceMinor: 120000, imageUrl: '/images/zobo-drink.jpg', isFeatured: true, sortOrder: 1 },
];

async function upsertCategory(cat: SeedCategory): Promise<string> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM product_categories WHERE slug = $1', [cat.slug]);
  if (existing) return existing.id;
  const row = await queryOne<{ id: string }>(
    `INSERT INTO product_categories (name, slug, description, sort_order)
     VALUES ($1,$2,$3,$4) RETURNING id`,
    [cat.name, cat.slug, cat.description, cat.sortOrder],
  );
  return row!.id;
}

async function upsertProduct(prod: SeedProduct, categoryId: string): Promise<void> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM products WHERE slug = $1', [prod.slug]);
  if (existing) {
    await query(
      `UPDATE products SET name=$2, description=$3, price_minor=$4, image_url=$5, is_featured=$6, sort_order=$7, is_available=true
       WHERE id = $1`,
      [existing.id, prod.name, prod.description, prod.priceMinor, prod.imageUrl, prod.isFeatured ?? false, prod.sortOrder],
    );
    return;
  }
  await query(
    `INSERT INTO products (category_id, name, slug, description, price_minor, image_url, is_featured, sort_order)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [categoryId, prod.name, prod.slug, prod.description, prod.priceMinor, prod.imageUrl, prod.isFeatured ?? false, prod.sortOrder],
  );
}

async function seedUser(email: string, name: string, phone: string, password: string, role: Role): Promise<void> {
  const existing = await queryOne<{ id: string }>('SELECT id FROM users WHERE lower(email) = lower($1)', [email]);
  if (existing) {
    await query('UPDATE users SET role = $2, is_active = true WHERE id = $1', [existing.id, role]);
    return;
  }
  await query(
    `INSERT INTO users (email, phone, full_name, password_hash, role) VALUES ($1,$2,$3,$4,$5)`,
    [email.toLowerCase(), phone, name, hashPassword(password), role],
  );
}

async function main(): Promise<void> {
  const env = getEnv();
  logger.info('seeding database...');

  for (const cat of CATEGORIES) {
    const id = await upsertCategory(cat);
    for (const prod of PRODUCTS.filter((p) => p.categorySlug === cat.slug)) {
      await upsertProduct(prod, id);
    }
  }

  await seedUser(
    env.SEED_STAFF_EMAIL,
    'Amina Operations',
    '+2348000000001',
    env.SEED_STAFF_PASSWORD,
    Role.MANAGER,
  );
  await seedUser(
    env.SEED_CUSTOMER_EMAIL,
    'Anna Example',
    '+2348000000002',
    env.SEED_CUSTOMER_PASSWORD,
    Role.CUSTOMER,
  );

  logger.info('seed complete');
  await getPool().end();
}

main().catch((err) => {
  logger.error({ err }, 'seed failed');
  process.exit(1);
});
