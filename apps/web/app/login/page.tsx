'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, LogIn } from 'lucide-react';
import { apiClient, ApiError } from '@/lib/api-client';
import { Button, Card, CardContent, CardHeader, CardTitle, Input, Label } from '@/components/ui';

export default function LoginPage() {
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
      router.replace(user.role === 'CUSTOMER' ? '/dashboard' : '/ops');
      router.refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Login failed.');
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><LogIn className="h-5 w-5 text-brand" /> Welcome back</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            <div>
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </div>
            <div>
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" />
            </div>
            {error && <p className="text-sm font-medium text-red-600" role="alert">{error}</p>}
            <Button type="submit" className="w-full" size="lg" disabled={busy}>
              {busy && <Loader2 className="h-4 w-4 animate-spin" />} Log in
            </Button>
            <p className="text-center text-sm text-neutral-500">
              New here? <a className="font-semibold text-brand hover:underline" href="/create-account">Create an account</a>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
