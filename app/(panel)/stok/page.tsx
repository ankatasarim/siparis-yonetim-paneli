import { ready, inventory } from '@/lib/services';
import { InventoryClient } from '@/components/inventory/InventoryClient';

export default async function InventoryPage() {
  await ready();
  const initial = await inventory.overview();
  return <InventoryClient initial={initial} />;
}
