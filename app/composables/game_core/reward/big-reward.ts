// useRewardEffectBig.ts
import * as PIXI from "pixi.js";
import {
  useFishAssetPreload,
  COIN_ATLAS_URL,
} from "~/composables/game_core/assets/useFishAssetPreload";

// Constants
const ODD_FONT_NAME = "fnt_odd";

// Atlas frame names
const BIG_COIN_EFFECT_FRAME = "s_coin0001.png"; // effect.atlas.txt
const SMALL_COIN_FRAME = "ef_coin0_only0000.png"; // used for scattered z:3 coins

const EXPLODE_FRAMES = [
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

const BIG_COIN_FRAMES = [
  "s_coin0000.png",
  "s_coin0001.png",
  "s_coin0002.png",
  "s_coin0003.png",
  "s_coin0004.png",
  "s_coin0005.png",
  "s_coin0006.png",
  "s_coin0007.png",
  "s_coin0008.png",
  "s_coin0009.png",
] as const;

// Small coin animation frames — same set used by useRewardEffect.ts for the
// normal reward coin. Reused here for the fullscreen shower.
const COIN_FRAMES = [
  "ef_coin0_only0000.png",
  "ef_coin0_only0001.png",
  "ef_coin0_only0002.png",
  "ef_coin0_only0003.png",
  "ef_coin0_only0004.png",
  "ef_coin0_only0005.png",
  "ef_coin0_only0006.png",
  "ef_coin0_only0007.png",
  "ef_coin0_only0008.png",
  "ef_coin0_only0009.png",
] as const;

// Timing / sizing
const COIN_COUNT = 5;
const CIRCLE_RADIUS = 60;
const EXPLODE_COUNT = 10;
const COIN_BASE_SCALE = 0.65;
const COIN_ROUNDS = 3;
const POP_MS = 280;

// Master scale for the whole reward visual (coin ring + win/amount label).
// This is the ONLY place to touch to resize the entire presentation — the
// coin ring and label are both children of one container (`rewardVisual`)
// so they always scale together in proportion.
const REWARD_VISUAL_SCALE = 1.2;

// Screen shake config
const SHAKE_DURATION_MS = 900;
const SHAKE_MAGNITUDE_PX = 22;
const SHAKE_FREQUENCY = 1.9;

// Fullscreen diamond-cluster shower config
// const SHOWER_CLUSTER_COUNT = 8;
const SHOWER_CLUSTER_SPACING = 25; // size of each diamond cluster
const SHOWER_CLUSTER_MIN_GAP = 150; // min distance between cluster centers
const SHOWER_COIN_STAGGER_MS = 40;
const SHOWER_CLUSTER_WAVE_MS = 350;
const SHOWER_POP_MS = 240;
const SHOWER_HOLD_MS = 500;
const SHOWER_SCALE_MIN = 0.5;
const SHOWER_SCALE_MAX = 0.85;
const SHOWER_FLY_DURATION_MS = 600;
const SHOWER_FLY_STAGGER_MS = 12;
const SHOWER_AVOID_RADIUS = 170; // keep-clear zone around the reward label
let cachedShowerCoinTextures: PIXI.Texture[] | null = null;
let cachedExplodeTextures: PIXI.Texture[] | null = null;
let cachedBigCoinFrameTextures: PIXI.Texture[] | null = null;

// Easing
function easeOutBack(t: number): number {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

function getCachedAtlasTextures(
  current: PIXI.Texture[] | null,
  frames: readonly string[],
  getAtlasTexture: (atlasUrl: string, frame: string) => PIXI.Texture,
) {
  if (current) return current;

  const textures: PIXI.Texture[] = [];
  for (const frame of frames) {
    const texture = getAtlasTexture(COIN_ATLAS_URL, frame);
    if (texture !== PIXI.Texture.WHITE) textures.push(texture);
  }
  return textures;
}

// Reward-size tiers
// Bigger wins → more diamond clusters + longer/harder shake.
// Tune thresholds/values here only.
type ShowerTier = {
  clusterCount: number;
  shakeDurationMs: number;
  shakeMagnitudePx: number;
};

function getShowerTier(amount: number): ShowerTier {
  if (amount >= 100_000)
    return { clusterCount: 14, shakeDurationMs: 1400, shakeMagnitudePx: 32 };
  if (amount >= 50_000)
    return { clusterCount: 11, shakeDurationMs: 1100, shakeMagnitudePx: 26 };
  if (amount >= 10_000)
    return { clusterCount: 8, shakeDurationMs: 900, shakeMagnitudePx: 22 };
  return { clusterCount: 5, shakeDurationMs: 600, shakeMagnitudePx: 16 };
}

// Screen shake
// Shakes `target` (pass sceneRoot / stage — NOT fishLayer, since shaking
// fishLayer would offset fish visuals relative to their collision bounds).
function triggerScreenShake(
  target: PIXI.Container,
  durationMs: number = SHAKE_DURATION_MS,
  magnitude: number = SHAKE_MAGNITUDE_PX,
): void {
  const tagged = target as PIXI.Container & {
    __shakeBaseX?: number;
    __shakeBaseY?: number;
    __shakeTick?: () => void;
  };

  if (tagged.__shakeTick) {
    PIXI.Ticker.shared.remove(tagged.__shakeTick);
    if (tagged.__shakeBaseX !== undefined) target.x = tagged.__shakeBaseX;
    if (tagged.__shakeBaseY !== undefined) target.y = tagged.__shakeBaseY;
  }

  const baseX = tagged.__shakeBaseX ?? target.x;
  const baseY = tagged.__shakeBaseY ?? target.y;
  tagged.__shakeBaseX = baseX;
  tagged.__shakeBaseY = baseY;

  let elapsed = 0;
  let seed = Math.random() * 1000;

  const onShake = () => {
    if (target.destroyed) {
      PIXI.Ticker.shared.remove(onShake);
      return;
    }

    elapsed += PIXI.Ticker.shared.elapsedMS;
    const t = Math.min(elapsed / durationMs, 1);
    const decay = t < 0.15 ? 1 : Math.pow(1 - (t - 0.15) / 0.85, 1.6);

    seed += PIXI.Ticker.shared.elapsedMS * 0.001 * SHAKE_FREQUENCY * 60;
    target.x = baseX + Math.sin(seed * 1.7) * magnitude * decay;
    target.y = baseY + Math.cos(seed * 2.3) * magnitude * decay * 0.7;

    if (t >= 1) {
      PIXI.Ticker.shared.remove(onShake);
      target.x = baseX;
      target.y = baseY;
      tagged.__shakeTick = undefined;
    }
  };

  tagged.__shakeTick = onShake;
  PIXI.Ticker.shared.add(onShake);
}

// Diamond cluster shape (13 coins in a rhombus), reused per shower burst
const SHOWER_DIAMOND_ROWS = 4; // was implicitly 2 (rows -2..2) — now -4..4, more coins per cluster

function getDiamondClusterOffsets(): { x: number; y: number; delay: number }[] {
  const pts: { x: number; y: number; delay: number }[] = [];
  for (let r = -SHOWER_DIAMOND_ROWS; r <= SHOWER_DIAMOND_ROWS; r++) {
    const span = SHOWER_DIAMOND_ROWS - Math.abs(r);
    for (let c = -span; c <= span; c++) {
      pts.push({
        x: c * SHOWER_CLUSTER_SPACING,
        y: r * (SHOWER_CLUSTER_SPACING * 0.85),
        delay: Math.abs(r) * SHOWER_COIN_STAGGER_MS,
      });
    }
  }
  return pts;
}

// Fullscreen coin shower: many diamond-shaped coin clusters scattered
// randomly across the screen, avoiding the reward label, then flying to the
// coin box (or fading if no box target given).
function spawnCoinShower(
  layer: PIXI.Container,
  originX: number,
  originY: number,
  screenWidth: number,
  screenHeight: number,
  getAtlasTexture: (atlasUrl: string, frame: string) => PIXI.Texture,
  clusterCount: number,
  boxTarget?: { x: number; y: number },
  onShowerComplete?: () => void,
): void {
  cachedShowerCoinTextures = getCachedAtlasTextures(
    cachedShowerCoinTextures,
    COIN_FRAMES,
    getAtlasTexture,
  );
  const coinTextures = cachedShowerCoinTextures;

  if (coinTextures.length === 0) {
    onShowerComplete?.();
    return;
  }

  const diamondOffsets = getDiamondClusterOffsets();

  type ShowerCoin = {
    sprite: PIXI.AnimatedSprite;
    delay: number;
    targetScale: number;
  };

  const coins: ShowerCoin[] = [];
  const clusterCenters: { x: number; y: number; waveDelay: number }[] = [];

  let attempts = 0;
  while (clusterCenters.length < clusterCount && attempts < clusterCount * 20) {
    attempts++;
    const cx = Math.random() * screenWidth;
    const cy = Math.random() * screenHeight;
    const distFromOrigin = Math.hypot(cx - originX, cy - originY);
    if (distFromOrigin < SHOWER_AVOID_RADIUS) continue;

    const tooClose = clusterCenters.some(
      (existing) =>
        Math.hypot(existing.x - cx, existing.y - cy) < SHOWER_CLUSTER_MIN_GAP,
    );
    if (tooClose) continue;

    clusterCenters.push({
      x: cx,
      y: cy,
      waveDelay:
        (distFromOrigin / Math.max(screenWidth, screenHeight)) *
          SHOWER_CLUSTER_WAVE_MS +
        Math.random() * 120,
    });
  }

  for (const center of clusterCenters) {
    const clusterScale =
      SHOWER_SCALE_MIN + 1 * (SHOWER_SCALE_MAX - SHOWER_SCALE_MIN);

    for (const offset of diamondOffsets) {
      const px = center.x + offset.x;
      const py = center.y + offset.y;

      const sprite = new PIXI.AnimatedSprite(coinTextures);
      sprite.anchor.set(0.5);
      sprite.position.set(px, py);
      sprite.scale.set(0);
      sprite.alpha = 0;
      sprite.zIndex = 9990;
      sprite.animationSpeed = 0.3 + Math.random() * 0.15;
      sprite.loop = true;
      sprite.gotoAndPlay(Math.floor(Math.random() * coinTextures.length));
      (sprite as any).__isRewardEffect = true;
      layer.addChild(sprite);

      coins.push({
        sprite,
        delay: center.waveDelay + offset.delay,
        targetScale: clusterScale,
      });
    }
  }

  cachedExplodeTextures = getCachedAtlasTextures(
    cachedExplodeTextures,
    EXPLODE_FRAMES,
    getAtlasTexture,
  );
  const explodeTextures = cachedExplodeTextures;

  type ClusterBurst = {
    sprite: PIXI.AnimatedSprite;
    delay: number;
    fired: boolean;
  };
  const clusterBursts: ClusterBurst[] = [];

  if (explodeTextures.length > 0) {
    for (const center of clusterCenters) {
      const burst = new PIXI.AnimatedSprite(explodeTextures);
      burst.anchor.set(0.5);
      burst.position.set(center.x, center.y);
      burst.scale.set(1.6);
      burst.animationSpeed = 0.5;
      burst.loop = false;
      burst.alpha = 0;
      burst.zIndex = 9989; // just under the coins (9990)
      (burst as any).__isRewardEffect = true;
      layer.addChild(burst);
      clusterBursts.push({
        sprite: burst,
        delay: center.waveDelay,
        fired: false,
      });
    }
  }

  const maxHoldStart = Math.max(
    ...coins.map((c) => c.delay + SHOWER_POP_MS),
    0,
  );
  const flyStartMs = maxHoldStart + SHOWER_HOLD_MS;

  let elapsed = 0;
  let flyTriggered = false;

  const onTick = () => {
    elapsed += PIXI.Ticker.shared.elapsedMS;
    clusterBursts.forEach((cb) => {
      if (cb.fired || cb.sprite.destroyed) return;
      if (elapsed < cb.delay) return;
      cb.fired = true;
      cb.sprite.alpha = 1;
      cb.sprite.gotoAndPlay(0);
      cb.sprite.onComplete = () => {
        if (!cb.sprite.destroyed) {
          cb.sprite.parent?.removeChild(cb.sprite);
          cb.sprite.destroy();
        }
      };
    });

    coins.forEach((c) => {
      if (c.sprite.destroyed) return;
      const localT = elapsed - c.delay;
      if (localT < 0) return;

      const popT = Math.min(localT / SHOWER_POP_MS, 1);
      if (popT < 1) {
        c.sprite.scale.set(easeOutBack(popT) * c.targetScale);
        c.sprite.alpha = Math.min(1, popT * 1.5);
        return;
      }

      c.sprite.scale.set(c.targetScale);
      c.sprite.alpha = 1;
    });

    if (!flyTriggered && elapsed >= flyStartMs) {
      flyTriggered = true;
      PIXI.Ticker.shared.remove(onTick);

      const liveSprites: PIXI.AnimatedSprite[] = [];
      for (const coin of coins) {
        if (!coin.sprite.destroyed) liveSprites.push(coin.sprite);
      }

      if (boxTarget && liveSprites.length > 0) {
        flyShowerCoinsToBox(liveSprites, boxTarget, () => onShowerComplete?.());
      } else {
        fadeOutSprites(liveSprites, () => onShowerComplete?.());
      }
    }
  };

  PIXI.Ticker.shared.add(onTick);
}

function flyShowerCoinsToBox(
  coins: PIXI.AnimatedSprite[],
  target: { x: number; y: number },
  onComplete?: () => void,
): void {
  type ShowerFlyState = {
    coin: PIXI.AnimatedSprite;
    delay: number;
    startX: number;
    startY: number;
    midX: number;
    midY: number;
    startScale: number;
    stopped: boolean;
    done: boolean;
  };

  const flyStates: ShowerFlyState[] = [];
  for (let i = 0; i < coins.length; i++) {
    const coin = coins[i]!;
    const startX = coin.x;
    const startY = coin.y;
    flyStates.push({
      coin,
      delay: i * SHOWER_FLY_STAGGER_MS,
      startX,
      startY,
      midX: (startX + target.x) / 2 + (Math.random() - 0.5) * 150,
      midY: Math.min(startY, target.y) - 100 - Math.random() * 80,
      startScale: coin.scale.x,
      stopped: false,
      done: false,
    });
  }

  let elapsed = 0;
  let completed = 0;

  const onFly = () => {
    elapsed += PIXI.Ticker.shared.elapsedMS;

    for (const state of flyStates) {
      if (state.done) continue;
      const coin = state.coin;
      if (coin.destroyed) {
        state.done = true;
        completed++;
        continue;
      }

      if (elapsed < state.delay) continue;

      if (!state.stopped) {
        coin.stop();
        state.stopped = true;
      }

      const t = Math.min((elapsed - state.delay) / SHOWER_FLY_DURATION_MS, 1);
      const et = easeInOut(t);
      const inv = 1 - et;

      coin.x =
        inv * inv * state.startX +
        2 * inv * et * state.midX +
        et * et * target.x;
      coin.y =
        inv * inv * state.startY +
        2 * inv * et * state.midY +
        et * et * target.y;

      if (t > 0.8) {
        const endT = (t - 0.8) / 0.2;
        coin.scale.set(state.startScale * (1 - endT * 0.75));
        coin.alpha = 1 - endT;
      }

      if (t >= 1) {
        state.done = true;
        coin.stop();
        coin.parent?.removeChild(coin);
        coin.destroy();
        completed++;
      }
    }

    if (completed >= flyStates.length) {
      PIXI.Ticker.shared.remove(onFly);
      onComplete?.();
    }
  };

  PIXI.Ticker.shared.add(onFly);
}

// Public types
export type BigRewardEffectOptions = {
  layer: PIXI.Container;
  x: number;
  y: number;
  amount: number;
  boxTarget?: { x: number; y: number };
  onComplete?: () => void;
  shakeTarget?: PIXI.Container; // e.g. sceneRoot/app.stage — do NOT pass fishLayer
  screenWidth?: number;
  screenHeight?: number;
  enableShake?: boolean;
  enableCoinShower?: boolean;
};

// Main
export function showBigRewardEffect(options: BigRewardEffectOptions): void {
  const {
    layer,
    x,
    y,
    amount,
    boxTarget,
    onComplete,
    shakeTarget,
    screenWidth = 1280,
    screenHeight = 720,
    enableShake = true,
    enableCoinShower = true,
  } = options;

  const { getEffectTexture, getAtlasTexture, getLocalizedTexture } =
    useFishAssetPreload();

  const bigCoinTex = getEffectTexture(BIG_COIN_EFFECT_FRAME);
  if (!bigCoinTex || bigCoinTex === PIXI.Texture.WHITE) {
    console.warn("[bigReward] s_coin0001.png not loaded from effect atlas");
    return;
  }

  cachedExplodeTextures = getCachedAtlasTextures(
    cachedExplodeTextures,
    EXPLODE_FRAMES,
    getAtlasTexture,
  );
  const explodeTextures = cachedExplodeTextures;

  if (explodeTextures.length === 0) {
    console.warn("[bigReward] coin explode frames not loaded from coin atlas");
    return;
  }

  const showerTier = getShowerTier(amount);

  // Trigger shake + fullscreen shower right away
  if (enableShake && shakeTarget) {
    triggerScreenShake(
      shakeTarget,
      showerTier.shakeDurationMs,
      showerTier.shakeMagnitudePx,
    );
  }
  if (enableCoinShower) {
    spawnCoinShower(
      layer,
      x,
      y,
      screenWidth,
      screenHeight,
      getAtlasTexture,
      showerTier.clusterCount,
      boxTarget,
    );
  }

  // Root container
  const root = new PIXI.Container();
  root.position.set(x, y);
  (root as any).__isRewardEffect = true;
  root.zIndex = 9999;
  root.sortableChildren = true;
  layer.addChild(root);

  // Explosion bursts (z: 2)
  const burstDelays = Array.from({ length: EXPLODE_COUNT }, (_, i) => i * 40);
  const burstFired = new Array<boolean>(EXPLODE_COUNT).fill(false);

  const explodeBursts = Array.from({ length: EXPLODE_COUNT }, (_, i) => {
    const burst = new PIXI.AnimatedSprite(explodeTextures);
    burst.anchor.set(0.5);
    const angle = (i / EXPLODE_COUNT) * Math.PI * 2 + Math.random() * 0.4;
    const dist = 50 + Math.random() * 70;
    burst.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist);
    burst.scale.set(1.4 + Math.random() * 0.6);
    burst.animationSpeed = 0.5 + Math.random() * 0.2;
    burst.loop = false;
    burst.alpha = 0;
    burst.zIndex = 2;
    root.addChild(burst);
    return burst;
  });

  // Scattered small coins (z: 3)
  const smallCoinTex = getAtlasTexture(COIN_ATLAS_URL, SMALL_COIN_FRAME);
  const SCATTER_COUNT = 12;

  const scatterCoins =
    smallCoinTex !== PIXI.Texture.WHITE
      ? Array.from({ length: SCATTER_COUNT }, () => {
          const sc = new PIXI.Sprite(smallCoinTex);
          sc.anchor.set(0.5);
          const angle = Math.random() * Math.PI * 2;
          const dist = 80 + Math.random() * 120;
          sc.position.set(Math.cos(angle) * dist, Math.sin(angle) * dist);
          sc.scale.set(0);
          sc.alpha = 0;
          sc.zIndex = 3;
          root.addChild(sc);
          return sc;
        })
      : [];

  // Reward visual group: coin ring + label, scaled together as one unit
  // REWARD_VISUAL_SCALE is applied to this single container, so the coin
  // ring (size + orbit radius) and the win/amount label always resize in
  // proportion — no separate constants to keep in sync.
  const rewardVisual = new PIXI.Container();
  rewardVisual.sortableChildren = true;
  root.addChild(rewardVisual);

  // Circle coin group (z: 9 within rewardVisual)
  cachedBigCoinFrameTextures = getCachedAtlasTextures(
    cachedBigCoinFrameTextures,
    BIG_COIN_FRAMES,
    getAtlasTexture,
  );
  const bigCoinFrameTextures = cachedBigCoinFrameTextures;

  const coinTextures =
    bigCoinFrameTextures.length > 0 ? bigCoinFrameTextures : [bigCoinTex];

  const circleGroup = new PIXI.Container();
  circleGroup.zIndex = 9;
  rewardVisual.addChild(circleGroup);

  const circleCoins = Array.from({ length: COIN_COUNT }, (_, i) => {
    const angle = (i / COIN_COUNT) * Math.PI * 2 - Math.PI / 2;
    const coin = new PIXI.AnimatedSprite(coinTextures);
    coin.anchor.set(0.5);
    coin.scale.set(0);
    coin.position.set(
      Math.cos(angle) * CIRCLE_RADIUS,
      Math.sin(angle) * CIRCLE_RADIUS,
    );
    coin.animationSpeed = 0.25;
    coin.loop = true;
    coin.gotoAndStop(0);
    circleGroup.addChild(coin);
    return coin;
  });

  // Shared sync state for circle coins (unchanged behavior)
  let syncStarted = false;
  let sharedRounds = 0;
  let allCoinsDone = false;

  // Reward label group (z: 20 within rewardVisual) — win sprite + amount
  const rewardLabelGroup = new PIXI.Container();
  rewardLabelGroup.zIndex = 20;
  rewardLabelGroup.alpha = 0;
  rewardVisual.addChild(rewardLabelGroup);

  const winTex = getLocalizedTexture("km", "win.png");
  let winSprite: PIXI.Sprite | null = null;
  if (winTex !== PIXI.Texture.WHITE) {
    winSprite = new PIXI.Sprite(winTex);
    winSprite.anchor.set(0.5);
    winSprite.position.y = -40;
    rewardLabelGroup.addChild(winSprite);
  }

  const amountLabel = new PIXI.BitmapText(`${amount.toLocaleString()}`, {
    fontName: ODD_FONT_NAME,
    fontSize: 18,
    align: "center",
  });
  amountLabel.anchor.set(0.5);
  amountLabel.position.set(0, -15);
  rewardLabelGroup.addChild(amountLabel);

  // Animation timing
  const circleDelays = circleCoins.map((_, i) => 80 + i * 60);
  const circleEls = new Array<number>(COIN_COUNT).fill(0);

  const LAST_POP_DONE_MS = (circleDelays[COIN_COUNT - 1] ?? 0) + POP_MS;
  const MS_PER_ROUND = (coinTextures.length / 0.25) * (1000 / 60);
  const COINS_ANIM_TOTAL_MS = LAST_POP_DONE_MS + COIN_ROUNDS * MS_PER_ROUND;
  const holdMs = COINS_ANIM_TOTAL_MS + 200;

  let elapsed = 0;
  let flyStarted = false;

  // Main tick
  const onTick = () => {
    if (root.destroyed) {
      PIXI.Ticker.shared.remove(onTick);
      return;
    }

    const dt = PIXI.Ticker.shared.elapsedMS;
    elapsed += dt;

    // Master scale for the whole reward visual — apply once, every tick is
    // fine since it's a static value, but kept here so it's trivial to
    // animate later (e.g. ease it in) if desired.
    if (!rewardVisual.destroyed) {
      rewardVisual.scale.set(REWARD_VISUAL_SCALE);
    }

    // Explosion bursts — staggered fire + re-trigger while in hold
    explodeBursts.forEach((burst, i) => {
      if (burst.destroyed) return;
      if (burstFired[i] || elapsed <= (burstDelays[i] ?? 0)) return;

      burstFired[i] = true;
      burst.alpha = 1;
      burst.gotoAndPlay(0);

      burst.onComplete = () => {
        if (burst.destroyed) return;
        burst.alpha = 0;
        if (elapsed >= holdMs * 0.75) return;

        const newAngle = Math.random() * Math.PI * 2;
        const newDist = 40 + Math.random() * 90;
        burst.position.set(
          Math.cos(newAngle) * newDist,
          Math.sin(newAngle) * newDist,
        );
        burst.scale.set(0.9 + Math.random() * 0.8);

        let waitEl = 0;
        const waitDelay = 100 + Math.random() * 180;
        const onWait = () => {
          if (burst.destroyed) {
            PIXI.Ticker.shared.remove(onWait);
            return;
          }
          waitEl += PIXI.Ticker.shared.elapsedMS;
          if (waitEl < waitDelay) return;
          PIXI.Ticker.shared.remove(onWait);
          burst.alpha = 1;
          burst.gotoAndPlay(0);
          burst.onComplete = () => {
            if (!burst.destroyed) burst.alpha = 0;
          };
        };
        PIXI.Ticker.shared.add(onWait);
      };
    });

    // Circle coins — staggered pop-in (per-coin roundness scale; master
    // ring scale is applied separately above via rewardVisual)
    circleCoins.forEach((coin, i) => {
      if (coin.destroyed) return;
      circleEls[i]! += dt;
      const localT = circleEls[i]! - circleDelays[i]!;
      if (localT < 0) return;

      const popT = Math.min(localT / POP_MS, 1);
      if (popT < 1) {
        coin.scale.set(easeOutBack(popT) * COIN_BASE_SCALE);
        return;
      }

      coin.scale.set(COIN_BASE_SCALE);
    });

    // Once the last coin finishes its pop-in, start ALL coins on frame 0 together
    if (!syncStarted && elapsed >= LAST_POP_DONE_MS) {
      syncStarted = true;

      const leader = circleCoins[0];
      if (leader && !leader.destroyed) {
        leader.loop = true;
        leader.onLoop = () => {
          sharedRounds++;
          if (sharedRounds >= COIN_ROUNDS) {
            leader.onLoop = undefined;
            leader.loop = false;
            allCoinsDone = true;
            circleCoins.forEach((c) => {
              if (!c.destroyed) {
                c.stop();
                c.gotoAndStop(0);
              }
            });
          }
        };
      }

      circleCoins.slice(1).forEach((c) => {
        if (!c.destroyed) c.loop = true;
      });

      circleCoins.forEach((coin) => {
        if (!coin.destroyed) coin.gotoAndPlay(0);
      });
    }

    // Reward label pop — intro curve; master scale multiplies in via parent
    if (!rewardLabelGroup.destroyed) {
      const t = Math.min((elapsed - 200) / 350, 1);
      if (t > 0) {
        rewardLabelGroup.scale.set(easeOutBack(t));
        rewardLabelGroup.alpha = Math.min(1, t * 2);
      }
    }

    // Hold → fade label → detach coins → fly/fade
    if (elapsed > holdMs && !flyStarted) {
      const fadeT = Math.min((elapsed - holdMs) / 350, 1);

      if (!rewardLabelGroup.destroyed) {
        rewardLabelGroup.alpha = Math.max(0, 1 - fadeT);
      }

      if (fadeT >= 1) {
        flyStarted = true;
        PIXI.Ticker.shared.remove(onTick);

        // Detach coins into layer space before destroying root. Coins are
        // nested root → rewardVisual → circleGroup → coin, so removeChild
        // must target circleGroup (their actual parent), while toGlobal
        // still resolves correctly across the full chain regardless of depth.
        const flyCoins: PIXI.AnimatedSprite[] = [];
        for (const coin of circleCoins) {
          if (coin.destroyed) continue;

          const worldPos = root.toGlobal(coin.position);
          const layerPos = layer.toLocal(worldPos);

          // Capture the coin's fully-resolved world scale (COIN_BASE_SCALE *
          // rewardVisual's scale, and any other ancestor scale) BEFORE re-parenting,
          // since re-parenting drops the parent multiplier and the coin's own
          // .scale alone doesn't reflect what was actually rendered on screen.
          const flyScale = COIN_BASE_SCALE * REWARD_VISUAL_SCALE;

          circleGroup.removeChild(coin);
          coin.position.set(layerPos.x, layerPos.y);
          coin.scale.set(flyScale);
          coin.zIndex = 9999;
          coin.stop();
          coin.gotoAndStop(0);
          layer.addChild(coin);
          flyCoins.push(coin);
        }

        root.parent?.removeChild(root);
        root.destroy({ children: true });

        if (boxTarget && flyCoins.length > 0) {
          flyCoinsToBox(flyCoins, layer, boxTarget, onComplete);
        } else {
          fadeOutSprites(flyCoins, onComplete);
        }
      }
    }
  };

  PIXI.Ticker.shared.add(onTick);
}

// Fly circle coins to coin box
function flyCoinsToBox(
  coins: PIXI.AnimatedSprite[],
  layer: PIXI.Container,
  target: { x: number; y: number },
  onComplete?: () => void,
): void {
  const FLY_DURATION = 600;
  const STAGGER_DELAY = 70;
  let completed = 0;

  coins.forEach((coin, i) => {
    const delay = i * STAGGER_DELAY;
    const startX = coin.x;
    const startY = coin.y;
    const startScale = coin.scale.x;
    const midX = (startX + target.x) / 2 + (Math.random() - 0.5) * 120;
    const midY = Math.min(startY, target.y) - 80 - Math.random() * 60;
    let elapsed = 0;

    const onFly = () => {
      if (coin.destroyed) {
        PIXI.Ticker.shared.remove(onFly);
        if (++completed === coins.length) onComplete?.();
        return;
      }

      elapsed += PIXI.Ticker.shared.elapsedMS;
      if (elapsed < delay) return;

      const t = Math.min((elapsed - delay) / FLY_DURATION, 1);
      const et = easeInOut(t);
      const inv = 1 - et;

      coin.x = inv * inv * startX + 2 * inv * et * midX + et * et * target.x;
      coin.y = inv * inv * startY + 2 * inv * et * midY + et * et * target.y;

      if (t > 0.78) {
        const endT = (t - 0.78) / 0.22;
        coin.scale.set(startScale * (1 - endT * 0.8));
        coin.alpha = 1 - endT;
      }
      // else {
      //   coin.scale.set(startScale * (0.5 + t * 0.5));
      //   coin.alpha = 1;
      // }

      if (t >= 1) {
        PIXI.Ticker.shared.remove(onFly);
        coin.parent?.removeChild(coin);
        coin.destroy();
        if (++completed === coins.length) onComplete?.();
      }
    };

    PIXI.Ticker.shared.add(onFly);
  });
}

// Fallback: fade out sprites
function fadeOutSprites(
  sprites: PIXI.DisplayObject[],
  onComplete?: () => void,
): void {
  if (sprites.length === 0) {
    onComplete?.();
    return;
  }

  const FADE_MS = 300;
  let elapsed = 0;

  const onFade = () => {
    elapsed += PIXI.Ticker.shared.elapsedMS;
    const t = Math.min(elapsed / FADE_MS, 1);

    for (const sprite of sprites) {
      if (!sprite.destroyed) sprite.alpha = 1 - t;
    }

    if (t < 1) return;

    PIXI.Ticker.shared.remove(onFade);
    for (const sprite of sprites) {
      if (sprite.destroyed) continue;
      sprite.parent?.removeChild(sprite);
      sprite.destroy();
    }
    onComplete?.();
  };

  PIXI.Ticker.shared.add(onFade);
}
