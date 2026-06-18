import * as PIXI from "pixi.js";
import { Spine } from "pixi-spine";
import { getManifestFishTypes } from "~/composables/game_core/fish/useManifestFishData";

// ── Base path ─────────────────────────────────────────────────────────────────
export const FISH_BASE_PATH = "/fish/fish-all-star";
const RES = `${FISH_BASE_PATH}/resources`;

// ── Atlas URLs ────────────────────────────────────────────────────────────────
export const EFFECT_ATLAS_URL = `${RES}/effect.atlas.txt`;
export const EFFECT_IMAGE_URL = `${RES}/effect.png`;
export const NAGA_ATLAS_URL = `${RES}/naga.atlas.txt`;
export const UI_ATLAS_URL = `${RES}/ui.atlas.txt`;
export const CANNON_ATLAS_URL = `${RES}/cannon.atlas.txt`;
export const BULLET_ATLAS_URL = `${RES}/bullet.atlas.txt`;
export const CATCH_BIG_ATLAS_URL = `${RES}/catch_big.atlas.txt`;
export const COIN_ATLAS_URL = `${RES}/coin.atlas.txt`;
export const EXPLOSIVE_EFFECT_ATLAS_URL = `${RES}/fbf.atlas.txt`;
export const NORMAL_FISH_ATLAS_URL = `${RES}/normal_fish.atlas.txt`;
export const POPUP_INFO_ATLAS_URL = `${RES}/popup_info_menu.atlas.txt`;
export const REWARD_AWAKEN_ATLAS_URL = `${RES}/reward_awaken.atlas.txt`;
export const WHEEL_ATLAS_URL = `${RES}/wheel.atlas.txt`;

export const LOCALIZE_ATLAS_URLS = {
  en: `${RES}/localize_text/en.atlas.txt`,
  km: `${RES}/localize_text/km.atlas.txt`,
} as const;

export type LocalizeLanguage = keyof typeof LOCALIZE_ATLAS_URLS;

// ── All atlases to preload ────────────────────────────────────────────────────
const ALL_ATLAS_URLS = [
  BULLET_ATLAS_URL,
  CANNON_ATLAS_URL,
  CATCH_BIG_ATLAS_URL,
  COIN_ATLAS_URL,
  EFFECT_ATLAS_URL,
  EXPLOSIVE_EFFECT_ATLAS_URL,
  NAGA_ATLAS_URL,
  NORMAL_FISH_ATLAS_URL,
  POPUP_INFO_ATLAS_URL,
  REWARD_AWAKEN_ATLAS_URL,
  UI_ATLAS_URL,
  WHEEL_ATLAS_URL,
  `${RES}/puffer/purple.atlas.txt`,
  `${RES}/puffer/purple_anger.atlas.txt`,
  `${RES}/puffer/yellow.atlas.txt`,
  `${RES}/puffer/yellow_anger.atlas.txt`,
  `${RES}/squid/purple_angry.atlas.txt`,
  `${RES}/squid/purple_run.atlas.txt`,
  `${RES}/squid/yellow_angry.atlas.txt`,
  `${RES}/squid/yellow_run.atlas.txt`,
  `${RES}/spine_fbf/lobster/red.atlas.txt`,
  `${RES}/spine_fbf/lobster/yellow.atlas.txt`,
  LOCALIZE_ATLAS_URLS.en,
  LOCALIZE_ATLAS_URLS.km,
] as const;

// ── Bitmap fonts ──────────────────────────────────────────────────────────────
export const COIN_FONT_URL = `${RES}/fnt/coin/fnt_coin.fnt`;
export const ODD_FONT_URL = `${RES}/fnt/fnt_odd/fnt_odd.fnt`;
export const SYSTEM_FONT_URL = `${RES}/fnt/system_font/system_font.fnt`;

