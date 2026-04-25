import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft,
  Printer,
  Save,
  CheckCircle2,
  Package,
  Banknote,
  Wallet,
  CreditCard,
  HandCoins,
} from 'lucide-react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { useToastStore } from '@/store/useToastStore';
import { RECEIPT_BRANDING } from '@/lib/receiptConstants';
import { buildReceiptPdf, type ReceiptPdfInput, type ReceiptPaymentBreakdown } from '@/lib/buildReceiptPdf';
import { getReceiptBrandingFromSettings, useSettingsStore } from '@/store/useSettingsStore';
import { CreditPaymentModal } from '@/components/pos/CreditPaymentModal';
import { formatSellQuantityLabel } from '@/lib/posCartQuantity';
import { cartLineSubtotal } from '@/lib/cartFefoAllocation';
import { formatCurrency, cn } from '@/lib/utils';
import { displayManufacturerForCartLine } from '@/lib/medicineDisplay';
import { CustomerCreditBalanceStrip } from '@/components/pos/CustomerCreditBalanceStrip';
import { customerHasOutstandingCredit } from '@/lib/customerCreditAlerts';
import { PayDuesModal } from '@/components/pos/PayDuesModal';
import type { ServiceChargeSnapshot } from '@/types';

function emptyCharges(): ServiceChargeSnapshot {
  return { deliveryFee: 0, serviceFee: 0, customLabel: 'Service charge', customAmount: 0 };
}

function normPhoneDigits(p: string): string {
  return p.replace(/[\s-]/g, '').toLowerCase();
}

type ReceiptPlainOverrides = {
  paymentMethod?: string;
  creditAmount?: number;
  paidCashPortion?: number;
  paymentBreakdown?: ReceiptPaymentBreakdown;
};

function buildReceiptPlainText(overrides?: ReceiptPlainOverrides): string {
  const s = usePOSBillingStore.getState();
  const st = useSettingsStore.getState();
  const { cart, customer, paymentMethod, receiptInvoiceNo, discountType, discount, medicines } = s;
  const { subtotal, discountAmt, serviceTotal, tax, total } = s.getTotals();
  const sc = s.appliedServiceCharges;
  const lines: string[] = [];
  const ts = new Date().toLocaleString();
  const brand = getReceiptBrandingFromSettings();
  const pm = overrides?.paymentMethod ?? paymentMethod;

  lines.push(brand.name.toUpperCase());
  lines.push(brand.address);
  lines.push(brand.phone);
  lines.push('');
  lines.push(`Invoice: ${receiptInvoiceNo ?? '—'}`);
  lines.push(`Date: ${ts}`);
  if (customer && st.receiptShowCustomerInfo) {
    lines.push(`Customer: ${customer.name} · ${customer.phone}`);
  }
  if (overrides?.paymentBreakdown) {
    const b = overrides.paymentBreakdown;
    lines.push(`Previous balance: ${formatCurrency(b.previousBalance)}`);
    lines.push(`Current bill: ${formatCurrency(b.currentBill)}`);
    lines.push(`Paid amount: ${formatCurrency(b.paidAmount)}`);
    lines.push(`Remaining balance: ${formatCurrency(b.remainingBalance)}`);
  } else if (customer && customer.balance > 0) {
    lines.push(`Previous balance: ${formatCurrency(customer.balance)}`);
  }
  lines.push(`Payment: ${pm.toUpperCase()}`);
  if (overrides?.creditAmount != null) {
    lines.push(`CREDIT AMOUNT: ${formatCurrency(overrides.creditAmount)}`);
    if (overrides.paidCashPortion != null && overrides.paidCashPortion > 0.001) {
      lines.push(`CASH (same invoice): ${formatCurrency(overrides.paidCashPortion)}`);
    }
    lines.push('CUSTOMER DUES UPDATED');
  }
  lines.push('--------------------------------');
  for (const it of cart) {
    const lt = cartLineSubtotal(medicines, it);
    lines.push(`${it.name}`);
    lines.push(`  Mfr: ${displayManufacturerForCartLine(it, medicines)}`);
    lines.push(`  ${formatSellQuantityLabel(it)} × ${formatCurrency(it.unitPrice)} = ${formatCurrency(lt)}`);
  }
  lines.push('--------------------------------');
  lines.push(`Subtotal: ${formatCurrency(subtotal)}`);
  lines.push(`Discount: -${formatCurrency(discountAmt)} (${discountType === 'percentage' ? `${discount}%` : 'flat'})`);
  if (serviceTotal > 0) {
    if (sc.deliveryFee > 0) lines.push(`  Delivery: ${formatCurrency(sc.deliveryFee)}`);
    if (sc.serviceFee > 0) lines.push(`  Service: ${formatCurrency(sc.serviceFee)}`);
    if (sc.customAmount > 0) lines.push(`  ${sc.customLabel}: ${formatCurrency(sc.customAmount)}`);
    lines.push(`Service charges total: ${formatCurrency(serviceTotal)}`);
  }
  lines.push(`Tax (${st.taxPercent}%): ${formatCurrency(tax)}`);
  lines.push(`TOTAL: ${formatCurrency(total)}`);
  lines.push('');
  lines.push(RECEIPT_BRANDING.footerThanks);
  lines.push(RECEIPT_BRANDING.footerPolicy);
  lines.push(RECEIPT_BRANDING.footerSystem);
  return lines.join('\n');
}

