// useRewardEffectFishKill.ts
import * as PIXI from "pixi.js";
import {
  useFishAssetPreload,
  type LocalizeLanguage,
  CATCH_BIG_ATLAS_URL,
  COIN_ATLAS_URL,
  EFFECT_ATLAS_URL,
} from "~/composables/game_core/assets/useFishAssetPreload";
import {
  createFishRendererFactory,
  type FishDisplayHandle,
} from "../fish/useFishRendererFactory";

//  Constants
const ODD_FONT_NAME = "fnt_odd";

//  Atlas frame names
const LIGHT_FRAMES = [
  "lightreward01.png",
  "lightreward02.png",
  "lightreward03.png",
  "lightreward04.png",
  "lightreward05.png",
  "lightreward06.png",
  "lightreward07.png",
  "lightreward08.png",
] as const;

const EXPLOSION_FRAMES = [
  "ef_coin_0001.png",
  "ef_coin_0002.png",
  "ef_coin_0003.png",
  "ef_coin_0004.png",
  "ef_coin_0005.png",
  "ef_coin_0006.png",
  "ef_coin_0007.png",
  "ef_coin_0008.png",
  "ef_coin_0009.png",
  "ef_coin_0010.png",
  "ef_coin_0011.png",
  "ef_coin_0012.png",
  "ef_coin_0013.png",
  "ef_coin_0014.png",
  "ef_coin_0015.png",
] as const;

const SHINE_FRAME = "bg_y_light01_000.png";
const COIN_FRAME = "s_coin0000.png";
const GOLDEN_FRAME = "rewardcolorbg2_out.png";
const RGB_BG_FRAME = "rewardcolorbg3_02.png";
const CIRCLE_FRAME = "rewardcolorbg.png";
const BANNER_FRAME = "rewardnamebg.png";
const REWARD_PANEL_SCALE = 0.6;
const ORBIT_RADIUS = 90;

// Explosion timing — replicates the original AnimatedSprite's
// animationSpeed=0.55 at a nominal 60fps ticker rate.
const EXPLOSION_ANIM_SPEED = 0.55;
const EXPLOSION_FPS_BASE = 60;

const FLY_MS = 600;
const SHINE_MS = 350;
const INTRO_MS = 420;
const EXIT_MS = 320;

