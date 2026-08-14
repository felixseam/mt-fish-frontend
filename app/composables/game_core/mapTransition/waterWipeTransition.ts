import * as PIXI from "pixi.js";
import { useFishAssetPreload } from "../assets/useFishAssetPreload";
import type { StageTransitionRunner } from "./types";

const WAVE_FRAME = "wave.png";
const FISH_TIDE_FRAME = "fishtide.png";
const LOCALIZE_LANG = "km";

// ─── Timing (ms) ──────────────────────────────────────────────────────────────
//
// Phase 0 – SCALE-IN : banner zooms from large → normal size while fading in.
// Phase 1 – HOLD     : banner sits fully visible on screen.
// Phase 2 – DIM      : background darkens behind banner.
// Phase 3 – WIPE     : water wipe sweeps RIGHT→LEFT revealing next scene.
// Phase 4 – BRIGHTEN : new scene brightens, banner fades out.
//
const SCALE_IN_DURATION = 500;
const HOLD_DURATION = 800;
const DIM_IN_DURATION = 600;
const WIPE_DURATION = 1000;
const BRIGHTEN_DURATION = 3100;
const TOTAL_DURATION =
  SCALE_IN_DURATION +
  HOLD_DURATION +
  DIM_IN_DURATION +
  WIPE_DURATION +
  BRIGHTEN_DURATION;

const MAX_DARK = 0.8;

// ─── Banner scale-in ──────────────────────────────────────────────────────────
// Banner starts at this scale multiplier and animates down to 1.0
const SCALE_IN_FROM = 3.0;

// ─── Banner geometry ──────────────────────────────────────────────────────────
const BANNER_HEIGHT = 60;
const BANNER_PADDING_Y = 10;
const BANNER_PANEL_PAD_X = 88;

type GradientStop = {
  offset: number;
  color: string;
};

interface BubbleSprite {
  sprite: PIXI.Sprite;
  vy: number;
  vx: number;
  life: number;
  maxLife: number;
  followFactor: number;
}

const {
  getEffectTexture,
  getLocalizedTexture,
} = useFishAssetPreload();

export interface WaterWipeTransitionOptions {
  app: PIXI.Application;
  currentScene: PIXI.DisplayObject;
  targetLayer: PIXI.Container;
  nextScene: PIXI.DisplayObject;
  onComplete?: () => void;
  width: number;
  height: number;
}

function resolveTransitionSource(
  displayObject: PIXI.DisplayObject,
): PIXI.DisplayObject {
  if ("children" in displayObject) {
    const firstChild = (displayObject as PIXI.Container).children[0];
    if (firstChild) return firstChild;
  }
  return displayObject;
}

function makeSprite(frame: string): PIXI.Sprite {
  return new PIXI.Sprite(getEffectTexture(frame));
}

function makeHorizontalGradientSprite(
  width: number,
  height: number,
  stops: GradientStop[],
): PIXI.Sprite {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(width));
  canvas.height = Math.max(2, Math.round(height));

  const ctx = canvas.getContext("2d");
  if (!ctx) return new PIXI.Sprite(PIXI.Texture.WHITE);

  const gradient = ctx.createLinearGradient(0, 0, canvas.width, 0);
  for (const stop of stops) {
    gradient.addColorStop(stop.offset, stop.color);
  }

  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  return new PIXI.Sprite(PIXI.Texture.from(canvas));
}

function spawnBubble(
  container: PIXI.Container,
  bubbles: BubbleSprite[],
  edgeX: number,
  H: number,
): void {
  const sprite = makeSprite("particle/bubble.png");
  const scale = 0.35 + Math.random() * 0.55;
  sprite.anchor.set(0.5);
  sprite.scale.set(scale);
  sprite.position.set(
    edgeX + 8 + Math.random() * 42,
    H * 0.05 + Math.random() * H * 0.88,
  );
  sprite.alpha = 0;
  container.addChild(sprite);
  bubbles.push({
    sprite,
    vx: 0.9 + Math.random() * 1.4,
    vy: -(0.5 + Math.random() * 1.2),
    life: 0,
    maxLife: 1.2 + Math.random() * 1.6,
    followFactor: 0.08 + Math.random() * 0.08,
  });
}

