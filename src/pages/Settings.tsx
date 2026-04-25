import React, { useCallback, useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Building2,
  Check,
  Cpu,
  Printer,
  Wallet,
} from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useSettingsStore, type AppSettingsSnapshot, type ReceiptFormat } from '@/store/useSettingsStore';
import { useToastStore } from '@/store/useToastStore';
import { cn } from '@/lib/utils';
import {
  BillPreviewCard,
  IdentityReceiptStrip,
  ReceiptPreviewCard,
} from '@/pages/settings/SettingsPreviews';
import { SettingsDiagnosticsPanel } from '@/pages/settings/SettingsDiagnosticsPanel';
import { useAuthStore } from '@/store/useAuthStore';

type SettingsCategory = 'general' | 'billing' | 'receipt' | 'system';

const NAV: { id: SettingsCategory; label: string; icon: React.ElementType }[] = [
  { id: 'general', label: 'General', icon: Building2 },
  { id: 'billing', label: 'Billing', icon: Wallet },
  { id: 'receipt', label: 'Receipt & Printing', icon: Printer },
  { id: 'system', label: 'System', icon: Cpu },
];

function PanelCard({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] border border-slate-200/80 bg-white/90 p-5 shadow-[0_8px_30px_-18px_rgba(15,23,42,0.18)] dark:border-zinc-800/90 dark:bg-zinc-900/70 dark:shadow-black/30">
      <h3 className="text-sm font-semibold tracking-tight text-slate-900 dark:text-white">{title}</h3>
      {subtitle ? <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">{subtitle}</p> : null}
      <div className="mt-4 space-y-4">{children}</div>
    </div>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-500">{children}</span>;
}

function Helper({ children }: { children: React.ReactNode }) {
  return <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-zinc-500">{children}</p>;
}

function ToggleRow({
  checked,
  onChange,
  title,
  helper,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  title: string;
  helper?: string;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-slate-100 bg-slate-50/50 p-3.5 dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-slate-800 dark:text-zinc-100">{title}</span>
        <button
          type="button"
          role="switch"
          aria-checked={checked}
          onClick={() => onChange(!checked)}
          className={cn(
            'relative inline-flex h-7 w-12 shrink-0 rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40',
            checked ? 'bg-primary' : 'bg-slate-200 dark:bg-zinc-700'
          )}
        >
          <span
            className={cn(
              'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform',
              checked ? 'translate-x-[1.35rem]' : 'translate-x-0.5'
            )}
          />
        </button>
      </div>
      {helper ? <p className="text-xs text-slate-500 dark:text-zinc-500">{helper}</p> : null}
    </div>
  );
}

export const Settings: React.FC = () => {
  const patch = useSettingsStore((s) => s.patch);
  const s = useSettingsStore();
  const resetToDemoSeed = usePOSBillingStore((x) => x.resetToDemoSeed);
  const showToast = useToastStore((x) => x.show);
  const user = useAuthStore((x) => x.user);
  const changePassword = useAuthStore((x) => x.changePassword);

  const [active, setActive] = useState<SettingsCategory>('general');
  const [saveFlash, setSaveFlash] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);

  const bumpSaveFlash = useCallback(() => {
    setSaveFlash(true);
  }, []);

  useEffect(() => {
    if (!saveFlash) return;
    const t = window.setTimeout(() => setSaveFlash(false), 1200);
    return () => window.clearTimeout(t);
  }, [saveFlash]);

  const applyPatch = useCallback(
    (p: Partial<AppSettingsSnapshot>) => {
      patch(p);
      bumpSaveFlash();
    },
    [patch, bumpSaveFlash]
  );

  const handleResetDemo = () => {
    const ok = window.confirm(
      'Clear local session data and reload from backend? This will clear local cart/checkout state and rehydrate live records.'
    );
    if (!ok) return;
    resetToDemoSeed();
    showToast('Data reloaded from backend. Local session state has been cleared.', 'success');
  };

  const handleChangePassword = async () => {
    if (!user) {
      showToast('No active account found.', 'error');
      return;
    }
    if (!currentPassword.trim()) {
      showToast('Current password is required.', 'error');
      return;
    }
    if (!newPassword.trim()) {
      showToast('New password is required.', 'error');
      return;
    }
    if (newPassword.length < 6) {
      showToast('New password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPassword) {
      showToast('Confirm password does not match.', 'error');
      return;
    }

    setChangingPassword(true);
    try {
      const res = changePassword(currentPassword, newPassword);
      if (!res.ok) {
        showToast(res.message, 'error');
        return;
      }
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      showToast('Password changed successfully.', 'success');
    } finally {
      setChangingPassword(false);
    }
  };

  const panelMotion = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
    transition: { duration: 0.2 },
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#f6f8fc] dark:bg-zinc-950">
      <header className="shrink-0 border-b border-slate-200/80 bg-white/80 px-5 py-4 backdrop-blur-md dark:border-zinc-800 dark:bg-zinc-950/80 sm:px-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold tracking-tight text-slate-900 dark:text-white">Control center</h1>
            <p className="mt-0.5 max-w-xl text-sm text-slate-600 dark:text-zinc-400">
              Tune how PharmaOS feels at the counter. Everything here is grouped so you can move fast without hunting.
            </p>
          </div>
          <div
            className={cn(
              'flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-opacity duration-300',
              saveFlash
                ? 'border-emerald-200 bg-emerald-50 text-emerald-800 opacity-100 dark:border-emerald-900/50 dark:bg-emerald-950/50 dark:text-emerald-200'
                : 'border-transparent bg-transparent text-slate-400 opacity-70 dark:text-zinc-500'
            )}
          >
            <Check className={cn('h-3.5 w-3.5', saveFlash ? 'opacity-100' : 'opacity-0')} strokeWidth={2.5} />
            {saveFlash ? 'Saved on this device' : 'Auto-saves as you go'}
          </div>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-0 lg:flex-row">
        <nav
          className="shrink-0 border-b border-slate-200/80 bg-white/60 p-3 dark:border-zinc-800 dark:bg-zinc-950/50 lg:w-[260px] lg:border-b-0 lg:border-r lg:p-4"
          aria-label="Settings categories"
        >
          <ul className="flex gap-1 overflow-x-auto pb-1 lg:flex-col lg:overflow-visible lg:pb-0">
            {NAV.map((item) => {
              const Icon = item.icon;
              const isOn = active === item.id;
              return (
                <li key={item.id} className="shrink-0 lg:w-full">
                  <button
                    type="button"
                    onClick={() => setActive(item.id)}
                    className={cn(
                      'flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left text-sm font-medium transition-all',
                      isOn
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/25'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-zinc-900'
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0 opacity-90" strokeWidth={2} />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="mx-auto max-w-3xl">
            <AnimatePresence mode="wait">
              {active === 'general' && (
                <motion.div key="general" {...panelMotion} className="space-y-5">
                  <PanelCard title="Pharmacy identity" subtitle="This is what customers see at the top of a receipt.">
                    <label className="block space-y-1.5">
                      <FieldLabel>Pharmacy name</FieldLabel>
                      <input
                        value={s.pharmacyName}
                        onChange={(e) => applyPatch({ pharmacyName: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <FieldLabel>Address</FieldLabel>
                      <input
                        value={s.pharmacyAddress}
                        onChange={(e) => applyPatch({ pharmacyAddress: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                    </label>
                    <label className="block space-y-1.5">
                      <FieldLabel>Phone</FieldLabel>
                      <input
                        value={s.pharmacyPhone}
                        onChange={(e) => applyPatch({ pharmacyPhone: e.target.value })}
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                      <Helper>Keep it short — this line is meant for a small receipt.</Helper>
                    </label>
                  </PanelCard>
                  <IdentityReceiptStrip name={s.pharmacyName} address={s.pharmacyAddress} phone={s.pharmacyPhone} />
                </motion.div>
              )}

              {active === 'billing' && (
                <motion.div key="billing" {...panelMotion} className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <PanelCard title="Tax & invoices" subtitle="Guided controls — numbers update the preview beside them.">
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <FieldLabel>Tax rate</FieldLabel>
                          <span className="text-sm font-semibold tabular-nums text-primary">{s.taxPercent}%</span>
                        </div>
                        <input
                          type="range"
                          min={0}
                          max={25}
                          step={0.5}
                          value={s.taxPercent}
                          onChange={(e) => applyPatch({ taxPercent: Number(e.target.value) })}
                          className="mt-2 w-full accent-primary"
                        />
                        <input
                          type="number"
                          min={0}
                          max={100}
                          step={0.5}
                          value={s.taxPercent}
                          onChange={(e) => applyPatch({ taxPercent: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                          className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        />
                        <Helper>Applied after discounts and any delivery-style charges on the bill.</Helper>
                      </div>
                      <label className="block space-y-1.5">
                        <FieldLabel>Invoice prefix</FieldLabel>
                        <input
                          value={s.invoicePrefix}
                          onChange={(e) =>
                            applyPatch({ invoicePrefix: e.target.value.toUpperCase().replace(/[^A-Z0-9-]/g, '').slice(0, 8) })
                          }
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 font-mono text-sm uppercase dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        />
                        <Helper>Example: INV → INV-1730… on the next receipt.</Helper>
                      </label>
                    </PanelCard>
                    <BillPreviewCard
                      taxPercent={s.taxPercent}
                      defaultDiscountEnabled={s.defaultDiscountEnabled}
                      defaultDiscountPercent={s.defaultDiscountPercent}
                      serviceChargesEnabled={s.serviceChargesEnabled}
                      serviceChargeDefaultDelivery={s.serviceChargeDefaultDelivery}
                    />
                  </div>

                  <PanelCard title="Discounts & charges" subtitle="Turn features on first, then set the amounts.">
                    <ToggleRow
                      checked={s.defaultDiscountEnabled}
                      onChange={(v) => applyPatch({ defaultDiscountEnabled: v })}
                      title="Suggested staff discount"
                      helper="When on, the sample bill shows your default percentage. Staff can still change it per sale at the register."
                    />
                    <div className={cn(!s.defaultDiscountEnabled && 'pointer-events-none opacity-50')}>
                      <FieldLabel>Default discount (%)</FieldLabel>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        step={0.5}
                        value={s.defaultDiscountPercent}
                        onChange={(e) => applyPatch({ defaultDiscountPercent: Number(e.target.value) || 0 })}
                        className="mt-1.5 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                    </div>
                    <label className="block space-y-1.5">
                      <FieldLabel>Discount rules (short note)</FieldLabel>
                      <input
                        value={s.discountRulesNote}
                        onChange={(e) => applyPatch({ discountRulesNote: e.target.value })}
                        placeholder="e.g. Staff 5%, seniors capped at 10%"
                        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                    </label>
                    <ToggleRow
                      checked={s.serviceChargesEnabled}
                      onChange={(v) => applyPatch({ serviceChargesEnabled: v })}
                      title="Suggest service charges at checkout"
                      helper="When on, opening checkout can pre-select a delivery fee using the amount below."
                    />
                    <div className={cn(!s.serviceChargesEnabled && 'pointer-events-none opacity-50')}>
                      <FieldLabel>Default delivery fee (amount)</FieldLabel>
                      <input
                        type="number"
                        min={0}
                        step={1}
                        value={s.serviceChargeDefaultDelivery}
                        onChange={(e) => applyPatch({ serviceChargeDefaultDelivery: Math.max(0, Number(e.target.value) || 0) })}
                        className="mt-1.5 w-full max-w-xs rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm tabular-nums dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                      />
                      <Helper>Set to zero if you rarely charge delivery.</Helper>
                    </div>
                  </PanelCard>
                </motion.div>
              )}

              {active === 'receipt' && (
                <motion.div key="receipt" {...panelMotion} className="space-y-5">
                  <div className="grid gap-5 lg:grid-cols-2">
                    <PanelCard title="Print & layout" subtitle="Choose the format your printer expects.">
                      <label className="block space-y-1.5">
                        <FieldLabel>Receipt type</FieldLabel>
                        <select
                          value={s.receiptFormat}
                          onChange={(e) => applyPatch({ receiptFormat: e.target.value as ReceiptFormat })}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                        >
                          <option value="thermal">Thermal (80mm)</option>
                          <option value="a4">A4 invoice</option>
                        </select>
                      </label>
                      <ToggleRow
                        checked={s.autoPrintAfterCheckout}
                        onChange={(v) => applyPatch({ autoPrintAfterCheckout: v })}
                        title="Auto-print after checkout"
                        helper="Sends a print job right after completing a sale (simulated in this demo)."
                      />
                      <ToggleRow
                        checked={s.receiptShowLogo}
                        onChange={(v) => applyPatch({ receiptShowLogo: v })}
                        title="Show logo area on receipt"
                        helper="Reserves space at the top for your brand mark on printed PDFs."
                      />
                      <ToggleRow
                        checked={s.receiptShowCustomerInfo}
                        onChange={(v) => applyPatch({ receiptShowCustomerInfo: v })}
                        title="Show customer on receipt"
                        helper="Hides name and phone on the printed copy when privacy matters."
                      />
                    </PanelCard>
                    <div className="rounded-[18px] border border-dashed border-slate-200/90 bg-slate-50/80 p-4 dark:border-zinc-800 dark:bg-zinc-900/40">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400 dark:text-zinc-500">Live preview</p>
                      <div className="mt-3 flex min-h-[280px] items-start justify-center rounded-2xl bg-white/60 py-4 dark:bg-zinc-950/30">
                        <ReceiptPreviewCard
                          name={s.pharmacyName}
                          address={s.pharmacyAddress}
                          phone={s.pharmacyPhone}
                          format={s.receiptFormat}
                          showLogo={s.receiptShowLogo}
                          showCustomer={s.receiptShowCustomerInfo}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}

              {active === 'system' && (
                <motion.div key="system" {...panelMotion} className="space-y-5">
                  <SettingsDiagnosticsPanel appVersion={s.appVersion} />
                  <PanelCard title="Change password" subtitle="Update your account password used for login.">
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="block space-y-1.5 sm:col-span-2">
                        <FieldLabel>Account</FieldLabel>
                        <input
                          value={user ? `${user.username} (${user.email})` : 'No account configured'}
                          disabled
                          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-500 dark:border-zinc-700 dark:bg-zinc-900/60 dark:text-zinc-400"
                        />
                      </label>
                      <label className="block space-y-1.5 sm:col-span-2">
                        <FieldLabel>Current password</FieldLabel>
                        <input
                          type="password"
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                          placeholder="Enter current password"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <FieldLabel>New password</FieldLabel>
                        <input
                          type="password"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                          placeholder="Minimum 6 characters"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <FieldLabel>Confirm new password</FieldLabel>
                        <input
                          type="password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm dark:border-zinc-700 dark:bg-zinc-950 dark:text-white"
                          placeholder="Re-enter new password"
                        />
                      </label>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleChangePassword()}
                        disabled={changingPassword || !user}
                        className="rounded-2xl bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60 dark:bg-white dark:text-slate-900"
                      >
                        {changingPassword ? 'Updating...' : 'Change password'}
                      </button>
                      <Helper>Use a strong password and avoid reusing old credentials.</Helper>
                    </div>
                  </PanelCard>
                  <PanelCard title="Data reload" subtitle="Use only when support asks you to rehydrate local session data.">
                    <button
                      type="button"
                      onClick={handleResetDemo}
                      className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-3 text-sm font-semibold text-rose-900 hover:bg-rose-100 dark:border-rose-900/50 dark:bg-rose-950/40 dark:text-rose-100 dark:hover:bg-rose-950/70"
                    >
                      Reload backend data
                    </button>
                    <Helper>
                      Reload clears local session state and fetches fresh medicines, references, and business records
                      from backend.
                    </Helper>
                  </PanelCard>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
};