//  Easing
function easeOutBack(t: number): number {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInBack(t: number): number {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return c3 * t * t * t - c1 * t * t;
}

//  Public types
export type FishMissRewardOptions = {
  layer: PIXI.Container;
  x: number;
  y: number;
  rewardX?: number;
  rewardY?: number;
  amount: number;
  fishName?: string;
  fishId?: number;
  durationMs?: number;
  onComplete?: () => void;
};

//  Internal helper types
type GetAtlasTex = (atlasUrl: string, frame: string) => PIXI.Texture;
type GetLocalTex = (lang: LocalizeLanguage, frame: string) => PIXI.Texture;

// ============================================================
//  Asset cache — resolved once, reused forever
// ============================================================

interface RewardAssetCache {
  explosionTextures: PIXI.Texture[];
  lightTextures: PIXI.Texture[];
  coinTexture: PIXI.Texture;
  shineTexture: PIXI.Texture;
  goldenFrameTexture: PIXI.Texture;
  rgbBgTexture: PIXI.Texture;
  circleBgTexture: PIXI.Texture;
  bannerTexture: PIXI.Texture;
  winTextures: Map<LocalizeLanguage, PIXI.Texture>;
}

let assetCache: RewardAssetCache | null = null;

function resolveAssetCache(getAtlasTexture: GetAtlasTex): RewardAssetCache {
  if (assetCache) return assetCache;

  const explosionTextures: PIXI.Texture[] = [];
  for (const frame of EXPLOSION_FRAMES) {
    const tex = getAtlasTexture(COIN_ATLAS_URL, frame);
    if (tex !== PIXI.Texture.WHITE) explosionTextures.push(tex);
  }

  const lightTextures: PIXI.Texture[] = [];
  for (const frame of LIGHT_FRAMES) {
    const tex = getAtlasTexture(CATCH_BIG_ATLAS_URL, frame);
    if (tex !== PIXI.Texture.WHITE) lightTextures.push(tex);
  }

  assetCache = {
    explosionTextures,
    lightTextures,
    coinTexture: getAtlasTexture(COIN_ATLAS_URL, COIN_FRAME),
    shineTexture: getAtlasTexture(EFFECT_ATLAS_URL, SHINE_FRAME),
    goldenFrameTexture: getAtlasTexture(CATCH_BIG_ATLAS_URL, GOLDEN_FRAME),
    rgbBgTexture: getAtlasTexture(CATCH_BIG_ATLAS_URL, RGB_BG_FRAME),
    circleBgTexture: getAtlasTexture(CATCH_BIG_ATLAS_URL, CIRCLE_FRAME),
    bannerTexture: getAtlasTexture(CATCH_BIG_ATLAS_URL, BANNER_FRAME),
    winTextures: new Map(),
  };
  return assetCache;
}

function resolveWinTexture(
  lang: LocalizeLanguage,
  getLocalizedTexture: GetLocalTex,
): PIXI.Texture {
  const cache = assetCache!;
  let tex = cache.winTextures.get(lang);
  if (!tex) {
    tex = getLocalizedTexture(lang, "win.png");
    cache.winTextures.set(lang, tex);
  }
  return tex;
}

// Cache asset-getter functions so the composable is only unwrapped once.
let cachedGetters: {
  getAtlasTexture: GetAtlasTex;
  getLocalizedTexture: GetLocalTex;
} | null = null;

function getAssetGetters() {
  if (!cachedGetters) {
    const { getAtlasTexture, getLocalizedTexture } = useFishAssetPreload();
    cachedGetters = { getAtlasTexture, getLocalizedTexture };
  }
  return cachedGetters;
}

// ============================================================
//  Fish base-scale cache (avoids repeated getLocalBounds() per fishId)
// ============================================================

const fishBaseScaleCache = new Map<number, number>();

function getFishBaseScale(fishId: number, display: PIXI.Container): number {
  const cached = fishBaseScaleCache.get(fishId);
  if (cached !== undefined) return cached;

  const TARGET_SIZE = 250;
  const bounds = display.getLocalBounds();
  const naturalSize = Math.max(bounds.width, bounds.height);
  const scale = naturalSize > 0 ? TARGET_SIZE / naturalSize : 1;

  fishBaseScaleCache.set(fishId, scale);
  return scale;
}

// ============================================================
//  Generic sprite pools (explosion / coin / shine)
// ============================================================

function acquirePooledSprite(
  pool: PIXI.Sprite[],
  texture: PIXI.Texture,
): PIXI.Sprite {
  let sprite = pool.pop();
  while (sprite && sprite.destroyed) sprite = pool.pop();

  if (!sprite) {
    sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
  } else {
    sprite.texture = texture;
  }

  sprite.visible = true;
  sprite.alpha = 1;
  sprite.rotation = 0;
  sprite.scale.set(1);
  return sprite;
}

function releasePooledSprite(pool: PIXI.Sprite[], sprite: PIXI.Sprite | null) {
  if (!sprite || sprite.destroyed) return;
  if (sprite.parent) sprite.parent.removeChild(sprite);
  sprite.visible = false;
  pool.push(sprite);
}

const explosionPool: PIXI.Sprite[] = [];
const coinPool: PIXI.Sprite[] = [];
const shinePool: PIXI.Sprite[] = [];

// ============================================================
//  Reward panel pool — the whole static visual tree is built once
//  per pooled instance and reused; only text/fish content changes.
// ============================================================

interface PanelInstance {
  root: PIXI.Container;
  rgbBg: PIXI.Sprite | null;
  circleBg: PIXI.Sprite | null;
  goldenFrame: PIXI.Sprite;
  ballSprites: PIXI.Sprite[];
  ballAngleOffsets: number[];
  winAmountGroup: PIXI.Container;
  winSprite: PIXI.Sprite | null;
  amountLabel: PIXI.BitmapText;
  banner: PIXI.Sprite | null;
  nameLabel: PIXI.Text | null;
}

const panelPool: PanelInstance[] = [];

function createPanelInstance(
  cache: RewardAssetCache,
  winTexture: PIXI.Texture,
): PanelInstance {
  const root = new PIXI.Container();
  root.sortableChildren = true;
  root.zIndex = 9999;
  (root as any).__isRewardEffect = true;

  let rgbBg: PIXI.Sprite | null = null;
  if (cache.rgbBgTexture !== PIXI.Texture.WHITE) {
    rgbBg = new PIXI.Sprite(cache.rgbBgTexture);
    rgbBg.anchor.set(0.5);
    rgbBg.zIndex = 1;
    root.addChild(rgbBg);
  }

  let circleBg: PIXI.Sprite | null = null;
  if (cache.circleBgTexture !== PIXI.Texture.WHITE) {
    circleBg = new PIXI.Sprite(cache.circleBgTexture);
    circleBg.anchor.set(0.5);
    circleBg.zIndex = 2;
    root.addChild(circleBg);
  }

  const goldenFrame = new PIXI.Sprite(cache.goldenFrameTexture);
  goldenFrame.anchor.set(0.5);
  goldenFrame.zIndex = 4;
  root.addChild(goldenFrame);

  const ballSprites: PIXI.Sprite[] = [];
  const ballAngleOffsets: number[] = [];
  const ballCount = cache.lightTextures.length;
  for (let i = 0; i < ballCount; i++) {
    const ball = new PIXI.Sprite(cache.lightTextures[i]!);
    ball.anchor.set(0.5);
    ball.zIndex = 5;
    const angle = (i / ballCount) * Math.PI * 2;
    ball.position.set(
      Math.cos(angle) * ORBIT_RADIUS,
      Math.sin(angle) * ORBIT_RADIUS,
    );
    ballAngleOffsets.push(angle);
    root.addChild(ball);
    ballSprites.push(ball);
  }

  const winAmountGroup = new PIXI.Container();
  winAmountGroup.zIndex = 14;
  root.addChild(winAmountGroup);

  let winSprite: PIXI.Sprite | null = null;
  if (winTexture !== PIXI.Texture.WHITE) {
    winSprite = new PIXI.Sprite(winTexture);
    winSprite.anchor.set(0, 0.5);
    winSprite.position.set(0, 35);
    winAmountGroup.addChild(winSprite);
  }

  const amountLabel = new PIXI.BitmapText("0", {
    fontName: ODD_FONT_NAME,
    fontSize: 18,
    align: "center",
  });
  amountLabel.anchor.set(0, 0.5);
  amountLabel.position.set((winSprite?.width ?? 0) + 4, 0);
  winAmountGroup.addChild(amountLabel);

  let banner: PIXI.Sprite | null = null;
  let nameLabel: PIXI.Text | null = null;
  if (cache.bannerTexture !== PIXI.Texture.WHITE) {
    banner = new PIXI.Sprite(cache.bannerTexture);
    banner.anchor.set(0.5, 0);
    banner.position.set(0, 55);
    banner.zIndex = 12;
    root.addChild(banner);

    nameLabel = new PIXI.Text("", {
      fontSize: 28,
      fill: "#ffffff",
      fontWeight: "bold",
      align: "center",
      dropShadow: true,
      dropShadowColor: "#000000",
      dropShadowDistance: 2,
      dropShadowBlur: 4,
    });
    nameLabel.anchor.set(0.5);
    nameLabel.position.set(0, 100);
    nameLabel.zIndex = 13;
    root.addChild(nameLabel);
  }

  return {
    root,
    rgbBg,
    circleBg,
    goldenFrame,
    ballSprites,
    ballAngleOffsets,
    winAmountGroup,
    winSprite,
    amountLabel,
    banner,
    nameLabel,
  };
}

function acquirePanel(
  cache: RewardAssetCache,
  winTexture: PIXI.Texture,
): PanelInstance {
  let panel = panelPool.pop();
  while (panel && panel.root.destroyed) panel = panelPool.pop();
  if (!panel) panel = createPanelInstance(cache, winTexture);

  const root = panel.root;
  root.visible = true;
  root.alpha = 1;
  root.rotation = 0;
  root.scale.set(0);

  if (panel.rgbBg) {
    panel.rgbBg.scale.set(0);
    panel.rgbBg.alpha = 0;
    panel.rgbBg.rotation = 0;
  }
  if (panel.circleBg) {
    panel.circleBg.scale.set(0);
    panel.circleBg.alpha = 0;
    panel.circleBg.rotation = 0;
  }

  panel.goldenFrame.scale.set(0);
  panel.goldenFrame.alpha = 0;
  panel.goldenFrame.rotation = 0;

  for (const ball of panel.ballSprites) {
    ball.scale.set(0);
    ball.alpha = 0;
  }

  panel.winAmountGroup.scale.set(0);
  panel.winAmountGroup.alpha = 0;

  if (panel.winSprite) panel.winSprite.texture = winTexture;

  if (panel.banner) {
    panel.banner.scale.set(0);
    panel.banner.alpha = 0;
  }
  if (panel.nameLabel) {
    panel.nameLabel.scale.set(0);
    panel.nameLabel.alpha = 0;
  }

  return panel;
}

function releasePanel(panel: PanelInstance) {
  if (panel.root.destroyed) return;
  if (panel.root.parent) panel.root.parent.removeChild(panel.root);
  panel.root.visible = false;
  panelPool.push(panel);
}

// ============================================================
//  Reward effect state machine
// ============================================================

type EffectPhase = "explosion" | "shine" | "panel" | "done";

interface ExplosionRuntime {
  sprite: PIXI.Sprite;
  frameProgress: number;
  peaked: boolean;
  finished: boolean;
}

interface CoinRuntime {
  sprite: PIXI.Sprite;
  elapsed: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
}

interface ShineRuntime {
  sprite: PIXI.Sprite;
  elapsed: number;
}

interface PanelRuntime {
  panel: PanelInstance;
  elapsed: number;
  pulseT: number;
  frameSpinT: number;
  orbitAngle: number;
  exitStarted: boolean;
  holdMs: number;
  fishDisplay: PIXI.DisplayObject | null;
  fishHandle: FishDisplayHandle | null;
  fishBaseScale: number;
}

interface RewardEffectState {
  layer: PIXI.Container;
  x: number;
  y: number;
  rewardX: number;
  rewardY: number;
  amount: number;
  fishName: string;
  fishId?: number;
  durationMs: number;
  onComplete?: () => void;

  phase: EffectPhase;
  completed: boolean;

  explosion: ExplosionRuntime | null;
  coin: CoinRuntime | null;
  shine: ShineRuntime | null;
  panel: PanelRuntime | null;
}

const activeEffects: RewardEffectState[] = [];
let managerRunning = false;

function ensureManagerRunning() {
  if (managerRunning) return;
  managerRunning = true;
  PIXI.Ticker.shared.add(updateRewardEffects);
}

// Single centralized ticker for ALL reward effects, regardless of count.
function updateRewardEffects() {
  if (activeEffects.length === 0) return;

  const dt = PIXI.Ticker.shared.elapsedMS;

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const eff = activeEffects[i]!;
    updateEffect(eff, dt);
    if (eff.phase === "done") {
      activeEffects.splice(i, 1);
    }
  }
}

