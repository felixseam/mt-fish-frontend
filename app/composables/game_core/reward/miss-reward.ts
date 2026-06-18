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

// catch_big.atlas.txt frames
const SHINE_FRAME = "bg_y_light01_000.png"; // effect.atlas.txt
const COIN_FRAME = "s_coin0000.png"; // coin.atlas.txt
const GOLDEN_FRAME = "rewardcolorbg2_out.png";
const RGB_BG_FRAME = "rewardcolorbg3_02.png";
const CIRCLE_FRAME = "rewardcolorbg.png";
const BANNER_FRAME = "rewardnamebg.png";
const REWARD_PANEL_SCALE = 0.6;

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

//  Step 1: Explosion at fish position
function playExplosion(
  layer: PIXI.Container,
  x: number,
  y: number,
  getAtlasTexture: GetAtlasTex,
  onPeak: () => void,
): void {
  const textures = EXPLOSION_FRAMES.map((f) =>
    getAtlasTexture(COIN_ATLAS_URL, f),
  ).filter((t) => t !== PIXI.Texture.WHITE);

  if (textures.length === 0) {
    onPeak();
    return;
  }

  const explosion = new PIXI.AnimatedSprite(textures);
  explosion.anchor.set(0.5);
  explosion.position.set(x, y);
  explosion.animationSpeed = 0.55;
  explosion.loop = false;
  explosion.scale.set(1.4);
  explosion.zIndex = 9998;
  layer.sortableChildren = true;
  layer.addChild(explosion);

  const peakFrame = Math.floor(textures.length * 0.45);
  let peaked = false;

  explosion.onFrameChange = (frame) => {
    if (!peaked && frame >= peakFrame) {
      peaked = true;
      onPeak();
    }
  };
  explosion.onComplete = () => {
    if (!peaked) onPeak();
    explosion.parent?.removeChild(explosion);
    explosion.destroy();
  };
  explosion.play();
}

//  Step 2: Coin arc fly
function playCoinFly(
  layer: PIXI.Container,
  fromX: number,
  fromY: number,
  toX: number,
  toY: number,
  getAtlasTexture: GetAtlasTex,
  onArrived: () => void,
): void {
  const coinTex = getAtlasTexture(COIN_ATLAS_URL, COIN_FRAME);
  if (coinTex === PIXI.Texture.WHITE) {
    onArrived();
    return;
  }

  const coin = new PIXI.Sprite(coinTex);
  coin.anchor.set(0.5);
  coin.position.set(fromX, fromY);
  coin.zIndex = 9999;
  layer.addChild(coin);

  const FLY_MS = 600;
  let elapsed = 0;

  const onTick = () => {
    const dt = PIXI.Ticker.shared.elapsedMS;
    elapsed += dt;
    const t = Math.min(elapsed / FLY_MS, 1);
    const et = easeOut(t);

    coin.x = fromX + (toX - fromX) * et;
    coin.y = fromY + (toY - fromY) * et;
    coin.rotation += dt * 0.003;

    if (t > 0.75) {
      coin.alpha = 1 - (t - 0.75) / 0.25;
    }

    if (t >= 1) {
      PIXI.Ticker.shared.remove(onTick);
      coin.parent?.removeChild(coin);
      coin.destroy();
      onArrived();
    }
  };

  PIXI.Ticker.shared.add(onTick);
}

//  Step 3: Shine burst at reward position
function playShine(
  layer: PIXI.Container,
  x: number,
  y: number,
  getAtlasTexture: GetAtlasTex,
  onDone: () => void,
): void {
  const shineTex = getAtlasTexture(EFFECT_ATLAS_URL, SHINE_FRAME);
  if (shineTex === PIXI.Texture.WHITE) {
    onDone();
    return;
  }

  const shine = new PIXI.Sprite(shineTex);
  shine.anchor.set(0.5);
  shine.position.set(x, y);
  shine.scale.set(0);
  shine.zIndex = 9998;
  layer.addChild(shine);

  const SHINE_MS = 350;
  let elapsed = 0;

  const onTick = () => {
    const dt = PIXI.Ticker.shared.elapsedMS;
    elapsed += dt;
    const t = Math.min(elapsed / SHINE_MS, 1);

    shine.scale.set(easeOut(t) * 2.5);
    shine.alpha = t < 0.4 ? 1 : 1 - (t - 0.4) / 0.6;
    shine.rotation += dt * 0.004;

    if (t >= 1) {
      PIXI.Ticker.shared.remove(onTick);
      shine.parent?.removeChild(shine);
      shine.destroy();
      onDone();
    }
  };

  PIXI.Ticker.shared.add(onTick);
}

