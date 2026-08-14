// useRewardEffect.ts
import * as PIXI from "pixi.js";
import {
  useFishAssetPreload,
  COIN_ATLAS_URL,
  COIN_FONT_URL,
  ODD_FONT_URL,
} from "~/composables/game_core/assets/useFishAssetPreload";

// Constants
const COIN_FONT_NAME = "fnt_coin";

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

// Timing
const HOLD_RATIO = 0.55;
const POP_SINGLE_MS = 300;
const POP_MULTI_MS = 280;
const POP_STAGGER_MS = 60;
const LABEL_IN_MS = 400;
const LABEL_FADE_MS = 300;
const FLY_DURATION = 550;
const STAGGER_DELAY = 80;
const FADE_MS = 300;

// Coin spin rate — replicates AnimatedSprite.animationSpeed at a nominal
// 60fps ticker rate (frames advanced per second = 60 * animationSpeed).
const ANIM_FPS_BASE = 60;
const SINGLE_ANIM_SPEED = 0.5;
const MULTI_ANIM_SPEED = 0.45;
const SINGLE_POP_SCALE = 0.9;
const MULTI_POP_SCALE = 0.85;

const EMPTY_SPAWN_POSITIONS: SpawnPos[] = [];
const RING_POSITIONS = getRingPositions();
const FILLED_CIRCLE_POSITIONS = getFilledCirclePositions();
const STAR_POSITIONS = getStarPositions();
const TRIANGLE_POSITIONS = getTrianglePositions();
const HEXAGON_POSITIONS = getHexagonPositions();
const DIAMOND_POSITIONS = getDiamondPositions();
const CROSS_POSITIONS = getCrossPositions();

let cachedCoinTextures: PIXI.Texture[] | null = null;

// Easing
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}
function easeOutBack(t: number): number {
  const c1 = 1.70158,
    c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
}
function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
}

// Public types
export type RewardEffectOptions = {
  layer: PIXI.Container;
  x: number;
  y: number;
  amount: number;
  pattern?: SpawnPattern;
  durationMs?: number;
  boxTarget?: { x: number; y: number };
  onComplete?: () => void;
};

export type SpawnPattern =
  | "single"
  | "ring"
  | "filled_circle"
  | "star"
  | "triangle"
  | "hexagon"
  | "diamond"
  | "cross";

// Spawn Position
type SpawnPos = { x: number; y: number; delay?: number };

function getRingPositions(): SpawnPos[] {
  const R = 30;
  return [
    { x: 0, y: -R },
    { x: R, y: 0 },
    { x: 0, y: R },
    { x: -R, y: 0 },
  ];
}

function getFilledCirclePositions(): SpawnPos[] {
  const pts: SpawnPos[] = [{ x: 0, y: 0 }];
  for (let ring = 1; ring <= 2; ring++) {
    const n = ring * 6;
    const radius = ring * 28;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      pts.push({
        x: Math.cos(a) * radius,
        y: Math.sin(a) * radius,
        delay: ring * POP_STAGGER_MS,
      });
    }
  }
  return pts;
}

function getStarPositions(): SpawnPos[] {
  const POINTS = 5;
  const R_OUTER = 60;
  const R_INNER = 26;
  const pts: SpawnPos[] = [];
  for (let i = 0; i < POINTS * 2; i++) {
    const a = (i / (POINTS * 2)) * Math.PI * 2 - Math.PI / 2;
    const r = i % 2 === 0 ? R_OUTER : R_INNER;
    pts.push({
      x: Math.cos(a) * r,
      y: Math.sin(a) * r,
      delay: i * POP_STAGGER_MS,
    });
  }
  return pts;
}

function getTrianglePositions(): SpawnPos[] {
  const pts: SpawnPos[] = [];
  const rows = 4;
  for (let r = 0; r < rows; r++) {
    const count = r + 1;
    const yOff = (r - (rows - 1) / 2) * 28;
    for (let c = 0; c < count; c++) {
      const xOff = (c - (count - 1) / 2) * 32;
      pts.push({ x: xOff, y: yOff, delay: r * POP_STAGGER_MS });
    }
  }
  return pts;
}

