import { ready, reports } from '@/lib/services';
import { ReportsClient } from '@/components/reports/ReportsClient';

export default async function ReportsPage() {
  await ready();
  return <ReportsClient initial={await reports.get(null, null)} />;
}