function finishEffect(eff: RewardEffectState) {
  if (eff.completed) return;
  eff.completed = true;
  eff.phase = "done";
  eff.onComplete?.();
}

function startCoin(eff: RewardEffectState) {
  const cache = assetCache!;
  if (eff.layer.destroyed) {
    finishEffect(eff);
    return;
  }
  if (cache.coinTexture === PIXI.Texture.WHITE) {
    startShine(eff);
    return;
  }

  const sprite = acquirePooledSprite(coinPool, cache.coinTexture);
  sprite.position.set(eff.x, eff.y);
  sprite.zIndex = 9999;
  eff.layer.sortableChildren = true;
  eff.layer.addChild(sprite);

  eff.coin = {
    sprite,
    elapsed: 0,
    fromX: eff.x,
    fromY: eff.y,
    toX: eff.rewardX,
    toY: eff.rewardY,
  };
}

function startShine(eff: RewardEffectState) {
  eff.phase = "shine";

  const cache = assetCache!;
  if (eff.layer.destroyed) {
    finishEffect(eff);
    return;
  }
  if (cache.shineTexture === PIXI.Texture.WHITE) {
    startPanel(eff);
    return;
  }

  const sprite = acquirePooledSprite(shinePool, cache.shineTexture);
  sprite.position.set(eff.rewardX, eff.rewardY);
  sprite.scale.set(0);
  sprite.zIndex = 9998;
  eff.layer.sortableChildren = true;
  eff.layer.addChild(sprite);

  eff.shine = { sprite, elapsed: 0 };
}