function getHexagonPositions(): SpawnPos[] {
  const pts: SpawnPos[] = [{ x: 0, y: 0, delay: 0 }];
  const R1 = 30,
    R2 = 60;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 - Math.PI / 6;
    pts.push({
      x: Math.cos(a) * R1,
      y: Math.sin(a) * R1,
      delay: POP_STAGGER_MS,
    });
  }
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2 - Math.PI / 6;
    pts.push({
      x: Math.cos(a) * R2,
      y: Math.sin(a) * R2,
      delay: POP_STAGGER_MS * 2,
    });
  }
  return pts;
}

function getDiamondPositions(): SpawnPos[] {
  const pts: SpawnPos[] = [];
  for (const r of [-2, -1, 0, 1, 2]) {
    const span = 2 - Math.abs(r);
    for (let c = -span; c <= span; c++) {
      pts.push({ x: c * 26, y: r * 22, delay: Math.abs(r) * POP_STAGGER_MS });
    }
  }
  return pts;
}

function getCrossPositions(): SpawnPos[] {
  const pts: SpawnPos[] = [];
  const ARM = 3,
    STEP = 30;
  for (let i = -ARM; i <= ARM; i++) {
    pts.push({ x: i * STEP, y: 0, delay: Math.abs(i) * POP_STAGGER_MS });
    if (i !== 0)
      pts.push({ x: 0, y: i * STEP, delay: Math.abs(i) * POP_STAGGER_MS });
  }
  return pts;
}

// Texture getter — resolved once, cached forever.
function getCoinTextures(): PIXI.Texture[] {
  if (cachedCoinTextures) return cachedCoinTextures;

  const { getAtlasTexture } = useFishAssetPreload();
  const textures: PIXI.Texture[] = [];
  for (const frame of COIN_FRAMES) {
    const texture = getAtlasTexture(COIN_ATLAS_URL, frame);
    if (texture !== PIXI.Texture.WHITE) textures.push(texture);
  }
  cachedCoinTextures = textures;
  return textures;
}

// ============================================================
//  Object pools
// ============================================================

const rootPool: PIXI.Container[] = [];
const coinSpritePool: PIXI.Sprite[] = [];
const labelPool: PIXI.BitmapText[] = [];

function acquireRoot(): PIXI.Container {
  let root = rootPool.pop();
  while (root && root.destroyed) root = rootPool.pop();
  if (!root) {
    root = new PIXI.Container();
    root.zIndex = 1000;
  }
  root.visible = true;
  root.alpha = 1;
  root.scale.set(1);
  root.rotation = 0;
  root.position.set(0, 0);
  (root as any).__isRewardEffect = true;
  return root;
}

function releaseRoot(root: PIXI.Container) {
  if (root.destroyed) return;
  if (root.parent) root.parent.removeChild(root);
  root.removeChildren(); // detach only — pooled children released separately
  root.visible = false;
  (root as any).__isRewardEffect = true;
  rootPool.push(root);
}

function acquireCoinSprite(texture: PIXI.Texture): PIXI.Sprite {
  let sprite = coinSpritePool.pop();
  while (sprite && sprite.destroyed) sprite = coinSpritePool.pop();

  if (!sprite) {
    sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5);
    sprite.zIndex = 1000;
    (sprite as any).__isRewardEffect = true;
  } else {
    sprite.texture = texture;
  }

  sprite.visible = true;
  sprite.alpha = 1;
  sprite.rotation = 0;
  sprite.scale.set(0);
  sprite.position.set(0, 0);
  return sprite;
}

function releaseCoinSprite(sprite: PIXI.Sprite) {
  if (sprite.destroyed) return;
  if (sprite.parent) sprite.parent.removeChild(sprite);
  sprite.visible = false;
  coinSpritePool.push(sprite);
}

