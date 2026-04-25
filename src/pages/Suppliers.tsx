import React, { useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Eye, Pencil, Plus, Search, Trash2, X } from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useAppStore } from '@/store/useAppStore';
import type { Manufacturer, Supplier } from '@/types';
import { formatCurrency } from '@/lib/utils';

function duesTone(s: Supplier): 'green' | 'yellow' | 'red' {
  if (s.outstandingBalance <= 0) return 'green';
  if (s.outstandingBalance < 5000) return 'yellow';
  return 'red';
}

function dotColor(t: 'green' | 'yellow' | 'red') {
  if (t === 'green') return '#22c55e';
  if (t === 'yellow') return '#eab308';
  return '#ef4444';
}

interface SupplierForm {
  name: string;
  phone: string;
  company: string;
  address: string;
  outstanding: string;
}

const emptyForm = (): SupplierForm => ({
  name: '',
  phone: '',
  company: '',
  address: '',
  outstanding: '0',
});

interface ManufacturerForm {
  name: string;
  phone: string;
  company: string;
  address: string;
}

const emptyManufacturerForm = (): ManufacturerForm => ({
  name: '',
  phone: '',
  company: '',
  address: '',
});

export const Suppliers: React.FC = () => {
  const suppliers = usePOSBillingStore((s) => s.suppliers);
  const purchases = usePOSBillingStore((s) => s.purchases);
  const manufacturers = usePOSBillingStore((s) => s.manufacturers);
  const addSupplier = usePOSBillingStore((s) => s.addSupplier);
  const updateSupplier = usePOSBillingStore((s) => s.updateSupplier);
  const removeSupplier = usePOSBillingStore((s) => s.removeSupplier);
  const addManufacturer = usePOSBillingStore((s) => s.addManufacturer);
  const updateManufacturer = usePOSBillingStore((s) => s.updateManufacturer);
  const removeManufacturer = usePOSBillingStore((s) => s.removeManufacturer);
  const setCurrentScreen = useAppStore((s) => s.setCurrentScreen);

  const [query, setQuery] = useState('');
  const [profileId, setProfileId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState<SupplierForm>(emptyForm());
  const [manufacturerProfileId, setManufacturerProfileId] = useState<string | null>(null);
  const [manufacturerAddOpen, setManufacturerAddOpen] = useState(false);
  const [manufacturerEditId, setManufacturerEditId] = useState<string | null>(null);
  const [manufacturerForm, setManufacturerForm] = useState<ManufacturerForm>(emptyManufacturerForm());

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return suppliers;
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        (s.company ?? '').toLowerCase().includes(q)
    );
  }, [suppliers, query]);

  const profile = profileId ? suppliers.find((s) => s.id === profileId) ?? null : null;
  const manufacturerProfile = manufacturerProfileId
    ? manufacturers.find((m) => m.id === manufacturerProfileId) ?? null
    : null;

  const filteredManufacturers = useMemo(() => {
    const q = query.toLowerCase().trim();
    if (!q) return manufacturers;
    return manufacturers.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        (m.company ?? '').toLowerCase().includes(q)
    );
  }, [manufacturers, query]);

  const profilePurchases = useMemo(() => {
    if (!profileId) return [];
    return [...purchases]
      .filter((p) => p.supplierId === profileId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }, [purchases, profileId]);

  const totalPurchases = (id: string) =>
    purchases.filter((p) => p.supplierId === id && p.status === 'completed').reduce((a, p) => a + p.total, 0);

  const openAdd = () => {
    setForm(emptyForm());
    setAddOpen(true);
  };

  const openEdit = (s: Supplier) => {
    setForm({
      name: s.name,
      phone: s.phone,
      company: s.company ?? '',
      address: s.address ?? '',
      outstanding: String(s.outstandingBalance),
    });
    setEditId(s.id);
  };

  const openManufacturerAdd = () => {
    setManufacturerForm(emptyManufacturerForm());
    setManufacturerAddOpen(true);
  };

  const openManufacturerEdit = (m: Manufacturer) => {
    setManufacturerForm({
      name: m.name,
      phone: m.phone,
      company: m.company ?? '',
      address: m.address ?? '',
    });
    setManufacturerEditId(m.id);
  };

  const saveAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    const id = await addSupplier({
      name: form.name.trim(),
      phone: form.phone.trim(),
      company: form.company.trim() || undefined,
      address: form.address.trim() || undefined,
      outstandingBalance: Number(form.outstanding) || 0,
    });
    if (id) setAddOpen(false);
  };

  const saveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editId || !form.name.trim()) return;
    await updateSupplier(editId, {
      name: form.name.trim(),
      phone: form.phone.trim(),
      company: form.company.trim() || undefined,
      address: form.address.trim() || undefined,
      outstandingBalance: Number(form.outstanding) || 0,
    });
    setEditId(null);
  };

  const saveManufacturerAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manufacturerForm.name.trim()) return;
    const id = await addManufacturer({
      name: manufacturerForm.name.trim(),
      phone: manufacturerForm.phone.trim(),
      company: manufacturerForm.company.trim() || undefined,
      address: manufacturerForm.address.trim() || undefined,
    });
    if (id) setManufacturerAddOpen(false);
  };

  const saveManufacturerEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!manufacturerEditId || !manufacturerForm.name.trim()) return;
    await updateManufacturer(manufacturerEditId, {
      name: manufacturerForm.name.trim(),
      phone: manufacturerForm.phone.trim(),
      company: manufacturerForm.company.trim() || undefined,
      address: manufacturerForm.address.trim() || undefined,
    });
    setManufacturerEditId(null);
  };

  const FormBody = (
    <>
      <label className="block text-xs font-semibold text-slate-500">
        Name *
        <input
          required
          value={form.name}
          onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-500">
        Phone *
        <input
          required
          value={form.phone}
          onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-500">
        Company
        <input
          value={form.company}
          onChange={(e) => setForm((f) => ({ ...f, company: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
      <label className="block text-xs font-semibold text-slate-500">
        Address
        <input
          value={form.address}
          onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
        />
      </label>
    </>
  );

  const mockPayments = [
    { id: '1', label: 'Bank transfer', amount: 25000, date: '2026-04-01' },
    { id: '2', label: 'Cash deposit', amount: 8000, date: '2026-04-08' },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 bg-slate-50/90 p-4 sm:p-6 dark:bg-zinc-950">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Suppliers</h1>
          <p className="text-sm text-slate-600 dark:text-zinc-400">Vendors and manufacturers at a glance.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={openAdd}
            className="inline-flex items-center gap-2 self-start rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white dark:bg-white dark:text-slate-900"
          >
            <Plus className="h-4 w-4" />
            Add supplier
          </button>
          <button
            type="button"
            onClick={openManufacturerAdd}
            className="inline-flex items-center gap-2 self-start rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
          >
            <Plus className="h-4 w-4" />
            Add manufacturer
          </button>
        </div>
      </header>

      <div className="relative max-w-xl">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search supplier name or phone…"
          className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-3 text-sm dark:border-zinc-800 dark:bg-zinc-900 dark:text-white"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <h2 className="mb-3 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">Suppliers</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((s) => {
            const tone = duesTone(s);
            const vol = totalPurchases(s.id);
            return (
              <li
                key={s.id}
                className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white">{s.name}</p>
                    <p className="text-sm text-slate-600 dark:text-zinc-400">{s.phone}</p>
                    {s.company ? (
                      <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{s.company}</p>
                    ) : null}
                  </div>
                  <span
                    className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: dotColor(tone), opacity: 0.9 }}
                    title={tone === 'green' ? 'No dues' : tone === 'yellow' ? 'Pending' : 'High outstanding'}
                  />
                </div>
                <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Accounts payable</p>
                <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{formatCurrency(s.outstandingBalance)}</p>
                <p className="text-xs text-muted-foreground">
                  Completed purchases:{' '}
                  <span className="font-semibold tabular-nums text-foreground">{formatCurrency(vol)}</span>
                </p>
                <div className="mt-3 flex gap-1 border-t border-slate-100 pt-3 dark:border-zinc-800">
                  <button
                    type="button"
                    title="View"
                    onClick={() => setProfileId(s.id)}
                    className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Eye className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Edit"
                    onClick={() => openEdit(s)}
                    className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    title="Delete"
                    onClick={() => {
                      if (!window.confirm(`Remove supplier “${s.name}”?`)) return;
                      void (async () => {
                        const ok = await removeSupplier(s.id);
                        if (!ok) window.alert('Remove linked purchases first, or keep supplier on file.');
                        else setProfileId((id) => (id === s.id ? null : id));
                      })();
                    }}
                    className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-zinc-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
        <h2 className="mb-3 mt-8 text-sm font-black uppercase tracking-wide text-slate-500 dark:text-zinc-400">Manufacturers</h2>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filteredManufacturers.map((m) => (
            <li
              key={m.id}
              className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{m.name}</p>
                <p className="text-sm text-slate-600 dark:text-zinc-400">{m.phone}</p>
                {m.company ? <p className="mt-1 text-xs text-slate-500 dark:text-zinc-500">{m.company}</p> : null}
              </div>
              <div className="mt-3 flex gap-1 border-t border-slate-100 pt-3 dark:border-zinc-800">
                <button
                  type="button"
                  title="View"
                  onClick={() => setManufacturerProfileId(m.id)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <Eye className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Edit"
                  onClick={() => openManufacturerEdit(m)}
                  className="rounded-lg border border-slate-200 p-2 hover:bg-slate-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  title="Delete"
                  onClick={() => {
                    if (!window.confirm(`Remove manufacturer “${m.name}”?`)) return;
                    void (async () => {
                      const ok = await removeManufacturer(m.id);
                      if (!ok) window.alert('This manufacturer is currently used by medicines.');
                      else setManufacturerProfileId((id) => (id === m.id ? null : id));
                    })();
                  }}
                  className="rounded-lg border border-slate-200 p-2 text-red-600 hover:bg-red-50 dark:border-zinc-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {profile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button type="button" className="absolute inset-0" onClick={() => setProfileId(null)} aria-label="Close" />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">Supplier profile</h2>
              <button type="button" onClick={() => setProfileId(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 text-sm">
              <section>
                <h3 className="text-[11px] font-bold uppercase text-slate-400">Info</h3>
                <p className="mt-2 text-lg font-semibold">{profile.name}</p>
                <p className="text-slate-600 dark:text-zinc-400">{profile.phone}</p>
                <p className="mt-2 text-slate-600">{(profile.address ?? '—').trim() || '—'}</p>
              </section>
              <section>
                <h3 className="text-[11px] font-bold uppercase text-slate-400">Financial</h3>
                <div className="mt-2 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-slate-500">Outstanding</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(profile.outstandingBalance)}</p>
                  </div>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-zinc-900">
                    <p className="text-xs text-slate-500">Purchases (completed)</p>
                    <p className="text-lg font-bold tabular-nums">{formatCurrency(totalPurchases(profile.id))}</p>
                  </div>
                </div>
              </section>
              <section>
                <h3 className="text-[11px] font-bold uppercase text-slate-400">Payment history (demo)</h3>
                <ul className="mt-2 space-y-2">
                  {mockPayments.map((m) => (
                    <li key={m.id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-zinc-800">
                      <span>
                        {m.label}
                        <span className="block text-xs text-slate-500">{m.date}</span>
                      </span>
                      <span className="font-semibold text-emerald-700 dark:text-emerald-400">
                        −{formatCurrency(m.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
              <section>
                <div className="flex items-center justify-between">
                  <h3 className="text-[11px] font-bold uppercase text-slate-400">Purchase history</h3>
                  <button
                    type="button"
                    onClick={() => {
                      setProfileId(null);
                      setCurrentScreen('Purchases');
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Open Purchases
                  </button>
                </div>
                <ul className="mt-2 space-y-2">
                  {profilePurchases.length === 0 ? (
                    <li className="text-xs text-slate-500">No GRNs yet.</li>
                  ) : (
                    profilePurchases.map((p) => (
                      <li key={p.id} className="flex justify-between rounded-lg border border-slate-100 px-3 py-2 dark:border-zinc-800">
                        <div>
                          <p className="font-medium">{p.grnNo}</p>
                          <p className="text-xs text-slate-500">
                            {format(new Date(p.timestamp), 'MMM d, yyyy')} · {p.status}
                          </p>
                        </div>
                        <p className="font-semibold tabular-nums">{formatCurrency(p.total)}</p>
                      </li>
                    ))
                  )}
                </ul>
              </section>
            </div>
          </aside>
        </div>
      )}

      {manufacturerProfile && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/40">
          <button
            type="button"
            className="absolute inset-0"
            onClick={() => setManufacturerProfileId(null)}
            aria-label="Close"
          />
          <aside className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-zinc-950">
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 dark:border-zinc-800">
              <h2 className="font-semibold text-slate-900 dark:text-white">Manufacturer profile</h2>
              <button
                type="button"
                onClick={() => setManufacturerProfileId(null)}
                className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4 text-sm">
              <section>
                <h3 className="text-[11px] font-bold uppercase text-slate-400">Info</h3>
                <p className="mt-2 text-lg font-semibold">{manufacturerProfile.name}</p>
                <p className="text-slate-600 dark:text-zinc-400">{manufacturerProfile.phone}</p>
                <p className="mt-2 text-slate-600">{(manufacturerProfile.address ?? '—').trim() || '—'}</p>
              </section>
            </div>
          </aside>
        </div>
      )}

      {addOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setAddOpen(false)} aria-label="Close" />
          <form
            onSubmit={saveAdd}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New supplier</h2>
              <button type="button" onClick={() => setAddOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FormBody}
            <label className="block text-xs font-semibold text-slate-500">
              Opening outstanding (optional)
              <input
                type="number"
                min={0}
                value={form.outstanding}
                onChange={(e) => setForm((f) => ({ ...f, outstanding: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setAddOpen(false)} className="flex-1 rounded-xl border py-2 text-sm dark:border-zinc-700">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {editId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setEditId(null)} aria-label="Close" />
          <form
            onSubmit={saveEdit}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit supplier</h2>
              <button type="button" onClick={() => setEditId(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            {FormBody}
            <label className="block text-xs font-semibold text-slate-500">
              Outstanding balance
              <input
                type="number"
                min={0}
                value={form.outstanding}
                onChange={(e) => setForm((f) => ({ ...f, outstanding: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setEditId(null)} className="flex-1 rounded-xl border py-2 text-sm dark:border-zinc-700">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                Save changes
              </button>
            </div>
          </form>
        </div>
      )}

      {manufacturerAddOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setManufacturerAddOpen(false)} aria-label="Close" />
          <form
            onSubmit={saveManufacturerAdd}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">New manufacturer</h2>
              <button type="button" onClick={() => setManufacturerAddOpen(false)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-500">
              Name *
              <input
                required
                value={manufacturerForm.name}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Phone *
              <input
                required
                value={manufacturerForm.phone}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Company
              <input
                value={manufacturerForm.company}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, company: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Address
              <input
                value={manufacturerForm.address}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setManufacturerAddOpen(false)} className="flex-1 rounded-xl border py-2 text-sm dark:border-zinc-700">
                Cancel
              </button>
              <button type="submit" className="flex-1 rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white dark:bg-white dark:text-slate-900">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {manufacturerEditId && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center">
          <button type="button" className="absolute inset-0" onClick={() => setManufacturerEditId(null)} aria-label="Close" />
          <form
            onSubmit={saveManufacturerEdit}
            className="relative z-10 w-full max-w-md space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl dark:border-zinc-800 dark:bg-zinc-950"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">Edit manufacturer</h2>
              <button type="button" onClick={() => setManufacturerEditId(null)} className="rounded-lg p-1 hover:bg-slate-100 dark:hover:bg-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>
            <label className="block text-xs font-semibold text-slate-500">
              Name *
              <input
                required
                value={manufacturerForm.name}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, name: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Phone *
              <input
                required
                value={manufacturerForm.phone}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, phone: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Company
              <input
                value={manufacturerForm.company}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, company: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Address
              <input
                value={manufacturerForm.address}
                onChange={(e) => setManufacturerForm((f) => ({ ...f, address: e.target.value }))}
                className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900 dark:text-white"
              />
            </label>
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setManufacturerEditId(null)} className="flex-1 rounded-xl border py-2 text-sm dark:border-zinc-700">
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
