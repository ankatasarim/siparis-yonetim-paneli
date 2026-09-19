import { PageHeader } from '@/components/PageHeader';
import { Card } from '@/components/ui';
import { CustomerForm } from '@/components/customers/CustomerForm';

export default function NewCustomerPage() {
  return (
    <>
      <PageHeader title="Yeni Müşteri" />
      <div className="max-w-3xl"><Card><CustomerForm /></Card></div>
    </>
  );
}
