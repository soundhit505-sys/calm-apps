/* =====================================================================
   いま、ここ — Service Worker
   役割：一度開いたアプリを端末にキャッシュし、オフラインでも使えるようにする。

   ★アプリを更新したとき（HTMLを差し替えたとき）は、
     下の CACHE_VERSION の数字を 1 つ増やしてからアップロードしてください。
     （例： "v1" → "v2"）。古いキャッシュが入れ替わり、最新版が届きます。
   ===================================================================== */

const CACHE_VERSION = "v1";
const CACHE_NAME = "ima-koko-" + CACHE_VERSION;

// 最初にまとめて保存しておくファイル（アプリ本体）
const PRECACHE = [
  "./",
  "./index.html",
  "./shizuka.html",
  "./tamatebako.html",
  "./grounding.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
];

// インストール時：本体を保存
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // 1つ失敗しても全体が止まらないよう、個別に追加
      Promise.allSettled(PRECACHE.map((url) => cache.add(url)))
    ).then(() => self.skipWaiting())
  );
});

// 有効化時：古いバージョンのキャッシュを掃除
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k.startsWith("ima-koko-") && k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// 取得時の戦略
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;

  if (sameOrigin) {
    // 自分のファイル：まずキャッシュを即返し、裏で新しいものを取り直す
    // （stale-while-revalidate）。オフラインでも開け、次回には最新になる。
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          const network = fetch(req)
            .then((res) => {
              if (res && res.status === 200) cache.put(req, res.clone());
              return res;
            })
            .catch(() => cached); // オフライン時はキャッシュで代替
          return cached || network;
        })
      )
    );
  } else {
    // 外部リソース（フォント等）：キャッシュ優先、なければ取得して保存
    event.respondWith(
      caches.open(CACHE_NAME).then((cache) =>
        cache.match(req).then((cached) => {
          if (cached) return cached;
          return fetch(req)
            .then((res) => {
              // opaque も含めて保存（オフラインでも書体が出るように）
              try { cache.put(req, res.clone()); } catch (e) {}
              return res;
            })
            .catch(() => cached);
        })
      )
    );
  }
});
