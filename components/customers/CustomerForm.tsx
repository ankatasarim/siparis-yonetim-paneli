'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { api } from '@/lib/client';
import { useToast } from '@/components/Toast';
import { Field } from '@/components/ui';
import { ConfirmDialog } from '@/components/Modal';
import type { Customer } from '@/lib/types';

export function CustomerForm({ customer }: { customer?: Customer | null }) {
  const router = useRouter();
  const { toast, fail } = useToast();
  const [f, setF] = useState({ name: customer?.name || '', email: customer?.email || '', phone: customer?.phone || '', address: customer?.address || '', city: customer?.city || '', district: customer?.district || '', postal_code: customer?.postal_code || '', ig_username: customer?.ig_username || '', notes: customer?.notes || '' });
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) return toast('Ad Soyad gerekli', 'err');
    setBusy(true);
    try {
      if (customer) { await api.put(`/api/customers/${customer.id}`, f); toast('Müşteri kaydedildi', 'ok'); router.refresh(); }
      else { const c = await api.post('/api/customers', f); toast('Müşteri oluşturuldu', 'ok'); router.push(`/musteriler/${c.id}`); router.refresh(); }
    } catch (e) { fail(e); }
    setBusy(false);
  };

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="Ad Soyad *"><input value={f.name} onChange={set('name')} className="input" /></Field>
        <Field label="Telefon"><input value={f.phone} onChange={set('phone')} className="input" /></Field>
        <Field label="E-posta"><input value={f.email} onChange={set('email')} className="input" /></Field>
        <Field label="Instagram kullanıcı adı"><input value={f.ig_username} onChange={set('ig_username')} readOnly={Boolean(customer?.ig_user_id)} className="input" placeholder="kullanici_adi" /></Field>
        <Field label="Adres" className="md:col-span-2"><textarea value={f.address} onChange={set('address')} className="input min-h-[60px]" /></Field>
        <Field label="İl"><input value={f.city} onChange={set('city')} className="input" /></Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="İlçe"><input value={f.district} onChange={set('district')} className="input" /></Field>
          <Field label="Posta kodu"><input value={f.postal_code} onChange={set('postal_code')} className="input" /></Field>
        </div>
        <Field label="Notlar" className="md:col-span-2"><textarea value={f.notes} onChange={set('notes')} className="input min-h-[60px]" /></Field>
      </div>
      <div className="flex items-center gap-2">
        {customer && <button onClick={() => setConfirm(true)} className="btn btn-sm btn-danger"><Trash2 className="h-3.5 w-3.5" />Sil</button>}
        <button disabled={busy} onClick={save} className="btn btn-primary ml-auto">{customer ? 'Kaydet' : 'Müşteri oluştur'}</button>
      </div>
      {customer && <ConfirmDialog open={confirm} text="Müşteri silinsin mi? Siparişi olan müşteri silinemez." okLabel="Sil" danger busy={busy} onCancel={() => setConfirm(false)} onConfirm={async () => { setBusy(true); try { await api.del(`/api/customers/${customer.id}`); toast('Müşteri silindi'); router.push('/musteriler'); router.refresh(); } catch (e) { fail(e); setBusy(false); setConfirm(false); } }} />}
    </div>
  );
}