function isEditableTarget(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null;
  if (!t) return false;
  const tag = t.tagName;
  if (tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (tag !== 'INPUT') return false;
  const type = (t as HTMLInputElement).type;
  return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'submit';
}

export const CheckoutFlowModal: React.FC = () => {
  const step = usePOSBillingStore((s) => s.checkoutFlowStep);
  const closeCheckoutFlow = usePOSBillingStore((s) => s.closeCheckoutFlow);
  const goToChargesStep = usePOSBillingStore((s) => s.goToChargesStep);
  const goBackToCustomerStep = usePOSBillingStore((s) => s.goBackToCustomerStep);
  const goBackToChargesFromReceipt = usePOSBillingStore((s) => s.goBackToChargesFromReceipt);
  const goToReceiptStep = usePOSBillingStore((s) => s.goToReceiptStep);
  const setAppliedServiceCharges = usePOSBillingStore((s) => s.setAppliedServiceCharges);
  const finalizeCheckoutFromReceipt = usePOSBillingStore((s) => s.finalizeCheckoutFromReceipt);
  const setPaymentMethod = usePOSBillingStore((s) => s.setPaymentMethod);
  const setCustomer = usePOSBillingStore((s) => s.setCustomer);
  const customers = usePOSBillingStore((s) => s.customers);
  const addCustomer = usePOSBillingStore((s) => s.addCustomer);

  const cart = usePOSBillingStore((s) => s.cart);
  const medicines = usePOSBillingStore((s) => s.medicines);
  const customer = usePOSBillingStore((s) => s.customer);
  const paymentMethod = usePOSBillingStore((s) => s.paymentMethod);
  const receiptInvoiceNo = usePOSBillingStore((s) => s.receiptInvoiceNo);
  const appliedServiceCharges = usePOSBillingStore((s) => s.appliedServiceCharges);
  const discountType = usePOSBillingStore((s) => s.discountType);
  const discount = usePOSBillingStore((s) => s.discount);

  const showToast = useToastStore((s) => s.show);
  const pharmacyName = useSettingsStore((s) => s.pharmacyName);
  const pharmacyAddress = useSettingsStore((s) => s.pharmacyAddress);
  const pharmacyPhone = useSettingsStore((s) => s.pharmacyPhone);
  const taxPercent = useSettingsStore((s) => s.taxPercent);
  const receiptShowCustomerInfo = useSettingsStore((s) => s.receiptShowCustomerInfo);

  const [creditModalOpen, setCreditModalOpen] = useState(false);
  /** When set, this checkout is settled as customer credit for this amount (≤ invoice total). */
  const [confirmedCreditAmount, setConfirmedCreditAmount] = useState<number | null>(null);
  /** Cash/card collected at counter (string for input); may exceed invoice when paying prior balance. */
  const [counterPaymentInput, setCounterPaymentInput] = useState('');
  const [payDuesOpen, setPayDuesOpen] = useState(false);

  const [checkoutName, setCheckoutName] = useState('');
  const [checkoutPhone, setCheckoutPhone] = useState('');
  const [checkoutMatchIndex, setCheckoutMatchIndex] = useState(0);
  const coNameRef = useRef<HTMLInputElement>(null);
  const coPhoneRef = useRef<HTMLInputElement>(null);

  const [serviceChargeInput, setServiceChargeInput] = useState('');
  const serviceChargeFieldRef = useRef<HTMLInputElement>(null);

  const checkoutCustomerMatches = useMemo(() => {
    const n = checkoutName.trim().toLowerCase();
    const p = normPhoneDigits(checkoutPhone);
    if (!n && !p) return [];
    const scored = customers
      .map((c) => {
        const cn = c.name.toLowerCase();
        const cp = normPhoneDigits(c.phone);
        let score = 0;
        if (p && cp === p) score += 100;
        else if (p && cp.includes(p)) score += 40;
        if (n && cn === n) score += 80;
        else if (n && cn.includes(n)) score += 30;
        return { c, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score);
    return scored.map((x) => x.c).slice(0, 8);
  }, [customers, checkoutName, checkoutPhone]);

  useEffect(() => {
    if (step !== 'customer') return;
    const cur = usePOSBillingStore.getState().customer;
    setCheckoutName(cur?.name?.trim() && cur.name !== 'Customer' ? cur.name : '');
    setCheckoutPhone(cur?.phone && cur.phone !== '—' ? cur.phone : '');
    setCheckoutMatchIndex(0);
    const t = window.requestAnimationFrame(() => coNameRef.current?.focus());
    return () => window.cancelAnimationFrame(t);
  }, [step]);

  useEffect(() => {
    setCheckoutMatchIndex((i) => {
      if (checkoutCustomerMatches.length === 0) return 0;
      return Math.min(Math.max(0, i), checkoutCustomerMatches.length - 1);
    });
  }, [checkoutCustomerMatches]);

  const proceedWalkIn = useCallback(() => {
    setCustomer(null);
    goToChargesStep();
  }, [setCustomer, goToChargesStep]);

  const pickCustomerAndContinue = useCallback(
    (c: (typeof customers)[0]) => {
      setCustomer(c);
      goToChargesStep();
    },
    [setCustomer, goToChargesStep]
  );

  const submitCheckoutCustomer = useCallback(async () => {
    const name = checkoutName.trim();
    const phone = checkoutPhone.trim();
    const matches = checkoutCustomerMatches;
    if (matches.length > 0) {
      const idx = Math.min(Math.max(0, checkoutMatchIndex), matches.length - 1);
      const c = matches[idx];
      if (c) {
        pickCustomerAndContinue(c);
        return;
      }
    }
    if (name && phone) {
      const np = normPhoneDigits(phone);
      const dup = customers.find(
        (c) => normPhoneDigits(c.phone) === np || c.name.trim().toLowerCase() === name.toLowerCase()
      );
      if (dup) {
        pickCustomerAndContinue(dup);
        return;
      }
      const id = await addCustomer({ name, phone, balance: 0 });
      if (!id) return;
      const row = usePOSBillingStore.getState().customers.find((c) => c.id === id);
      if (row) setCustomer(row);
      goToChargesStep();
      showToast('New customer saved and attached.', 'success');
      return;
    }
    if (!name && !phone) {
      proceedWalkIn();
      return;
    }
    showToast('Enter both name and phone to add a new customer, or pick a match below.', 'error');
  }, [
    checkoutName,
    checkoutPhone,
    checkoutCustomerMatches,
    checkoutMatchIndex,
    customers,
    addCustomer,
    setCustomer,
    goToChargesStep,
    proceedWalkIn,
    pickCustomerAndContinue,
    showToast,
  ]);

  useEffect(() => {
    if (step !== 'charges') return;
    setServiceChargeInput('');
    const t = window.requestAnimationFrame(() => serviceChargeFieldRef.current?.focus());
    return () => window.cancelAnimationFrame(t);
  }, [step]);

  useEffect(() => {
    if (step !== 'receipt') return;
    setPaymentMethod('cash');
    setConfirmedCreditAmount(null);
    setCreditModalOpen(false);
    setPayDuesOpen(false);
    const cap = Math.round(usePOSBillingStore.getState().getTotals().total * 100) / 100;
    setCounterPaymentInput(String(cap));
  }, [step, setPaymentMethod]);

  useEffect(() => {
    if (step !== 'customer') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.shiftKey) {
        e.preventDefault();
        proceedWalkIn();
        return;
      }
      if (e.key === 'Escape' && e.shiftKey) {
        e.preventDefault();
        closeCheckoutFlow();
        return;
      }
      if (checkoutCustomerMatches.length > 0 && !isEditableTarget(e.target)) {
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setCheckoutMatchIndex((i) => Math.min(checkoutCustomerMatches.length - 1, i + 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setCheckoutMatchIndex((i) => Math.max(0, i - 1));
          return;
        }
      }
      if (e.key === 'Enter' && !e.repeat && !isEditableTarget(e.target)) {
        e.preventDefault();
        void submitCheckoutCustomer();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [
    step,
    checkoutCustomerMatches,
    proceedWalkIn,
    closeCheckoutFlow,
    submitCheckoutCustomer,
  ]);

  const totals = useMemo(
    () => usePOSBillingStore.getState().getTotals(),
    [cart, appliedServiceCharges, discount, discountType]
  );

  const billTotal = useMemo(() => Math.round(totals.total * 100) / 100, [totals.total]);

  const receiptPaymentBreakdownPreview = useMemo((): ReceiptPaymentBreakdown | null => {
    if (!customer || confirmedCreditAmount != null) return null;
    if (paymentMethod !== 'cash' && paymentMethod !== 'card') return null;
    const parsed = parseFloat(counterPaymentInput.replace(/,/g, ''));
    const paid = Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : billTotal;
    const prevB = Math.round(customer.balance * 100) / 100;
    if (prevB <= 0 && Math.abs(paid - billTotal) < 0.005) return null;
    return {
      previousBalance: prevB,
      currentBill: billTotal,
      paidAmount: paid,
      remainingBalance: Math.max(0, Math.round((prevB + billTotal - paid) * 100) / 100),
    };
  }, [customer, confirmedCreditAmount, paymentMethod, counterPaymentInput, billTotal]);

  const applyChargesAndContinue = (snapshot: ServiceChargeSnapshot) => {
    setAppliedServiceCharges(snapshot);
    goToReceiptStep();
  };

  const handleSkipCharges = () => {
    applyChargesAndContinue(emptyCharges());
  };

  const handleAddCharges = () => {
    const raw = serviceChargeInput.trim();
    const n = parseFloat(raw);
    const amt = Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : 0;
    if (amt > 0) {
      applyChargesAndContinue({
        deliveryFee: 0,
        serviceFee: 0,
        customLabel: 'Service charge',
        customAmount: amt,
      });
    } else {
      applyChargesAndContinue(emptyCharges());
    }
  };

  const runFinalize = async (action: 'print' | 'save' | 'complete') => {
    const creditAmt = confirmedCreditAmount;
    const cap = Math.round(totals.total * 100) / 100;
    const cashPortion =
      creditAmt != null ? Math.max(0, Math.round((cap - creditAmt) * 100) / 100) : undefined;

    let finalizeOpts: { creditAmount: number } | { counterPayment: number } | undefined;
    if (creditAmt != null) {
      finalizeOpts = { creditAmount: creditAmt };
    } else if (customer && (paymentMethod === 'cash' || paymentMethod === 'card')) {
      const parsed = parseFloat(counterPaymentInput.replace(/,/g, ''));
      const amt = Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : cap;
      if (amt < 0) {
        showToast('Payment amount cannot be negative.', 'error');
        return;
      }
      finalizeOpts = { counterPayment: amt };
    }

    const paymentBreakdown: ReceiptPaymentBreakdown | undefined =
      finalizeOpts && 'counterPayment' in finalizeOpts && customer
        ? (() => {
            const paid = finalizeOpts.counterPayment;
            const prevB = Math.round(customer.balance * 100) / 100;
            if (prevB <= 0 && Math.abs(paid - cap) < 0.005) return undefined;
            return {
              previousBalance: prevB,
              currentBill: cap,
              paidAmount: paid,
              remainingBalance: Math.max(0, Math.round((prevB + cap - paid) * 100) / 100),
            };
          })()
        : undefined;

    const plainOverrides: ReceiptPlainOverrides | undefined =
      creditAmt != null
        ? {
            paymentMethod: 'credit',
            creditAmount: creditAmt,
            paidCashPortion: cashPortion && cashPortion > 0.001 ? cashPortion : undefined,
          }
        : paymentBreakdown
          ? { paymentBreakdown }
          : undefined;
    const text = buildReceiptPlainText(plainOverrides);
    const snapshotTotal = totals.total;
    const inv = receiptInvoiceNo ?? 'receipt';

    let pdfBlob: Blob | null = null;
    if (action === 'save') {
      const s = usePOSBillingStore.getState();
      const t = s.getTotals();
      const st = useSettingsStore.getState();
      const input: ReceiptPdfInput = {
        cart: s.cart.map((l) => ({ ...l })),
        medicines: s.medicines,
        customer: s.customer,
        paymentMethod: creditAmt != null ? 'credit' : s.paymentMethod,
        invoiceNo: inv,
        subtotal: t.subtotal,
        discountAmt: t.discountAmt,
        discountType: s.discountType,
        discountInput: s.discount,
        serviceCharges: { ...s.appliedServiceCharges },
        serviceTotal: t.serviceTotal,
        tax: t.tax,
        total: t.total,
        branding: getReceiptBrandingFromSettings(),
        showCustomerBlock: st.receiptShowCustomerInfo,
        taxLabel: `Tax (${st.taxPercent}%)`,
        ...(creditAmt != null
          ? {
              creditAmount: creditAmt,
              ...(cashPortion && cashPortion > 0.001 ? { paidCashPortion: cashPortion } : {}),
            }
          : {}),
        ...(paymentBreakdown ? { paymentBreakdown } : {}),
      };
      pdfBlob = buildReceiptPdf(input).output('blob');
    }

    const r = await finalizeCheckoutFromReceipt(action, finalizeOpts);
    if (!r.ok) {
      showToast(r.message ?? 'Could not finalize.', 'error');
      return;
    }
    if (action === 'print') {
      // eslint-disable-next-line no-console
      console.log('[PharmaOS] Print job (simulated)\n', text);
      showToast('Print job sent to receipt printer (simulated).', 'success');
    } else if (action === 'save' && pdfBlob) {
      const url = URL.createObjectURL(pdfBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${inv}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      showToast('Invoice saved as PDF.', 'success');
    } else {
      showToast(`Sale finalized · ${formatCurrency(snapshotTotal)}`, 'success');
    }
  };

  const runFinalizeRef = useRef(runFinalize);
  runFinalizeRef.current = runFinalize;

  const handleSkipRef = useRef(handleSkipCharges);
  const handleAddRef = useRef(handleAddCharges);
  handleSkipRef.current = handleSkipCharges;
  handleAddRef.current = handleAddCharges;

  useEffect(() => {
    if (step !== 'charges') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'b' || e.key === 'B') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        goBackToCustomerStep();
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        handleSkipRef.current();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        goBackToCustomerStep();
        return;
      }
      if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        handleAddRef.current();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, goBackToCustomerStep]);

  useEffect(() => {
    if (step !== 'receipt') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        goBackToChargesFromReceipt();
        return;
      }
      if (e.key === 'p' || e.key === 'P') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        void runFinalizeRef.current('print');
        return;
      }
      if (e.key === 's' || e.key === 'S') {
        if (isEditableTarget(e.target)) return;
        e.preventDefault();
        void runFinalizeRef.current('save');
        return;
      }
      if (e.key === 'Enter' && !e.repeat) {
        const t = e.target as HTMLElement | null;
        if (t?.tagName === 'BUTTON') return;
        if (t?.tagName === 'INPUT' || t?.tagName === 'TEXTAREA' || t?.tagName === 'SELECT') return;
        e.preventDefault();
        void runFinalizeRef.current('complete');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [step, goBackToChargesFromReceipt]);

  const open = step !== null;
  const receiptCreditMode = confirmedCreditAmount != null;
  const receiptCashPortionPreview =
    receiptCreditMode && customer
      ? Math.max(0, Math.round((totals.total - (confirmedCreditAmount ?? 0)) * 100) / 100)
      : 0;

  return (
    <AnimatePresence>
      {customer && creditModalOpen ? (
        <CreditPaymentModal
          open={creditModalOpen}
          customerName={customer.name}
          invoiceTotal={totals.total}
          defaultCreditAmount={totals.total}
          onCancel={() => setCreditModalOpen(false)}
          onConfirm={(amt) => {
            setConfirmedCreditAmount(amt);
            setPaymentMethod('credit');
            setCreditModalOpen(false);
          }}
        />
      ) : null}
      {customer && payDuesOpen ? (
        <PayDuesModal
          open={payDuesOpen}
          previousBalance={customer.balance}
          currentBill={billTotal}
          onClose={() => setPayDuesOpen(false)}
          onConfirm={(amtTowardDues) => {
            const bill = billTotal;
            const totalCollected = Math.round((bill + amtTowardDues) * 100) / 100;
            setCounterPaymentInput(String(totalCollected));
            setPaymentMethod('cash');
            setConfirmedCreditAmount(null);
            setPayDuesOpen(false);
          }}
        />
      ) : null}
      {open && (
        <motion.div
          className="fixed inset-0 z-[140] flex items-center justify-center p-4 sm:p-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <motion.button
            type="button"
            aria-label="Close backdrop"
            className="absolute inset-0 bg-slate-900/45 backdrop-blur-[6px]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={step === 'charges' || step === 'customer' ? closeCheckoutFlow : undefined}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby={
              step === 'customer'
                ? 'checkout-flow-title-customer'
                : step === 'charges'
                  ? 'checkout-flow-title-charges'
                  : 'checkout-flow-title-receipt'
            }
            className={cn(
              'relative z-10 w-full overflow-hidden rounded-[24px] border border-slate-200/90 bg-white shadow-2xl dark:border-border/60 dark:bg-card',
              step === 'receipt' ? 'max-w-lg max-h-[92vh] flex flex-col' : 'max-w-md'
            )}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
          >
            <AnimatePresence mode="wait">
              {step === 'customer' && (
                <motion.div
                  key="customer"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="flex max-h-[min(88vh,560px)] flex-col p-6 sm:p-8"
                >
                  <h2 id="checkout-flow-title-customer" className="text-xl font-black tracking-tight text-foreground mb-1">
                    Customer
                  </h2>
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                    Name and phone · matches appear below ·{' '}
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Enter</kbd> on phone to continue ·{' '}
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Esc</kbd> walk-in ·{' '}
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Shift+Esc</kbd> cancel sale ·{' '}
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">↑↓</kbd> when matches show
                  </p>

                  <label className="block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Name</span>
                    <input
                      id="checkout-co-name"
                      ref={coNameRef}
                      value={checkoutName}
                      onChange={(e) => setCheckoutName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          coPhoneRef.current?.focus();
                        }
                      }}
                      placeholder="Customer name"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none ring-primary/20 focus:ring-2 dark:border-border dark:bg-card/50"
                      autoComplete="name"
                    />
                  </label>
                  <label className="mt-3 block space-y-1">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Phone</span>
                    <input
                      id="checkout-co-phone"
                      ref={coPhoneRef}
                      value={checkoutPhone}
                      onChange={(e) => setCheckoutPhone(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          void submitCheckoutCustomer();
                        }
                      }}
                      placeholder="Phone number"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm shadow-sm outline-none ring-primary/20 focus:ring-2 dark:border-border dark:bg-card/50"
                      autoComplete="tel"
                    />
                  </label>

                  {checkoutCustomerMatches.length > 0 ? (
                    <div className="mt-4 min-h-0 flex-1 space-y-1.5 overflow-y-auto pr-1">
                      <p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground px-0.5">
                        Matching customers
                      </p>
                      {checkoutCustomerMatches.map((c, i) => {
                        const hi = checkoutMatchIndex === i;
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setCheckoutMatchIndex(i);
                              pickCustomerAndContinue(c);
                            }}
                            className={cn(
                              'flex w-full flex-col rounded-xl border px-3 py-2.5 text-left text-sm transition',
                              hi
                                ? 'border-primary bg-primary/10 ring-2 ring-primary/25'
                                : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-border dark:bg-card/40'
                            )}
                          >
                            <span className="font-bold">{c.name}</span>
                            <span className="text-xs text-muted-foreground">{c.phone}</span>
                            {c.balance > 0 ? (
                              <span className="mt-1 inline-flex w-fit rounded-md bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold text-amber-900 dark:text-amber-100">
                                Outstanding {formatCurrency(c.balance)}
                              </span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-3 text-[11px] text-muted-foreground">
                      No match yet — leave both fields blank and press Enter (or Esc) for walk-in, or fill both to create
                      a new customer.
                    </p>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-border/60 pt-4">
                    <button
                      type="button"
                      onClick={proceedWalkIn}
                      className="rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-sm font-bold text-foreground hover:bg-muted/50"
                    >
                      Walk-in
                    </button>
                    <button
                      type="button"
                      onClick={submitCheckoutCustomer}
                      className="rounded-xl bg-primary px-4 py-2.5 text-sm font-black text-primary-foreground shadow-md shadow-primary/25"
                    >
                      Continue
                    </button>
                  </div>
                </motion.div>
              )}

              {step === 'charges' && (
                <motion.div
                  key="charges"
                  tabIndex={-1}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}
                  className="p-6 sm:p-8 outline-none focus-visible:ring-2 focus-visible:ring-primary/25"
                >
                  <h2 id="checkout-flow-title-charges" className="text-xl font-black tracking-tight text-foreground mb-1">
                    Service charges
                  </h2>
                  <p className="text-sm text-muted-foreground mb-2 leading-relaxed">
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Enter</kbd> add to bill (or leave empty)
                    · <kbd className="rounded bg-muted px-1 font-mono text-[11px]">S</kbd> skip ·{' '}
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">B</kbd> /{' '}
                    <kbd className="rounded bg-muted px-1 font-mono text-[11px]">Esc</kbd> back to customer
                  </p>
                  {customer && customerHasOutstandingCredit(customer) ? (
                    <div className="mb-4">
                      <CustomerCreditBalanceStrip customer={customer} />
                    </div>
                  ) : null}

                  <label className="mt-2 block space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                      Amount (optional)
                    </span>
                    <input
                      id="checkout-service-charge-input"
                      ref={serviceChargeFieldRef}
                      type="number"
                      min={0}
                      step={0.01}
                      value={serviceChargeInput}
                      onChange={(e) => setServiceChargeInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAddCharges();
                        }
                      }}
                      placeholder="0"
                      className="w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-lg font-black tabular-nums outline-none ring-primary/20 focus:ring-2 dark:border-border dark:bg-card/50"
                    />
                  </label>

                  <div className="mt-6 flex flex-col-reverse sm:flex-row sm:items-center sm:justify-between gap-3">
                    <button
                      type="button"
                      onClick={goBackToCustomerStep}
                      className="inline-flex items-center justify-center gap-2 rounded-xl px-2 py-2 text-sm font-semibold text-muted-foreground transition hover:text-foreground"
                    >
                      <ArrowLeft className="w-4 h-4" />
                      Back
                    </button>
                    <div className="flex flex-col gap-2 sm:flex-row sm:justify-end sm:flex-1">
                      <button
                        type="button"
                        onClick={handleSkipCharges}
                        className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-foreground transition hover:bg-slate-50 dark:border-border dark:bg-card/40"
                      >
                        Skip
                      </button>
                      <button
                        type="button"
                        onClick={handleAddCharges}
                        className="rounded-xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/30 transition hover:brightness-[1.03]"
                      >
                        Continue
                      </button>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 'receipt' && (
                <motion.div
                  key="receipt"
                  initial={{ opacity: 0, x: 14 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -14 }}
                  transition={{ duration: 0.22 }}
                  className="flex flex-col max-h-[92vh]"
                >
                  <div className="shrink-0 border-b border-slate-200/80 px-5 py-4 dark:border-border/50">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p id="checkout-flow-title-receipt" className="text-[10px] font-bold uppercase tracking-widest text-primary">
                          Receipt preview
                        </p>
                        <p className="text-sm font-semibold text-muted-foreground">
                          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Enter</kbd> complete ·{' '}
                          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">P</kbd> print ·{' '}
                          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">S</kbd> save PDF ·{' '}
                          <kbd className="rounded bg-muted px-1 py-0.5 font-mono text-xs">Esc</kbd> back to charges
                        </p>
                      </div>
                      <Package className="w-8 h-8 shrink-0 text-primary/25" />
                    </div>
                    {customer && customerHasOutstandingCredit(customer) ? (
                      <div className="mt-3">
                        <CustomerCreditBalanceStrip customer={customer} compact />
                      </div>
                    ) : null}
                  </div>

                  {customer && customerHasOutstandingCredit(customer) ? (
                    <div className="shrink-0 border-b border-slate-200/80 bg-slate-50/90 px-5 py-3 dark:border-border/50 dark:bg-zinc-900/50">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Payment summary
                      </p>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="rounded-lg border border-border/60 bg-background/80 px-2.5 py-2 dark:bg-background/40">
                          <p className="text-[10px] font-bold text-muted-foreground">Current bill</p>
                          <p className="font-black tabular-nums text-foreground">{formatCurrency(billTotal)}</p>
                        </div>
                        <div className="rounded-lg border border-amber-200/70 bg-amber-500/[0.08] px-2.5 py-2 dark:border-amber-900/40">
                          <p className="text-[10px] font-bold text-amber-900/80 dark:text-amber-200/90">Previous balance</p>
                          <p className="font-black tabular-nums text-amber-950 dark:text-amber-50">
                            {formatCurrency(customer.balance)}
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {customer ? (
                    <div className="shrink-0 border-b border-slate-200/80 bg-gradient-to-r from-slate-50 to-teal-50/30 px-5 py-3 dark:border-border/50 dark:from-zinc-900/40 dark:to-zinc-900/20">
                      <p className="text-[10px] font-black uppercase tracking-widest text-muted-foreground mb-2">
                        Payment options
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <motion.button
                          type="button"
                          layout
                          initial={false}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => {
                            setConfirmedCreditAmount(null);
                            setCreditModalOpen(false);
                            setPaymentMethod('cash');
                          }}
                          className={cn(
                            'inline-flex flex-1 min-w-[100px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                            !receiptCreditMode && paymentMethod === 'cash'
                              ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-border dark:bg-card'
                          )}
                        >
                          <Banknote className="h-4 w-4" />
                          Cash
                        </motion.button>
                        <motion.button
                          type="button"
                          layout
                          initial={false}
                          animate={{ opacity: 1, scale: 1 }}
                          onClick={() => {
                            setConfirmedCreditAmount(null);
                            setCreditModalOpen(false);
                            setPaymentMethod('card');
                          }}
                          className={cn(
                            'inline-flex flex-1 min-w-[100px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                            !receiptCreditMode && paymentMethod === 'card'
                              ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-border dark:bg-card'
                          )}
                        >
                          <CreditCard className="h-4 w-4" />
                          Card
                        </motion.button>
                        <motion.button
                          type="button"
                          layout
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                          onClick={() => setCreditModalOpen(true)}
                          className={cn(
                            'inline-flex flex-1 min-w-[100px] items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-bold transition',
                            receiptCreditMode
                              ? 'border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20'
                              : 'border-slate-200 bg-white hover:bg-slate-50 dark:border-border dark:bg-card'
                          )}
                        >
                          <Wallet className="h-4 w-4" />
                          Credit
                        </motion.button>
                        {customerHasOutstandingCredit(customer) ? (
                          <motion.button
                            type="button"
                            layout
                            initial={{ opacity: 0, x: 8 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ type: 'spring', stiffness: 420, damping: 28 }}
                            onClick={() => {
                              setConfirmedCreditAmount(null);
                              setCreditModalOpen(false);
                              setPaymentMethod('cash');
                              setPayDuesOpen(true);
                            }}
                            className="inline-flex flex-1 min-w-[100px] items-center justify-center gap-2 rounded-xl border border-amber-300/80 bg-amber-500/10 px-3 py-2.5 text-sm font-bold text-amber-950 transition hover:bg-amber-500/15 dark:border-amber-800/50 dark:bg-amber-950/30 dark:text-amber-50"
                          >
                            <HandCoins className="h-4 w-4" />
                            Pay dues
                          </motion.button>
                        ) : null}
                      </div>
                      {!receiptCreditMode && customer && (paymentMethod === 'cash' || paymentMethod === 'card') ? (
                        <div className="mt-3 space-y-1">
                          <label className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground" htmlFor="checkout-counter-pay">
                            Amount received (cash / card)
                          </label>
                          <input
                            id="checkout-counter-pay"
                            type="number"
                            min={0}
                            step={0.01}
                            value={counterPaymentInput}
                            onChange={(e) => setCounterPaymentInput(e.target.value)}
                            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold tabular-nums outline-none ring-primary/20 focus:ring-2 dark:border-border dark:bg-card"
                          />
                          <p className="text-[10px] text-muted-foreground">
                            Default is this invoice. Enter a higher total if the customer is also paying down prior
                            balance.
                          </p>
                        </div>
                      ) : null}
                      <p className="mt-2 text-[11px] text-muted-foreground">
                        Credit posts to <span className="font-semibold text-foreground">{customer.name}</span>’s
                        balance. Use <span className="font-semibold">Pay dues</span> to pre-fill bill + amount toward old
                        balance.
                      </p>
                    </div>
                  ) : null}

                  <div className="flex-1 min-h-0 overflow-y-auto p-5 sm:p-6 bg-[#fafafa] dark:bg-background/60">
                    <div className="mx-auto max-w-sm rounded-2xl border border-slate-200/90 bg-white px-6 py-7 shadow-sm font-mono text-[13px] leading-relaxed text-slate-800 dark:border-border/60 dark:bg-slate-950/40 dark:text-slate-100">
                      <p className="text-center font-black text-base tracking-tight text-slate-900 dark:text-white">
                        {pharmacyName}
                      </p>
                      <p className="text-center text-slate-500 text-[11px] mt-1 dark:text-slate-400">
                        {pharmacyAddress}
                      </p>
                      <p className="text-center text-slate-500 text-[11px] dark:text-slate-400">{pharmacyPhone}</p>
                      <div className="my-4 border-t border-dashed border-slate-300 dark:border-slate-600" />
                      <div className="flex justify-between text-[11px] text-slate-500 dark:text-slate-400">
                        <span>{new Date().toLocaleString()}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-200">{receiptInvoiceNo}</span>
                      </div>
                      {customer && receiptShowCustomerInfo ? (
                        <p className="text-[11px] text-slate-600 mt-2 dark:text-slate-300">
                          Customer: {customer.name} · {customer.phone}
                        </p>
                      ) : null}
                      {receiptPaymentBreakdownPreview ? (
                        <div className="mt-2 space-y-0.5 rounded-lg border border-slate-200/80 bg-slate-50/80 px-2.5 py-2 text-[11px] font-semibold tabular-nums text-slate-800 dark:border-border/60 dark:bg-zinc-900/40 dark:text-slate-100">
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Previous balance</span>
                            <span>{formatCurrency(receiptPaymentBreakdownPreview.previousBalance)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Current bill</span>
                            <span>{formatCurrency(receiptPaymentBreakdownPreview.currentBill)}</span>
                          </div>
                          <div className="flex justify-between gap-2">
                            <span className="text-muted-foreground">Paid amount</span>
                            <span>{formatCurrency(receiptPaymentBreakdownPreview.paidAmount)}</span>
                          </div>
                          <div className="flex justify-between gap-2 border-t border-slate-200/80 pt-1 dark:border-border/50">
                            <span className="text-amber-900 dark:text-amber-100">Remaining balance</span>
                            <span className="text-amber-950 dark:text-amber-50">
                              {formatCurrency(receiptPaymentBreakdownPreview.remainingBalance)}
                            </span>
                          </div>
                        </div>
                      ) : customer && customer.balance > 0 ? (
                        <p className="text-[11px] font-semibold text-amber-800 dark:text-amber-200/95 mt-1 tabular-nums">
                          Previous balance: {formatCurrency(customer.balance)}
                        </p>
                      ) : null}
                      <p className="text-[11px] uppercase tracking-wider text-slate-500 mt-1 dark:text-slate-400">
                        Pay: {receiptCreditMode ? 'CREDIT' : paymentMethod}
                      </p>
                      {receiptCreditMode && confirmedCreditAmount != null ? (
                        <div className="mt-2 space-y-0.5 rounded-lg bg-amber-500/10 px-2 py-1.5 text-[11px] font-semibold text-amber-950 dark:bg-amber-500/15 dark:text-amber-100">
                          <p>Credit amount: {formatCurrency(confirmedCreditAmount)}</p>
                          {receiptCashPortionPreview > 0.001 ? (
                            <p className="font-normal text-amber-900/90 dark:text-amber-200/90">
                              Cash (same invoice): {formatCurrency(receiptCashPortionPreview)}
                            </p>
                          ) : null}
                          <p className="text-[10px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
                            Customer dues updated
                          </p>
                        </div>
                      ) : null}
                      <div className="my-4 border-t border-dashed border-slate-300 dark:border-slate-600" />
                      {cart.map((it) => {
                        const lineTot = cartLineSubtotal(usePOSBillingStore.getState().medicines, it);
                        return (
                          <div key={it.lineId} className="mb-3">
                            <div className="font-bold text-slate-900 dark:text-white">{it.name}</div>
                            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">
                              Mfr. {displayManufacturerForCartLine(it, medicines)}
                            </div>
                            <div className="flex justify-between text-slate-600 dark:text-slate-300 mt-0.5">
                              <span>
                                {formatSellQuantityLabel(it)} × {formatCurrency(it.unitPrice)}
                              </span>
                              <span className="tabular-nums font-semibold">{formatCurrency(lineTot)}</span>
                            </div>
                          </div>
                        );
                      })}
                      <div className="my-4 border-t border-dashed border-slate-300 dark:border-slate-600" />
                      <div className="space-y-1.5 text-slate-600 dark:text-slate-300">
                        <div className="flex justify-between">
                          <span>Subtotal</span>
                          <span className="tabular-nums">{formatCurrency(totals.subtotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Discount</span>
                          <span className="tabular-nums">−{formatCurrency(totals.discountAmt)}</span>
                        </div>
                        {totals.serviceTotal > 0 && (
                          <>
                            {appliedServiceCharges.deliveryFee > 0 && (
                              <div className="flex justify-between text-[12px] text-slate-500 dark:text-slate-400">
                                <span>Delivery</span>
                                <span className="tabular-nums">{formatCurrency(appliedServiceCharges.deliveryFee)}</span>
                              </div>
                            )}
                            {appliedServiceCharges.serviceFee > 0 && (
                              <div className="flex justify-between text-[12px] text-slate-500 dark:text-slate-400">
                                <span>Service</span>
                                <span className="tabular-nums">{formatCurrency(appliedServiceCharges.serviceFee)}</span>
                              </div>
                            )}
                            {appliedServiceCharges.customAmount > 0 && (
                              <div className="flex justify-between text-[12px] text-slate-500 dark:text-slate-400">
                                <span>{appliedServiceCharges.customLabel}</span>
                                <span className="tabular-nums">{formatCurrency(appliedServiceCharges.customAmount)}</span>
                              </div>
                            )}
                            <div className="flex justify-between text-primary font-semibold pt-0.5">
                              <span>Service total</span>
                              <span className="tabular-nums">{formatCurrency(totals.serviceTotal)}</span>
                            </div>
                          </>
                        )}
                        <div className="flex justify-between">
                          <span>Tax ({taxPercent}%)</span>
                          <span className="tabular-nums">{formatCurrency(totals.tax)}</span>
                        </div>
                      </div>
                      <div className="my-4 border-t-2 border-slate-900 dark:border-white" />
                      <div className="flex justify-between items-end text-slate-900 dark:text-white">
                        <span className="text-sm font-black uppercase tracking-wide">Grand total</span>
                        <span className="text-2xl font-black tabular-nums">{formatCurrency(totals.total)}</span>
                      </div>
                      <p className="text-center text-[11px] text-slate-500 mt-6 dark:text-slate-400">
                        {RECEIPT_BRANDING.footerThanks}
                      </p>
                      <p className="text-center text-[10px] text-slate-400 mt-2 dark:text-slate-500">
                        {RECEIPT_BRANDING.footerPolicy}
                      </p>
                      <p className="text-center text-[10px] text-slate-400 mt-3 opacity-80 dark:text-slate-500">
                        {RECEIPT_BRANDING.footerSystem}
                      </p>
                    </div>
                  </div>

                  <div className="shrink-0 border-t border-slate-200/80 p-4 sm:p-5 flex flex-col sm:flex-row gap-2 sm:justify-end bg-white dark:bg-card dark:border-border/50">
                    <button
                      type="button"
                      onClick={() => void runFinalize('print')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50 transition dark:border-border"
                    >
                      <Printer className="w-4 h-4" />
                      Print
                    </button>
                    <button
                      type="button"
                      onClick={() => void runFinalize('save')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-4 py-3 text-sm font-bold hover:bg-slate-50 transition dark:border-border"
                    >
                      <Save className="w-4 h-4" />
                      Save PDF
                    </button>
                    <button
                      id="receipt-complete-order-btn"
                      type="button"
                      onClick={() => void runFinalize('complete')}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-black uppercase tracking-wide text-primary-foreground shadow-lg shadow-primary/25 hover:brightness-[1.03] transition"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span className="flex flex-col items-start leading-tight">
                        <span>Complete order</span>
                        <span className="text-[10px] font-bold normal-case tracking-wide opacity-90">
                          Enter
                        </span>
                      </span>
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