function acquireLabel(text: string): PIXI.BitmapText {
  let label = labelPool.pop();
  while (label && label.destroyed) label = labelPool.pop();

  if (!label) {
    label = new PIXI.BitmapText(text, {
      fontName: COIN_FONT_NAME,
      fontSize: 44,
      align: "center",
    });
    label.anchor.set(0.5);
    (label as any).__isRewardEffect = true;
  } else {
    label.text = text;
  }

  label.visible = true;
  label.alpha = 0;
  label.scale.set(0.3);
  label.position.set(0, 0);
  return label;
}

function releaseLabel(label: PIXI.BitmapText) {
  if (label.destroyed) return;
  if (label.parent) label.parent.removeChild(label);
  label.visible = false;
  labelPool.push(label);
}

// ============================================================
//  Coin animation stepping (replaces AnimatedSprite bookkeeping)
// ============================================================

function stepCoinFrame(
  sprite: PIXI.Sprite,
  frameProgress: number,
  animSpeed: number,
  dt: number,
  textures: PIXI.Texture[],
): number {
  const nextProgress = frameProgress + (dt / 1000) * ANIM_FPS_BASE * animSpeed;
  const count = textures.length;
  const idx = Math.floor(nextProgress) % count;
  const tex = textures[idx]!;
  if (sprite.texture !== tex) sprite.texture = tex;
  return nextProgress;
}

// ============================================================
//  Reward effect state machine
// ============================================================

interface CoinState {
  sprite: PIXI.Sprite;
  frameProgress: number;
  animSpeed: number;
  delay: number;
  popElapsed: number;
  popMs: number;
  popDone: boolean;
  popScale: number;
}

interface FlyCoinState {
  sprite: PIXI.Sprite;
  frameProgress: number;
  animSpeed: number;
  delay: number;
  elapsed: number;
  startX: number;
  startY: number;
  midX: number;
  midY: number;
  targetX: number; // ← add
  targetY: number; // ← add
  done: boolean;
}

interface FadeCoinState {
  sprite: PIXI.Sprite;
  frameProgress: number;
  animSpeed: number;
}

type EffectPhase = "main" | "fly" | "fade" | "done";

interface RewardEffectState {
  layer: PIXI.Container;
  root: PIXI.Container;
  coins: CoinState[];
  label: PIXI.BitmapText;
  durationMs: number;
  holdMs: number;
  elapsed: number;
  startY: number;
  boxTarget?: { x: number; y: number };
  onComplete?: () => void;
  completed: boolean;
  phase: EffectPhase;
  textures: PIXI.Texture[];

  // fly/fade phase state
  subElapsed: number;
  flyCoins: FlyCoinState[];
  fadeCoins: FadeCoinState[];
}

const activeEffects: RewardEffectState[] = [];
let managerRunning = false;

function ensureManagerRunning() {
  if (managerRunning) return;
  managerRunning = true;
  PIXI.Ticker.shared.add(updateRewardEffects);
}

// Single centralized ticker for every reward effect, any count.
function updateRewardEffects() {
  if (activeEffects.length === 0) return;

  const dt = PIXI.Ticker.shared.elapsedMS;

  for (let i = activeEffects.length - 1; i >= 0; i--) {
    const eff = activeEffects[i]!;

    if (eff.layer.destroyed) {
      finishEffect(eff);
      activeEffects.splice(i, 1);
      continue;
    }

    if (eff.phase === "main") updateMainPhase(eff, dt);
    else if (eff.phase === "fly") updateFlyPhase(eff, dt);
    else if (eff.phase === "fade") updateFadePhase(eff, dt);

    if (eff.phase === "done") {
      activeEffects.splice(i, 1);
    }
  }
}

function finishEffect(eff: RewardEffectState) {
  if (eff.completed) return;
  eff.completed = true;
  eff.phase = "done";

  // Safety cleanup for any sprites left un-pooled (e.g. layer destroyed mid-flight)
  for (const c of eff.coins) releaseCoinSprite(c.sprite);
  for (const c of eff.flyCoins) if (!c.done) releaseCoinSprite(c.sprite);
  for (const c of eff.fadeCoins) releaseCoinSprite(c.sprite);
  if (eff.root.parent || !eff.root.destroyed) releaseRoot(eff.root);
  releaseLabel(eff.label);

  eff.onComplete?.();
}

