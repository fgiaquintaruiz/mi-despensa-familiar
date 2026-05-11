'use client';

import { useState } from 'react';
import type { BudgetCurrency, ShoppingTransaction } from '@/lib/types';
import TransactionList from './TransactionList';
import BudgetFAB from './BudgetFAB';
import ManualTransactionModal from './ManualTransactionModal';

interface BudgetClientWrapperProps {
  transactions: ShoppingTransaction[];
  currency: BudgetCurrency;
}

export default function BudgetClientWrapper({ transactions, currency }: BudgetClientWrapperProps) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<'create' | 'edit'>('create');
  const [selectedTransaction, setSelectedTransaction] = useState<ShoppingTransaction | null>(null);

  function handleCreate() {
    setMode('create');
    setSelectedTransaction(null);
    setOpen(true);
  }

  function handleEdit(tx: ShoppingTransaction) {
    if (tx.source !== 'manual') return;
    setMode('edit');
    setSelectedTransaction(tx);
    setOpen(true);
  }

  function handleClose() {
    setOpen(false);
  }

  return (
    <>
      <TransactionList
        transactions={transactions}
        currency={currency}
        onEditTransaction={handleEdit}
      />
      <BudgetFAB onOpen={handleCreate} />
      <ManualTransactionModal
        open={open}
        onClose={handleClose}
        mode={mode}
        transaction={selectedTransaction ?? undefined}
      />
    </>
  );
}
