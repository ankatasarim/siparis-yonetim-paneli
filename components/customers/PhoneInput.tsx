'use client';
import { useRef } from 'react';
import { formatTurkishPhone } from '@/lib/phone';

function caretForDigitCount(value: string, count: number): number {
  if (count <= 0) return 0;
  let seen = 0;
  for (let i = 0; i < value.length; i += 1) {
    if (/\d/.test(value[i])) seen += 1;
    if (seen === count) return i + 1;
  }
  return value.length;
}

export function PhoneInput({ value, onChange, className = 'input', placeholder = '05xx xxx xx xx' }: {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const raw = event.target.value;
    const caret = event.target.selectionStart ?? raw.length;
    const normalized = formatTurkishPhone(raw);
    const digitsBeforeCaret = raw.slice(0, caret).replace(/\D/g, '').length;
    const atEnd = caret === raw.length;
    onChange(normalized);
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      const nextCaret = atEnd ? normalized.length : caretForDigitCount(normalized, digitsBeforeCaret);
      input.setSelectionRange(nextCaret, nextCaret);
    });
  };

  return <input ref={inputRef} type="tel" inputMode="tel" autoComplete="tel" value={formatTurkishPhone(value)} onChange={handleChange} className={className} placeholder={placeholder} />;
}