const ALL_FONT_URLS = [
  COIN_FONT_URL,
  ODD_FONT_URL,
  SYSTEM_FONT_URL,
  `${RES}/fnt/fnt_boss_win_awaken/fnt_boss_win_awaken.fnt`,
  `${RES}/fnt/fnt_count/fnt_count.fnt`,
  `${RES}/fnt/fnt_lightning_ball/fnt_lightning_ball.fnt`,
  `${RES}/fnt/fnt_shots_num/fnt_shots_num.fnt`,
  `${RES}/fnt/fnt_bet.fnt`,
  `${RES}/fnt/num_auto.fnt`,
] as const;

// ── Spine manifests ───────────────────────────────────────────────────────────
const ALL_SPINE_MANIFESTS = [
  {
    json: `${RES}/spines/boss_octopus/boss_octopus.json`,
    atlas: `${RES}/spines/boss_octopus/boss_octopus.atlas.txt`,
  },
  { json: `${RES}/spines/cr/cr.json`, atlas: `${RES}/spines/cr/cr.atlas.txt` },
  {
    json: `${RES}/spines/crab/crab.json`,
    atlas: `${RES}/spines/crab/crab.atlas.txt`,
  },
  { json: `${RES}/spines/dt/dt.json`, atlas: `${RES}/spines/dt/dt.atlas.txt` },
  {
    json: `${RES}/spines/naga/naga.json`,
    atlas: `${RES}/spines/naga/naga.atlas.txt`,
  },
  {
    json: `${RES}/spines/phoenix/phoenix.json`,
    atlas: `${RES}/spines/phoenix/phoenix.atlas.txt`,
  },
] as const;

// ── Backgrounds ───────────────────────────────────────────────────────────────
const ALL_BACKGROUND_URLS = [
  `${RES}/background/bg1.webp`,
  `${RES}/background/bg2.webp`,
  `${RES}/background/bg3.webp`,
  `${RES}/background/bg_crocodile.png`,
  `${RES}/background/bg_naga.webp`,
  `${RES}/background/bg_naga_1.webp`,
  `${RES}/background/bg_naga_2.webp`,
  `${RES}/background/bg_phoenix.webp`,
] as const;

// ── Avatar URLs ───────────────────────────────────────────────────────────────
export const DEFAULT_AVATAR_URLS = [
  "/avatar/Avatar3.png",
  "/avatar/Avatar4.png",
  "/avatar/Avatar6.png",
  "/avatar/Avatar7.png",
] as const;

// ── Icon button ───────────────────────────────────────────────────────────────
export const ICON_BUTTON_ATLAS_URL = "/icon_button/button.json";
export const ICON_BUTTON_IMAGE_URL = "/icon_button/button.png";

// ── Internal types ────────────────────────────────────────────────────────────
type ApiRenderState = {
  prefix: string;
  frame_array: string[];
  state_code: string;
  is_default: boolean;
};

type ApiRenderFamily = {
  render_type: { type_code: string } | null;
  render_states: ApiRenderState[];
  spine_json_path: string | null;
  spine_atlas_path: string | null;
};

type ApiFishType = {
  id: number;
  default_state_code: string;
  render_family: ApiRenderFamily | null;
};

type AtlasFrameRect = {
  idx: number;
  x: number;
  y: number;
  w: number;
  h: number;
};
type AtlasData = {
  meta?: { image?: string };
  frames?: Record<string, { frame: AtlasFrameRect }>;
};

type AtlasTextureMap = Map<string, PIXI.Texture>;

// ── Module-level caches ───────────────────────────────────────────────────────
const loadedUrls = new Set<string>();
const loadingUrls = new Map<string, Promise<void>>();
const effectTextures = new Map<string, PIXI.Texture>();
const atlasTextures = new Map<string, AtlasTextureMap>();
const atlasPromises = new Map<string, Promise<void>>();
const bitmapFontPromises = new Map<string, Promise<void>>();
const jsonCache = new Map<string, unknown>();
const jsonPromises = new Map<string, Promise<unknown>>();

let effectAtlasPromise: Promise<void> | null = null;
let appAssetPreloadPromise: Promise<void> | null = null;

