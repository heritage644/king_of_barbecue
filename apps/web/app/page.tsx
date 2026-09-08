import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, Clock, MapPin, Phone, Star } from 'lucide-react';
import { formatMoney } from '@/lib/utils';
import type { Product } from '@kob/core';
import { serverFetch } from '@/lib/server-api';

export const dynamic = 'force-dynamic';

const GALLERY = [
  { src: '/images/gallery-1.jpg', alt: 'Restaurant interior with warm lighting' },
  { src: '/images/gallery-3.jpg', alt: 'Shared barbecue spread on a dark wooden table' },
  { src: '/images/hero.jpg', alt: 'Premium barbecue platter over charcoal' },
  { src: '/images/grilled-chicken.jpg', alt: 'Flame-grilled half chicken' },
  { src: '/images/suya-beef.jpg', alt: 'Suya beef skewers with yaji spice' },
  { src: '/images/zobo-drink.jpg', alt: 'Chilled zobo drink' },
];

export default async function LandingPage() {
  let featured: Product[] = [];
  try {
    featured = await serverFetch<{ products: Product[] }>('/products/featured').then((r) => r.products);
  } catch {
    // server-side fetch failure → friendly empty state
  }

  return (
    <>
      {/* ---------- Hero ---------- */}
      <section className="relative overflow-hidden bg-charcoal text-cream">
        <div className="absolute inset-0">
          <Image
            src="/images/hero.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-charcoal via-charcoal/80 to-transparent" />
        </div>
        <div className="relative mx-auto max-w-6xl px-4 py-24 sm:py-36">
          <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-brand-light">
            <Star className="h-3.5 w-3.5 fill-current" /> Charcoal-grilled. Always fresh.
          </p>
          <h1 className="max-w-2xl font-display text-5xl font-bold leading-tight tracking-tight sm:text-6xl">
            Order delicious food <span className="text-brand-light">easily.</span>
          </h1>
          <p className="mt-5 max-w-xl text-lg text-neutral-300">
            Flame-grilled chicken, smoky jollof, suya and fresh fish — from our
            charcoal kitchen to your door. Pickup or delivery, tracked live.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/menu"
              className="inline-flex h-12 items-center gap-2 rounded-lg bg-brand px-6 text-base font-semibold text-white shadow-lg transition hover:bg-brand-dark"
            >
              View Menu <ArrowRight className="h-5 w-5" />
            </Link>
            <Link
              href="/#contact"
              className="inline-flex h-12 items-center rounded-lg border border-cream/30 px-6 text-base font-semibold text-cream transition hover:bg-cream/10"
            >
              Find us
            </Link>
          </div>
        </div>
      </section>

      {/* ---------- Featured menu ---------- */}
      <section className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="featured-heading">
        <div className="mb-8 flex items-end justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">Chef&apos;s picks</p>
            <h2 id="featured-heading" className="mt-1 font-display text-3xl font-bold">Featured favourites</h2>
          </div>
          <Link href="/menu" className="hidden items-center gap-1 text-sm font-semibold text-brand hover:underline sm:flex">
            Full menu <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        {featured.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 bg-white p-10 text-center text-neutral-500">
            Our menu is taking a quick break — check back soon.
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {featured.slice(0, 8).map((p) => (
              <Link
                key={p.id}
                href={`/menu/${p.slug}`}
                className="group overflow-hidden rounded-xl border border-neutral-200 bg-white shadow-card transition hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="relative aspect-[4/3] overflow-hidden bg-neutral-100">
                  {p.imageUrl ? (
                    <Image
                      src={p.imageUrl}
                      alt={p.name}
                      fill
                      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center text-neutral-400">No photo yet</div>
                  )}
                </div>
                <div className="p-4">
                  <p className="text-xs font-medium uppercase tracking-wider text-brand">{p.categoryName}</p>
                  <h3 className="mt-1 font-semibold leading-snug">{p.name}</h3>
                  <p className="mt-2 font-bold text-charcoal">{formatMoney(p.priceMinor)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* ---------- Gallery ---------- */}
      <section id="gallery" className="bg-white py-16" aria-labelledby="gallery-heading">
        <div className="mx-auto max-w-6xl px-4">
          <div className="mb-8 text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">The experience</p>
            <h2 id="gallery-heading" className="mt-1 font-display text-3xl font-bold">From flame to table</h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {GALLERY.map((g) => (
              <div key={g.src} className="group relative aspect-square overflow-hidden rounded-xl">
                <Image
                  src={g.src}
                  alt={g.alt}
                  fill
                  sizes="(max-width: 640px) 50vw, 33vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- About ---------- */}
      <section id="about" className="mx-auto max-w-6xl px-4 py-16" aria-labelledby="about-heading">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="relative aspect-[4/3] overflow-hidden rounded-2xl">
            <Image src="/images/gallery-1.jpg" alt="King of Barbecue dining room" fill sizes="50vw" className="object-cover" />
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand">About us</p>
            <h2 id="about-heading" className="mt-1 font-display text-3xl font-bold">Real charcoal. Real flavour.</h2>
            <p className="mt-4 leading-relaxed text-neutral-600">
              King of Barbecue started with one belief: great food starts with fire.
              Every chicken, skewer and fish is grilled over real charcoal, seasoned
              with a house blend and served hot — whether you dine with us or order
              to your door.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-neutral-700">
              <li className="flex gap-2"><Star className="h-4 w-4 shrink-0 text-brand-light" /> Fresh ingredients, prepared daily</li>
              <li className="flex gap-2"><Star className="h-4 w-4 shrink-0 text-brand-light" /> Fast pickup &amp; tracked delivery</li>
              <li className="flex gap-2"><Star className="h-4 w-4 shrink-0 text-brand-light" /> Family recipes, generous portions</li>
            </ul>
          </div>
        </div>
      </section>

      {/* ---------- Contact ---------- */}
      <section id="contact" className="bg-charcoal py-16 text-cream" aria-labelledby="contact-heading">
        <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:grid-cols-3">
          <div>
            <h2 id="contact-heading" className="font-display text-2xl font-bold">Find us</h2>
            <p className="mt-2 text-sm text-neutral-300">Walk in, call ahead, or order online.</p>
          </div>
          <div className="space-y-4 text-sm">
            <p className="flex items-start gap-3"><MapPin className="mt-0.5 h-4 w-4 text-brand-light" /> 24 Zik Avenue, Awka, Anambra State</p>
            <p className="flex items-center gap-3"><Phone className="h-4 w-4 text-brand-light" /> <a href="tel:+2348001234567" className="hover:underline">+234 800 123 4567</a></p>
            <p className="flex items-center gap-3"><Clock className="h-4 w-4 text-brand-light" /> Mon–Thu 10:00–22:00 · Fri–Sat 10:00–23:00 · Sun 12:00–21:00</p>
          </div>
          <div className="flex flex-col gap-3 sm:items-end">
            <p className="text-sm text-neutral-300">Follow the smoke:</p>
            <div className="flex gap-2 text-sm font-semibold text-brand-light">
              <a className="hover:underline" href="https://instagram.com" target="_blank" rel="noreferrer">Instagram</a>
              <a className="hover:underline" href="https://facebook.com" target="_blank" rel="noreferrer">Facebook</a>
              <a className="hover:underline" href="https://wa.me/2348001234567" target="_blank" rel="noreferrer">WhatsApp</a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