function startPanel(eff: RewardEffectState) {
  eff.phase = "panel";

  const cache = assetCache!;
  if (eff.layer.destroyed) {
    finishEffect(eff);
    return;
  }

  const { getAtlasTexture, getLocalizedTexture } = getAssetGetters();
  const winTexture = resolveWinTexture("en", getLocalizedTexture);

  if (
    cache.goldenFrameTexture === PIXI.Texture.WHITE ||
    cache.lightTextures.length === 0
  ) {
    console.warn("[rewardPanel] required assets not loaded");
    finishEffect(eff);
    return;
  }

  const panel = acquirePanel(cache, winTexture);
  panel.root.position.set(eff.rewardX, eff.rewardY);
  eff.layer.sortableChildren = true;
  eff.layer.addChild(panel.root);

  panel.amountLabel.text = `${eff.amount.toLocaleString()}`;
  const groupBounds = panel.winAmountGroup.getLocalBounds();
  panel.winAmountGroup.pivot.set(
    groupBounds.x + groupBounds.width / 2,
    groupBounds.y + groupBounds.height / 2,
  );
  panel.winAmountGroup.position.set(0, 40);

  if (panel.nameLabel) panel.nameLabel.text = eff.fishName;

  let fishHandle: FishDisplayHandle | null = null;
  let fishDisplay: PIXI.DisplayObject | null = null;
  let fishBaseScale = 1;

  if (eff.fishId !== undefined) {
    const factory = createFishRendererFactory({ getAtlasTexture });
    fishHandle = factory.createAnimatedFishBySpawnFishId(eff.fishId);
    fishDisplay = fishHandle?.display ?? null;

    if (fishDisplay) {
      fishBaseScale = getFishBaseScale(
        eff.fishId,
        fishDisplay as PIXI.Container,
      );
      (fishDisplay as PIXI.Container).scale.set(0);
      fishDisplay.alpha = 0;
      (fishDisplay as PIXI.Container).zIndex = 11;
      fishDisplay.position.set(0, -20);
      panel.root.addChild(fishDisplay);
    }
  }

  eff.panel = {
    panel,
    elapsed: 0,
    pulseT: 0,
    frameSpinT: 0,
    orbitAngle: 0,
    exitStarted: false,
    holdMs: eff.durationMs * 0.65,
    fishDisplay,
    fishHandle,
    fishBaseScale,
  };
}

