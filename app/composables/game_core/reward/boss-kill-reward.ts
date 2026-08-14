// useRewardEffectBossCatch.ts
import * as PIXI from "pixi.js";
import {
  useFishAssetPreload,
  CATCH_BIG_ATLAS_URL,
  EXPLOSIVE_EFFECT_ATLAS_URL,
  type LocalizeLanguage,
} from "~/composables/game_core/assets/useFishAssetPreload";
import {
  createFishRendererFactory,
  type FishDisplayHandle,
} from "../fish/useFishRendererFactory";

// ── Font ──────────────────────────────────────────────────────────────────────
const COUNT_FONT_NAME = "fnt_count";

// ── Atlas frame names ─────────────────────────────────────────────────────────
const CIRCLE_SHINE_FRAME = "coney_ligb_00.png";
const CENTER_GLOW_FRAME = "worldcupfx_bglight02.png";
const SHIELD_HALF_FRAME = "capture_01.png";
const DECO_STAR_FRAME = "capture_05.png";
const BAR_EMPTY_FRAME = "capturerewardbar_01.png";
const BAR_FILL_FRAME = "capturerewardbar_02.png";
const STAR_EMPTY_FRAME = "capturerewardstar__bg.png";
const STAR_FILL_FRAME = "capture_03.png";
const CAUGHT_WORD_FRAME = "capture_word.png";

// fbf explosion frames (14 frames)
const EXPLOSION_FRAMES: string[] = Array.from(
  { length: 14 },
  (_, i) => `explosion/explosionsmoke01_${String(i + 1).padStart(2, "0")}.png`,
);

const BOSS_NAME_FRAMES: Record<number, string> = {
  18: "bossname_07.png",
  19: "bossname_03.png",
  20: "bossname_08.png",
};

// ── Timing ────────────────────────────────────────────────────────────────────
const INTRO_MS = 450;
const HOLD_MS = 2800;
const EXIT_MS = 380;
const STAR_START_MS = INTRO_MS + 150;
const STAR_STAGGER_MS = 90;
const MAX_STARS = 5;
const BAR_START_MS = 380;
const BAR_DURATION_MS = 480;

// ── Easing ────────────────────────────────────────────────────────────────────
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

// ── Public types ──────────────────────────────────────────────────────────────
export type BossCatchEffectOptions = {
  layer: PIXI.Container;
  x: number;
  y: number;
  fishId: number;
  winOdd: number; // IS the multiplier, e.g. 599
  maxKillOdd: number; // max possible for this fish, e.g. 1000
  lang?: LocalizeLanguage;
  onComplete?: () => void;
};

// ── Star slot layout ──────────────────────────────────────────────────────────
type StarSlot = { x: number; y: number; scale: number };
const STAR_SLOTS: StarSlot[] = [
  { x: -90, y: 15, scale: 0.5 },
  { x: -50, y: -5, scale: 0.7 },
  { x: 0, y: -20, scale: 0.8 },
  { x: 65, y: -27, scale: 1.0 },
  { x: 140, y: -20, scale: 1.1 },
];

