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

// Texture getter
function getCoinTextures(): PIXI.Texture[] {
  const { getAtlasTexture } = useFishAssetPreload();
  return COIN_FRAMES.map((f) => getAtlasTexture(COIN_ATLAS_URL, f)).filter(
    (t) => t !== PIXI.Texture.WHITE,
  );
}

// Amount label
function makeAmountLabel(amount: number): PIXI.BitmapText {
  const label = new PIXI.BitmapText(`+${amount.toLocaleString()}`, {
    fontName: COIN_FONT_NAME,
    fontSize: 44,
    align: "center",
  });
  label.anchor.set(0.5);
  return label;
}

// Public entry point
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

  const textures = getCoinTextures();
  if (textures.length === 0) {
    console.warn(
      "[reward] coin textures not loaded — call preloadAppAssets() first",
    );
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
        ? getRingPositions()
        : pattern === "filled_circle"
          ? getFilledCirclePositions()
          : pattern === "star"
            ? getStarPositions()
            : pattern === "triangle"
              ? getTrianglePositions()
              : pattern === "hexagon"
                ? getHexagonPositions()
                : pattern === "diamond"
                  ? getDiamondPositions()
                  : getCrossPositions();

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

// Single coin (amount <= 50)
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
  const root = new PIXI.Container();
  (root as any).__isRewardEffect = true;
  root.zIndex = 1000;
  root.position.set(x, y);
  layer.addChild(root);

  const coin = new PIXI.AnimatedSprite(textures);
  coin.anchor.set(0.5);
  coin.animationSpeed = 0.5;
  coin.loop = true;
  coin.scale.set(0);
  coin.zIndex = 1000;
  coin.play();
  root.addChild(coin);

  const label = makeAmountLabel(amount);
  label.position.set(0, -70);
  label.alpha = 0;
  label.scale.set(0.3);
  root.addChild(label);

  // Pop-in
  let popEl = 0;
  const onPop = () => {
    if (coin.destroyed) {
      PIXI.Ticker.shared.remove(onPop);
      return;
    }
    popEl += PIXI.Ticker.shared.elapsedMS;
    const t = Math.min(popEl / POP_SINGLE_MS, 1);
    coin.scale.set(easeOutBack(t) * 0.9);
    if (t >= 1) PIXI.Ticker.shared.remove(onPop);
  };
  PIXI.Ticker.shared.add(onPop);

  animateReward(root, [coin], label, durationMs, boxTarget, layer, onComplete);
}

// Four coins in circle (amount > 50)
function spawnMultiCoin(
  layer: PIXI.Container,
  x: number,
  y: number,
  textures: PIXI.Texture[],
  amount: number,
  positions: SpawnPos[], // ← now passed in
  durationMs: number,
  boxTarget?: { x: number; y: number },
  onComplete?: () => void,
): void {
  const root = new PIXI.Container();
  (root as any).__isRewardEffect = true;
  root.zIndex = 1000;
  root.position.set(x, y);
  layer.addChild(root);

  const coins = positions.map((pos, i) => {
    const coin = new PIXI.AnimatedSprite(textures);
    coin.anchor.set(0.5);
    coin.currentFrame = Math.floor((i / positions.length) * textures.length);
    coin.animationSpeed = 0.45;
    coin.loop = true;
    coin.scale.set(0);
    coin.zIndex = 1000;
    coin.position.set(pos.x, pos.y);
    coin.play();
    root.addChild(coin);
    return { coin, delay: pos.delay ?? i * POP_STAGGER_MS };
  });

  const labelY = -Math.max(...positions.map((p) => Math.abs(p.y))) - 52;
  const label = makeAmountLabel(amount);
  label.position.set(0, labelY);
  label.alpha = 0;
  label.scale.set(0.3);
  root.addChild(label);

  // Staggered pop-in using per-coin delay
  coins.forEach(({ coin, delay }) => {
    let elapsed = 0;
    const onPop = () => {
      if (coin.destroyed) {
        PIXI.Ticker.shared.remove(onPop);
        return;
      }
      elapsed += PIXI.Ticker.shared.elapsedMS;
      if (elapsed < delay) return;
      const t = Math.min((elapsed - delay) / POP_MULTI_MS, 1);
      coin.scale.set(easeOutBack(t) * 0.85);
      if (t >= 1) PIXI.Ticker.shared.remove(onPop);
    };
    PIXI.Ticker.shared.add(onPop);
  });

  animateReward(
    root,
    coins.map((c) => c.coin),
    label,
    durationMs,
    boxTarget,
    layer,
    onComplete,
  );
}

