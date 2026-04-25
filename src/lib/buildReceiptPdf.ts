import { jsPDF } from 'jspdf';
import { RECEIPT_BRANDING } from '@/lib/receiptConstants';
import { formatSellQuantityLabel } from '@/lib/posCartQuantity';
import { formatCurrency } from '@/lib/utils';
import { displayManufacturerForCartLine } from '@/lib/medicineDisplay';
import { cartLineSubtotal } from '@/lib/cartFefoAllocation';
import type { CartLine, Customer, Medicine, ServiceChargeSnapshot } from '@/types';

export interface ReceiptPaymentBreakdown {
  previousBalance: number;
  currentBill: number;
  paidAmount: number;
  remainingBalance: number;
}

export interface ReceiptPdfInput {
  cart: CartLine[];
  /** When provided, line totals use FEFO slice pricing where applicable. */
  medicines?: Medicine[];
  customer: Customer | null;
  paymentMethod: string;
  invoiceNo: string;
  subtotal: number;
  discountAmt: number;
  discountType: 'percentage' | 'fixed';
  discountInput: number;
  serviceCharges: ServiceChargeSnapshot;
  serviceTotal: number;
  tax: number;
  total: number;
  /** Overrides static receipt header when provided (e.g. from Settings). */
  branding?: { name: string; address: string; phone: string };
  /** When false, customer section is hidden (header/items/totals unchanged). */
  showCustomerBlock?: boolean;
  /** Label for the tax row, e.g. `Tax (5%)`. */
  taxLabel?: string;
  /** When payment is credit: amount posted to customer ledger. */
  creditAmount?: number;
  /** Remainder of invoice collected as cash (partial credit). */
  paidCashPortion?: number;
  /** Cash/card settlement including prior balance (replaces single “previous balance” line). */
  paymentBreakdown?: ReceiptPaymentBreakdown;
}