// ── Deco star layout ──────────────────────────────────────────────────────────
type DecoStarCfg = { x: number; yOffset: number; rotDeg: number; sc: number };
const DECO_STAR_CFGS: DecoStarCfg[] = [
  { x: -10, yOffset: 10, rotDeg: -6.5, sc: 0.9 },
  { x: 5, yOffset: 0, rotDeg: -6.0, sc: 1.1 },
  { x: 118, yOffset: 15, rotDeg: -4.5, sc: 1.1 },
  { x: 115, yOffset: 35, rotDeg: -4.3, sc: 0.9 },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Play fbf explosion centered at (px, py) inside container. */
function playExplosion(
  container: PIXI.Container,
  px: number,
  py: number,
  getFbfTex: (frame: string) => PIXI.Texture,
  sc = 1.4,
): void {
  const frames = EXPLOSION_FRAMES.map(getFbfTex).filter(
    (t) => t !== PIXI.Texture.WHITE,
  );
  if (!frames.length) return;

  const spr = new PIXI.Sprite(frames[0]);
  spr.anchor.set(0.5);
  spr.position.set(px, py);
  spr.scale.set(sc);
  spr.zIndex = 20;
  container.addChild(spr);

  let fi = 0;
  let acc = 0;
  const frameDt = 1000 / 24; // 24 fps

  const tick = () => {
    if (spr.destroyed) {
      PIXI.Ticker.shared.remove(tick);
      return;
    }
    acc += PIXI.Ticker.shared.elapsedMS;
    while (acc >= frameDt) {
      acc -= frameDt;
      fi++;
      if (fi >= frames.length) {
        PIXI.Ticker.shared.remove(tick);
        spr.parent?.removeChild(spr);
        spr.destroy();
        return;
      }
      spr.texture = frames[fi]!;
    }
  };
  PIXI.Ticker.shared.add(tick);
}

/** Scale-pop a display object: scale up then back to original. */
function scalePop(
  obj: PIXI.DisplayObject,
  peakScale = 1.6,
  durationMs = 300,
): void {
  const baseScX = (obj as any).scale.x as number;
  const baseScY = (obj as any).scale.y as number;
  let elapsed = 0;

  const tick = () => {
    if ((obj as any).destroyed) {
      PIXI.Ticker.shared.remove(tick);
      return;
    }
    elapsed += PIXI.Ticker.shared.elapsedMS;
    const t = Math.min(elapsed / durationMs, 1);
    // 0→0.4 scale up, 0.4→1 scale back down
    const peakT = 0.4;
    const sc =
      t < peakT
        ? 1 + (peakScale - 1) * (t / peakT)
        : 1 + (peakScale - 1) * (1 - (t - peakT) / (1 - peakT));
    (obj as any).scale.set(baseScX * sc, baseScY * sc);
    if (t >= 1) {
      (obj as any).scale.set(baseScX, baseScY);
      PIXI.Ticker.shared.remove(tick);
    }
  };
  PIXI.Ticker.shared.add(tick);
}

// ── Main ──────────────────────────────────────────────────────────────────────
export function showBossCatchEffect(options: BossCatchEffectOptions): void {
  const {
    layer,
    x,
    y,
    fishId,
    winOdd,
    maxKillOdd,
    lang = "en",
    onComplete,
  } = options;

  // Derive progress (0–1) and star count from odds
  const progress = Math.min(winOdd / Math.max(maxKillOdd, 1), 1);
  const starCount = Math.floor(progress * MAX_STARS);

  const { getAtlasTexture, getEffectTexture, getLocalizedTexture } =
    useFishAssetPreload();

  const catchTex = (f: string) => getAtlasTexture(CATCH_BIG_ATLAS_URL, f);
  const effectTex = (f: string) => getEffectTexture(f);
  const localTex = (f: string) => getLocalizedTexture(lang, f);
  const fbfTex = (f: string) => getAtlasTexture(EXPLOSIVE_EFFECT_ATLAS_URL, f);

  layer.sortableChildren = true;

  // ── Root ──────────────────────────────────────────────────────────────────
  const root = new PIXI.Container();
  root.position.set(x, y);
  root.scale.set(0);
  (root as any).__isRewardEffect = true;  

  root.zIndex = 9000;
  root.sortableChildren = true;
  layer.addChild(root);

  // ── Shield halves ─────────────────────────────────────────────────────────
  const shieldHalfTex = catchTex(SHIELD_HALF_FRAME);
  if (shieldHalfTex !== PIXI.Texture.WHITE) {
    const left = new PIXI.Sprite(shieldHalfTex);
    left.anchor.set(1, 0.5);
    left.zIndex = 2;
    root.addChild(left);

    const right = new PIXI.Sprite(shieldHalfTex);
    right.anchor.set(1, 0.5);
    right.scale.x = -1;
    right.zIndex = 2;
    root.addChild(right);
  }

  const shieldH =
    shieldHalfTex !== PIXI.Texture.WHITE ? shieldHalfTex.height : 240;
  const shieldTopY = -shieldH * 0.5;

  // ── Background glows ──────────────────────────────────────────────────────
  const circleShineTex = effectTex(CIRCLE_SHINE_FRAME);
  let circleShine: PIXI.Sprite | null = null;
  if (circleShineTex !== PIXI.Texture.WHITE) {
    circleShine = new PIXI.Sprite(circleShineTex);
    circleShine.anchor.set(0.5);
    circleShine.position.set(-90, shieldTopY + 90);
    circleShine.scale.set(2.5);
    circleShine.alpha = 0;
    circleShine.zIndex = 0;
    root.addChild(circleShine);
  }

  const centerGlowTex = effectTex(CENTER_GLOW_FRAME);
  let centerGlow: PIXI.Sprite | null = null;
  if (centerGlowTex !== PIXI.Texture.WHITE) {
    centerGlow = new PIXI.Sprite(centerGlowTex);
    centerGlow.anchor.set(0.5);
    centerGlow.position.set(-90, shieldTopY + 90);
    centerGlow.scale.set(2.5);
    centerGlow.alpha = 0;
    centerGlow.zIndex = 0;
    root.addChild(centerGlow);
  }

  // ── Fish ──────────────────────────────────────────────────────────────────
  let fishHandle: FishDisplayHandle | null = null;
  let fishContainer: PIXI.Container | null = null;
  const factory = createFishRendererFactory({ getAtlasTexture });
  fishHandle = factory.createAnimatedFishBySpawnFishId(fishId);
  const fishDisplay = fishHandle?.display ?? null;
  if (fishDisplay) {
    fishContainer = new PIXI.Container();
    fishContainer.addChild(fishDisplay as PIXI.DisplayObject);
    const bounds = (fishDisplay as PIXI.Container).getLocalBounds();
    fishContainer.scale.set(400 / Math.max(bounds.width, 1));
    fishContainer.position.set(-100, shieldTopY + 10);
    fishContainer.rotation = -0.5;
    fishContainer.alpha = 0;
    fishContainer.zIndex = 0;
    root.addChild(fishContainer);
  }

  // ── Deco stars ────────────────────────────────────────────────────────────
  const decoStarTex = catchTex(DECO_STAR_FRAME);
  const decoStars: PIXI.Sprite[] = [];
  if (decoStarTex !== PIXI.Texture.WHITE) {
    for (const cfg of DECO_STAR_CFGS) {
      const star = new PIXI.Sprite(decoStarTex);
      star.anchor.set(0.5);
      star.position.set(cfg.x, shieldTopY + cfg.yOffset);
      star.rotation = cfg.rotDeg;
      star.scale.set(0);
      star.alpha = 0;
      star.zIndex = 1;
      root.addChild(star);
      decoStars.push(star);
    }
  }

  // ── "Caught" word ─────────────────────────────────────────────────────────
  const caughtWordTex = localTex(CAUGHT_WORD_FRAME);
  let caughtWord: PIXI.Sprite | null = null;
  if (caughtWordTex !== PIXI.Texture.WHITE) {
    caughtWord = new PIXI.Sprite(caughtWordTex);
    caughtWord.anchor.set(0.5);
    caughtWord.position.set(62, shieldTopY + 15);
    caughtWord.rotation = -6.1;
    caughtWord.scale.set(0);
    caughtWord.alpha = 0;
    caughtWord.zIndex = 6;
    root.addChild(caughtWord);
  }

  // ── Boss name ─────────────────────────────────────────────────────────────
  let bossName: PIXI.Sprite | null = null;
  const bossNameFrame = BOSS_NAME_FRAMES[fishId];
  if (bossNameFrame) {
    const tex = localTex(bossNameFrame);
    if (tex !== PIXI.Texture.WHITE) {
      bossName = new PIXI.Sprite(tex);
      bossName.anchor.set(0.5);
      bossName.scale.set(0);
      bossName.position.set(0, shieldTopY + 70);
      bossName.alpha = 0;
      bossName.zIndex = 7;
      root.addChild(bossName);
    }
  }

  // ── Win odd label (the red text — rides bar tip, explodes on star hits) ───
  const winOddLabel = new PIXI.BitmapText(`0X`, {
    fontName: COUNT_FONT_NAME,
    fontSize: 16,
    align: "center",
  });
  winOddLabel.anchor.set(0.5); // bottom-center so it sits above bar tip
  winOddLabel.position.set(0, shieldTopY + 100);
  winOddLabel.scale.set(0);
  winOddLabel.alpha = 0;
  winOddLabel.zIndex = 8;
  root.addChild(winOddLabel);
  // Position updated every tick — added to barContainer below

  // ── Progress bar ──────────────────────────────────────────────────────────
  const barContainer = new PIXI.Container();
  barContainer.position.set(0, shieldTopY + 230);
  barContainer.alpha = 0;
  barContainer.zIndex = 9;
  root.addChild(barContainer);

  const barEmptyTex = catchTex(BAR_EMPTY_FRAME);
  if (barEmptyTex !== PIXI.Texture.WHITE) {
    const barBg = new PIXI.Sprite(barEmptyTex);
    barBg.anchor.set(0.5);
    barBg.position.set(20, 0);
    barContainer.addChild(barBg);
  }

  const barFillTex = catchTex(BAR_FILL_FRAME);
  let barFill: PIXI.Sprite | null = null;
  let fillMask: PIXI.Graphics | null = null;

  if (barFillTex !== PIXI.Texture.WHITE) {
    barFill = new PIXI.Sprite(barFillTex);
    barFill.anchor.set(0.5);
    barFill.position.set(20, 0);
    barFill.alpha = 1;
    barContainer.addChild(barFill);

    fillMask = new PIXI.Graphics();
    barFill.mask = fillMask;
    barContainer.addChild(fillMask);
  }

  // Add win odd label after fill so it renders on top
  // barContainer.addChild(winOddLabel);

  // ── Star slots ────────────────────────────────────────────────────────────
  const starEmptyTex = catchTex(STAR_EMPTY_FRAME);
  const starFillTex = catchTex(STAR_FILL_FRAME);
  const starFills: (PIXI.Sprite | null)[] = [];

  for (let i = 0; i < MAX_STARS; i++) {
    const slot = STAR_SLOTS[i]!;
    if (starEmptyTex !== PIXI.Texture.WHITE) {
      const empty = new PIXI.Sprite(starEmptyTex);
      empty.anchor.set(0.5);
      empty.position.set(slot.x, slot.y);
      empty.scale.set(slot.scale);
      barContainer.addChild(empty);
    }
    let fill: PIXI.Sprite | null = null;
    if (starFillTex !== PIXI.Texture.WHITE) {
      fill = new PIXI.Sprite(starFillTex);
      fill.anchor.set(0.5);
      fill.position.set(slot.x, slot.y);
      fill.scale.set(0);
      fill.alpha = 0;
      barContainer.addChild(fill);
    }
    starFills.push(fill);
  }

  // ── Bar geometry ──────────────────────────────────────────────────────────
  const barFullWidth = barFillTex?.width ?? 0;
  const barFullHeight = barFillTex?.height ?? 40;
  const barLeftEdge = 20 - barFullWidth * 0.5;

  // Map each star's x position to a fill width value
  // slot.x is in barContainer coords, barLeftEdge is the left edge of the fill
  const starThresholds = STAR_SLOTS.map((slot) => slot.x - barLeftEdge);

  console.log("starThresholds", starThresholds);
  // Should log something like [25, 65, 115, 180, 255] — increasing left→right

  // ── Tick state ────────────────────────────────────────────────────────────

  // const starFired = new Array<boolean>(MAX_STARS).fill(false);
  const barStarExploded = new Array<boolean>(MAX_STARS).fill(false);
  let elapsed = 0;
  let spinAngle = 0;
  let exitStarted = false;
  let barElapsed = 0;
  let prevBarW = 0;
  let barPausedUntil = 0;
  let isPaused = false;

  const onTick = () => {
    if (root.destroyed) {
      PIXI.Ticker.shared.remove(onTick);
      return;
    }

    const dt = PIXI.Ticker.shared.elapsedMS;
    elapsed += dt;
    spinAngle += dt * 0.0007;

    const introT = Math.min(elapsed / INTRO_MS, 1);

    if (!exitStarted) root.scale.set(easeOutBack(Math.min(introT * 1.3, 1)));

    if (circleShine && !circleShine.destroyed) {
      circleShine.rotation = spinAngle;
      circleShine.alpha = Math.min(0.6, introT * 0.9);
    }
    if (centerGlow && !centerGlow.destroyed) {
      centerGlow.rotation = -spinAngle * 0.5;
      centerGlow.alpha = Math.min(0.8, introT * 1.2);
    }
    if (fishContainer && !fishContainer.destroyed) {
      fishContainer.alpha = Math.min(
        1,
        easeOut(Math.min(elapsed / 350, 1)) * 1.4,
      );
    }

    decoStars.forEach((star, i) => {
      if (star.destroyed) return;
      const t = Math.min((elapsed - (60 + i * 40)) / 220, 1);
      if (t <= 0) return;
      star.alpha = Math.min(1, t * 2);
      const baseSc = DECO_STAR_CFGS[i]!.sc;
      star.scale.set(
        t < 1
          ? easeOutBack(t) * baseSc
          : baseSc * (1 + Math.sin(elapsed * 0.003 + i * 0.8) * 0.06),
      );
    });

    if (caughtWord && !caughtWord.destroyed) {
      const t = Math.min((elapsed - 130) / 260, 1);
      if (t > 0) {
        caughtWord.scale.set(easeOutBack(t));
        caughtWord.alpha = Math.min(1, t * 2);
      }
    }
    if (bossName && !bossName.destroyed) {
      const t = Math.min((elapsed - 180) / 280, 1);
      if (t > 0) {
        bossName.scale.set(easeOutBack(t) * 0.5);
        bossName.alpha = Math.min(1, t * 2);
      }
    }

    if (!barContainer.destroyed) {
      const t = Math.min((elapsed - 300) / 260, 1);
      if (t > 0) barContainer.alpha = Math.min(1, t * 2);
    }

    // ── Win odd label animate in + count up while bar sweeps ──────────────────
    if (!winOddLabel.destroyed) {
      const labelT = Math.min((elapsed - 230) / 300, 1);
      if (labelT > 0) {
        winOddLabel.scale.set(easeOutBack(labelT));
        winOddLabel.alpha = Math.min(1, labelT * 2);
      }
    }

    // ── Bar fill + stars follow bar + pause on star hit ───────────────────────
    if (barFill && !barFill.destroyed && fillMask) {
      // Determine pause state BEFORE advancing barElapsed
      isPaused = elapsed < BAR_START_MS || elapsed < barPausedUntil;

      // Only advance bar time when not paused
      if (!isPaused) {
        barElapsed += dt;
      }

      const t = Math.min(barElapsed / BAR_DURATION_MS, 1);
      const easedT = easeOut(t);
      // Bar fills up to the last earned star's position, not beyond
      // const maxFillW = starCount > 0 ? starThresholds[starCount - 1]! : 0;
      // How far between earned stars and next star
      const earnedProgress = starCount / MAX_STARS;
      const nextStarProgress = (starCount + 1) / MAX_STARS;
      const remainder =
        (progress - earnedProgress) / (nextStarProgress - earnedProgress);
      // (0.599 - 0.4) / (0.6 - 0.4) = 0.199/0.2 = 0.995 → almost at star 3

      // Bar fills from last earned star toward next star
      const fromW = starCount > 0 ? starThresholds[starCount - 1]! : 0;
      const toW = starThresholds[starCount] ?? barFullWidth;
      const targetW = fromW + (toW - fromW) * Math.min(remainder, 1);
      // 65 + (115 - 65) * 0.995 = 65 + 49.75 = ~115 → stops just before star 3 ✓

      const currentW = easedT * targetW;

      console.log(
        "progress",
        progress,
        "starCount",
        starCount,
        "winOdd",
        winOdd,
        "maxKillOdd",
        maxKillOdd,
      );

      // Always redraw mask at current position (even while paused — bar stays frozen)
      fillMask.clear();
      fillMask.beginFill(0xffffff);
      fillMask.drawRect(
        barLeftEdge,
        -barFullHeight * 0.5,
        currentW,
        barFullHeight,
      );
      fillMask.endFill();

      // Count-up label — freeze text while paused
      if (!isPaused) {
        winOddLabel.text =
          t < 1 ? `${Math.round(easedT * winOdd)}X` : `${winOdd}X`;
      }

      // Check each star threshold crossing (prevBarW → currentW)
      for (let i = 0; i < MAX_STARS; i++) {
        if (barStarExploded[i]) continue;
        if (i >= starCount) continue; // only stars we earned

        const threshold = starThresholds[i]!;
        if (threshold > barFullWidth * progress) continue; // ← use star's actual x position

        if (prevBarW < threshold && currentW >= threshold) {
          barStarExploded[i] = true;

          const fill = starFills[i];
          const slot = STAR_SLOTS[i]!;
          if (fill && !fill.destroyed) {
            let starEl = 0;
            const onStarPop = () => {
              if (fill.destroyed) {
                PIXI.Ticker.shared.remove(onStarPop);
                return;
              }
              starEl += PIXI.Ticker.shared.elapsedMS;
              const st = Math.min(starEl / 200, 1);
              fill.scale.set(easeOutBack(st) * slot.scale);
              fill.alpha = Math.min(1, st * 2);
              if (st >= 1) PIXI.Ticker.shared.remove(onStarPop);
            };
            PIXI.Ticker.shared.add(onStarPop);
          }

          winOddLabel.text = `${Math.round(((i + 1) / MAX_STARS) * winOdd)}X`;
          barPausedUntil = elapsed + Math.ceil((14 / 24) * 1000) + 100;
          isPaused = true;

          scalePop(winOddLabel, 1.8, 300);
          playExplosion(
            root,
            winOddLabel.position.x,
            winOddLabel.position.y + 10,
            fbfTex,
            1.4,
          );
        }
      }

      prevBarW = currentW;
    }

    // ── Exit ──────────────────────────────────────────────────────────────
    const totalMs = INTRO_MS + HOLD_MS;
    if (!exitStarted && elapsed >= totalMs) exitStarted = true;

    if (exitStarted) {
      const exitT = Math.min((elapsed - totalMs) / EXIT_MS, 1);
      root.scale.set(Math.max(0, 1 - easeInBack(exitT)));

      if (exitT >= 1) {
        PIXI.Ticker.shared.remove(onTick);
        root.parent?.removeChild(root);
        root.destroy({ children: true });
        fishHandle?.destroy();
        onComplete?.();
      }
    }
  };

  PIXI.Ticker.shared.add(onTick);
}

///////fish/fish-all-star/resources/localize_text/en.atlas.txt
// caught word
// capture_word.png;

// boss name base on id
// id 18
// bossname_07.png
// id 19
// bossname_03
// id 20
// bossname_08.png

////fish/fish-all-star/resources/catch_big.atlas.txt

// star neak caught word
// capture_05.png

// empty progess bar
// capturerewardbar_01.png

// fill progress bar
// capturerewardbar_02.png

// empty star on the progress bar
// capturerewardstar__bg.png

// fill star on the progress bar
// capture_03.png

// haft sheld bg it need 2 to build full sheild
// capture_01.png

///////////fish/fish-all-star/resources/effect.atlas.txt
// circle shine at the back
/// big_wave.png

/// the shine in the middle of circle shine
// worldcupfx_bglight02.png

/// this is the red font
// fnt_count

////////////fish/fish-all-star/resources/fbf.atlas.txt
// explode effect
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
// explosion/explosionsmoke01_14.png