// Shared: float up → hold → detach → fly/fade
function animateReward(
  root: PIXI.Container,
  coins: PIXI.AnimatedSprite[],
  label: PIXI.BitmapText,
  durationMs: number,
  boxTarget: { x: number; y: number } | undefined,
  layer: PIXI.Container,
  onComplete?: () => void,
): void {
  const startY = root.y;
  const holdMs = durationMs * HOLD_RATIO;
  let elapsed = 0;
  let flyStarted = false;

  const onMain = () => {
    if (root.destroyed) {
      PIXI.Ticker.shared.remove(onMain);
      return;
    }

    elapsed += PIXI.Ticker.shared.elapsedMS;
    const t = Math.min(elapsed / durationMs, 1);
    root.y = startY - easeOut(t) * 90;

    // Label fade-in
    if (!label.destroyed) {
      const labelT = Math.min(elapsed / LABEL_IN_MS, 1);
      label.scale.set(easeOutBack(labelT) * 0.9);
      label.alpha = Math.min(1, labelT * 2);

      // Label + root fade-out during hold exit
      if (elapsed > holdMs) {
        const fadeT = Math.min((elapsed - holdMs) / LABEL_FADE_MS, 1);
        label.alpha = Math.max(0, 1 - fadeT);
        root.alpha = Math.max(0, 1 - fadeT);
      }
    }

    if (!flyStarted && elapsed >= holdMs) {
      flyStarted = true;
      PIXI.Ticker.shared.remove(onMain);

      // Detach coins into layer space before destroying root
      const flyCoins: PIXI.AnimatedSprite[] = [];
      for (const coin of coins) {
        if (coin.destroyed) continue;
        const worldPos = root.toGlobal(coin.position);
        const layerPos = layer.toLocal(worldPos);
        root.removeChild(coin);
        coin.position.set(layerPos.x, layerPos.y);
        layer.addChild(coin);
        flyCoins.push(coin);
      }

      root.parent?.removeChild(root);
      root.destroy({ children: true });

      if (boxTarget && flyCoins.length > 0) {
        flyCoinsToBox(flyCoins, boxTarget, onComplete);
      } else {
        fadeOutCoins(flyCoins, onComplete);
      }
    }
  };

  PIXI.Ticker.shared.add(onMain);
}

// Fly coins to coin box (bezier arc)
function flyCoinsToBox(
  coins: PIXI.AnimatedSprite[],
  target: { x: number; y: number },
  onComplete?: () => void,
): void {
  let completed = 0;

  coins.forEach((coin, i) => {
    const delay = i * STAGGER_DELAY;
    const startX = coin.x;
    const startY = coin.y;
    const midX = (startX + target.x) / 2 + (Math.random() - 0.5) * 100;
    const midY = Math.min(startY, target.y) - 60 - Math.random() * 60;
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

      // Quadratic bezier
      coin.x = inv * inv * startX + 2 * inv * et * midX + et * et * target.x;
      coin.y = inv * inv * startY + 2 * inv * et * midY + et * et * target.y;

      const BASE = 0.75;
      if (t > 0.8) {
        const endT = (t - 0.8) / 0.2;
        coin.scale.set(BASE * (1 - endT * 0.7));
        coin.alpha = 1 - endT;
      } else {
        coin.scale.set(BASE);
        coin.alpha = 1;
      }

      if (t >= 1) {
        PIXI.Ticker.shared.remove(onFly);
        coin.stop();
        coin.parent?.removeChild(coin);
        coin.destroy();
        if (++completed === coins.length) onComplete?.();
      }
    };

    PIXI.Ticker.shared.add(onFly);
  });
}

// Fallback: fade coins out
function fadeOutCoins(
  coins: PIXI.AnimatedSprite[],
  onComplete?: () => void,
): void {
  if (coins.length === 0) {
    onComplete?.();
    return;
  }

  let completed = 0;

  coins.forEach((coin) => {
    let elapsed = 0;
    const onFade = () => {
      if (coin.destroyed) {
        PIXI.Ticker.shared.remove(onFade);
        if (++completed === coins.length) onComplete?.();
        return;
      }
      elapsed += PIXI.Ticker.shared.elapsedMS;
      const t = Math.min(elapsed / FADE_MS, 1);
      coin.alpha = 1 - t;
      if (t >= 1) {
        PIXI.Ticker.shared.remove(onFade);
        coin.stop();
        coin.parent?.removeChild(coin);
        coin.destroy();
        if (++completed === coins.length) onComplete?.();
      }
    };
    PIXI.Ticker.shared.add(onFade);
  });
}