// ── URL helpers ───────────────────────────────────────────────────────────────
const webpBackgrounds = new Set([
  "bg1.png",
  "bg2.png",
  "bg3.png",
  "bg_naga.png",
  "bg_naga_1.png",
  "bg_naga_2.png",
  "bg_phoenix.png",
]);

function normalizeAssetUrl(url: string): string {
  const fileName = url.split("/").pop() ?? "";

  if (url.includes("/fish/fish-all-star/spines/")) {
    return url
      .replace(
        "/fish/fish-all-star/spines/",
        "/fish/fish-all-star/resources/spines/",
      )
      .replace(/\.png$/i, ".webp");
  }

  if (
    url.includes("/resources/background/") &&
    url.endsWith(".png") &&
    webpBackgrounds.has(fileName)
  ) {
    return url.replace(/\.png$/, ".webp");
  }

  return url;
}

export function normalizeFishAssetUrl(url: string): string {
  return normalizeAssetUrl(url);
}

function getAtlasUrlFromPrefix(prefix: string | null): string | null {
  if (!prefix) return null;
  const clean = prefix.replace(/\/+$/, "");
  return `${FISH_BASE_PATH}/${clean}.atlas.txt`;
}

// ── Single URL loader ─────────────────────────────────────────────────────────
async function loadSingleUrl(
  url: string,
  options?: { ignoreErrors?: boolean },
): Promise<void> {
  if (loadedUrls.has(url)) return;

  const existing = loadingUrls.get(url);
  if (existing) {
    await existing;
    return;
  }

  const promise = (async () => {
    try {
      const ext = url.split("?")[0]?.split(".").pop()?.toLowerCase() ?? "";
      if (["png", "webp", "jpg", "jpeg"].includes(ext)) {
        await PIXI.Assets.load(url);
      } else {
        await fetch(url, { cache: "force-cache" });
      }
      loadedUrls.add(url);
    } catch (error) {
      if (!options?.ignoreErrors) throw error;
      console.warn("[assets] skipped missing asset", url);
      loadedUrls.add(url);
    }
  })();

  loadingUrls.set(url, promise);
  try {
    await promise;
  } finally {
    loadingUrls.delete(url);
  }
}

// ── Atlas preloader ───────────────────────────────────────────────────────────
async function preloadAtlas(atlasUrl: string): Promise<void> {
  if (atlasTextures.has(atlasUrl)) return;

  const existing = atlasPromises.get(atlasUrl);
  if (existing) {
    await existing;
    return;
  }

  const promise = (async () => {
    await loadSingleUrl(atlasUrl);

    const response = await fetch(atlasUrl, { cache: "force-cache" });
    const atlas = (await response.json()) as AtlasData;

    const imageNames =
      atlas.meta?.image
        ?.split(",")
        .map((n) => n.trim())
        .filter(Boolean) ?? [];

    if (imageNames.length === 0) {
      atlasTextures.set(atlasUrl, new Map());
      return;
    }

    const atlasDir = atlasUrl.split("/").slice(0, -1).join("/");
    const imageUrls = imageNames.map((name) =>
      name.startsWith("/") ? name : `${atlasDir}/${name}`,
    );

    await Promise.all(imageUrls.map((url) => loadSingleUrl(url)));

    const baseTextures = imageUrls.map(
      (url) => PIXI.Texture.from(url).baseTexture,
    );
    const textures: AtlasTextureMap = new Map();

    for (const [frameName, entry] of Object.entries(atlas.frames ?? {})) {
      const rect = entry.frame;
      if (!rect) continue;
      const base = baseTextures[rect.idx ?? 0];
      if (!base) continue;
      textures.set(
        frameName,
        new PIXI.Texture(
          base,
          new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h),
        ),
      );
    }

    atlasTextures.set(atlasUrl, textures);
  })();

  atlasPromises.set(atlasUrl, promise);
  try {
    await promise;
  } finally {
    atlasPromises.delete(atlasUrl);
  }
}

