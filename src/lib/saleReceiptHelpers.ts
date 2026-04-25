import { buildReceiptPdf, type ReceiptPdfInput } from '@/lib/buildReceiptPdf';
import { getReceiptBrandingFromSettings, useSettingsStore } from '@/store/useSettingsStore';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import type { Sale } from '@/types';

export function saleToReceiptPdfInput(sale: Sale): ReceiptPdfInput {
  const st = useSettingsStore.getState();
  const medicines = usePOSBillingStore.getState().medicines;
  return {
    cart: sale.items.map((l) => ({ ...l })),
    medicines,
    customer: sale.customer,
    paymentMethod: sale.paymentMethod,
    invoiceNo: sale.invoiceNo,
    subtotal: sale.subtotal,
    discountAmt: sale.discountApplied,
    discountType: sale.discountType,
    discountInput: sale.discountInput,
    serviceCharges: { ...sale.serviceCharges },
    serviceTotal: sale.serviceChargeTotal,
    tax: sale.tax,
    total: sale.total,
    branding: getReceiptBrandingFromSettings(),
    showCustomerBlock: st.receiptShowCustomerInfo,
    taxLabel: `Tax (${st.taxPercent}%)`,
    ...(sale.paymentMethod === 'credit' && sale.creditAmount != null
      ? {
          creditAmount: sale.creditAmount,
          ...(sale.paidCashPortion != null && sale.paidCashPortion > 0.001
            ? { paidCashPortion: sale.paidCashPortion }
            : {}),
        }
      : {}),
    ...(sale.counterPaymentTotal != null &&
    sale.customerOpeningBalance != null &&
    sale.customerClosingBalance != null &&
    (sale.paymentMethod === 'cash' || sale.paymentMethod === 'card')
      ? {
          paymentBreakdown: {
            previousBalance: sale.customerOpeningBalance,
            currentBill: sale.total,
            paidAmount: sale.counterPaymentTotal,
            remainingBalance: sale.customerClosingBalance,
          },
        }
      : {}),
  };
}

export function printSaleInvoice(sale: Sale): void {
  const blob = buildReceiptPdf(saleToReceiptPdfInput(sale)).output('blob');
  const url = URL.createObjectURL(blob);
  const w = window.open(url);
  if (w) {
    window.setTimeout(() => {
      try {
        w.print();
      } finally {
        window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
      }
    }, 400);
  }
}

export function downloadSaleInvoicePdf(sale: Sale): void {
  const blob = buildReceiptPdf(saleToReceiptPdfInput(sale)).output('blob');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sale.invoiceNo}.pdf`;
  a.click();
  URL.revokeObjectURL(url);
}
