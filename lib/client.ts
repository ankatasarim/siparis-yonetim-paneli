/** Tarayıcı tarafı API yardımcıları (client component'ler için). */
async function request<T = any>(method: string, url: string, body?: unknown): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: 'no-store',
  });
  if (res.status === 401) {
    window.location.href = '/giris';
    throw new Error('Giriş gerekli');
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data && data.error) || `Hata (${res.status})`);
  return data as T;
}

export const api = {
  get: <T = any>(url: string) => request<T>('GET', url),
  post: <T = any>(url: string, body: unknown = {}) => request<T>('POST', url, body),
  put: <T = any>(url: string, body: unknown = {}) => request<T>('PUT', url, body),
  del: <T = any>(url: string) => request<T>('DELETE', url),
};

/** Programatik yönlendirmeden (router.push) önce çağrılır; üstteki ilerleme çubuğunu başlatır. */
export const startNav = () => { if (typeof window !== 'undefined') window.dispatchEvent(new Event('anka:nav')); };

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      return true;
    } catch {
      return false;
    }
  }
}