function updateExplosion(eff: RewardEffectState, dt: number) {
  const ex = eff.explosion;
  if (!ex || ex.finished) return;

  const cache = assetCache!;
  const frames = cache.explosionTextures;
  const frameCount = frames.length;

  ex.frameProgress += (dt / 1000) * EXPLOSION_FPS_BASE * EXPLOSION_ANIM_SPEED;
  const frameIndex = Math.min(Math.floor(ex.frameProgress), frameCount - 1);

  const nextTexture = frames[frameIndex]!;
  if (ex.sprite.texture !== nextTexture) ex.sprite.texture = nextTexture;

  const peakFrame = Math.floor(frameCount * 0.45);
  if (!ex.peaked && frameIndex >= peakFrame) {
    ex.peaked = true;
    startCoin(eff);
  }

  if (ex.frameProgress >= frameCount) {
    ex.finished = true;
    if (!ex.peaked) {
      ex.peaked = true;
      startCoin(eff);
    }
    releasePooledSprite(explosionPool, ex.sprite);
    eff.explosion = null;
  }
}

function updateCoin(eff: RewardEffectState, dt: number) {
  const coin = eff.coin;
  if (!coin) return;

  coin.elapsed += dt;
  const t = Math.min(coin.elapsed / FLY_MS, 1);
  const et = easeOut(t);

  const sprite = coin.sprite;
  sprite.x = coin.fromX + (coin.toX - coin.fromX) * et;
  sprite.y = coin.fromY + (coin.toY - coin.fromY) * et;
  sprite.rotation += dt * 0.003;

  if (t > 0.75) sprite.alpha = 1 - (t - 0.75) / 0.25;

  if (t >= 1) {
    releasePooledSprite(coinPool, sprite);
    eff.coin = null;
    startShine(eff);
  }
}

