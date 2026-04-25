import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePOSBillingStore } from '@/store/usePOSBillingStore';
import { customerHasOutstandingCredit } from '@/lib/customerCreditAlerts';
import { CustomerCreditAlertModal } from '@/components/pos/CustomerCreditAlertModal';
import { CustomerCreditDetailsModal } from '@/components/pos/CustomerCreditDetailsModal';
import { POS_OPEN_CUSTOMER_CREDIT_DETAILS } from '@/components/pos/CustomerCreditBalanceStrip';

/**
 * One-shot balance reminder when a customer with dues is attached; inline strips live in Cart / Checkout / modal.
 */
export function CustomerCreditAlertHost() {
  const customer = usePOSBillingStore((s) => s.customer);
  const customers = usePOSBillingStore((s) => s.customers);
  const sales = usePOSBillingStore((s) => s.sales);

  const [tipOpen, setTipOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dismissedIds = useRef(new Set<string>());

  const catalogCustomer = useMemo(() => {
    if (!customer) return null;
    return customers.find((c) => c.id === customer.id) ?? customer;
  }, [customer, customers]);

  useEffect(() => {
    if (!customer) {
      dismissedIds.current.clear();
      setTipOpen(false);
      setDetailsOpen(false);
      return;
    }
    if (!customerHasOutstandingCredit(customer)) {
      setTipOpen(false);
      return;
    }
    if (dismissedIds.current.has(customer.id)) {
      setTipOpen(false);
      return;
    }
    setTipOpen(true);
  }, [customer]);

  const handleContinue = useCallback(() => {
    if (customer) dismissedIds.current.add(customer.id);
    setTipOpen(false);
  }, [customer]);

  const handleViewDetails = useCallback(() => {
    if (customer) dismissedIds.current.add(customer.id);
    setTipOpen(false);
    setDetailsOpen(true);
  }, [customer]);

  useEffect(() => {
    const onOpenDetails = () => {
      const c = usePOSBillingStore.getState().customer;
      if (!c || !customerHasOutstandingCredit(c)) return;
      dismissedIds.current.add(c.id);
      setTipOpen(false);
      setDetailsOpen(true);
    };
    window.addEventListener(POS_OPEN_CUSTOMER_CREDIT_DETAILS, onOpenDetails);
    return () => window.removeEventListener(POS_OPEN_CUSTOMER_CREDIT_DETAILS, onOpenDetails);
  }, []);

  if (!catalogCustomer || !customerHasOutstandingCredit(catalogCustomer)) {
    return null;
  }

  return (
    <>
      {tipOpen ? (
        <CustomerCreditAlertModal
          open={tipOpen}
          customer={catalogCustomer}
          onContinue={handleContinue}
          onViewDetails={handleViewDetails}
        />
      ) : null}
      <CustomerCreditDetailsModal
        open={detailsOpen}
        customer={catalogCustomer}
        sales={sales}
        onClose={() => setDetailsOpen(false)}
      />
    </>
  );
}
