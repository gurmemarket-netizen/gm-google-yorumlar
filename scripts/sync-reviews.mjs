// GurmeMarket – Google yorum senkronu
// Çalışma sırası:
//  1) Google Business Profile API kimlik bilgileri varsa: işletmenin TÜM yorumlarını en yeniden eskiye çeker.
//     (Yeni yorum Google'da yayınlandığı anda bir sonraki çalışmada siteye düşer.)
//  2) Yoksa Google Places API (New): puan, yorum sayısı ve Google'ın verdiği en fazla 5 yorumu çeker.
// Sonuç public/reviews.json dosyasına yazılır; site bu dosyayı okur.
//
// Ortam değişkenleri (GitHub > Settings > Secrets and variables > Actions):
//   GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN, GBP_ACCOUNT_ID, GBP_LOCATION_ID   (1. yöntem)
//   PLACES_API_KEY, PLACE_ID (boşsa isimle bulunur)                                          (2. yöntem)
//   MIN_RATING (varsayılan 4)  – sitede gösterilecek en düşük yıldız
//   MAX_REVIEWS (varsayılan 60) – dosyada tutulacak en fazla yorum

import { readFile, writeFile } from 'node:fs/promises';

const OUT = new URL('../public/reviews.json', import.meta.url);
const env = process.env;
const MIN_RATING = Number(env.MIN_RATING || 4);
const MAX_REVIEWS = Number(env.MAX_REVIEWS || 60);
const PLACE_QUERY = 'Efendioğlu Gurme Market Gaziantep';
const MAPS_FALLBACK = 'https://www.google.com/maps?cid=866895817036598945';
const STAR = { ONE: 1, TWO: 2, THREE: 3, FOUR: 4, FIVE: 5 };

async function getJson(url, opts = {}) {
  const r = await fetch(url, opts);
  const t = await r.text();
  if (!r.ok) throw new Error(`${r.status} ${url.split('?')[0]} → ${t.slice(0, 300)}`);
  return JSON.parse(t);
}

// ---------- 1) Google Business Profile API (işletme sahibinin kendi yorumları) ----------
async function fromBusinessProfile() {
  const { GBP_CLIENT_ID, GBP_CLIENT_SECRET, GBP_REFRESH_TOKEN, GBP_ACCOUNT_ID, GBP_LOCATION_ID } = env;
  if (!(GBP_CLIENT_ID && GBP_CLIENT_SECRET && GBP_REFRESH_TOKEN && GBP_ACCOUNT_ID && GBP_LOCATION_ID)) return null;

  const tok = await getJson('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: GBP_CLIENT_ID, client_secret: GBP_CLIENT_SECRET,
      refresh_token: GBP_REFRESH_TOKEN, grant_type: 'refresh_token',
    }),
  });
  const auth = { Authorization: `Bearer ${tok.access_token}` };
  const base = `https://mybusiness.googleapis.com/v4/accounts/${GBP_ACCOUNT_ID}/locations/${GBP_LOCATION_ID}/reviews`;

  let pageToken = '', all = [], avg = null, total = null;
  do {
    const j = await getJson(`${base}?pageSize=50&orderBy=updateTime%20desc${pageToken ? `&pageToken=${pageToken}` : ''}`, { headers: auth });
    avg = j.averageRating ?? avg;
    total = j.totalReviewCount ?? total;
    all = all.concat(j.reviews || []);
    pageToken = j.nextPageToken || '';
  } while (pageToken && all.length < MAX_REVIEWS * 3);

  return {
    source: 'business-profile',
    place: { rating: avg, count: total },
    reviews: all.map(r => ({
      id: r.reviewId || r.name,
      author: r.reviewer?.isAnonymous ? 'Google kullanıcısı' : (r.reviewer?.displayName || 'Google kullanıcısı'),
      authorUri: null,
      photo: r.reviewer?.profilePhotoUrl || null,
      rating: STAR[r.starRating] || 0,
      // Google çeviri ekiyse yalnızca orijinal metni al
      text: String(r.comment || '').split('(Translated by Google)')[0].replace(/\(Original\)\s*/,'').trim(),
      publishTime: r.createTime,
      approxDate: false,
      relative: null,
      reply: r.reviewReply?.comment || null,
      source: 'business-profile',
    })),
  };
}