// ── Effect atlas (custom separate parser) ─────────────────────────────────────
async function preloadEffectAtlas(): Promise<void> {
  if (effectTextures.size > 0) return;
  if (effectAtlasPromise) {
    await effectAtlasPromise;
    return;
  }

  effectAtlasPromise = (async () => {
    await Promise.all([
      loadSingleUrl(EFFECT_ATLAS_URL),
      loadSingleUrl(EFFECT_IMAGE_URL),
    ]);

    const response = await fetch(EFFECT_ATLAS_URL, { cache: "force-cache" });
    const atlas = (await response.json()) as AtlasData;
    const imageUrl = atlas.meta?.image
      ? `${RES}/${atlas.meta.image}`
      : EFFECT_IMAGE_URL;

    const baseTexture = PIXI.Texture.from(imageUrl).baseTexture;

    for (const [frameName, entry] of Object.entries(atlas.frames ?? {})) {
      const rect = entry.frame;
      if (!rect) continue;
      effectTextures.set(
        frameName,
        new PIXI.Texture(
          baseTexture,
          new PIXI.Rectangle(rect.x, rect.y, rect.w, rect.h),
        ),
      );
    }
  })();

  try {
    await effectAtlasPromise;
  } finally {
    effectAtlasPromise = null;
  }
}

// ── Bitmap font preloader ─────────────────────────────────────────────────────
const SKIPPED_FONTS = new Set([`${RES}/fnt/system_font.fnt`]);

function extractPageFiles(fontText: string): string[] {
  return [...fontText.matchAll(/<page[^>]*file="([^"]+)"/g)]
    .map((m) => m[1] ?? "")
    .filter(Boolean);
}

function resolveRelativeUrl(baseUrl: string, relative: string): string {
  if (relative.startsWith("/")) return normalizeAssetUrl(relative);
  const dir = baseUrl.split("/").slice(0, -1).join("/");
  return normalizeAssetUrl(`${dir}/${relative}`);
}

function sanitizeFontText(
  fontText: string,
  pageSizes: Record<string, { width: number; height: number }>,
): string {
  const pageFileById = new Map<number, string>();
  for (const m of fontText.matchAll(
    /<page[^>]*id="(\d+)"[^>]*file="([^"]+)"/g,
  )) {
    const id = Number(m[1]);
    const file = m[2] ?? "";
    if (Number.isFinite(id) && file) pageFileById.set(id, file);
  }

  const validChars = [...fontText.matchAll(/^[ \t]*<char\b[^>]*\/>[ \t]*$/gm)]
    .map((m) => m[0])
    .filter((line) => {
      const pageId = Number(line.match(/\bpage="(\d+)"/)?.[1] ?? "0");
      const x = Number(line.match(/\bx="(\d+)"/)?.[1] ?? "0");
      const y = Number(line.match(/\by="(\d+)"/)?.[1] ?? "0");
      const w = Number(line.match(/\bwidth="(\d+)"/)?.[1] ?? "0");
      const h = Number(line.match(/\bheight="(\d+)"/)?.[1] ?? "0");
      const pageFile = pageFileById.get(pageId);
      const size = pageFile ? pageSizes[pageFile] : null;
      return !size || (x + w <= size.width && y + h <= size.height);
    });

  const kernings =
    fontText.match(/^[ \t]*<kernings\b[^>]*\/>[ \t]*$/m)?.[0]?.trim() ??
    '<kernings count="0"/>';

  const rebuilt = [
    `  <chars count="${validChars.length}">`,
    ...validChars.map((l) => `    ${l.trim()}`),
    `  </chars>`,
    `  ${kernings}`,
  ].join("\n");

  const malformed = /<chars\b[^>]*>[\s\S]*?<kernings\b[^>]*\/?>\s*<\/chars>/;
  const normal = /<chars\b[^>]*>[\s\S]*?<\/chars>/;
  return fontText.replace(
    malformed.test(fontText) ? malformed : normal,
    rebuilt,
  );
}