function updateMainPhase(eff: RewardEffectState, dt: number) {
  eff.elapsed += dt;

  for (const coin of eff.coins) {
    // Spin continues regardless of pop-in delay, matching AnimatedSprite.play()
    // being called immediately at creation.
    coin.frameProgress = stepCoinFrame(
      coin.sprite,
      coin.frameProgress,
      coin.animSpeed,
      dt,
      eff.textures,
    );

    if (coin.popDone) continue;
    coin.popElapsed += dt;
    if (coin.popElapsed < coin.delay) continue;

    const t = Math.min((coin.popElapsed - coin.delay) / coin.popMs, 1);
    coin.sprite.scale.set(easeOutBack(t) * coin.popScale);
    if (t >= 1) coin.popDone = true;
  }

  const t = Math.min(eff.elapsed / eff.durationMs, 1);
  eff.root.y = eff.startY - easeOut(t) * 90;

  if (!eff.label.destroyed) {
    const labelT = Math.min(eff.elapsed / LABEL_IN_MS, 1);
    eff.label.scale.set(easeOutBack(labelT) * 0.9);
    eff.label.alpha = Math.min(1, labelT * 2);

    if (eff.elapsed > eff.holdMs) {
      const fadeT = Math.min((eff.elapsed - eff.holdMs) / LABEL_FADE_MS, 1);
      eff.label.alpha = Math.max(0, 1 - fadeT);
      eff.root.alpha = Math.max(0, 1 - fadeT);
    }
  }

  if (eff.elapsed >= eff.holdMs) {
    transitionOutOfMain(eff);
  }
}

function transitionOutOfMain(eff: RewardEffectState) {
  const layer = eff.layer;
  const flyCoins: FlyCoinState[] = [];
  const fadeCoins: FadeCoinState[] = [];

  const useFly = !!(eff.boxTarget && eff.coins.length > 0);
  // Snapshot the target ONCE for this whole flight — don't re-read a
  // possibly-moving boxTarget reference on every frame.
  const targetX = eff.boxTarget?.x ?? 0;
  const targetY = eff.boxTarget?.y ?? 0;

  for (let i = 0; i < eff.coins.length; i++) {
    const coin = eff.coins[i]!;
    const sprite = coin.sprite;
    if (sprite.destroyed) continue;

    const worldPos = eff.root.toGlobal(sprite.position);
    const layerPos = layer.toLocal(worldPos);

    eff.root.removeChild(sprite);
    sprite.position.set(layerPos.x, layerPos.y);
    layer.addChild(sprite);

    if (useFly) {
      flyCoins.push({
        sprite,
        frameProgress: coin.frameProgress,
        animSpeed: coin.animSpeed,
        delay: i * STAGGER_DELAY,
        elapsed: 0,
        startX: layerPos.x,
        startY: layerPos.y,
        midX: (layerPos.x + targetX) / 2 + (Math.random() - 0.5) * 100,
        midY: Math.min(layerPos.y, targetY) - 60 - Math.random() * 60,
        targetX,
        targetY,
        done: false,
      });
    } else {
      fadeCoins.push({
        sprite,
        frameProgress: coin.frameProgress,
        animSpeed: coin.animSpeed,
      });
    }
  }

  releaseRoot(eff.root);
  releaseLabel(eff.label);
  eff.coins.length = 0;

  eff.subElapsed = 0;

  if (useFly && flyCoins.length > 0) {
    eff.flyCoins = flyCoins;
    eff.phase = "fly";
  } else if (fadeCoins.length > 0) {
    eff.fadeCoins = fadeCoins;
    eff.phase = "fade";
  } else {
    finishEffect(eff);
  }
}

