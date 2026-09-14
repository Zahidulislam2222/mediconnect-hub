import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { fetchAuthSession } from 'aws-amplify/auth';
import { Hub } from 'aws-amplify/utils';
import { z } from 'zod';
import policySource from '@/content/session-policy.json';
import { clearAllSensitive, getUser, markAuthenticated, setUser, SESSION_CLEARED_EVENT } from '@/lib/secure-storage';

const roleSchema = z.enum(['patient', 'doctor', 'admin', 'staff']);
const policy = z.object({
  loading: z.string(), unknownName: z.string(), loginPath: z.string(), defaultRole: roleSchema,
  groups: z.record(roleSchema), home: z.record(roleSchema, z.string()),
}).parse(policySource);
type Role = z.infer<typeof roleSchema>;
type Identity = { id: string; role: Role; expires: number };
const SessionContext = createContext<Identity | null>(null);
export const useVerifiedSession = () => useContext(SessionContext);

/** UI access boundary. API services must independently verify tokens and authorization. */
export function VerifiedSession({ children }: { children: ReactNode }) {
  const [identity, setIdentity] = useState<Identity | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let mounted = true;
    let generation = 0;
    let expiry: ReturnType<typeof setTimeout> | undefined;
    const invalidate = () => {
      generation++;
      clearTimeout(expiry);
      if (mounted) { setIdentity(null); setLoading(false); }
    };
    const refresh = async () => {
      const current = ++generation;
      try {
        const session = await fetchAuthSession();
        if (!mounted || generation !== current) return;
        const payload = session.tokens?.idToken?.payload;
        const id = payload?.sub;
        const expires = payload?.exp;
        const groups = payload?.['cognito:groups'];
        if (typeof id !== 'string' || !id || typeof expires !== 'number' || expires * 1000 <= Date.now()
          || (groups !== undefined && (!Array.isArray(groups) || groups.some(group => typeof group !== 'string')))) {
          throw new Error('INVALID_SESSION');
        }
        const roles = new Set((groups as string[] | undefined ?? []).flatMap(group => {
          if (!Object.prototype.hasOwnProperty.call(policy.groups, group)) return [];
          const configuredRole = roleSchema.safeParse(policy.groups[group]);
          return configuredRole.success ? [configuredRole.data] : [];
        }));
        if (roles.size > 1 || (Array.isArray(groups) && groups.length > 0 && roles.size === 0)) throw new Error('AMBIGUOUS_ROLE');
        const role = roles.values().next().value ?? policy.defaultRole;
        const previous = getUser();
        setUser({ ...(previous?.id === id ? previous : {}), id, role,
          name: typeof payload?.name === 'string' ? payload.name : policy.unknownName });
        markAuthenticated();
        setIdentity({ id, role, expires });
        clearTimeout(expiry);
        expiry = setTimeout(() => { invalidate(); clearAllSensitive(); }, Math.min(expires * 1000 - Date.now(), 2147483647));
      } catch {
        if (mounted && generation === current) { invalidate(); clearAllSensitive(); }
      } finally {
        if (mounted && generation === current) setLoading(false);
      }
    };
    window.addEventListener(SESSION_CLEARED_EVENT, invalidate);
    const unsubscribe = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedOut' || payload.event === 'tokenRefresh_failure') { invalidate(); clearAllSensitive(); }
      if (payload.event === 'signedIn' || payload.event === 'tokenRefresh') void refresh();
    });
    void refresh();
    return () => {
      mounted = false; generation++; clearTimeout(expiry); unsubscribe();
      window.removeEventListener(SESSION_CLEARED_EVENT, invalidate);
    };
  }, []);
  if (loading) return <p role="status" className="p-8 text-muted-foreground">{policy.loading}</p>;
  if (!identity) return <Navigate to={policy.loginPath} replace />;
  return <SessionContext.Provider value={identity}>{children}</SessionContext.Provider>;
}

export function VerifiedRole({ allowedRoles, children }: { allowedRoles: string[]; children: ReactNode }) {
  const identity = useVerifiedSession();
  if (!identity) return <Navigate to={policy.loginPath} replace />;
  if (!allowedRoles.includes(identity.role)) return <Navigate to={policy.home[identity.role]} replace />;
  return <>{children}</>;
}