//  Step 4: Reward panel
type RewardPanelOptions = {
  layer: PIXI.Container;
  rewardX: number;
  rewardY: number;
  amount: number;
  fishName: string;
  fishId?: number;
  durationMs: number;
  getAtlasTexture: GetAtlasTex;
  getLocalizedTexture: GetLocalTex;
  onComplete?: () => void;
};

function spawnRewardPanel(options: RewardPanelOptions): void {
  const {
    layer,
    rewardX,
    rewardY,
    amount,
    fishName,
    fishId,
    durationMs,
    getAtlasTexture,
    getLocalizedTexture,
    onComplete,
  } = options;

  const goldenFrameTex = getAtlasTexture(CATCH_BIG_ATLAS_URL, GOLDEN_FRAME);
  const rgbBgTex = getAtlasTexture(CATCH_BIG_ATLAS_URL, RGB_BG_FRAME);
  const circleBgTex = getAtlasTexture(CATCH_BIG_ATLAS_URL, CIRCLE_FRAME);
  const bannerTex = getAtlasTexture(CATCH_BIG_ATLAS_URL, BANNER_FRAME);

  const lightTextures = LIGHT_FRAMES.map((f) =>
    getAtlasTexture(CATCH_BIG_ATLAS_URL, f),
  ).filter((t) => t !== PIXI.Texture.WHITE);

  // Guard: need at minimum the golden frame and some lights
  if (goldenFrameTex === PIXI.Texture.WHITE || lightTextures.length === 0) {
    console.warn("[rewardPanel] required assets not loaded");
    onComplete?.();
    return;
  }

  //  Root container
  const root = new PIXI.Container();
  root.position.set(rewardX, rewardY);
  (root as any).__isRewardEffect = true;
  root.zIndex = 9999;
  root.sortableChildren = true;
  root.scale.set(0);
  layer.addChild(root);

  //  RGB bg (z: 1)
  let rgbBg: PIXI.Sprite | null = null;
  if (rgbBgTex !== PIXI.Texture.WHITE) {
    rgbBg = new PIXI.Sprite(rgbBgTex);
    rgbBg.anchor.set(0.5);
    rgbBg.scale.set(0);
    rgbBg.alpha = 0;
    rgbBg.zIndex = 1;
    root.addChild(rgbBg);
  }

  //  Circle bg (z: 2)
  let circleBg: PIXI.Sprite | null = null;
  if (circleBgTex !== PIXI.Texture.WHITE) {
    circleBg = new PIXI.Sprite(circleBgTex);
    circleBg.anchor.set(0.5);
    circleBg.scale.set(0);
    circleBg.alpha = 0;
    circleBg.zIndex = 2;
    root.addChild(circleBg);
  }

  //  Fish display (z: 11)
  let fishHandle: FishDisplayHandle | null = null;
  let fishDisplay: PIXI.DisplayObject | null = null;
  let fishBaseScale = 1;

  if (fishId !== undefined) {
    const factory = createFishRendererFactory({ getAtlasTexture });
    fishHandle = factory.createAnimatedFishBySpawnFishId(fishId);
    fishDisplay = fishHandle?.display ?? null;

    if (fishDisplay) {
      const TARGET_SIZE = 250;
      const bounds = (fishDisplay as PIXI.Container).getLocalBounds();
      const naturalSize = Math.max(bounds.width, bounds.height);
      fishBaseScale = naturalSize > 0 ? TARGET_SIZE / naturalSize : 1;
      (fishDisplay as PIXI.Container).scale.set(0);
      fishDisplay.alpha = 0;
      (fishDisplay as PIXI.Container).zIndex = 11;
      fishDisplay.position.set(0, -20);
      root.addChild(fishDisplay);
    }
  }

  //  Golden frame (z: 4)
  const goldenFrame = new PIXI.Sprite(goldenFrameTex);
  goldenFrame.anchor.set(0.5);
  goldenFrame.scale.set(0);
  goldenFrame.alpha = 0;
  goldenFrame.zIndex = 4;
  root.addChild(goldenFrame);

  //  Orbiting light balls (z: 5)
  const BALL_COUNT = lightTextures.length;
  const ORBIT_RADIUS = 90;

  const ballSprites = lightTextures.map((tex, i) => {
    const ball = new PIXI.Sprite(tex);
    ball.anchor.set(0.5);
    const angle = (i / BALL_COUNT) * Math.PI * 2;
    ball.position.set(
      Math.cos(angle) * ORBIT_RADIUS,
      Math.sin(angle) * ORBIT_RADIUS,
    );
    ball.scale.set(0);
    ball.alpha = 0;
    ball.zIndex = 5;
    root.addChild(ball);
    return ball;
  });

  //  WIN + amount group (z: 14)
  const winAmountGroup = new PIXI.Container();
  winAmountGroup.zIndex = 14;
  winAmountGroup.scale.set(0);
  winAmountGroup.alpha = 0;
  root.addChild(winAmountGroup);

  const winTex = getLocalizedTexture("en", "win.png");
  let winSprite: PIXI.Sprite | null = null;
  if (winTex !== PIXI.Texture.WHITE) {
    winSprite = new PIXI.Sprite(winTex);
    winSprite.anchor.set(0, 0.5);
    winSprite.position.set(0, 35);
    winAmountGroup.addChild(winSprite);
  }

  const amountLabel = new PIXI.BitmapText(`${amount.toLocaleString()}`, {
    fontName: ODD_FONT_NAME,
    fontSize: 18,
    align: "center",
  });
  amountLabel.anchor.set(0, 0.5);
  amountLabel.position.set((winSprite?.width ?? 0) + 4, 0);
  winAmountGroup.addChild(amountLabel);

  const groupBounds = winAmountGroup.getLocalBounds();
  winAmountGroup.pivot.set(
    groupBounds.x + groupBounds.width / 2,
    groupBounds.y + groupBounds.height / 2,
  );
  winAmountGroup.position.set(0, 40);

  //  Banner + fish name (z: 12–13)
  let banner: PIXI.Sprite | null = null;
  let nameLabel: PIXI.Text | null = null;

  if (bannerTex !== PIXI.Texture.WHITE) {
    banner = new PIXI.Sprite(bannerTex);
    banner.anchor.set(0.5, 0);
    banner.position.set(0, 55);
    banner.scale.set(0);
    banner.alpha = 0;
    banner.zIndex = 12;
    root.addChild(banner);

    if (fishName) {
      nameLabel = new PIXI.Text(fishName, {
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
      nameLabel.scale.set(0);
      nameLabel.alpha = 0;
      nameLabel.zIndex = 13;
      root.addChild(nameLabel);
    }
  }

  //  Ticker animation
  const INTRO_MS = 420;
  const EXIT_MS = 320;
  const holdMs = durationMs * 0.65;

  let elapsed = 0;
  let pulseT = 0;
  let frameSpinT = 0;
  let orbitAngle = 0;
  let exitStarted = false;

  const onTick = () => {
    if (root.destroyed) {
      PIXI.Ticker.shared.remove(onTick);
      return;
    }

    const dt = PIXI.Ticker.shared.elapsedMS;
    elapsed += dt;
    pulseT += dt * 0.003;
    frameSpinT += dt * 0.0008;
    orbitAngle += dt * 0.006;

    const introT = Math.min(elapsed / INTRO_MS, 1);

    // Root pop-in
    if (!exitStarted) root.scale.set(easeOutBack(introT) * REWARD_PANEL_SCALE);

    // RGB bg — spins clockwise
    if (rgbBg && !rgbBg.destroyed) {
      const t = Math.min(elapsed / 300, 1);
      rgbBg.scale.set(easeOutBack(t));
      rgbBg.alpha = Math.min(1, t * 2);
      rgbBg.rotation += dt * 0.0015;
    }

    // Circle bg — counter-rotates
    if (circleBg && !circleBg.destroyed) {
      const t = Math.min(elapsed / 300, 1);
      circleBg.scale.set(easeOutBack(t));
      circleBg.alpha = Math.min(1, t * 2);
      circleBg.rotation -= dt * 0.0006;
    }

    // Fish
    if (fishDisplay && !(fishDisplay as any).destroyed) {
      const t = Math.min((elapsed - 60) / 320, 1);
      if (t > 0) {
        (fishDisplay as PIXI.Container).scale?.set(
          easeOutBack(t) * fishBaseScale,
        );
        fishDisplay.alpha = Math.min(1, t * 2);
      }
    }

    // Golden frame — slow spin after intro
    if (!goldenFrame.destroyed) {
      const t = Math.min((elapsed - 80) / 360, 1);
      if (t > 0) {
        goldenFrame.scale.set(easeOutBack(t));
        goldenFrame.alpha = Math.min(1, t * 2);
      }
      if (introT >= 1) goldenFrame.rotation = frameSpinT;
    }

    // Orbiting light balls
    ballSprites.forEach((ball, i) => {
      if (ball.destroyed) return;
      const delay = 120 + i * 30;
      const popT = Math.min((elapsed - delay) / 280, 1);
      if (popT <= 0) return;

      const angle = orbitAngle + (i / BALL_COUNT) * Math.PI * 2;
      ball.position.set(
        Math.cos(angle) * ORBIT_RADIUS,
        Math.sin(angle) * ORBIT_RADIUS,
      );

      if (popT < 1) {
        ball.scale.set(easeOutBack(popT) * 0.5);
        ball.alpha = Math.min(1, popT * 2);
      } else {
        ball.alpha = 1;
        ball.scale.set(0.5 * (1 + Math.sin(pulseT * 3 + i * 0.8) * 0.12));
      }
    });

    // WIN + amount
    if (!winAmountGroup.destroyed) {
      const t = Math.min((elapsed - 200) / 320, 1);
      if (t > 0) {
        winAmountGroup.scale.set(easeOutBack(t));
        winAmountGroup.alpha = Math.min(1, t * 2);
      }
    }

    // Banner
    if (banner && !banner.destroyed) {
      const t = Math.min((elapsed - 300) / 350, 1);
      if (t > 0) {
        banner.scale.set(easeOutBack(t));
        banner.alpha = Math.min(1, t * 2);
      }
    }

    // Fish name
    if (nameLabel && !nameLabel.destroyed) {
      const t = Math.min((elapsed - 380) / 280, 1);
      if (t > 0) {
        nameLabel.scale.set(easeOut(t));
        nameLabel.alpha = Math.min(1, t * 2);
      }
    }

    // Exit
    if (!exitStarted && elapsed > holdMs) exitStarted = true;

    if (exitStarted) {
      const exitT = Math.min((elapsed - holdMs) / EXIT_MS, 1);
      root.scale.set(Math.max(0, 1 - easeInBack(exitT))* REWARD_PANEL_SCALE);

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

//  Public entry point
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

  const { getAtlasTexture, getLocalizedTexture } = useFishAssetPreload();

  // Sequence: explosion → coin fly → shine → reward panel
  playExplosion(layer, x, y, getAtlasTexture, () => {
    playCoinFly(layer, x, y, rewardX, rewardY, getAtlasTexture, () => {
      playShine(layer, rewardX, rewardY, getAtlasTexture, () => {
        spawnRewardPanel({
          layer,
          rewardX,
          rewardY,
          amount,
          fishName,
          fishId,
          durationMs,
          getAtlasTexture,
          getLocalizedTexture,
          onComplete,
        });
      });
    });
  });
}