function updateFlyPhase(eff: RewardEffectState, dt: number) {
  eff.subElapsed += dt;
  let completed = 0;

  for (const state of eff.flyCoins) {
    if (state.done) {
      completed++;
      continue;
    }

    const sprite = state.sprite;
    if (sprite.destroyed) {
      state.done = true;
      completed++;
      continue;
    }

    state.frameProgress = stepCoinFrame(
      sprite,
      state.frameProgress,
      state.animSpeed,
      dt,
      eff.textures,
    );

    if (eff.subElapsed < state.delay) continue;

    const t = Math.min((eff.subElapsed - state.delay) / FLY_DURATION, 1);
    const et = easeInOut(t);
    const inv = 1 - et;

    sprite.x =
      inv * inv * state.startX +
      2 * inv * et * state.midX +
      et * et * state.targetX;
    sprite.y =
      inv * inv * state.startY +
      2 * inv * et * state.midY +
      et * et * state.targetY;

    const BASE = 0.75;
    if (t > 0.8) {
      const endT = (t - 0.8) / 0.2;
      sprite.scale.set(BASE * (1 - endT * 0.7));
      sprite.alpha = 1 - endT;
    } else {
      sprite.scale.set(BASE);
      sprite.alpha = 1;
    }

    if (t >= 1) {
      state.done = true;
      releaseCoinSprite(sprite);
      completed++;
    }
  }

  if (completed >= eff.flyCoins.length) {
    finishEffect(eff);
  }
}

// boxTarget is stored on the effect, but FlyCoinState doesn't carry it
// directly (kept per-state minimal) — resolve from eff.boxTarget each call.
function flyTargetX(eff: RewardEffectState, _state: FlyCoinState): number {
  return eff.boxTarget?.x ?? 0;
}
function flyTargetY(eff: RewardEffectState, _state: FlyCoinState): number {
  return eff.boxTarget?.y ?? 0;
}

function updateFadePhase(eff: RewardEffectState, dt: number) {
  eff.subElapsed += dt;
  const t = Math.min(eff.subElapsed / FADE_MS, 1);

  for (const state of eff.fadeCoins) {
    const sprite = state.sprite;
    if (sprite.destroyed) continue;

    state.frameProgress = stepCoinFrame(
      sprite,
      state.frameProgress,
      state.animSpeed,
      dt,
      eff.textures,
    );
    sprite.alpha = 1 - t;
  }

  if (t >= 1) {
    for (const state of eff.fadeCoins) releaseCoinSprite(state.sprite);
    eff.fadeCoins.length = 0;
    finishEffect(eff);
  }
}

// ============================================================
//  Public entry point
// ============================================================

export function showRewardEffect(options: RewardEffectOptions): void {
  const {
    layer,
    x,
    y,
    amount,
    pattern = "single",
    durationMs = 1800,
    boxTarget,
    onComplete,
  } = options;

  if (layer.destroyed) {
    onComplete?.();
    return;
  }

  const textures = getCoinTextures();
  if (textures.length === 0) {
    console.warn(
      "[reward] coin textures not loaded — call preloadAppAssets() first",
    );
    onComplete?.();
    return;
  }

  if (pattern === "single") {
    spawnSingleCoin(
      layer,
      x,
      y,
      textures,
      amount,
      durationMs,
      boxTarget,
      onComplete,
    );
  } else {
    const positions =
      pattern === "ring"
        ? RING_POSITIONS
        : pattern === "filled_circle"
          ? FILLED_CIRCLE_POSITIONS
          : pattern === "star"
            ? STAR_POSITIONS
            : pattern === "triangle"
              ? TRIANGLE_POSITIONS
              : pattern === "hexagon"
                ? HEXAGON_POSITIONS
                : pattern === "diamond"
                  ? DIAMOND_POSITIONS
                  : pattern === "cross"
                    ? CROSS_POSITIONS
                    : EMPTY_SPAWN_POSITIONS;

    spawnMultiCoin(
      layer,
      x,
      y,
      textures,
      amount,
      positions,
      durationMs,
      boxTarget,
      onComplete,
    );
  }
}