function updateShine(eff: RewardEffectState, dt: number) {
  const shine = eff.shine;
  if (!shine) return;

  shine.elapsed += dt;
  const t = Math.min(shine.elapsed / SHINE_MS, 1);

  const sprite = shine.sprite;
  sprite.scale.set(easeOut(t) * 2.5);
  sprite.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
  sprite.rotation += dt * 0.004;

  if (t >= 1) {
    releasePooledSprite(shinePool, sprite);
    eff.shine = null;
    startPanel(eff);
  }
}

function updatePanel(eff: RewardEffectState, dt: number) {
  const p = eff.panel;
  if (!p) return;

  const panel = p.panel;
  const root = panel.root;

  if (root.destroyed) {
    finishEffect(eff);
    return;
  }

  p.elapsed += dt;
  p.pulseT += dt * 0.003;
  p.frameSpinT += dt * 0.0008;
  p.orbitAngle += dt * 0.006;

  const introT = Math.min(p.elapsed / INTRO_MS, 1);

  if (!p.exitStarted) root.scale.set(easeOutBack(introT) * REWARD_PANEL_SCALE);

  if (panel.rgbBg && !panel.rgbBg.destroyed) {
    const t = Math.min(p.elapsed / 300, 1);
    panel.rgbBg.scale.set(easeOutBack(t));
    panel.rgbBg.alpha = Math.min(1, t * 2);
    panel.rgbBg.rotation += dt * 0.0015;
  }

  if (panel.circleBg && !panel.circleBg.destroyed) {
    const t = Math.min(p.elapsed / 300, 1);
    panel.circleBg.scale.set(easeOutBack(t));
    panel.circleBg.alpha = Math.min(1, t * 2);
    panel.circleBg.rotation -= dt * 0.0006;
  }

  if (p.fishDisplay && !(p.fishDisplay as any).destroyed) {
    const t = Math.min((p.elapsed - 60) / 320, 1);
    if (t > 0) {
      (p.fishDisplay as PIXI.Container).scale?.set(
        easeOutBack(t) * p.fishBaseScale,
      );
      p.fishDisplay.alpha = Math.min(1, t * 2);
    }
  }

  if (!panel.goldenFrame.destroyed) {
    const t = Math.min((p.elapsed - 80) / 360, 1);
    if (t > 0) {
      panel.goldenFrame.scale.set(easeOutBack(t));
      panel.goldenFrame.alpha = Math.min(1, t * 2);
    }
    if (introT >= 1) panel.goldenFrame.rotation = p.frameSpinT;
  }

  const ballCount = panel.ballSprites.length;
  for (let i = 0; i < ballCount; i++) {
    const ball = panel.ballSprites[i]!;
    if (ball.destroyed) continue;

    const delay = 120 + i * 30;
    const popT = Math.min((p.elapsed - delay) / 280, 1);
    if (popT <= 0) continue;

    const angle = p.orbitAngle + panel.ballAngleOffsets[i]!;
    ball.position.set(
      Math.cos(angle) * ORBIT_RADIUS,
      Math.sin(angle) * ORBIT_RADIUS,
    );

    if (popT < 1) {
      ball.scale.set(easeOutBack(popT) * 0.5);
      ball.alpha = Math.min(1, popT * 2);
    } else {
      ball.alpha = 1;
      ball.scale.set(0.5 * (1 + Math.sin(p.pulseT * 3 + i * 0.8) * 0.12));
    }
  }

  if (!panel.winAmountGroup.destroyed) {
    const t = Math.min((p.elapsed - 200) / 320, 1);
    if (t > 0) {
      panel.winAmountGroup.scale.set(easeOutBack(t));
      panel.winAmountGroup.alpha = Math.min(1, t * 2);
    }
  }

  if (panel.banner && !panel.banner.destroyed) {
    const t = Math.min((p.elapsed - 300) / 350, 1);
    if (t > 0) {
      panel.banner.scale.set(easeOutBack(t));
      panel.banner.alpha = Math.min(1, t * 2);
    }
  }

  if (panel.nameLabel && !panel.nameLabel.destroyed) {
    const t = Math.min((p.elapsed - 380) / 280, 1);
    if (t > 0) {
      panel.nameLabel.scale.set(easeOut(t));
      panel.nameLabel.alpha = Math.min(1, t * 2);
    }
  }

  if (!p.exitStarted && p.elapsed > p.holdMs) p.exitStarted = true;

  if (p.exitStarted) {
    const exitT = Math.min((p.elapsed - p.holdMs) / EXIT_MS, 1);
    root.scale.set(Math.max(0, 1 - easeInBack(exitT)) * REWARD_PANEL_SCALE);

    if (exitT >= 1) {
      if (p.fishDisplay && panel.root.children.includes(p.fishDisplay)) {
        panel.root.removeChild(p.fishDisplay);
      }
      p.fishHandle?.destroy();

      releasePanel(panel);
      eff.panel = null;
      finishEffect(eff);
    }
  }
}

