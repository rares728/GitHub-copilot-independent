import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LockKeyhole } from 'lucide-react';
import AuthLayout from '@/components/AuthLayout';
import { useAuth } from '@/lib/AuthContext';

export default function Login() {
  const navigate = useNavigate();
  const { login, completeInvitation } = useAuth();
  const invitationToken = new URLSearchParams(window.location.search).get('invite');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event) => {
    event.preventDefault();
    setBusy(true);
    setError('');
    try {
      if (invitationToken) await completeInvitation(invitationToken, password);
      else await login(email, password);
      navigate('/');
    } catch (requestError) {
      setError(requestError.message || 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      icon={LockKeyhole}
      title={invitationToken ? 'Set your password' : 'RCCA Tracker'}
      subtitle={invitationToken ? 'Choose a password to activate your account.' : 'Sign in to your production quality workspace.'}
    >
      <form className="space-y-4" onSubmit={submit}>
        {!invitationToken && (
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium">Email</label>
            <input id="email" type="email" autoComplete="username" required value={email} onChange={(event) => setEmail(event.target.value)} className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm" />
          </div>
        )}
        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium">{invitationToken ? 'New password' : 'Password'}</label>
          <input
            id="password"
            type="password"
            autoComplete={invitationToken ? 'new-password' : 'current-password'}
            minLength={12}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
          />
          {invitationToken && <p className="text-xs text-muted-foreground">Use at least 12 characters.</p>}
        </div>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <button type="submit" className="inline-flex h-9 w-full items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50" disabled={busy}>
          {busy ? 'Please wait…' : invitationToken ? 'Activate account' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
