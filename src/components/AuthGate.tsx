import React, { useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Maximize2, Minus, ShieldCheck, UserCircle2, X, XCircle } from 'lucide-react';
import { useAuthStore } from '@/store/useAuthStore';
import { cn } from '@/lib/utils';

const LICENSE_PATTERN = /^[A-Z0-9]{4}(?:-[A-Z0-9]{4}){3}$/;
const IS_DEV = import.meta.env.DEV;

function normalizeLicenseInput(value: string) {
  const cleaned = value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16);
  const groups: string[] = [];
  for (let i = 0; i < cleaned.length; i += 4) groups.push(cleaned.slice(i, i + 4));
  return groups.join('-');
}

type Status = { kind: 'success' | 'error'; message: string } | null;

export const AuthGate: React.FC = () => {
  const { licenseActivated, user, activateLicense, createFirstUser, login, resetPasswordWithLicense } = useAuthStore();

  const [licenseKey, setLicenseKey] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [setupEmail, setSetupEmail] = useState('');
  const [setupPassword, setSetupPassword] = useState('');
  const [identity, setIdentity] = useState('');
  const [password, setPassword] = useState('');
  const [showSetupPassword, setShowSetupPassword] = useState(false);
  const [showLoginPassword, setShowLoginPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetLicenseKey, setResetLicenseKey] = useState('');
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmPassword, setResetConfirmPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showResetConfirmPassword, setShowResetConfirmPassword] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [isLoading, setIsLoading] = useState(false);

  const stage = useMemo<'activation' | 'setup' | 'login'>(() => {
    if (!licenseActivated) return 'activation';
    if (!user) return 'setup';
    return 'login';
  }, [licenseActivated, user]);

  const keyLooksValid = useMemo(() => LICENSE_PATTERN.test(licenseKey.trim()), [licenseKey]);
  const hasWindowControls = Boolean(window.api?.minimize || window.electronAPI?.minimize);

  const handleWindowAction = async (action: 'minimize' | 'maximize' | 'close') => {
    const desktopApi = window.api ?? window.electronAPI;
    if (!desktopApi) return;
    try {
      await desktopApi[action]();
    } catch {
      // Ignore renderer-side action errors on unsupported environments.
    }
  };

  const withLoader = async (fn: () => void) => {
    setIsLoading(true);
    await new Promise((resolve) => window.setTimeout(resolve, 700));
    fn();
    setIsLoading(false);
  };

  const submitActivation = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    if (!IS_DEV && !keyLooksValid) {
      setStatus({ kind: 'error', message: 'Please enter the license in XXXX-XXXX-XXXX-XXXX format.' });
      return;
    }
    await withLoader(() => {
      const res = activateLicense(licenseKey);
      if (!res.ok) setStatus({ kind: 'error', message: res.message });
      else
        setStatus({
          kind: 'success',
          message: IS_DEV
            ? 'Development mode: license verification bypassed.'
            : 'License verified. Continue to account setup.',
        });
    });
  };

  const submitSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    await withLoader(() => {
      const res = createFirstUser({
        username: setupUsername,
        email: setupEmail,
        password: setupPassword,
      });
      if (!res.ok) setStatus({ kind: 'error', message: res.message });
      else {
        setStatus({
          kind: 'success',
          message: IS_DEV
            ? 'Development mode: account setup saved with dev defaults where needed.'
            : 'Account created. Please sign in with your new credentials.',
        });
        setIdentity(setupEmail.trim() || setupUsername.trim());
        setPassword('');
      }
    });
  };

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus(null);
    await withLoader(() => {
      const res = login(identity, password);
      if (!res.ok) setStatus({ kind: 'error', message: res.message });
      else if (IS_DEV) setStatus({ kind: 'success', message: 'Development mode: login verification bypassed.' });
    });
  };

  const submitForgotPassword = async () => {
    setStatus(null);
    const normalized = normalizeLicenseInput(resetLicenseKey);
    if (!IS_DEV && !LICENSE_PATTERN.test(normalized)) {
      setStatus({ kind: 'error', message: 'Please enter license key as XXXX-XXXX-XXXX-XXXX.' });
      return;
    }
    if (resetPassword.length < 6) {
      setStatus({ kind: 'error', message: 'New password must be at least 6 characters.' });
      return;
    }
    if (resetPassword !== resetConfirmPassword) {
      setStatus({ kind: 'error', message: 'Confirm password does not match.' });
      return;
    }
    await withLoader(() => {
      const res = resetPasswordWithLicense(normalized, resetPassword);
      if (!res.ok) {
        setStatus({ kind: 'error', message: res.message });
        return;
      }
      setShowForgotPassword(false);
      setResetLicenseKey('');
      setResetPassword('');
      setResetConfirmPassword('');
      setPassword('');
      setStatus({
        kind: 'success',
        message: 'Password has been reset. Please login with your new password.',
      });
    });
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center overflow-auto bg-[radial-gradient(120%_80%_at_0%_0%,rgba(14,116,144,0.09),transparent_56%),radial-gradient(90%_60%_at_100%_100%,rgba(16,185,129,0.08),transparent_63%),linear-gradient(180deg,#f8fbff_0%,#f1f6ff_46%,#eef4ff_100%)] p-4 sm:p-6">
      {hasWindowControls ? (
        <div className="fixed right-0 top-0 z-50 flex items-center gap-0.5 rounded-bl-lg border border-r-0 border-t-0 border-slate-200/80 bg-white/95 px-1 py-1 shadow-sm">
          <button
            type="button"
            onClick={() => {
              void handleWindowAction('minimize');
            }}
            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Minimize window"
            title="Minimize"
          >
            <Minus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              void handleWindowAction('maximize');
            }}
            className="rounded-md p-1.5 text-slate-600 transition hover:bg-slate-100 hover:text-slate-800"
            aria-label="Maximize window"
            title="Maximize"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => {
              void handleWindowAction('close');
            }}
            className="rounded-md p-1.5 text-slate-600 transition hover:bg-red-100 hover:text-red-700"
            aria-label="Close window"
            title="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}
      <div className="relative grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200/80 bg-white/95 shadow-[0_24px_68px_-30px_rgba(15,23,42,0.3)] md:grid-cols-[1fr_1.05fr]">
        <section className="relative hidden overflow-hidden bg-gradient-to-br from-sky-50 via-white to-emerald-50/60 p-9 md:flex md:flex-col md:justify-between">
          <div className="pointer-events-none absolute -left-16 -top-16 h-52 w-52 rounded-full bg-sky-200/30 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-14 -right-16 h-56 w-56 rounded-full bg-emerald-200/35 blur-3xl" />
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-white/85 px-3 py-1 text-xs font-semibold text-sky-700">
              <ShieldCheck className="h-3.5 w-3.5" />
              Secure activation workflow
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-tight text-slate-900">Pharmacy POS Access</h2>
            <p className="mt-2 max-w-sm text-sm leading-relaxed text-slate-600">
              One-time license verification, then protected sign-in with your configured account credentials.
            </p>
          </div>
          <div className="relative mt-8 flex h-48 items-center justify-center">
            <motion.div
              className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gradient-to-br from-sky-600 to-emerald-500 text-white shadow-xl shadow-sky-700/25"
              initial={{ y: 0 }}
              animate={{ y: [-2, 5, -2] }}
              transition={{ repeat: Infinity, duration: 4, ease: 'easeInOut' }}
            >
              {stage === 'login' ? <UserCircle2 className="h-12 w-12" /> : <Lock className="h-12 w-12" />}
            </motion.div>
          </div>
        </section>

        <section className="p-6 sm:p-8 md:p-10">
          <h1 className="text-2xl font-black tracking-tight text-slate-900 sm:text-[2rem]">
            {stage === 'activation'
              ? 'Activate Your License'
              : stage === 'setup'
                ? 'Create First Account'
                : 'Login to Continue'}
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            {stage === 'activation'
              ? 'Enter your license key to start using the system'
              : stage === 'setup'
                ? 'Set username, email, and password for first-time access'
                : 'Use your configured username/email and password'}
          </p>

          {stage === 'activation' ? (
            <form className="mt-7 space-y-4" onSubmit={submitActivation}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">License Key</span>
                <div className="relative mt-1.5">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={licenseKey}
                    onChange={(e) => setLicenseKey(normalizeLicenseInput(e.target.value))}
                    placeholder="XXXX-XXXX-XXXX-XXXX"
                    className={cn(
                      'w-full rounded-xl border bg-white py-3 pl-10 pr-4 text-sm font-mono tracking-[0.08em] text-slate-900 shadow-sm transition focus:outline-none focus:ring-4',
                      keyLooksValid || !licenseKey
                        ? 'border-slate-200 focus:border-sky-300 focus:ring-sky-100'
                        : 'border-red-300 focus:border-red-300 focus:ring-red-100'
                    )}
                  />
                </div>
              </label>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Verifying...
                  </>
                ) : (
                  'Activate License'
                )}
              </button>
            </form>
          ) : stage === 'setup' ? (
            <form className="mt-7 space-y-4" onSubmit={submitSetup}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username</span>
                <input
                  value={setupUsername}
                  onChange={(e) => setSetupUsername(e.target.value)}
                  placeholder="Enter username"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Email</span>
                <input
                  type="email"
                  value={setupEmail}
                  onChange={(e) => setSetupEmail(e.target.value)}
                  placeholder="name@business.com"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
                <div className="relative mt-1.5">
                  <input
                    type={showSetupPassword ? 'text' : 'password'}
                    value={setupPassword}
                    onChange={(e) => setSetupPassword(e.target.value)}
                    placeholder="Minimum 6 characters"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSetupPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showSetupPassword ? 'Hide setup password' : 'Show setup password'}
                  >
                    {showSetupPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>
          ) : (
            <form className="mt-7 space-y-4" onSubmit={submitLogin}>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Username or Email</span>
                <input
                  value={identity}
                  onChange={(e) => setIdentity(e.target.value)}
                  placeholder="Enter username or email"
                  className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                />
              </label>
              <label className="block">
                <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Password</span>
                <div className="relative mt-1.5">
                  <input
                    type={showLoginPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 pr-11 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                  />
                  <button
                    type="button"
                    onClick={() => setShowLoginPassword((v) => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                    aria-label={showLoginPassword ? 'Hide login password' : 'Show login password'}
                  >
                    {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  onClick={() => {
                    setShowForgotPassword((v) => !v);
                    setStatus(null);
                  }}
                  className="text-xs font-semibold text-sky-700 hover:text-sky-800 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  {showForgotPassword ? 'Cancel password reset' : 'Forgot password?'}
                </button>
              </div>
              {showForgotPassword ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/30">
                  <p className="mb-3 text-xs font-medium text-amber-900 dark:text-amber-200">
                    Verify your license key to set a new password.
                  </p>
                  <div className="space-y-3">
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">License key</span>
                      <input
                        value={resetLicenseKey}
                        onChange={(e) => setResetLicenseKey(normalizeLicenseInput(e.target.value))}
                        placeholder="XXXX-XXXX-XXXX-XXXX"
                        className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 font-mono text-sm tracking-[0.08em] text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                      />
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">New password</span>
                      <div className="relative mt-1.5">
                        <input
                          type={showResetPassword ? 'text' : 'password'}
                          value={resetPassword}
                          onChange={(e) => setResetPassword(e.target.value)}
                          placeholder="Minimum 6 characters"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showResetPassword ? 'Hide new password' : 'Show new password'}
                        >
                          {showResetPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                    <label className="block">
                      <span className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Confirm new password</span>
                      <div className="relative mt-1.5">
                        <input
                          type={showResetConfirmPassword ? 'text' : 'password'}
                          value={resetConfirmPassword}
                          onChange={(e) => setResetConfirmPassword(e.target.value)}
                          placeholder="Re-enter new password"
                          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 pr-11 text-sm text-slate-900 shadow-sm transition focus:border-sky-300 focus:outline-none focus:ring-4 focus:ring-sky-100"
                        />
                        <button
                          type="button"
                          onClick={() => setShowResetConfirmPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showResetConfirmPassword ? 'Hide confirm password' : 'Show confirm password'}
                        >
                          {showResetConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        void submitForgotPassword();
                      }}
                      disabled={isLoading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300 bg-white py-2.5 text-sm font-bold text-amber-900 shadow-sm transition hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-70 dark:border-amber-900/50 dark:bg-zinc-950 dark:text-amber-200 dark:hover:bg-amber-950/50"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Resetting...
                        </>
                      ) : (
                        'Verify License & Reset Password'
                      )}
                    </button>
                  </div>
                </div>
              ) : null}
              <button
                type="submit"
                disabled={isLoading}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 py-3 text-sm font-bold text-white shadow-lg shadow-sky-600/25 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-75"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Signing in...
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </form>
          )}

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={status?.kind ?? 'idle'}
              initial={{ opacity: 0, y: 6, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className={cn(
                'mt-4 min-h-11 rounded-xl border px-3 py-2 text-sm',
                status?.kind === 'success' && 'border-emerald-200 bg-emerald-50 text-emerald-700',
                status?.kind === 'error' && 'border-red-200 bg-red-50 text-red-700',
                !status && 'border-slate-200 bg-slate-50 text-slate-500'
              )}
            >
              {status?.kind === 'success' ? (
                <span className="inline-flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {status.message}
                </span>
              ) : status?.kind === 'error' ? (
                <span className="inline-flex items-center gap-2">
                  <XCircle className="h-4 w-4" />
                  {status.message}
                </span>
              ) : (
                <span>Secure activation powered by PharmaOS Technologies</span>
              )}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
};
