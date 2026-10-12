import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { api } from '@/lib/api';
import { beginNativeMfa, nativeMfaContent as copy } from '@/lib/cognito-native-auth';

export function SensitiveOperationMfaDialog({ open, onOpenChange, onVerified }: {
  open: boolean; onOpenChange(open: boolean): void; onVerified(): void;
}) {
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [session, setSession] = useState('');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const generation = useRef(0);
  const pending = useRef(false);
  const controller = useRef<AbortController>();
  const invalidate = () => { generation.current++; controller.current?.abort(); pending.current = false; };
  useEffect(() => {
    if (!open) { setPassword(''); setCode(''); setSession(''); setFailed(false); setBusy(false); }
    return invalidate;
  }, [open]);
  const close = () => { invalidate(); setPassword(''); setCode(''); setSession(''); onOpenChange(false); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (pending.current || !open || (session ? !/^\d{6}$/.test(code) : !password)) return;
    const id = generation.current;
    pending.current = true; setBusy(true); setFailed(false);
    try {
      if (!session) {
        const secret = password; setPassword('');
        controller.current = new AbortController();
        const next = await beginNativeMfa(secret, controller.current.signal);
        if (id === generation.current) setSession(next);
      } else {
        const value = code; setCode('');
        controller.current = new AbortController();
        const result = await api.post(copy.completeEndpoint, { session, code: value }, { signal: controller.current.signal });
        if (id === generation.current) {
          if (result?.verified !== true) throw new Error('NATIVE_MFA_NOT_VERIFIED');
          close(); onVerified();
        }
      }
    } catch {
      if (id === generation.current) { setPassword(''); setCode(''); setSession(''); setFailed(true); }
    } finally {
      if (id === generation.current) { pending.current = false; setBusy(false); }
    }
  };
  return <Dialog open={open} onOpenChange={value => { if (!value) close(); }}>
    <DialogContent><DialogHeader><DialogTitle>{copy.title}</DialogTitle><DialogDescription>{copy.description}</DialogDescription></DialogHeader>
      <form onSubmit={submit} className="space-y-4" aria-busy={busy}>
        {session ? <div><Label htmlFor="native-mfa-code">{copy.codeLabel}</Label><Input id="native-mfa-code" value={code} onChange={e => setCode(e.target.value)} inputMode="numeric" autoComplete="one-time-code" maxLength={6} disabled={busy} /></div>
          : <div><Label htmlFor="native-mfa-password">{copy.passwordLabel}</Label><Input id="native-mfa-password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" disabled={busy} /></div>}
        {failed && <p role="alert">{copy.error}</p>}
        <div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={close}>{copy.cancelLabel}</Button>
          <Button type="submit" disabled={busy || (session ? !/^\d{6}$/.test(code) : !password)}>{session ? copy.verifyLabel : copy.continueLabel}</Button></div>
      </form>
    </DialogContent>
  </Dialog>;
}
