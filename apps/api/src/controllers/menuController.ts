import type { Request, Response } from 'express';
import { listCategories, listProducts, findFeaturedProducts, findProductBySlug, type CategoryRow, type ProductRow } from '../repositories/products';
import { AppError } from '@kob/core';

function toCategory(row: CategoryRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    description: row.description,
    imageUrl: row.image_url,
    sortOrder: row.sort_order,
    isActive: row.is_active,
  };
}

function toProduct(row: ProductRow) {
  return {
    id: row.id,
    categoryId: row.category_id,
    categorySlug: row.category_slug ?? null,
    categoryName: row.category_name ?? null,
    name: row.name,
    slug: row.slug,
    description: row.description,
    priceMinor: row.price_minor,
    imageUrl: row.image_url,
    isAvailable: row.is_available,
    isFeatured: row.is_featured,
    sortOrder: row.sort_order,
  };
}

export async function getCategories(_req: Request, res: Response): Promise<void> {
  const rows = await listCategories();
  res.json({ categories: rows.map(toCategory) });
}

export async function getFeatured(_req: Request, res: Response): Promise<void> {
  const rows = await findFeaturedProducts(8);
  res.json({ products: rows.map(toProduct) });
}

export async function getProducts(req: Request, res: Response): Promise<void> {
  const includeUnavailable = req.query.includeUnavailable === 'true';
  const rows = await listProducts(includeUnavailable);
  res.json({ products: rows.map(toProduct) });
}

export async function getProduct(req: Request, res: Response): Promise<void> {
  const { slug } = req.params as { slug: string };
  const row = await findProductBySlug(slug);
  if (!row || !row.is_available) throw AppError.notFound('Product not found.');
  res.json({ product: toProduct(row) });
}
