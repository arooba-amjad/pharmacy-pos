import type { CartLine, Medicine } from '@/types';
import { lineTotalTablets } from '@/lib/posCartQuantity';

/**
 * Freezes per-tablet cost and effective sale price on each slice at checkout
 * so reports use actual batch COGS (not post-hoc averages).
 */
export function enrichCartLinesForSaleLedger(medicines: Medicine[], lines: CartLine[]): CartLine[] {
  return lines.map((line) => enrichOneLine(medicines, line));
}

function enrichOneLine(medicines: Medicine[], line: CartLine): CartLine {
  const med = medicines.find((m) => m.id === line.medicineId);
  const T = lineTotalTablets(line);
  const uniformSalePerTablet = T > 0 ? (line.quantity * line.unitPrice) / T : line.unitPrice;
  const uniformCostPerTablet = T > 0 ? (line.quantity * line.costPrice) / T : line.costPrice;

  const batchSlices = (line.batchSlices ?? []).map((sl) => {
    const b = med?.batches.find((x) => x.id === sl.batchId);
    const cost = b?.costPricePerTablet ?? uniformCostPerTablet;
    const saleFromBatch = b?.salePricePerTablet ?? uniformSalePerTablet;
    const sale =
      line.pricingMode === 'custom' && T > 0 ? uniformSalePerTablet : saleFromBatch;
    return {
      ...sl,
      costPricePerTablet: Math.round(cost * 10000) / 10000,
      salePricePerTablet: Math.round(sale * 10000) / 10000,
    };
  });

  return { ...line, batchSlices };
}
