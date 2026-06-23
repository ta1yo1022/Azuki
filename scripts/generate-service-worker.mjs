import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const outputDirectory = path.join(process.cwd(), "out");
const rootAssets = new Set([
  "apple-touch-icon.png",
  "favicon-32.png",
  "icon-192.png",
  "icon-512.png",
  "manifest.webmanifest",
]);

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const entryPath = path.join(directory, entry.name);
      return entry.isDirectory() ? listFiles(entryPath) : [entryPath];
    }),
  );
  return files.flat();
}

function toCacheUrl(relativePath) {
  const urlPath = relativePath.split(path.sep).join("/");
  if (urlPath === "index.html") {
    return "/";
  }
  if (urlPath.endsWith("/index.html")) {
    return `/${urlPath.slice(0, -"index.html".length)}`;
  }
  return `/${urlPath}`;
}

const files = (await listFiles(outputDirectory))
  .filter((filePath) => {
    const relativePath = path.relative(outputDirectory, filePath);
    const isPage =
      relativePath === "index.html" || relativePath.endsWith(`${path.sep}index.html`);
    const isNextAsset = relativePath.startsWith(`_next${path.sep}static${path.sep}`);
    const isRootAsset = rootAssets.has(relativePath);

    return (
      (isPage || isNextAsset || isRootAsset) &&
      !relativePath.startsWith(`404${path.sep}`) &&
      !relativePath.startsWith(`_not-found${path.sep}`)
    );
  })
  .sort();

const hash = createHash("sha256");
for (const filePath of files) {
  const relativePath = path.relative(outputDirectory, filePath);
  hash.update(relativePath);
  hash.update(await readFile(filePath));
}

const cacheName = `azuki-${hash.digest("hex").slice(0, 12)}`;
const cacheUrls = [
  ...new Set(
    files.map((filePath) =>
      toCacheUrl(path.relative(outputDirectory, filePath)),
    ),
  ),
];
const navigationUrls = cacheUrls.filter(
  (url) => url === "/" || url.endsWith("/"),
);

const serviceWorker = `const CACHE_NAME = ${JSON.stringify(cacheName)};
const PRECACHE_URLS = ${JSON.stringify(cacheUrls, null, 2)};
const NAVIGATION_URLS = new Set(${JSON.stringify(navigationUrls, null, 2)});

function normalizeNavigationUrl(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = url.pathname;
  if (pathname !== "/" && !pathname.endsWith("/")) {
    pathname += "/";
  }
  return pathname;
}

async function fetchAndCache(cache, url) {
  let lastError;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, { cache: "reload" });
      if (!response.ok) {
        throw new Error(
          "Failed to cache " + url + ": " + response.status,
        );
      }
      await cache.put(url, response);
      return;
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError;
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      await Promise.all(
        PRECACHE_URLS.map((url) => fetchAndCache(cache, url)),
      );
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((names) =>
        Promise.all(
          names
            .filter((name) => name.startsWith("azuki-") && name !== CACHE_NAME)
            .map((name) => caches.delete(name)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      const cacheKey =
        request.mode === "navigate"
          ? normalizeNavigationUrl(request.url)
          : url.pathname;
      const cached = await cache.match(cacheKey);
      if (cached) {
        return cached;
      }

      try {
        const response = await fetch(request);
        if (response.ok && response.type === "basic") {
          await cache.put(cacheKey, response.clone());
        }
        return response;
      } catch {
        if (request.mode === "navigate") {
          return (
            (NAVIGATION_URLS.has(cacheKey) && (await cache.match(cacheKey))) ||
            cache.match("/")
          );
        }
        return new Response("Offline", { status: 503 });
      }
    }),
  );
});
`;

await writeFile(path.join(outputDirectory, "sw.js"), serviceWorker);
console.log(
  `Generated service worker ${cacheName} with ${cacheUrls.length} cached files.`,
);
