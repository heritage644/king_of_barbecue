import { query, queryOne } from '../db';

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  sort_order: number;
  is_active: boolean;
}

export interface ProductRow {
  id: string;
  category_id: string;
  category_slug?: string;
  category_name?: string;
  name: string;
  slug: string;
  description: string | null;
  price_minor: number;
  image_url: string | null;
  is_available: boolean;
  is_featured: boolean;
  sort_order: number;
}

export async function listCategories(): Promise<CategoryRow[]> {
  return query<CategoryRow>(
    `SELECT id, name, slug, description, image_url, sort_order, is_active
     FROM product_categories
     WHERE is_active = true
     ORDER BY sort_order ASC, name ASC`,
  );
}

export async function listProducts(includeUnavailable = false): Promise<ProductRow[]> {
  const availability = includeUnavailable ? '' : 'AND p.is_available = true';
  return query<ProductRow>(
    `SELECT p.id, p.category_id, c.slug AS category_slug, c.name AS category_name,
            p.name, p.slug, p.description, p.price_minor, p.image_url,
            p.is_available, p.is_featured, p.sort_order
     FROM products p
     JOIN product_categories c ON c.id = p.category_id
     WHERE c.is_active = true ${availability}
     ORDER BY c.sort_order ASC, p.sort_order ASC, p.name ASC`,
  );
}

export async function findFeaturedProducts(limit = 8): Promise<ProductRow[]> {
  return query<ProductRow>(
    `SELECT p.id, p.category_id, c.slug AS category_slug, c.name AS category_name,
            p.name, p.slug, p.description, p.price_minor, p.image_url,
            p.is_available, p.is_featured, p.sort_order
     FROM products p
     JOIN product_categories c ON c.id = p.category_id
     WHERE c.is_active = true AND p.is_available = true AND p.is_featured = true
     ORDER BY p.sort_order ASC, p.name ASC
     LIMIT $1`,
    [limit],
  );
}

export async function findProductBySlug(slug: string): Promise<ProductRow | null> {
  return queryOne<ProductRow>(
    `SELECT p.id, p.category_id, c.slug AS category_slug, c.name AS category_name,
            p.name, p.slug, p.description, p.price_minor, p.image_url,
            p.is_available, p.is_featured, p.sort_order
     FROM products p
     JOIN product_categories c ON c.id = p.category_id
     WHERE p.slug = $1 AND c.is_active = true`,
    [slug],
  );
}

export async function findProductsByIds(ids: string[]): Promise<Map<string, ProductRow>> {
  if (ids.length === 0) return new Map();
  const rows = await query<ProductRow>(
    `SELECT p.id, p.category_id, c.slug AS category_slug, c.name AS category_name,
            p.name, p.slug, p.description, p.price_minor, p.image_url,
            p.is_available, p.is_featured, p.sort_order
     FROM products p
     JOIN product_categories c ON c.id = p.category_id
     WHERE p.id = ANY($1::uuid[])`,
    [ids],
  );
  return new Map(rows.map((row) => [row.id, row]));
}
