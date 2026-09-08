import type { Metadata, Viewport } from 'next';
import Link from 'next/link';
import { Cookie, Flame, ShoppingBag, UtensilsCrossed } from 'lucide-react';
import '@/app/globals.css';
import { StoreStatusBanner } from '@/components/store-status-banner';
import { CartCount } from '@/components/cart-count';
import { cookies } from 'next/headers';

export const metadata: Metadata = {
  title: {
    default: 'King of Barbecue — Order Grills, Chicken & Rice Online',
    template: '%s | King of Barbecue',
  },
  description:
    'Fire-grilled chicken, suya, jollof rice, tilapia and more. Order online for pickup or delivery from King of Barbecue.',
};

export const viewport: Viewport = {
  themeColor: '#1c1917',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const cookieHeader = cookies().toString();
  return (
    <html lang="en">
      <body className="min-h-screen">
        <StoreStatusBanner />
        <Header cartCookie={cookieHeader} />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}

function Header({ cartCookie }: { cartCookie: string }) {
  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
        <Link href="/" className="flex items-center gap-2" aria-label="King of Barbecue home">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-charcoal text-brand-light">
            <Flame className="h-5 w-5" />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-lg font-bold tracking-tight">King of Barbecue</span>
            <span className="block text-[10px] font-medium uppercase tracking-[0.2em] text-brand">Charcoal Kitchen</span>
          </span>
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium text-neutral-600 md:flex" aria-label="Main">
          <Link className="hover:text-brand" href="/">Home</Link>
          <Link className="hover:text-brand" href="/menu">Menu</Link>
          <Link className="hover:text-brand" href="/#gallery">Gallery</Link>
          <Link className="hover:text-brand" href="/#about">About</Link>
          <Link className="hover:text-brand" href="/#contact">Contact</Link>
          <Link className="hover:text-brand" href="/dashboard">My Orders</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link
            href="/cart"
            className="relative flex h-10 items-center gap-2 rounded-lg bg-brand px-3 text-sm font-semibold text-white hover:bg-brand-dark"
            aria-label="View cart"
          >
            <ShoppingBag className="h-4 w-4" />
            <span className="hidden sm:inline">Cart</span>
            <CartCount cookieHeader={cartCookie} />
          </Link>
          <Link
            href="/ops/login"
            className="hidden h-10 items-center gap-1.5 rounded-lg border border-neutral-200 px-3 text-sm font-medium text-neutral-600 hover:bg-neutral-50 lg:flex"
          >
            <UtensilsCrossed className="h-4 w-4" /> Staff
          </Link>
        </div>
      </div>
      <nav className="flex items-center gap-5 overflow-x-auto px-4 py-2 text-sm font-medium text-neutral-600 md:hidden" aria-label="Mobile">
        <Link className="hover:text-brand" href="/">Home</Link>
        <Link className="hover:text-brand" href="/menu">Menu</Link>
        <Link className="hover:text-brand" href="/#gallery">Gallery</Link>
        <Link className="hover:text-brand" href="/#about">About</Link>
        <Link className="hover:text-brand" href="/#contact">Contact</Link>
        <Link className="hover:text-brand" href="/dashboard">My Orders</Link>
      </nav>
    </header>
  );
}

function Footer() {
  return (
    <footer className="mt-16 border-t border-neutral-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:grid-cols-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-charcoal text-brand-light">
              <Flame className="h-4 w-4" />
            </span>
            <span className="font-display text-lg font-bold">King of Barbecue</span>
          </div>
          <p className="mt-3 text-sm text-neutral-500">Fire-grilled favourites, served hot. Order online — we&apos;ll handle the rest.</p>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Quick links</h3>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600">
            <li><Link className="hover:text-brand" href="/menu">Full menu</Link></li>
            <li><Link className="hover:text-brand" href="/cart">Your cart</Link></li>
            <li><Link className="hover:text-brand" href="/dashboard">Track orders</Link></li>
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-neutral-400">Visit us</h3>
          <ul className="mt-3 space-y-2 text-sm text-neutral-600">
            <li>24 Zik Avenue, Awka, Anambra</li>
            <li><a className="hover:text-brand" href="tel:+2348001234567">+234 800 123 4567</a></li>
            <li className="flex items-center gap-1.5 text-neutral-500"><Cookie className="h-3.5 w-3.5" /> Open daily · 10:00 – 22:00</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-neutral-100 py-4 text-center text-xs text-neutral-400">
        © {new Date().getFullYear()} King of Barbecue. All rights reserved.
      </div>
    </footer>
  );
}
