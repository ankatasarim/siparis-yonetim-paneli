import { ready, products } from '@/lib/services';
import { ProductsClient } from '@/components/products/ProductsClient';

export default async function ProductsPage() {
  await ready();
  const list = await products.list();
  return <ProductsClient initial={list} />;
}
