import { ready, accounts } from '@/lib/services';
import { AccountsClient } from '@/components/accounts/AccountsClient';
import type { CustomerAccount } from '@/lib/services/accounts';

type Overview = { accounts: CustomerAccount[]; total_receivable: number };

export default async function AccountsPage() {
  await ready();
  const result = await accounts.list();
  if (!('accounts' in result) || !result.accounts) throw new Error('Cari hesap özeti yüklenemedi');
  return <AccountsClient initial={result as Overview} />;
}