function spawnSingleCoin(
  layer: PIXI.Container,
  x: number,
  y: number,
  textures: PIXI.Texture[],
  amount: number,
  durationMs: number,
  boxTarget?: { x: number; y: number },
  onComplete?: () => void,
): void {
  const root = acquireRoot();
  root.zIndex = 1000;
  root.position.set(x, y);
  (root as any).__isRewardEffect = true;
  layer.sortableChildren = true;
  layer.addChild(root);

  const sprite = acquireCoinSprite(textures[0]!);
  sprite.zIndex = 1000;
  root.addChild(sprite);

  const coin: CoinState = {
    sprite,
    frameProgress: 0,
    animSpeed: SINGLE_ANIM_SPEED,
    delay: 0,
    popElapsed: 0,
    popMs: POP_SINGLE_MS,
    popDone: false,
    popScale: SINGLE_POP_SCALE,
  };

  const label = acquireLabel(`+${amount.toLocaleString()}`);
  label.position.set(0, -70);
  root.addChild(label);

  pushRewardEffect(
    layer,
    root,
    [coin],
    label,
    durationMs,
    boxTarget,
    textures,
    onComplete,
  );
}

function spawnMultiCoin(
  layer: PIXI.Container,
  x: number,
  y: number,
  textures: PIXI.Texture[],
  amount: number,
  positions: SpawnPos[],
  durationMs: number,
  boxTarget?: { x: number; y: number },
  onComplete?: () => void,
): void {
  const root = acquireRoot();
  root.zIndex = 1000;
  root.position.set(x, y);
  (root as any).__isRewardEffect = true;
  layer.sortableChildren = true;
  layer.addChild(root);

  const coins: CoinState[] = [];
  let maxAbsY = 0;

  for (let i = 0; i < positions.length; i++) {
    const pos = positions[i]!;
    const sprite = acquireCoinSprite(textures[0]!);
    sprite.zIndex = 1000;
    sprite.position.set(pos.x, pos.y);
    root.addChild(sprite);

    coins.push({
      sprite,
      frameProgress: Math.floor((i / positions.length) * textures.length),
      animSpeed: MULTI_ANIM_SPEED,
      delay: pos.delay ?? i * POP_STAGGER_MS,
      popElapsed: 0,
      popMs: POP_MULTI_MS,
      popDone: false,
      popScale: MULTI_POP_SCALE,
    });

    const absY = Math.abs(pos.y);
    if (absY > maxAbsY) maxAbsY = absY;
  }

  const labelY = -maxAbsY - 52;
  const label = acquireLabel(`+${amount.toLocaleString()}`);
  label.position.set(0, labelY);
  root.addChild(label);

  pushRewardEffect(
    layer,
    root,
    coins,
    label,
    durationMs,
    boxTarget,
    textures,
    onComplete,
  );
}

function pushRewardEffect(
  layer: PIXI.Container,
  root: PIXI.Container,
  coins: CoinState[],
  label: PIXI.BitmapText,
  durationMs: number,
  boxTarget: { x: number; y: number } | undefined,
  textures: PIXI.Texture[],
  onComplete?: () => void,
): void {
  const eff: RewardEffectState = {
    layer,
    root,
    coins,
    label,
    durationMs,
    holdMs: durationMs * HOLD_RATIO,
    elapsed: 0,
    startY: root.y,
    boxTarget,
    onComplete,
    completed: false,
    phase: "main",
    textures,
    subElapsed: 0,
    flyCoins: [],
    fadeCoins: [],
  };

  activeEffects.push(eff);
  ensureManagerRunning();
}

// ============================================================
//  Teardown helper — call on scene/game destroy while effects
//  may still be active, to avoid orphaned ticker work or leaks.
// ============================================================

export function disposeRewardEffects(): void {
  for (const eff of activeEffects) {
    finishEffect(eff);
  }
  activeEffects.length = 0;

  if (managerRunning) {
    PIXI.Ticker.shared.remove(updateRewardEffects);
    managerRunning = false;
  }
}