async function preloadBitmapFont(fontUrl: string): Promise<void> {
  const url = normalizeAssetUrl(fontUrl);
  if (SKIPPED_FONTS.has(url)) return;

  const existing = bitmapFontPromises.get(url);
  if (existing) {
    await existing;
    return;
  }

  const promise = (async () => {
    await loadSingleUrl(url);

    let fontText = await fetch(url, { cache: "force-cache" }).then((r) =>
      r.text(),
    );

    // Fix empty letter attributes
    fontText = fontText.replace(
      /(<char\b[^>]*\bid="(\d+)"[^>]*)\bletter=""/g,
      (_, prefix, id) => {
        const code = Number(id);
        const entities: Record<number, string> = {
          32: "&#32;",
          34: "&quot;",
          38: "&amp;",
          39: "&apos;",
          60: "&lt;",
          62: "&gt;",
        };
        return `${prefix}letter="${entities[code] ?? String.fromCharCode(code)}"`;
      },
    );

    const pageFiles = extractPageFiles(fontText);
    const pageEntries = await Promise.all(
      pageFiles.map(async (file) => {
        const imageUrl = resolveRelativeUrl(url, file);
        await loadSingleUrl(imageUrl);
        return [file, PIXI.Texture.from(imageUrl)] as const;
      }),
    );

    const pageSizes = Object.fromEntries(
      pageEntries.map(([file, tex]) => [
        file,
        { width: tex.width, height: tex.height },
      ]),
    );

    const sanitized = sanitizeFontText(fontText, pageSizes);
    const fontName = sanitized.match(/<info[^>]*face="([^"]+)"/)?.[1];
    if (fontName && PIXI.BitmapFont.available[fontName]) return;

    PIXI.BitmapFont.install(sanitized, Object.fromEntries(pageEntries));
  })();

  bitmapFontPromises.set(url, promise);
  try {
    await promise;
  } finally {
    bitmapFontPromises.delete(url);
  }
}

// ── JSON asset cache ──────────────────────────────────────────────────────────
async function preloadJsonAsset<T>(url: string): Promise<T> {
  const normalized = normalizeAssetUrl(url);
  const cached = jsonCache.get(normalized);
  if (cached) return cached as T;

  const existing = jsonPromises.get(normalized);
  if (existing) return (await existing) as T;

  const promise = fetch(normalized, { cache: "force-cache" })
    .then((r) => r.json())
    .then((data) => {
      jsonCache.set(normalized, data);
      return data;
    });

  jsonPromises.set(normalized, promise);
  try {
    return (await promise) as T;
  } finally {
    jsonPromises.delete(normalized);
  }
}

function getJsonAsset<T>(url: string): T | null {
  return (jsonCache.get(normalizeAssetUrl(url)) as T | undefined) ?? null;
}

// ── Fish atlas URLs from API data ─────────────────────────────────────────────
function getFishAtlasUrlsFromApi(): string[] {
  const urls = new Set<string>();
  for (const fish of getManifestFishTypes() as ApiFishType[]) {
    const family = fish.render_family;
    if (family?.render_type?.type_code !== "atlas_sprite_anim") continue;
    for (const state of family.render_states) {
      const url = getAtlasUrlFromPrefix(state.prefix ?? null);
      if (url) urls.add(url);
    }
  }
  return [...urls];
}

// ── Spine manifests from API data ─────────────────────────────────────────────
function getSpineManifsFromApi(): Array<{ json: string; atlas: string }> {
  const seen = new Set<string>();
  const result: Array<{ json: string; atlas: string }> = [];
  for (const fish of getManifestFishTypes() as ApiFishType[]) {
    const family = fish.render_family;
    if (family?.render_type?.type_code !== "spine") continue;
    if (!family.spine_json_path || !family.spine_atlas_path) continue;
    if (seen.has(family.spine_json_path)) continue;
    seen.add(family.spine_json_path);
    result.push({
      json: family.spine_json_path,
      atlas: family.spine_atlas_path,
    });
  }
  return result;
}