function tickBubbles(
  bubbles: BubbleSprite[],
  container: PIXI.Container,
  edgeDeltaX: number,
): void {
  for (let i = bubbles.length - 1; i >= 0; i--) {
    const b = bubbles[i]!;
    b.life += 1 / 60;
    const bT = b.life / b.maxLife;
    if (bT >= 1 || b.sprite.y < -70) {
      container.removeChild(b.sprite);
      b.sprite.destroy();
      bubbles.splice(i, 1);
    } else {
      const followPush = Math.max(0, edgeDeltaX) * b.followFactor;
      b.sprite.x += b.vx + followPush;
      b.sprite.y += b.vy;
      if (bT < 0.15) b.sprite.alpha = (bT / 0.15) * 0.9;
      else if (bT < 0.65) b.sprite.alpha = 0.9;
      else b.sprite.alpha = (1 - (bT - 0.65) / 0.35) * 0.9;
    }
  }
}

export async function runWaterWipeTransition(
  options: WaterWipeTransitionOptions,
): Promise<void> {
  const { app, currentScene, targetLayer, nextScene, onComplete } = options;
  const { renderer, ticker } = app;
  const sourceDisplay = resolveTransitionSource(currentScene);

  // const sceneBounds = currentScene.getLocalBounds();
  // const W = Math.max(1, Math.round(sceneBounds.width));
  // const H = Math.max(1, Math.round(sceneBounds.height));
  // const overlayLayer = new PIXI.Container();
  // overlayLayer.position.set(sceneBounds.x, sceneBounds.y);

  const W = Math.max(1, Math.round(options.width));
  const H = Math.max(1, Math.round(options.height));
  const overlayLayer = new PIXI.Container();
  overlayLayer.position.set(0, 0);

  const wipeMask = new PIXI.Graphics();
  wipeMask.beginFill(0xffffff, 1);
  wipeMask.drawRect(0, 0, W, H);
  wipeMask.endFill();
  overlayLayer.position.set(0, 0);

  // ── Dark overlay ───────────────────────────────────────────────────────────
  const darkOverlay = new PIXI.Graphics();
  darkOverlay.beginFill(0x000000, 1);
  darkOverlay.drawRect(0, 0, W, H);
  darkOverlay.endFill();
  darkOverlay.alpha = 0;

  // ── Banner ─────────────────────────────────────────────────────────────────
  const stripCY = H * 0.5;

  const bannerContainer = new PIXI.Container();
  // Pivot at the screen centre so scale zooms from the middle
  bannerContainer.pivot.set(W / 2, H / 2);
  bannerContainer.position.set(W / 2, H / 2);

  // Title sprite — compute final scale first so pill is sized correctly
  const titleSprite = new PIXI.Sprite(
    getLocalizedTexture(LOCALIZE_LANG, FISH_TIDE_FRAME),
  );
  titleSprite.anchor.set(0.5);
  titleSprite.position.set(W / 2, stripCY);
  const maxH = BANNER_HEIGHT - BANNER_PADDING_Y * 2;
  const scaleH = maxH / titleSprite.texture.height;
  const scaleW = (W * 0.6) / titleSprite.texture.width;
  const titleScale = Math.min(scaleH, scaleW);
  titleSprite.scale.set(titleScale);

  const panelW =
    titleSprite.texture.width * titleScale + BANNER_PANEL_PAD_X * 2;
  const panelH = titleSprite.texture.height * titleScale + BANNER_PADDING_Y * 2;
  const panelX = W / 2 - panelW / 2;
  const panelY = stripCY - panelH / 2;
  const glowW = panelW + 180;
  const glowH = panelH + 18;
  const bannerGlow = makeHorizontalGradientSprite(glowW, glowH, [
    { offset: 0, color: "rgba(66,184,255,0)" },
    { offset: 0.2, color: "rgba(66,184,255,0.05)" },
    { offset: 0.5, color: "rgba(66,184,255,0.17)" },
    { offset: 0.8, color: "rgba(66,184,255,0.05)" },
    { offset: 1, color: "rgba(66,184,255,0)" },
  ]);
  bannerGlow.anchor.set(0.5);
  bannerGlow.position.set(W / 2, stripCY);
  bannerGlow.filters = [new PIXI.BlurFilter(10)];
  bannerGlow.blendMode = PIXI.BLEND_MODES.ADD;
  bannerContainer.addChild(bannerGlow);

  const bodyH = panelH - 18;
  const bannerBody = makeHorizontalGradientSprite(panelW + 150, bodyH, [
    { offset: 0, color: "rgba(54,146,232,0)" },
    { offset: 0.18, color: "rgba(54,146,232,0.05)" },
    { offset: 0.35, color: "rgba(54,146,232,0.16)" },
    { offset: 0.5, color: "rgba(54,146,232,0.28)" },
    { offset: 0.65, color: "rgba(54,146,232,0.16)" },
    { offset: 0.82, color: "rgba(54,146,232,0.05)" },
    { offset: 1, color: "rgba(54,146,232,0)" },
  ]);
  bannerBody.anchor.set(0.5);
  bannerBody.position.set(W / 2, stripCY);
  bannerContainer.addChild(bannerBody);

  const bannerCenterGlow = makeHorizontalGradientSprite(
    panelW * 0.72,
    bodyH + 8,
    [
      { offset: 0, color: "rgba(113,224,255,0)" },
      { offset: 0.2, color: "rgba(113,224,255,0.035)" },
      { offset: 0.5, color: "rgba(113,224,255,0.12)" },
      { offset: 0.8, color: "rgba(113,224,255,0.035)" },
      { offset: 1, color: "rgba(113,224,255,0)" },
    ],
  );
  bannerCenterGlow.anchor.set(0.5);
  bannerCenterGlow.position.set(W / 2, stripCY);
  bannerCenterGlow.blendMode = PIXI.BLEND_MODES.ADD;
  bannerContainer.addChild(bannerCenterGlow);

  const borderW = panelW + 185;
  const topBorder = makeHorizontalGradientSprite(borderW, 2, [
    { offset: 0, color: "rgba(245,255,255,0)" },
    { offset: 0.18, color: "rgba(173,237,255,0.16)" },
    { offset: 0.36, color: "rgba(173,237,255,0.58)" },
    { offset: 0.5, color: "rgba(224,249,255,0.9)" },
    { offset: 0.64, color: "rgba(173,237,255,0.58)" },
    { offset: 0.82, color: "rgba(173,237,255,0.16)" },
    { offset: 1, color: "rgba(245,255,255,0)" },
  ]);
  topBorder.anchor.set(0.5);
  topBorder.position.set(W / 2, panelY + 4);
  topBorder.blendMode = PIXI.BLEND_MODES.ADD;

  const bottomBorder = new PIXI.Sprite(topBorder.texture);
  bottomBorder.anchor.set(0.5);
  bottomBorder.position.set(W / 2, panelY + panelH - 4);
  bottomBorder.blendMode = PIXI.BLEND_MODES.ADD;

  bannerContainer.addChild(topBorder);
  bannerContainer.addChild(bottomBorder);

  const titleShadow = new PIXI.Sprite(titleSprite.texture);
  titleShadow.anchor.set(0.5);
  titleShadow.position.set(W / 2, stripCY + 3);
  titleShadow.scale.copyFrom(titleSprite.scale);
  titleShadow.tint = 0x1b6d83;
  titleShadow.alpha = 0.48;
  bannerContainer.addChild(titleShadow);

  bannerContainer.addChild(titleSprite);

  // Start invisible and oversized — animated in during Phase 0
  bannerContainer.alpha = 0;
  bannerContainer.scale.set(SCALE_IN_FROM);

  // ── Wave + bubbles ─────────────────────────────────────────────────────────
  const fxContainer = new PIXI.Container();
  const waveSprite = makeSprite(WAVE_FRAME);
  const waveHalfWidth = 80;
  waveSprite.anchor.set(0.5, 0);
  waveSprite.height = H;
  waveSprite.width = waveHalfWidth * 2;
  waveSprite.alpha = 0;
  waveSprite.blendMode = PIXI.BLEND_MODES.ADD;
  fxContainer.addChild(waveSprite);

  const bubbles: BubbleSprite[] = [];
  const bubbleContainer = new PIXI.Container();
  fxContainer.addChild(bubbleContainer);

  // ── Layer order ────────────────────────────────────────────────────────────
  nextScene.visible = true;
  nextScene.alpha = 1;
  nextScene.mask = null;
  if (!targetLayer.children.includes(nextScene)) {
    targetLayer.addChild(nextScene);
  }
  if (targetLayer.children.includes(currentScene)) {
    const currentIndex = targetLayer.getChildIndex(currentScene);
    targetLayer.setChildIndex(nextScene, currentIndex);
  }
  targetLayer.addChild(wipeMask);
  sourceDisplay.mask = wipeMask;
  overlayLayer.addChild(darkOverlay);
  overlayLayer.addChild(fxContainer);
  overlayLayer.addChild(bannerContainer);
  targetLayer.addChild(overlayLayer);
  currentScene.visible = true;

  // ── Phase timestamps ───────────────────────────────────────────────────────
  const T0 = SCALE_IN_DURATION;
  const T1 = T0 + HOLD_DURATION;
  const T2 = T1 + DIM_IN_DURATION;
  const T3 = T2 + WIPE_DURATION;

  const wipeStartX = W + waveHalfWidth;
  const wipeEndX = -waveHalfWidth;
  const wipeTravel = wipeEndX - wipeStartX;
  let lastEdgeX = wipeStartX;

  const startTime = performance.now();
  let lastBubbleTime = 0;

  // ── Tick ───────────────────────────────────────────────────────────────────
  const tick = () => {
    const now = performance.now();
    const elapsed = now - startTime;
    const t = Math.min(elapsed / TOTAL_DURATION, 1);

    // ── Phase 0: banner zooms from large → normal size (0 → T0) ──────────────
    if (elapsed <= T0) {
      const p = elapsed / T0;
      // Ease-out cubic: fast start, gentle landing at scale 1
      const ease = 1 - Math.pow(1 - p, 3);
      const currentScale = SCALE_IN_FROM + (1.0 - SCALE_IN_FROM) * ease;

      bannerContainer.scale.set(currentScale);
      // Fade in quickly so it's visible right away
      bannerContainer.alpha = Math.min(1, p / 0.25);

      darkOverlay.alpha = 0;
      wipeMask.clear();
      wipeMask.beginFill(0xffffff, 1);
      wipeMask.drawRect(0, 0, W, H);
      wipeMask.endFill();
      waveSprite.alpha = 0;
      lastEdgeX = wipeStartX;
      return;
    }

    // After scale-in: lock to final resting state
    bannerContainer.scale.set(1);
    bannerContainer.alpha = 1;

    // ── Phase 1: hold (T0 → T1) ──────────────────────────────────────────────
    if (elapsed <= T1) {
      darkOverlay.alpha = 0;
      wipeMask.clear();
      wipeMask.beginFill(0xffffff, 1);
      wipeMask.drawRect(0, 0, W, H);
      wipeMask.endFill();
      waveSprite.alpha = 0;
      lastEdgeX = wipeStartX;
      return;
    }

    // ── Phase 2: dim in (T1 → T2) ────────────────────────────────────────────
    if (elapsed <= T2) {
      const p = (elapsed - T1) / DIM_IN_DURATION;
      darkOverlay.alpha = p * p * MAX_DARK;
      wipeMask.clear();
      wipeMask.beginFill(0xffffff, 1);
      wipeMask.drawRect(0, 0, W, H);
      wipeMask.endFill();
      waveSprite.alpha = 0;
      lastEdgeX = wipeStartX;
      return;
    }

    // ── Phase 3: wipe right→left (T2 → T3) ───────────────────────────────────
    if (elapsed <= T3) {
      darkOverlay.alpha = MAX_DARK;

      const wipeT = (elapsed - T2) / WIPE_DURATION;
      const ease = 1 - Math.pow(1 - wipeT, 3);
      const edgeX = wipeStartX + ease * wipeTravel;
      const edgeDeltaX = edgeX - lastEdgeX;

      wipeMask.clear();
      wipeMask.beginFill(0xffffff, 1);
      wipeMask.drawRect(0, 0, Math.max(0, edgeX), H);
      wipeMask.endFill();
      waveSprite.position.set(edgeX, 0);

      const entryFade = Math.min(
        1,
        Math.max(0, (wipeStartX - edgeX) / Math.max(1, waveHalfWidth)),
      );
      const travelFade = Math.min(wipeT * 3, 1.0);
      waveSprite.alpha = entryFade * travelFade;

      if (now - lastBubbleTime > 75 && edgeX > 0 && edgeX < W) {
        spawnBubble(bubbleContainer, bubbles, edgeX, H);
        if (Math.random() > 0.3)
          spawnBubble(bubbleContainer, bubbles, edgeX, H);
        lastBubbleTime = now;
      }

      tickBubbles(bubbles, bubbleContainer, edgeDeltaX);
      lastEdgeX = edgeX;
      return;
    }

    // ── Phase 4: brighten + banner fades out (T3 → end) ─────────────────────
    const brightenT = Math.min((elapsed - T3) / BRIGHTEN_DURATION, 1);
    const eased = 1 - Math.pow(1 - brightenT, 3);

    darkOverlay.alpha = MAX_DARK * (1 - eased);
    bannerContainer.alpha = Math.max(0, 1 - brightenT / 0.5);

    wipeMask.clear();
    wipeMask.beginFill(0xffffff, 1);
    wipeMask.drawRect(0, 0, 0, H);
    wipeMask.endFill();
    waveSprite.position.set(wipeEndX, 0);
    waveSprite.alpha = Math.max(0, 1 - brightenT * 3);

    tickBubbles(bubbles, bubbleContainer, 0);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    if (t >= 1) {
      ticker.remove(tick);
      for (const b of bubbles) b.sprite.destroy();
      overlayLayer.removeChild(darkOverlay);
      overlayLayer.removeChild(bannerContainer);
      overlayLayer.removeChild(fxContainer);
      targetLayer.removeChild(overlayLayer);
      targetLayer.removeChild(wipeMask);
      fxContainer.destroy({ children: true });
      bannerContainer.destroy({ children: true });
      darkOverlay.destroy();
      sourceDisplay.mask = null;
      wipeMask.destroy();
      overlayLayer.destroy();
      currentScene.visible = false;
      nextScene.alpha = 1;
      onComplete?.();
    }
  };

  ticker.add(tick);
}

export function makeWaterWipeTransitionRunner(
  app: PIXI.Application,
  backgroundLayer: PIXI.Container,
  width: number, // ← add
  height: number, // ← add
): StageTransitionRunner {
  return ({ currentScene, nextScene, onComplete }) => {
    void runWaterWipeTransition({
      app,
      currentScene,
      targetLayer: backgroundLayer,
      nextScene,
      onComplete,
      width, // ← pass through
      height, // ← pass through
    });
  };
}