function updateEffect(eff: RewardEffectState, dt: number) {
  if (eff.explosion) updateExplosion(eff, dt);
  if (eff.coin) updateCoin(eff, dt);
  if (eff.shine) updateShine(eff, dt);
  if (eff.panel) updatePanel(eff, dt);
}

// ============================================================
//  Public entry point
// ============================================================

export function showFishMissRewardEffect(options: FishMissRewardOptions): void {
  const {
    layer,
    x,
    y,
    rewardX = x,
    rewardY = y - 80,
    amount,
    fishName = "",
    fishId,
    durationMs = 2800,
    onComplete,
  } = options;

  if (layer.destroyed) {
    onComplete?.();
    return;
  }

  const { getAtlasTexture } = getAssetGetters();
  const cache = resolveAssetCache(getAtlasTexture);

  const eff: RewardEffectState = {
    layer,
    x,
    y,
    rewardX,
    rewardY,
    amount,
    fishName,
    fishId,
    durationMs,
    onComplete,
    phase: "explosion",
    completed: false,
    explosion: null,
    coin: null,
    shine: null,
    panel: null,
  };

  if (cache.explosionTextures.length === 0) {
    // No explosion frames available — skip straight to coin.
    startCoin(eff);
  } else {
    const sprite = acquirePooledSprite(
      explosionPool,
      cache.explosionTextures[0]!,
    );
    sprite.position.set(x, y);
    sprite.scale.set(1.4);
    sprite.zIndex = 9998;
    layer.sortableChildren = true;
    layer.addChild(sprite);

    eff.explosion = {
      sprite,
      frameProgress: 0,
      peaked: false,
      finished: false,
    };
  }

  activeEffects.push(eff);
  ensureManagerRunning();
}

// ============================================================
//  Teardown helper — call on scene/game destroy while effects
//  may still be active, to avoid orphaned ticker work or leaks.
// ============================================================

export function disposeFishMissRewardEffects(): void {
  for (const eff of activeEffects) {
    if (eff.explosion) releasePooledSprite(explosionPool, eff.explosion.sprite);
    if (eff.coin) releasePooledSprite(coinPool, eff.coin.sprite);
    if (eff.shine) releasePooledSprite(shinePool, eff.shine.sprite);
    if (eff.panel) {
      const p = eff.panel;
      if (p.fishDisplay && p.panel.root.children.includes(p.fishDisplay)) {
        p.panel.root.removeChild(p.fishDisplay);
      }
      p.fishHandle?.destroy();
      releasePanel(p.panel);
    }
    finishEffect(eff);
  }
  activeEffects.length = 0;

  if (managerRunning) {
    PIXI.Ticker.shared.remove(updateRewardEffects);
    managerRunning = false;
  }
}
