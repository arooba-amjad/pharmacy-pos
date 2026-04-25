import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, HandCoins, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useAppStore } from '@/store/useAppStore';
import type { Customer } from '@/types';
import { cn, formatCurrency } from '@/lib/utils';
import { customerCreditLedgerStats } from '@/lib/customerCredit';
import { PayDuesModal } from '@/components/pos/PayDuesModal';

function balanceDot(c: Customer): 'green' | 'yellow' | 'red' {
  if (c.balance <= 0) return 'green';
  const lim = c.creditLimit ?? 8000;
  if (c.balance >= lim * 0.72) return 'red';
  return 'yellow';
}

function dotColor(t: 'green' | 'yellow' | 'red'): string {
  if (t === 'green') return '#22c55e';
  if (t === 'yellow') return '#eab308';
  return '#ef4444';
}

interface CustomerForm {
  name: string;
  phone: string;
  address: string;
  creditLimit: string;
  balance: string;
}

const emptyForm = (): CustomerForm => ({
  name: '',
  phone: '',
  address: '',
  creditLimit: '',
  balance: '0',
});

export const Customers: React.FC = () => {
  const customers = usePOSBillingStore((s) => s.customers);
  const sales = usePOSBillingStore((s) => s.sales);
  const addCustomer = usePOSBillingStore((s) => s.addCustomer);
  const updateCustomer = usePOSBillingStore((s) => s.updateCustomer);
  const removeCustomer = usePOSBillingStore((s) => s.removeCustomer);
  const recordCustomerBalancePayment = usePOSBillingStore((s) => s.recordCustomerBalancePayment);
  const setCurrentScreen = useAppStore((s) => s.setCurrentScreen);

  const [query, setQuery] = useState('');
  const [customerFilter, setCustomerFilter] = useState<'all' | 'credit'>('all');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [payDuesOpen, setPayDuesOpen] = useState(false);
  const [quickPayCustomerId, setQuickPayCustomerId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerForm>(emptyForm());

  const quickPayCustomer = useMemo(
    () => (quickPayCustomerId ? customers.find((c) => c.id === quickPayCustomerId) ?? null : null),
    [customers, quickPayCustomerId]
  );

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    let rows = customers;
    if (q) {
      rows = rows.filter((c) => c.name.toLowerCase().includes(q) || c.phone.toLowerCase().includes(q));
    }
    if (customerFilter === 'credit') {
      rows = rows
        .filter((c) => c.balance > 0)
        .sort((a, b) => b.balance - a.balance || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    }
    return rows;
  }, [customers, query, customerFilter]);

  const profile = profileId ? customers.find((c) => c.id === profileId) ?? null : null;

  useEffect(() => {
    if (!profileId) setPayDuesOpen(false);
  }, [profileId]);

  useEffect(() => {
    if (profileId) setQuickPayCustomerId(null);
  }, [profileId]);

  const profileSales = useMemo(() => {
    if (!profileId) return [];
    return [...sales]
      .filter((s) => s.customer?.id === profileId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 8);
  }, [sales, profileId]);

  const purchaseCount = (id: string) => sales.filter((s) => s.customer?.id === id).length;

  const openAdd = () => {
    setForm(emptyForm());
    setAddOpen(true);
  };

  const openEdit = (c: Customer) => {
    setForm({
      name: c.name,
      phone: c.phone,
      address: c.address ?? '',
      creditLimit: c.creditLimit != null ? String(c.creditLimit) : '',
      balance: String(c.balance),
    });
    setEditId(c.id);
  };

  const saveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = await addCustomer({
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || undefined,
      creditLimit: form.creditLimit.trim() ? Number(form.creditLimit) : undefined,
      balance: 0,
    });
    if (id) setAddOpen(false);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !form.name.trim()) return;
    await updateCustomer(editId, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      address: form.address.trim() || undefined,
      creditLimit: form.creditLimit.trim() ? Number(form.creditLimit) : undefined,
      balance: Number(form.balance) || 0,
    });
    setEditId(null);
  };

  const FormFields = (
    <>
      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Name *
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Phone *
        <input
          required
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Address
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
        Credit limit (optional)
        <input
          type="number"
          min={0}
          step={1}
          value={form.creditLimit}
          onChange={(e) => setForm((f) => ({ ...f, creditLimit: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-slate-50/90 p-4 sm:p-6 dark:bg-zinc-950">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">Customers</h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400">Profiles, balances, and recent activity.</p>
        </div>
        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center justify-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-slate-800 dark:bg-white dark:text-slate-900"
        >
          <Plus className="h-4 w-4" />
          Add customer
        </button>
      </header>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search customer name or phone…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
        />
      </div>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCustomerFilter('all')}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
            customerFilter === 'all'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          )}
        >
          All
        </button>
        <button
          type="button"
          onClick={() => setCustomerFilter('credit')}
          className={cn(
            'rounded-full px-3.5 py-1.5 text-xs font-bold transition',
            customerFilter === 'credit'
              ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
              : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-300 dark:hover:bg-zinc-800'
          )}
        >
          Credit
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((c) => {
            const tone = balanceDot(c);
            const n = purchaseCount(c.id);
            return (
              <li
                key={c.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{c.name}</p>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">{c.phone}</p>
                  </div>
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor(tone), opacity: 0.9 }}
                    title={tone === 'green' ? 'Clear' : tone === 'yellow' ? 'Balance pending' : 'High credit use'}
                  />
                </div>
                <p className="mt-3 text-lg font-bold tabular-nums text-slate-900 dark:text-white">
                  {formatCurrency(c.balance)}
                  <span className="ml-2 text-xs font-normal text-slate-500">outstanding</span>
                </p>
                <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{n} purchase{n === 1 ? '' : 's'}</p>
                {c.balance > 0.001 ? (
                  <button
                    type="button"
                    onClick={() => setQuickPayCustomerId(c.id)}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-amber-500/10 py-2 text-xs font-bold text-amber-950 transition hover:bg-amber-500/15 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-50 dark:hover:bg-amber-950/45"
                  >
                    <HandCoins className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    Pay balance
                  </button>
                ) : null}
                <div className="mt-3 flex gap-1 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    title="View profile"
                    onClick={() => setProfileId(c.id)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => openEdit(c)}
                    className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => {
                      if (!window.confirm(`Remove customer “${c.name}”?`)) return;
                      void (async () => {
                        const ok = await removeCustomer(c.id);
                        if (ok) setProfileId((id) => (id === c.id ? null : id));
                      })();
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-zinc-700 dark:text-red-400 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Profile drawer */}
      {profile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button type="button" className="absolute inset-0" aria-label="Close" onClick={() => setProfileId(null)} />
          <aside
            role="dialog"
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Customer profile</h2>
              <button
                type="button"
                onClick={() => setProfileId(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 text-sm">
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Info</h3>
                <p className="mt-2 text-lg font-semibold text-slate-900 dark:text-white">{profile.name}</p>
                <p className="text-slate-600 dark:text-zinc-400">{profile.phone}</p>
                <p className="mt-2 text-slate-600 dark:text-zinc-300">
                  {(profile.address ?? '—').trim() || '—'}
                </p>
              </section>
              <section>
                <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Financial</h3>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-slate-500">Total outstanding</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(profile.balance)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-slate-500">Credit limit</p>
                    <p className="text-lg font-bold tabular-nums">
                      {profile.creditLimit != null ? formatCurrency(profile.creditLimit) : '—'}
                    </p>
                  </div>
                </div>
                {profile.balance > 0 ? (
                  <button
                    type="button"
                    onClick={() => setPayDuesOpen(true)}
                    className="mt-3 w-full rounded-xl border border-amber-300/80 bg-amber-500/10 py-2.5 text-sm font-bold text-amber-950 transition hover:bg-amber-500/15 dark:border-amber-800/50 dark:bg-amber-950/35 dark:text-amber-50"
                  >
                    Record balance payment
                  </button>
                ) : null}
                {(profile.creditHistory?.length ?? 0) > 0 ? (
                  <>
                    <div className="mt-3 rounded-xl border border-slate-200/80 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Credit account (from POS)
                      </p>
                      {(() => {
                        const led = customerCreditLedgerStats(profile);
                        return (
                          <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                            <div>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500">Credit given</p>
                              <p className="text-sm font-bold tabular-nums">{formatCurrency(led.totalCreditGiven)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500">Paid down</p>
                              <p className="text-sm font-bold tabular-nums text-emerald-600 dark:text-emerald-400">
                                {formatCurrency(led.paidAmount)}
                              </p>
                            </div>
                            <div>
                              <p className="text-[10px] text-slate-500 dark:text-zinc-500">Remaining</p>
                              <p className="text-sm font-bold tabular-nums">{formatCurrency(led.remainingBalance)}</p>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="mt-3">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                        Credit history
                      </p>
                      <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto text-xs">
                        {profile.creditHistory!
                          .slice()
                          .reverse()
                          .map((h, i) => (
                            <li
                              key={`${h.invoiceId}-${i}`}
                              className="flex justify-between rounded-lg border border-slate-100 px-2 py-1.5 dark:border-zinc-800"
                            >
                              <span className="font-mono text-slate-600 dark:text-zinc-400">
                                {h.kind === 'payment' ? 'Payment' : h.invoiceId}
                              </span>
                              <span
                                className={
                                  h.kind === 'payment'
                                    ? 'font-bold tabular-nums text-emerald-700 dark:text-emerald-400'
                                    : 'font-bold tabular-nums text-slate-900 dark:text-zinc-100'
                                }
                              >
                                {h.kind === 'payment' ? '−' : '+'}
                                {formatCurrency(h.amount)}
                              </span>
                            </li>
                          ))}
                      </ul>
                    </div>
                  </>
                ) : null}
              </section>
              <section>
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-[11px] font-bold uppercase tracking-wide text-slate-400">Recent purchases</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileId(null);
                      setCurrentScreen('Sales');
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open Sales
                  </button>
                </div>
                {profileSales.length === 0 ? (
                  <p className="mt-2 text-xs text-slate-500">No linked sales yet.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {profileSales.map((s) => (
                      <li
                        key={s.id}
                        className="flex items-center justify-between rounded-xl border border-slate-100 px-3 py-2 dark:border-zinc-800"
                      >
                        <div>
                          <p className="font-medium text-slate-800 dark:text-zinc-100">{s.invoiceNo}</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(s.timestamp), 'MMM d, yyyy')}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">{formatCurrency(s.total)}</p>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </aside>
        </div>
      )}

      {profile && payDuesOpen ? (
        <PayDuesModal
          open={payDuesOpen}
          previousBalance={profile.balance}
          currentBill={0}
          onClose={() => setPayDuesOpen(false)}
          onConfirm={async (amt) => (await recordCustomerBalancePayment(profile.id, amt)).ok}
        />
      ) : null}

      {quickPayCustomer ? (
        <PayDuesModal
          open
          previousBalance={quickPayCustomer.balance}
          currentBill={0}
          onClose={() => setQuickPayCustomerId(null)}
          onConfirm={async (amt) => (await recordCustomerBalancePayment(quickPayCustomer.id, amt)).ok}
        />
      ) : null}

      {/* Add modal */}
      {addOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setAddOpen(false)} aria-label="Close" />
          <form
            onSubmit={saveAdd}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New customer</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FormFields}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setAddOpen(false)} className="flex-1 rounded-xl border py-2 text-sm font-medium dark:border-zinc-700">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit modal */}
      {editId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setEditId(null)} aria-label="Close" />
          <form
            onSubmit={saveEdit}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit customer</h2>
              <button type="button" onClick={() => setEditId(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FormFields}
            <label className="block text-xs font-semibold text-slate-500 dark:text-zinc-400">
              Current balance
              <input
                type="number"
                min={0}
                step={0.01}
                value={form.balance}
                onChange={(e) => setForm((f) => ({ ...f, balance: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditId(null)} className="flex-1 rounded-xl border py-2 text-sm font-medium dark:border-zinc-700">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