async function preloadSpines(): Promise<void> {
  // Static spines from tree
  const staticSpines = [...ALL_SPINE_MANIFESTS];

  // Dynamic spines from API
  const apiSpines = getSpineManifsFromApi();

  const all = [...staticSpines, ...apiSpines];

  await Promise.all(
    all.map(async (manifest) => {
      try {
        const res = await fetch(manifest.json, { cache: "force-cache" });
        if (!res.ok) return;
        const data = await res.json();
        if (!data?.skeleton?.spine) return;
        await PIXI.Assets.load({
          src: manifest.json,
          data: { spineAtlasFile: manifest.atlas },
        });
      } catch {
        // ignore missing spines
      }
    }),
  );
}

// ── Main preload ──────────────────────────────────────────────────────────────
async function preloadAppAssets(): Promise<void> {
  if (appAssetPreloadPromise) {
    await appAssetPreloadPromise;
    return;
  }

  appAssetPreloadPromise = (async () => {
    await Promise.all([
      // All known atlases
      ...ALL_ATLAS_URLS.map((url) => preloadAtlas(url)),

      // Fish atlases from loaded manifest fish data.
      ...getFishAtlasUrlsFromApi().map((url) => preloadAtlas(url)),

      // Effect atlas (uses its own parser into effectTextures map)
      preloadEffectAtlas(),

      // Backgrounds
      ...ALL_BACKGROUND_URLS.map((url) =>
        loadSingleUrl(url, { ignoreErrors: true }),
      ),

      // Avatars
      ...DEFAULT_AVATAR_URLS.map((url) =>
        loadSingleUrl(url, { ignoreErrors: true }),
      ),

      // Icon button
      loadSingleUrl(ICON_BUTTON_IMAGE_URL, { ignoreErrors: true }),
      preloadJsonAsset(ICON_BUTTON_ATLAS_URL),

      // Spines (static + from API)
      preloadSpines(),
    ]);

    // Fonts after atlases — each font depends on its PNG being available
    await Promise.all(ALL_FONT_URLS.map((url) => preloadBitmapFont(url)));
  })();

  try {
    await appAssetPreloadPromise;
  } finally {
    appAssetPreloadPromise = null;
  }
}

// ── Transition-only preload (for loading screens) ─────────────────────────────
async function preloadTransitionAssets(): Promise<void> {
  await Promise.all([
    preloadAtlas(EFFECT_ATLAS_URL),
    preloadAtlas(LOCALIZE_ATLAS_URLS.en),
    preloadAtlas(LOCALIZE_ATLAS_URLS.km),
    preloadAtlas(UI_ATLAS_URL),
    preloadEffectAtlas(),
    ...ALL_BACKGROUND_URLS.map((url) =>
      loadSingleUrl(url, { ignoreErrors: true }),
    ),
    preloadBitmapFont(ODD_FONT_URL),
    preloadBitmapFont(COIN_FONT_URL),
    preloadBitmapFont(SYSTEM_FONT_URL),
  ]);
}

// ── Public composable ─────────────────────────────────────────────────────────
export function useFishAssetPreload() {
  return {
    // Preload
    preloadAppAssets,
    preloadTransitionAssets,
    preloadAtlas,
    preloadEffectAtlas,
    preloadBitmapFont,
    preloadJsonAsset,

    // Getters
    getJsonAsset,
    getTexture: (url: string) => PIXI.Texture.from(normalizeAssetUrl(url)),
    getEffectTexture: (frame: string) =>
      effectTextures.get(frame) ?? PIXI.Texture.WHITE,
    getAtlasTexture: (atlasUrl: string, frame: string) =>
      atlasTextures.get(atlasUrl)?.get(frame) ?? PIXI.Texture.WHITE,
    getLocalizedTexture: (lang: LocalizeLanguage, frame: string) =>
      atlasTextures.get(LOCALIZE_ATLAS_URLS[lang])?.get(frame) ??
      PIXI.Texture.WHITE,

    // Normalize
    normalizeFishAssetUrl,
  };
}
