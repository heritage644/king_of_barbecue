'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader2, UserPlus } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';

export default function CreateAccountPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderCode = searchParams.get('order') ?? null;

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await apiClient.register({
        fullName,
        email,
        phone: phone || null,
        password,
        orderCode,
      });
      router.replace(orderCode ? `/order/${orderCode}` : '/dashboard');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><UserPlus className="h-5 w-5 text-brand" /> Create your account</CardTitle>
          <p className="text-sm text-neutral-500">
            {orderCode ? `Your order ${orderCode} will be linked to this account.` : 'Track orders, check out faster.'}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="fullName">Full name</Label>
              <Input id="fullName" required minLength={2} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="phone">Phone (optional)</Label>
              <Input id="phone" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} autoComplete="tel" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" />
              <p className="mt-1 text-xs text-neutral-400">At least 8 characters with a letter and a number.</p>
            </div>
            {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account
            </Button>
            <p className="text-center text-sm text-neutral-500">
              Already have one? <a className="font-semibold text-brand hover:underline" href="/login">Log in</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
