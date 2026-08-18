/* EXHEOH SYSTEM 서비스워커
 * 전략:
 *  - index.html(내비게이션): 네트워크 우선 → 실패 시(오프라인) 캐시 → 항상 최신 배포가 우선 반영됨
 *  - 정적 자산(아이콘·로고·CDN 라이브러리): 캐시 우선 + 백그라운드 갱신
 *  - Supabase API 호출은 가로채지 않음 (실시간 데이터)
 * 배포 시 새 버전을 강제 반영하려면 아래 CACHE_VERSION 숫자만 올리면 됩니다.
 */
const CACHE_VERSION = 1;
const CACHE_NAME = 'exheoh-shell-v' + CACHE_VERSION;

const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './EXHEOH_LOGO-01-01.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Supabase(데이터·인증)는 절대 캐싱하지 않음
  if (url.hostname.endsWith('.supabase.co')) return;

  // 페이지 내비게이션: 네트워크 우선, 오프라인이면 캐시된 index.html
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // 정적 자산(같은 출처 + CDN 스크립트/폰트): 캐시 우선, 백그라운드 갱신
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetched = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
          }
          return res;
        })
        .catch(() => cached);
      return cached || fetched;
    })
  );
});
