import { httpError, normalizeTr } from '../../utils';
import { request } from './client';

/**
 * DHL (MNG) CBS Info API: createOrder'ın istediği il (cityCode) ve ilçe (districtCode) kodları.
 * Bu API'nin dokümanı henüz elimizde yok. Yollar canlı sunucuda doğrulandı (GET dışı isteğe 405, bilinmeyen yola 404);
 * yanıt alan adları (code/name) toleranslı okunur. Listeler 24 saat bellekte tutulur.
 */

export type Place = { code: number; name: string };
type Cache = { cities?: Place[]; citiesAt: number; districts: Map<number, { list: Place[]; at: number }> };
const g = globalThis as unknown as { __dhlCbs?: Cache };
const TTL = 24 * 3600_000;
const cache = (): Cache => g.__dhlCbs || (g.__dhlCbs = { citiesAt: 0, districts: new Map() });

function toPlaces(data: unknown, kind: 'city' | 'district'): Place[] {
  const anyData = data as any;
  const list: any[] = Array.isArray(anyData) ? anyData : Array.isArray(anyData?.data) ? anyData.data : Array.isArray(anyData?.result) ? anyData.result : [];
  return list
    .map((x) => {
      const code = kind === 'district' ? x?.districtCode ?? x?.code ?? x?.id : x?.cityCode ?? x?.code ?? x?.id;
      const name = kind === 'district' ? x?.districtName ?? x?.name : x?.cityName ?? x?.name;
      return { code: Number(code), name: String(name ?? '').trim() };
    })
    .filter((p) => Number.isFinite(p.code) && p.code > 0 && p.name);
}

export async function cities(): Promise<Place[]> {
  const c = cache();
  if (c.cities && Date.now() - c.citiesAt < TTL) return c.cities;
  const data = await request('GET', '/cbsinfoapi/getcities');
  const list = toPlaces(data, 'city');
  if (!list.length) throw httpError(502, `DHL il listesi okunamadı (CBS Info API): ${JSON.stringify(data).slice(0, 200)}`);
  c.cities = list; c.citiesAt = Date.now();
  return list;
}

export async function districts(cityCode: number): Promise<Place[]> {
  const c = cache();
  const hit = c.districts.get(cityCode);
  if (hit && Date.now() - hit.at < TTL) return hit.list;
  const data = await request('GET', `/cbsinfoapi/getdistricts/${cityCode}`);
  const list = toPlaces(data, 'district');
  if (!list.length) throw httpError(502, `DHL ilçe listesi okunamadı (il kodu ${cityCode}): ${JSON.stringify(data).slice(0, 200)}`);
  c.districts.set(cityCode, { list, at: Date.now() });
  return list;
}

/** Ad eşleştirme: Türkçe karakter ve büyük/küçük harf duyarsız; önce tam, sonra parantez/ek temizlenmiş eşleşme. */
export function findPlace(list: Place[], name: string): Place | null {
  const key = (s: string) => normalizeTr(s).replace(/\(.*?\)/g, '').replace(/[^a-z0-9]/g, '');
  const n = key(name);
  if (!n) return null;
  return list.find((p) => key(p.name) === n) || null;
}

export async function resolveCodes(city: string, district: string): Promise<{ cityCode: number; districtCode: number; cityName: string; districtName: string }> {
  const il = findPlace(await cities(), city);
  if (!il) throw httpError(400, `İl DHL listesinde bulunamadı: "${city}". Müşteri adresindeki ili düzeltin.`);
  const ilce = findPlace(await districts(il.code), district);
  if (!ilce) throw httpError(400, `İlçe DHL listesinde bulunamadı: "${district}" (${il.name}). Müşteri adresindeki ilçeyi düzeltin.`);
  return { cityCode: il.code, districtCode: ilce.code, cityName: il.name, districtName: ilce.name };
}

export function clearCache() { g.__dhlCbs = undefined; }
