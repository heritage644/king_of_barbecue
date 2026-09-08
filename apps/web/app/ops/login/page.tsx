'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Flame, Loader2 } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { canAccessOperations } from '@kob/core';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';

export default function OpsLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { user } = await apiClient.login({ email, password });
      if (!canAccessOperations(user.role)) {
        setError('This account does not have staff access.');
        await apiClient.logout();
        setBusy(false);
        return;
      }
      router.replace('/ops');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center bg-charcoal px-4">
      <Card className="w-full max-w-sm border-charcoal-lighter bg-charcoal-light text-cream">
        <CardHeader className="items-center text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/20 text-brand-light">
            <Flame className="h-6 w-6" />
          </span>
          <CardTitle className="text-white">Staff Portal</CardTitle>
          <p className="text-sm text-neutral-400">Restaurant operations sign in</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email" className="text-neutral-300">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" className="border-neutral-600 bg-charcoal text-cream" />
            </div>
            <div>
              <Label htmlFor="password" className="text-neutral-300">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" className="border-neutral-600 bg-charcoal text-cream" />
            </div>
            {error && <p className="text-sm font-medium text-red-400" role="alert">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Sign in
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