/** Builds a print-style invoice PDF (A4, clean typography). */
export function buildReceiptPdf(input: ReceiptPdfInput): jsPDF {
  const brand = input.branding ?? RECEIPT_BRANDING;
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const left = 48;
  const right = pageW - 48;
  const mid = pageW / 2;
  let y = 56;
  const gap = (n = 14) => {
    y += n;
    if (y > pageH - 72) {
      doc.addPage();
      y = 56;
    }
  };

  const set = (size: number, style: 'normal' | 'bold' | 'italic' = 'normal') => {
    const fam = style === 'italic' ? 'helvetica' : 'helvetica';
    const st = style === 'bold' ? 'bold' : style === 'italic' ? 'italic' : 'normal';
    doc.setFont(fam, st);
    doc.setFontSize(size);
    doc.setTextColor(15, 23, 42);
  };

  set(18, 'bold');
  doc.text(brand.name, mid, y, { align: 'center' });
  gap(22);

  set(9, 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(brand.address, mid, y, { align: 'center' });
  gap(12);
  doc.text(brand.phone, mid, y, { align: 'center' });
  gap(20);

  doc.setDrawColor(226, 232, 240);
  doc.line(left, y, right, y);
  gap(18);

  doc.setTextColor(15, 23, 42);
  set(10, 'bold');
  doc.text('INVOICE', left, y);
  set(10, 'normal');
  doc.text(input.invoiceNo, right, y, { align: 'right' });
  gap(16);

  set(9, 'normal');
  doc.setTextColor(71, 85, 105);
  doc.text(`Date: ${new Date().toLocaleString()}`, left, y);
  gap(12);
  doc.text(`Payment: ${input.paymentMethod.toUpperCase()}`, left, y);
  gap(12);
  if (input.paymentMethod === 'credit' && input.creditAmount != null) {
    doc.setTextColor(180, 83, 9);
    set(9, 'bold');
    doc.text(`Credit amount: ${formatCurrency(input.creditAmount)}`, left, y);
    gap(10);
    if (input.paidCashPortion != null && input.paidCashPortion > 0.001) {
      set(9, 'normal');
      doc.setTextColor(71, 85, 105);
      doc.text(`Cash (same invoice): ${formatCurrency(input.paidCashPortion)}`, left, y);
      gap(10);
    }
    set(8, 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text('Customer dues updated', left, y);
    gap(14);
    doc.setTextColor(71, 85, 105);
    set(9, 'normal');
  } else {
    gap(14);
  }

  if (input.customer && input.showCustomerBlock !== false) {
    doc.setTextColor(15, 23, 42);
    set(9, 'bold');
    doc.text('Customer', left, y);
    gap(12);
    set(9, 'normal');
    doc.text(`${input.customer.name} · ${input.customer.phone}`, left, y);
    gap(12);
  }
  if (input.paymentBreakdown) {
    const b = input.paymentBreakdown;
    set(9, 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(`Previous balance: ${formatCurrency(b.previousBalance)}`, left, y);
    gap(10);
    doc.text(`Current bill: ${formatCurrency(b.currentBill)}`, left, y);
    gap(10);
    doc.setTextColor(15, 23, 42);
    doc.text(`Paid amount: ${formatCurrency(b.paidAmount)}`, left, y);
    gap(10);
    doc.setTextColor(180, 83, 9);
    doc.text(`Remaining balance: ${formatCurrency(b.remainingBalance)}`, left, y);
    gap(14);
    doc.setTextColor(71, 85, 105);
  } else if (input.customer && input.customer.balance > 0) {
    set(9, 'normal');
    doc.setTextColor(180, 83, 9);
    doc.text(`Previous balance: ${formatCurrency(input.customer.balance)}`, left, y);
    gap(14);
    doc.setTextColor(71, 85, 105);
  } else if (input.customer && input.showCustomerBlock !== false) {
    gap(4);
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(left, y, right, y);
  gap(18);

  set(9, 'bold');
  doc.text('Items', left, y);
  gap(14);

  for (const it of input.cart) {
    if (y > pageH - 100) {
      doc.addPage();
      y = 56;
    }
    const lineTotal = cartLineSubtotal(input.medicines ?? [], it);
    set(10, 'bold');
    doc.setTextColor(15, 23, 42);
    doc.text(it.name, left, y);
    gap(10);
    set(8, 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Mfr. ${displayManufacturerForCartLine(it, input.medicines)}`, left, y);
    gap(12);
    set(9, 'normal');
    doc.setTextColor(71, 85, 105);
    const row = `${formatSellQuantityLabel(it)} × ${formatCurrency(it.unitPrice)}`;
    doc.text(row, left, y);
    doc.text(formatCurrency(lineTotal), right, y, { align: 'right' });
    gap(16);
  }

  doc.setDrawColor(226, 232, 240);
  doc.line(left, y, right, y);
  gap(18);

  const rowPair = (label: string, value: string, bold = false) => {
    if (y > pageH - 80) {
      doc.addPage();
      y = 56;
    }
    set(bold ? 10 : 9, bold ? 'bold' : 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(label, left, y);
    doc.setTextColor(15, 23, 42);
    doc.text(value, right, y, { align: 'right' });
    gap(14);
  };

  rowPair('Subtotal', formatCurrency(input.subtotal));
  rowPair(
    'Discount',
    `−${formatCurrency(input.discountAmt)} (${input.discountType === 'percentage' ? `${input.discountInput}%` : 'flat'})`
  );

  if (input.serviceTotal > 0) {
    const sc = input.serviceCharges;
    if (sc.deliveryFee > 0) rowPair('  Delivery', formatCurrency(sc.deliveryFee));
    if (sc.serviceFee > 0) rowPair('  Service fee', formatCurrency(sc.serviceFee));
    if (sc.customAmount > 0) rowPair(`  ${sc.customLabel}`, formatCurrency(sc.customAmount));
    set(9, 'bold');
    doc.setTextColor(13, 148, 136);
    doc.text('Service charges', left, y);
    doc.text(formatCurrency(input.serviceTotal), right, y, { align: 'right' });
    gap(16);
    doc.setTextColor(15, 23, 42);
  }

  rowPair(input.taxLabel ?? 'Tax', formatCurrency(input.tax));

  gap(8);
  doc.setDrawColor(15, 23, 42);
  doc.setLineWidth(0.75);
  doc.line(left, y, right, y);
  doc.setLineWidth(0.2);
  gap(16);

  set(12, 'bold');
  doc.setTextColor(13, 148, 136);
  doc.text('Grand total', left, y);
  doc.text(formatCurrency(input.total), right, y, { align: 'right' });
  gap(28);

  doc.setTextColor(100, 116, 139);
  set(8, 'normal');
  doc.text(RECEIPT_BRANDING.footerThanks, mid, y, { align: 'center', maxWidth: right - left });
  gap(12);
  doc.text(RECEIPT_BRANDING.footerPolicy, mid, y, { align: 'center', maxWidth: right - left });
  gap(14);
  doc.setTextColor(148, 163, 184);
  doc.text(RECEIPT_BRANDING.footerSystem, mid, y, { align: 'center' });

  return doc;
}