// ---------- 2) Google Places API (New) ----------
async function fromPlaces() {
  const key = env.PLACES_API_KEY;
  if (!key) return null;
  let placeId = env.PLACE_ID;
  if (!placeId) {
    const s = await getJson('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id,places.displayName' },
      body: JSON.stringify({ textQuery: PLACE_QUERY, languageCode: 'tr', regionCode: 'TR' }),
    });
    placeId = s.places?.[0]?.id;
    if (!placeId) throw new Error('İşletme Places API ile bulunamadı');
    console.log('PLACE_ID bulundu (secrets içine kaydedin):', placeId);
  }
  const p = await getJson(`https://places.googleapis.com/v1/places/${placeId}?languageCode=tr&regionCode=TR`, {
    headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'id,displayName,rating,userRatingCount,googleMapsUri,reviews' },
  });
  // En yeni 5 yorum: Places API (eski sürüm) reviews_sort=newest. Hata olursa yalnızca uyarı verir.
  let newest = [];
  try {
    const L = await getJson(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${p.id}&fields=reviews&reviews_sort=newest&reviews_no_translations=true&language=tr&key=${key}`);
    if (L.status && L.status !== 'OK') throw new Error(`${L.status} ${String(L.error_message || '').slice(0, 200)}`);
    newest = (L.result?.reviews || []).map(r => ({
      id: `legacy:${r.author_name}:${r.time}`,
      author: r.author_name || 'Google kullanıcısı',
      authorUri: r.author_url || null,
      photo: r.profile_photo_url || null,
      rating: r.rating || 0,
      text: String(r.text || '').trim(),
      publishTime: r.time ? new Date(r.time * 1000).toISOString() : null,
      approxDate: false,
      relative: r.relative_time_description || null,
      source: 'places',
    }));
  } catch (e) { console.log('En yeni yorumlar alınamadı (Places eski sürüm):', String(e.message).slice(0, 300)); }

  return {
    source: 'places',
    place: {
      rating: p.rating, count: p.userRatingCount, mapsUri: p.googleMapsUri,
      writeReviewUri: `https://search.google.com/local/writereview?placeid=${p.id}`,
    },
    reviews: [...(p.reviews || []).map(r => ({
      id: r.name,
      author: r.authorAttribution?.displayName || 'Google kullanıcısı',
      authorUri: r.authorAttribution?.uri || null,
      photo: r.authorAttribution?.photoUri || null,
      rating: r.rating || 0,
      text: (r.originalText?.text || r.text?.text || '').trim(),
      publishTime: r.publishTime,
      approxDate: false,
      relative: r.relativePublishTimeDescription || null,
      source: 'places',
    })), ...newest],
  };
}

const norm = s => String(s || '').toLocaleLowerCase('tr').replace(/\s+/g, ' ').slice(0, 60);

async function main() {
  let prev = { place: {}, reviews: [] };
  try { prev = JSON.parse(await readFile(OUT, 'utf8')); } catch {}

  const fresh = (await fromBusinessProfile()) || (await fromPlaces());
  if (!fresh) { console.log('Kimlik bilgisi yok; dosya değiştirilmedi.'); return; }

  // Birleştir: aynı yorum (id ya da yazar+metin başlangıcı) tekrar eklenmez, güncel hali alınır.
  const byKey = new Map();
  const keyOf = r => `${norm(r.author)}|${norm(r.text)}`;
  for (const r of prev.reviews || []) byKey.set(keyOf(r), r);
  for (const r of fresh.reviews) {
    const k = keyOf(r);
    const old = byKey.get(k);
    byKey.set(k, { ...old, ...r });
  }

  let reviews = [...byKey.values()];
  if (fresh.source === 'business-profile') {
    // Tam liste geldi: Google'da silinen yorumlar sitede de kalmasın (elle girilenler dahil).
    const live = new Set(fresh.reviews.map(keyOf));
    reviews = reviews.filter(r => live.has(keyOf(r)));
  } else {
    // Places API içeriği Google koşulları gereği en fazla 30 gün önbellekte tutulur.
    const cutoff = Date.now() - 30 * 864e5;
    reviews = reviews.filter(r => r.source !== 'places' || (r.seenAt && Date.parse(r.seenAt) > cutoff) || fresh.reviews.some(f => keyOf(f) === keyOf(r)));
    const now = new Date().toISOString();
    reviews = reviews.map(r => fresh.reviews.some(f => keyOf(f) === keyOf(r)) ? { ...r, seenAt: now } : r);
  }

  reviews = reviews
    .filter(r => r.rating >= MIN_RATING && r.text && r.text.length >= 20)
    .sort((a, b) => Date.parse(b.publishTime || 0) - Date.parse(a.publishTime || 0))
    .slice(0, MAX_REVIEWS);

  const place = {
    name: 'Efendioğlu Gurme Market',
    mapsUri: MAPS_FALLBACK,
    writeReviewUri: MAPS_FALLBACK,
    ...prev.place,
    ...Object.fromEntries(Object.entries(fresh.place).filter(([, v]) => v != null)),
  };

  const out = { updatedAt: new Date().toISOString(), source: fresh.source, place, reviews };
  const before = JSON.stringify({ ...prev, updatedAt: 0 });
  const after = JSON.stringify({ ...out, updatedAt: 0 });
  if (before === after) { console.log('Değişiklik yok.'); return; }
  await writeFile(OUT, JSON.stringify(out, null, 1) + '\n');
  console.log(`Güncellendi: ${place.rating} puan, ${place.count} yorum, sitede ${reviews.length} yorum (${fresh.source}).`);
}

main().catch(e => { console.error(e.message); process.exit(1); });
