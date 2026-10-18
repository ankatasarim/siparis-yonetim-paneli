import { ready, finance } from '@/lib/services';
import { FinanceClient } from '@/components/finance/FinanceClient';

export default async function FinancePage() {
  await ready();
  return <FinanceClient initial={await finance.list(null)} />;
}
