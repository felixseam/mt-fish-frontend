import * as PIXI from "pixi.js";
import {
  FISH_BASE_PATH,
  useFishAssetPreload,
} from "~/composables/game_core/assets/useFishAssetPreload";

import { showRewardEffect } from "../reward/normal";
import { showBigRewardEffect } from "../reward/big-reward";
import { getFishById } from "../fish/useFishApiData";
import { showBossCatchEffect } from "../reward/boss-kill-reward";
import { showFishMissRewardEffect } from "../reward/miss-reward";
import { useGameAudio } from "../audio/useGameAudio";

const BET_STEPS = [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000] as const;

type CannonLevel = 1 | 2 | 3;

const getCannonLevel = (bet: number): CannonLevel => {
  if (bet < 200) return 1;
  if (bet < 2000) return 2;
  return 3;
};

const getCannonFrameName = (level: CannonLevel) => {
  if (level === 1) return "cannon_common01.png";
  if (level === 2) return "cannon_common02.png";
  return "cannon_common03.png";
};

const getBulletFrameName = (level: CannonLevel) => {
  if (level === 1) return "bullet_common01.png";
  if (level === 2) return "bullet_common02.png";
  return "bullet_common03.png";
};

const getNetFrameName = (level: CannonLevel) => {
  if (level === 1) return "h_01.png";
  if (level === 2) return "h01_2.png";
  return "h01.png";
};

const getBetStep = (index: number) => BET_STEPS[index] ?? BET_STEPS[0];

const BURST_FRAMES = ["ef_bb_01.png", "ef_bb_03.png", "ef_bb_05.png"] as const;
const CANNON_BARREL_LENGTH_RATIO = 0.72;
const BULLET_START_INSET = 0;
const BULLET_Z_INDEX = 2.5;
const BURST_Y_OFFSET = 60;
const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const BULLET_SPEED = 1200;
const UI_ATLAS_URL = `${FISH_BASE_PATH}/resources/ui.atlas.txt`;
const CANNON_ATLAS_URL = `${FISH_BASE_PATH}/resources/cannon.atlas.txt`;
const BULLET_ATLAS_URL = `${FISH_BASE_PATH}/resources/bullet.atlas.txt`;
const BULLET_FIRE_INTERVAL_MS = 200;
const MAX_ACTIVE_BULLETS = 20;

const easeOutExpo = (t: number) => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t));

export type BulletCollisionTarget = {
  bounds: { x: number; y: number; width: number; height: number };
  center: { x: number; y: number };
  radius: number;
  display?: PIXI.DisplayObject | null;
  onHit?: () => void;
  fishData?: {
    id?: number | null;
    kill_rate_modifier: number | null;
    min_reward_odd: number | null;
    max_reward_odd: number | null;
    fish_type_name: string | null;
  } | null;
};

let playfieldWidth = GAME_WIDTH;
let playfieldHeight = GAME_HEIGHT;

const setPlayfieldSize = (w: number, h: number) => {
  playfieldWidth = w;
  playfieldHeight = h;
};

export async function createCannonBetUi(options?: {
  getCollisionTargets?: () => BulletCollisionTarget[];
  getCurrentCoins?: () => number;
  onCoinsSpent?: (spentCoins: number, remainingCoins: number) => void;
  onInsufficientBalance?: (requiredCoins: number, currentCoins: number) => void;
  isInputBlocked?: () => boolean;
  onFishHitResolved?: (payload: {
    fishTypeId: number;
    cannonTypeId: number;
    target: BulletCollisionTarget;
  }) => Promise<{
    isKill?: boolean;
    killReward?: number;
    isReward?: boolean;
    reward?: number;
    isJackpot?: boolean;
    jackpotReward?: number;
  } | null>;
  resolveCannonTypeId?: (betAmount: number) => number | null;
  getCoinBoxPosition?: () => { x: number; y: number } | undefined;
  getRewardLayer?: () => PIXI.Container | null;
  getShakeTarget?: () => PIXI.Container | null;
}) {
  const { preloadAppAssets, getAtlasTexture } = useFishAssetPreload();
  const gameAudio = useGameAudio();
  await preloadAppAssets();

  const requireTexture = (atlasUrl: string, frame: string) => {
    const texture = getAtlasTexture(atlasUrl, frame);
    if (texture === PIXI.Texture.WHITE) {
      throw new Error(`Missing atlas texture: ${atlasUrl} -> ${frame}`);
    }
    return texture;
  };

  const cannonTextures: Record<CannonLevel, PIXI.Texture> = {
    1: requireTexture(CANNON_ATLAS_URL, getCannonFrameName(1)),
    2: requireTexture(CANNON_ATLAS_URL, getCannonFrameName(2)),
    3: requireTexture(CANNON_ATLAS_URL, getCannonFrameName(3)),
  };
  const bulletTextures: Record<CannonLevel, PIXI.Texture> = {
    1: requireTexture(BULLET_ATLAS_URL, getBulletFrameName(1)),
    2: requireTexture(BULLET_ATLAS_URL, getBulletFrameName(2)),
    3: requireTexture(BULLET_ATLAS_URL, getBulletFrameName(3)),
  };
  const netTextures: Record<CannonLevel, PIXI.Texture> = {
    1: requireTexture(BULLET_ATLAS_URL, getNetFrameName(1)),
    2: requireTexture(BULLET_ATLAS_URL, getNetFrameName(2)),
    3: requireTexture(BULLET_ATLAS_URL, getNetFrameName(3)),
  };
  const netBaseRadii: Record<CannonLevel, number> = {
    1: netTextures[1].width * 0.6,
    2: netTextures[2].width * 0.6,
    3: netTextures[3].width * 0.6,
  };
  const muzzleCoreTexture = requireTexture(CANNON_ATLAS_URL, "fire_03-4.png");
  const muzzleFlashTexture = requireTexture(CANNON_ATLAS_URL, "fire_1.png");
  const clickMarkerTexture = requireTexture(
    UI_ATLAS_URL,
    "ui/mouse_position.png",
  );
  const burstTextures = BURST_FRAMES.map((frame) =>
    requireTexture(CANNON_ATLAS_URL, frame),
  );

  const container = new PIXI.Container();
  container.sortableChildren = true;

  // base platform
  const base = new PIXI.Sprite(requireTexture(CANNON_ATLAS_URL, "base.png"));
  base.anchor.set(0.5, 1);
  base.position.set(0, 0);
  base.zIndex = 2;

  const betButtonsY = -base.height / 2 - 10;
  const betCenterY = -base.height / 2 + 20;
  let currentBetIndex = 0;

  // cannon
  const cannonSprite = new PIXI.Sprite(
    cannonTextures[getCannonLevel(getBetStep(currentBetIndex))],
  );
  cannonSprite.anchor.set(0.5, 1);
  cannonSprite.position.set(0, -base.height + 60);
  cannonSprite.zIndex = 3;

  const cannonCenterY = cannonSprite.position.y - cannonSprite.height / 2;
  const getAimRotation = (targetX: number, targetY: number) =>
    Math.atan2(
      targetY - cannonSprite.position.y,
      targetX - cannonSprite.position.x,
    ) +
    Math.PI / 2;

  const getMuzzlePosition = (rotation: number) => {
    const length = cannonSprite.height * CANNON_BARREL_LENGTH_RATIO;
    return {
      x: cannonSprite.position.x + Math.sin(rotation) * length,
      y: cannonSprite.position.y - Math.cos(rotation) * length,
    };
  };

  const aimCannonAt = (targetX: number, targetY: number) => {
    cannonSprite.rotation = getAimRotation(targetX, targetY);
  };

  type MuzzleFlashInstance = {
    core: PIXI.Sprite;
    flash: PIXI.Sprite;
    elapsed: number;
  };

  type SpriteEffectInstance = {
    sprite: PIXI.Sprite;
    elapsed: number;
    level?: CannonLevel;
  };

  const activeMuzzleFlashes: MuzzleFlashInstance[] = [];
  const muzzleFlashPool: MuzzleFlashInstance[] = [];
  const activeClickMarkers: SpriteEffectInstance[] = [];
  const clickMarkerPool: PIXI.Sprite[] = [];
  const activeHitRings: SpriteEffectInstance[] = [];
  const hitRingPool: PIXI.Sprite[] = [];

  const acquireMuzzleFlash = () => {
    const pooled = muzzleFlashPool.pop();
    if (pooled) {
      pooled.core.visible = true;
      pooled.flash.visible = true;
      return pooled;
    }

    const core = new PIXI.Sprite(muzzleCoreTexture);
    core.anchor.set(0.5, 0.9);
    core.zIndex = 5;
    core.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(core);

    const flash = new PIXI.Sprite(muzzleFlashTexture);
    flash.anchor.set(0.5, 0.9);
    flash.zIndex = 5;
    flash.blendMode = PIXI.BLEND_MODES.ADD;
    container.addChild(flash);

    return { core, flash, elapsed: 0 };
  };

  const releaseMuzzleFlash = (inst: MuzzleFlashInstance) => {
    inst.core.visible = false;
    inst.flash.visible = false;
    muzzleFlashPool.push(inst);
  };

  const acquireClickMarker = (): PIXI.Sprite => {
    const pooled = clickMarkerPool.pop();
    if (pooled) {
      pooled.visible = true;
      return pooled;
    }

    const created = new PIXI.Sprite(clickMarkerTexture);
    created.anchor.set(0.5, 0.5);
    created.zIndex = 9;
    container.addChild(created);
    return created;
  };

  const releaseClickMarker = (sprite: PIXI.Sprite) => {
    sprite.visible = false;
    clickMarkerPool.push(sprite);
  };

  const acquireHitRing = (level: CannonLevel): PIXI.Sprite => {
    const pooled = hitRingPool.pop();
    if (pooled) {
      pooled.texture = netTextures[level];
      pooled.visible = true;
      return pooled;
    }

    const created = new PIXI.Sprite(netTextures[level]);
    created.anchor.set(0.5, 0.5);
    created.zIndex = 8;
    container.addChild(created);
    return created;
  };
  let lastFireTime = 0;
  const canFireBullet = () => {
    const now = performance.now();

    if (now - lastFireTime < BULLET_FIRE_INTERVAL_MS) {
      return false;
    }

    lastFireTime = now;
    return true;
  };

  const releaseHitRing = (sprite: PIXI.Sprite) => {
    sprite.visible = false;
    hitRingPool.push(sprite);
  };

  const updateEffects = () => {
    const elapsedMS = PIXI.Ticker.shared.elapsedMS;

    for (let i = activeMuzzleFlashes.length - 1; i >= 0; i--) {
      const inst = activeMuzzleFlashes[i]!;
      inst.elapsed += elapsedMS;
      const progress = Math.min(inst.elapsed / 160, 1);
      inst.core.scale.set(0.65 + progress * 0.25, 0.65 + progress * 0.75);
      inst.core.alpha = 1 - progress;
      inst.flash.scale.set(1.0 + progress * 0.8, 1.0 + progress * 1.8);
      inst.flash.alpha = 1 - progress * 1.2;
      if (progress >= 1) {
        activeMuzzleFlashes.splice(i, 1);
        releaseMuzzleFlash(inst);
      }
    }

    for (let i = activeClickMarkers.length - 1; i >= 0; i--) {
      const inst = activeClickMarkers[i]!;
      inst.elapsed += elapsedMS;
      const progress = Math.min(inst.elapsed / 240, 1);
      const eased = easeOutExpo(progress);
      inst.sprite.scale.set(0.78 + eased * 0.3);
      inst.sprite.alpha = 1 - eased;
      if (progress >= 1) {
        activeClickMarkers.splice(i, 1);
        releaseClickMarker(inst.sprite);
      }
    }

    for (let i = activeHitRings.length - 1; i >= 0; i--) {
      const inst = activeHitRings[i]!;
      inst.elapsed += elapsedMS;
      const progress = Math.min(inst.elapsed / 400, 1);
      const eased = easeOutExpo(progress);
      inst.sprite.scale.set(0.1 + eased * 1.4);
      inst.sprite.alpha = Math.max(0, 1 - eased * 0.3);
      if (progress >= 1) {
        activeHitRings.splice(i, 1);
        releaseHitRing(inst.sprite);
      }
    }
  };

  PIXI.Ticker.shared.add(updateEffects);

  const playMuzzleFlash = (rotation: number) => {
    const muzzle = getMuzzlePosition(rotation);
    const offset = 25;
    const posX = muzzle.x + Math.sin(rotation) * offset;
    const posY = muzzle.y - Math.cos(rotation) * offset;

    const inst = acquireMuzzleFlash();
    inst.elapsed = 0;
    const flashCore = inst.core;
    const flash = inst.flash;

    flashCore.position.set(posX, posY);
    flashCore.rotation = rotation;
    flashCore.scale.set(0.65);
    flashCore.alpha = 1;
    flash.position.set(posX, posY);
    flash.rotation = rotation;
    flash.scale.set(1.0);
    flash.alpha = 1;
    activeMuzzleFlashes.push(inst);
  };

  // energy circle
  const energyCircle = new PIXI.Sprite(
    requireTexture(CANNON_ATLAS_URL, "energy_circle.png"),
  );
  energyCircle.anchor.set(0.5, 0.5);
  energyCircle.position.set(0, 0);
  energyCircle.alpha = 0;
  energyCircle.visible = false;
  energyCircle.zIndex = 1;

  const burstSprite = new PIXI.Sprite(
    requireTexture(CANNON_ATLAS_URL, "ef_bb_01.png"),
  );
  burstSprite.anchor.set(0.5, 0.5);
  burstSprite.position.set(0, cannonCenterY + BURST_Y_OFFSET);
  burstSprite.alpha = 0;
  burstSprite.visible = false;
  burstSprite.zIndex = 4;

  const framefxSprite = new PIXI.Sprite(
    requireTexture(CANNON_ATLAS_URL, "framefx.png"),
  );
  framefxSprite.anchor.set(0.5, 0.5);
  framefxSprite.position.set(0, cannonCenterY + BURST_Y_OFFSET);
  framefxSprite.alpha = 0;
  framefxSprite.visible = false;
  framefxSprite.zIndex = 5;

  let burstOnTick: (() => void) | null = null;

  const playBurstEffect = () => {
    if (burstOnTick) {
      PIXI.Ticker.shared.remove(burstOnTick);
      burstOnTick = null;
    }
    cannonSprite.scale.set(1.3);
    burstSprite.visible = true;
    framefxSprite.visible = true;
    energyCircle.visible = true;
    burstSprite.scale.set(1.5);
    framefxSprite.scale.set(2.0);
    energyCircle.scale.set(1.0);
    burstSprite.alpha = 1;
    framefxSprite.alpha = 1;
    energyCircle.alpha = 1;
    energyCircle.rotation = 0;

    let frameIdx = 0;
    let elapsed = 0;
    const TOTAL_DURATION = 300;
    const FRAME_DURATION = 50;

    burstOnTick = () => {
      elapsed += PIXI.Ticker.shared.elapsedMS;
      const progress = Math.min(elapsed / TOTAL_DURATION, 1);
      const eased = easeOutExpo(progress);
      cannonSprite.scale.set(1.3 - eased * 0.3);
      const newFrameIdx =
        Math.floor(elapsed / FRAME_DURATION) % BURST_FRAMES.length;
      if (newFrameIdx !== frameIdx) {
        frameIdx = newFrameIdx;
        burstSprite.texture = burstTextures[frameIdx % burstTextures.length]!;
      }
      burstSprite.scale.set(1.5 + eased * 2.0);
      burstSprite.alpha = 1 - eased;
      framefxSprite.scale.set(2.0 + eased * 2.0);
      framefxSprite.alpha = Math.max(0, 1 - progress * 3);
      energyCircle.scale.set(1.0 + eased * 7.0);
      energyCircle.rotation += 0.04;
      const ringFade = progress < 0.15 ? 1 : 1 - (progress - 0.15) / 0.85;
      energyCircle.alpha = Math.max(0, ringFade);
      if (progress >= 1) {
        PIXI.Ticker.shared.remove(burstOnTick!);
        burstOnTick = null;
        burstSprite.visible = false;
        framefxSprite.visible = false;
        energyCircle.visible = false;
        cannonSprite.scale.set(1.0);
      }
    };
    PIXI.Ticker.shared.add(burstOnTick);
  };

  const playClickMarker = (x: number, y: number) => {
    const marker = acquireClickMarker();
    marker.position.set(x, y);
    marker.scale.set(0.78);
    marker.alpha = 1;
    activeClickMarkers.push({ sprite: marker, elapsed: 0 });
  };

  // --- Hit net ---
  const playHitRing = (x: number, y: number, level: CannonLevel) => {
    const ring = acquireHitRing(level);
    ring.position.set(x, y);
    ring.scale.set(0.1);
    ring.alpha = 1;
    activeHitRings.push({ sprite: ring, elapsed: 0, level });
  };

  // ============================================================
  // --- Bullet system (refactored for performance) ---
  // ============================================================

  type BulletInstance = {
    sprite: PIXI.Sprite;
    vx: number;
    vy: number;
    bet: number;
    level: CannonLevel;
  };

  const activeBullets: BulletInstance[] = [];
  const bulletPool: BulletInstance[] = [];

  let hitScratchCapacity = 0;
  let hitScratch: BulletCollisionTarget[] = [];

  const bulletLocalPoint = new PIXI.Point();
  const bulletGlobalPoint = new PIXI.Point();

  const ensureCapacity = (n: number) => {
    if (n <= hitScratchCapacity) return;
    hitScratchCapacity = n;
    hitScratch = new Array(n);
  };

  const acquireBullet = (
    texture: PIXI.Texture,
    bet: number,
    level: CannonLevel,
  ): BulletInstance => {
    const pooled = bulletPool.pop();
    if (pooled) {
      pooled.sprite.texture = texture;
      pooled.sprite.visible = true;
      pooled.sprite.alpha = 1;
      pooled.sprite.scale.set(0.7);
      pooled.sprite.rotation = 0;
      pooled.vx = 0;
      pooled.vy = 0;
      pooled.bet = bet;
      pooled.level = level;
      return pooled;
    }
    const sprite = new PIXI.Sprite(texture);
    sprite.anchor.set(0.5, 0.5);
    sprite.scale.set(0.7);
    sprite.zIndex = BULLET_Z_INDEX;
    container.addChild(sprite);
    return { sprite, vx: 0, vy: 0, bet, level };
  };

  const releaseBullet = (inst: BulletInstance) => {
    inst.sprite.visible = false;
    inst.sprite.alpha = 1;
    inst.sprite.rotation = 0;
    inst.vx = 0;
    inst.vy = 0;
    bulletPool.push(inst);
  };

  let reservedCoins = 0;

  const getSpendableCoins = () => {
    const currentCoins =
      options?.getCurrentCoins?.() ?? Number.POSITIVE_INFINITY;
    return Math.max(0, currentCoins - reservedCoins);
  };

  const reserveCoinsForShot = (bet: number) => {
    reservedCoins += bet;
    options?.onCoinsSpent?.(bet, getSpendableCoins());
  };

  const releaseCoinsForShot = (bet: number) => {
    reservedCoins = Math.max(0, reservedCoins - bet);
  };

  const bounceBulletWithinPlayfield = (inst: BulletInstance) => {
    const { sprite } = inst;
    const halfWidth = sprite.width * 0.5;
    const halfHeight = sprite.height * 0.5;
    const minX = -playfieldWidth / 2 + halfWidth;
    const maxX = playfieldWidth / 2 - halfWidth;
    const minY = -playfieldHeight + halfHeight;
    const maxY = -halfHeight;

    let bounced = false;

    if (sprite.x <= minX) {
      sprite.x = minX;
      inst.vx = Math.abs(inst.vx);
      bounced = true;
    } else if (sprite.x >= maxX) {
      sprite.x = maxX;
      inst.vx = -Math.abs(inst.vx);
      bounced = true;
    }

    if (sprite.y <= minY) {
      sprite.y = minY;
      inst.vy = Math.abs(inst.vy);
      bounced = true;
    } else if (sprite.y >= maxY) {
      sprite.y = maxY;
      inst.vy = -Math.abs(inst.vy);
      bounced = true;
    }

    if (bounced) {
      sprite.rotation = Math.atan2(inst.vy, inst.vx) + Math.PI / 2;
    }
  };

  // Runs on an actual hit only — not the per-frame hot path — so allocations here are fine.
  const resolveBulletHit = (
    hitTargets: BulletCollisionTarget[],
    hitCount: number,
    localX: number,
    localY: number,
    bet: number,
    level: CannonLevel,
  ) => {
    for (let k = 0; k < hitCount; k++) {
      hitTargets[k]!.onHit?.();
    }

    playHitRing(localX, localY, level);

    bulletLocalPoint.set(localX, localY);
    const worldHit = container.toGlobal(bulletLocalPoint, bulletGlobalPoint);
    const layer = container.parent as PIXI.Container;
    const layerPos = layer ? layer.toLocal(worldHit) : worldHit;
    void layerPos; // kept for parity with original (unused beyond original scope)

    let betRequestStarted = false;

    for (let k = 0; k < hitCount; k++) {
      const target = hitTargets[k]!;
      const fish = target.fishData;
      const fishTypeId = fish?.id ?? null;
      if (!fishTypeId) continue;

      const cannonTypeId = options?.resolveCannonTypeId?.(bet) ?? null;
      if (!cannonTypeId) continue;

      betRequestStarted = true;

      const rewardLayer = options?.getRewardLayer?.() ?? layer ?? container;
      const rewardPos = rewardLayer.toLocal(worldHit);

      void options
        ?.onFishHitResolved?.({ fishTypeId, cannonTypeId, target })
        .then((result) => {
          if (!result) return;

          if (result.isKill) {
            const hittedFish = getFishById(fishTypeId);
            const amount = result.killReward || 0;
            if (amount <= 0) return;

            gameAudio.playSoundEffect("coinReward");

            if (hittedFish?.is_boss) {
              showBossCatchEffect({
                layer: rewardLayer,
                x: rewardPos.x,
                y: rewardPos.y,
                fishId: fishTypeId,
                maxKillOdd: hittedFish.max_kill_odd ?? 0,
                winOdd: amount / bet,
                lang: "km",
              });
            } else {
              const multiplier = bet > 0 ? amount / bet : 0;
              const pattern =
                amount <= 10
                  ? "single"
                  : amount <= 50
                    ? "ring"
                    : multiplier >= 20
                      ? "star"
                      : amount <= 200
                        ? "filled_circle"
                        : "diamond";

              showRewardEffect({
                layer: rewardLayer,
                x: rewardPos.x,
                y: rewardPos.y,
                amount,
                pattern,
                boxTarget: options?.getCoinBoxPosition?.(),
              });
            }
          }

          if (result.isReward) {
            const rewardAmount = result.reward || 0;
            if (rewardAmount > 0) {
              gameAudio.playSoundEffect("specialAddCoin");

              const margin = 150;
              const randX = () =>
                (Math.random() + Math.random() + Math.random()) / 3;
              const randY = () =>
                (Math.random() + Math.random() + Math.random()) / 3;

              const missX = margin + randX() * (GAME_WIDTH - margin * 2);
              const missY = margin + randY() * (GAME_HEIGHT - margin * 2);

              showFishMissRewardEffect({
                layer: rewardLayer,
                x: rewardPos.x,
                y: rewardPos.y,
                amount: rewardAmount,
                fishId: fishTypeId,
                fishName: fish?.fish_type_name || "Unknown",
                rewardX: missX,
                rewardY: missY,
              });
            }
          }

          if (result.isJackpot) {
            gameAudio.playSoundEffect("specialCoin");
            showBigRewardEffect({
              layer: rewardLayer,
              x: rewardPos.x,
              y: rewardPos.y,
              amount: result.jackpotReward || 0,
              boxTarget: options?.getCoinBoxPosition?.(),
              shakeTarget: options?.getShakeTarget?.() ?? undefined,
              screenWidth: GAME_WIDTH,
              screenHeight: GAME_HEIGHT,
            });
          }
        })
        .catch((err) => {
          console.error("[bet] fireBet failed", err);
        })
        .finally(() => {
          releaseCoinsForShot(bet);
        });

      break;
    }

    if (!betRequestStarted) {
      releaseCoinsForShot(bet);
    }
  };

  // Single shared per-frame update — replaces one-ticker-per-bullet.
  const updateBullets = () => {
    if (activeBullets.length === 0) return;

    const elapsedMS = PIXI.Ticker.shared.elapsedMS;
    const deltaSeconds = elapsedMS / 1000;

    const worldScale = container.worldTransform.a;
    const netRadiusPx1 = netBaseRadii[1] * worldScale;
    const netRadiusPx2 = netBaseRadii[2] * worldScale;
    const netRadiusPx3 = netBaseRadii[3] * worldScale;

    const collisionTargets = options?.getCollisionTargets?.() ?? [];
    const targetCount = collisionTargets.length;

    ensureCapacity(targetCount);

    // Reverse iteration so mid-loop splice is safe.
    for (let i = activeBullets.length - 1; i >= 0; i--) {
      const inst = activeBullets[i]!;
      const sprite = inst.sprite;

      sprite.x += inst.vx * deltaSeconds;
      sprite.y += inst.vy * deltaSeconds;

      bounceBulletWithinPlayfield(inst);

      bulletLocalPoint.set(sprite.x, sprite.y);
      container.toGlobal(bulletLocalPoint, bulletGlobalPoint);
      const netRadiusPx =
        inst.level === 1
          ? netRadiusPx1
          : inst.level === 2
            ? netRadiusPx2
            : netRadiusPx3;
      const netRadiusSq = netRadiusPx * netRadiusPx;

      let hitCount = 0;
      for (let t = 0; t < targetCount; t++) {
        const target = collisionTargets[t]!;
        const ddx = bulletGlobalPoint.x - target.center.x;
        const ddy = bulletGlobalPoint.y - target.center.y;
        const distSq = ddx * ddx + ddy * ddy;
        const radiusSq = target.radius * target.radius;
        if (distSq <= radiusSq || distSq <= netRadiusSq) {
          hitScratch[hitCount++] = target;
        }
      }

      if (hitCount > 0) {
        // Bullet resolves exactly once: spliced + hidden here, in the same
        // reverse-iteration pass where the hit was detected.
        activeBullets.splice(i, 1);
        releaseBullet(inst);
        resolveBulletHit(
          hitScratch,
          hitCount,
          sprite.x,
          sprite.y,
          inst.bet,
          inst.level,
        );
      }
    }
  };

  PIXI.Ticker.shared.add(updateBullets);

  const fireBullet = (targetX: number, targetY: number) => {
    if (activeBullets.length >= MAX_ACTIVE_BULLETS) {
      return;
    }
    const bet = getBetStep(currentBetIndex);
    const level = getCannonLevel(bet);
    const rotation = getAimRotation(targetX, targetY);
    const muzzle = getMuzzlePosition(rotation);
    const startX = muzzle.x - Math.sin(rotation) * BULLET_START_INSET;
    const startY = muzzle.y + Math.cos(rotation) * BULLET_START_INSET;

    playMuzzleFlash(rotation);
    gameAudio.playSoundEffect("shoot");

    const inst = acquireBullet(bulletTextures[level], bet, level);
    const sprite = inst.sprite;

    sprite.position.set(startX, startY);
    sprite.rotation = rotation;

    const dx = targetX - startX;
    const dy = targetY - startY;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.0001);
    const velocityScale = BULLET_SPEED / dist;

    inst.vx = dx * velocityScale;
    inst.vy = dy * velocityScale;
    inst.bet = bet;
    inst.level = level;

    activeBullets.push(inst);
    return true;
  };

  // ============================================================
  // --- Bet buttons ---
  // ============================================================

  const betMinus = new PIXI.Sprite(
    requireTexture(UI_ATLAS_URL, "ui/bet_minus.png"),
  );
  betMinus.anchor.set(0.5, 0.5);
  betMinus.position.set(-85, betButtonsY);
  betMinus.zIndex = 6;

  const betBg = new PIXI.Sprite(requireTexture(UI_ATLAS_URL, "ui/bet_bg.png"));
  betBg.anchor.set(0.5, 0.5);
  betBg.position.set(0, betCenterY);
  betBg.zIndex = 6;

  const betValue = new PIXI.Text("10", {
    fill: 0xffffff,
    fontFamily: "monospace",
    fontSize: 18,
    fontWeight: "bold",
  });
  betValue.anchor.set(0.5, 0.5);
  betValue.position.set(0, betCenterY);
  betValue.zIndex = 6;

  const betPlus = new PIXI.Sprite(
    requireTexture(UI_ATLAS_URL, "ui/bet_plus.png"),
  );
  betPlus.anchor.set(0.5, 0.5);
  betPlus.position.set(85, betButtonsY);
  betPlus.zIndex = 6;

  const updateBetUi = (animate = false) => {
    const currentBet = getBetStep(currentBetIndex);
    const currentLevel = getCannonLevel(currentBet);
    betValue.text = String(currentBet);
    cannonSprite.texture = cannonTextures[currentLevel];
    if (animate) playBurstEffect();
  };

  betMinus.eventMode = "static";
  betMinus.cursor = "pointer";
  betMinus.on("pointertap", (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    currentBetIndex =
      (currentBetIndex - 1 + BET_STEPS.length) % BET_STEPS.length;
    updateBetUi(true);
    gameAudio.playSoundEffect("uiClick");
  });

  betPlus.eventMode = "static";
  betPlus.cursor = "pointer";
  betPlus.on("pointertap", (e: PIXI.FederatedPointerEvent) => {
    e.stopPropagation();
    currentBetIndex = (currentBetIndex + 1) % BET_STEPS.length;
    updateBetUi(true);
    gameAudio.playSoundEffect("uiClick");
  });

  updateBetUi(false);

  // --- Container interaction ---
  container.eventMode = "static";
  container.hitArea = new PIXI.Rectangle(-4000, -4000, 8000, 8000);

  container.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
    const local = container.toLocal(e.global);
    aimCannonAt(local.x, local.y);
  });

  // container.on("pointertap", (e: PIXI.FederatedPointerEvent) => {
  //   if (options?.isInputBlocked?.()) {
  //     return;
  //   }
  //   const local = container.toLocal(e.global);
  //   const currentBet = getBetStep(currentBetIndex);
  //   const currentCoins =
  //     options?.getCurrentCoins?.() ?? Number.POSITIVE_INFINITY;
  //   const spendableCoins = Math.max(0, currentCoins - reservedCoins);

  //   if (currentCoins < currentBet) {
  //     options?.onInsufficientBalance?.(currentBet, currentCoins);
  //     return;
  //   }

  //   if (spendableCoins < currentBet) {
  //     return;
  //   }

  //   aimCannonAt(local.x, local.y);
  //   playClickMarker(local.x, local.y);
  //   reserveCoinsForShot(currentBet);
  //   fireBullet(local.x, local.y);
  // });

  container.on("pointertap", (e: PIXI.FederatedPointerEvent) => {
    if (options?.isInputBlocked?.()) {
      return;
    }

    const local = container.toLocal(e.global);
    const currentBet = getBetStep(currentBetIndex);

    const currentCoins =
      options?.getCurrentCoins?.() ?? Number.POSITIVE_INFINITY;

    const spendableCoins = Math.max(0, currentCoins - reservedCoins);

    if (currentCoins < currentBet) {
      options?.onInsufficientBalance?.(currentBet, currentCoins);
      return;
    }

    if (spendableCoins < currentBet) {
      return;
    }

    // Check fire rate only after validation
    if (!canFireBullet()) {
      return;
    }

    aimCannonAt(local.x, local.y);
    playClickMarker(local.x, local.y);

    if (!fireBullet(local.x, local.y)) {
      return;
    }

    reserveCoinsForShot(currentBet);
  });

  container.addChild(
    energyCircle,
    base,
    cannonSprite,
    burstSprite,
    framefxSprite,
    betMinus,
    betBg,
    betValue,
    betPlus,
  );

  const destroy = () => {
    if (burstOnTick) {
      PIXI.Ticker.shared.remove(burstOnTick);
      burstOnTick = null;
    }

    PIXI.Ticker.shared.remove(updateBullets);
    PIXI.Ticker.shared.remove(updateEffects);

    activeBullets.length = 0;
    bulletPool.length = 0;
    activeMuzzleFlashes.length = 0;
    muzzleFlashPool.length = 0;
    activeClickMarkers.length = 0;
    clickMarkerPool.length = 0;
    activeHitRings.length = 0;
    hitRingPool.length = 0;

    container.destroy({ children: true });
  };

  return { container, destroy, setPlayfieldSize };
}

//── Kill animation ─────────────────────────────────────────────────────────

export function playFishKillAnimation(
  displayObject: PIXI.DisplayObject,
  onComplete?: () => void,
) {
  const obj = displayObject as PIXI.Container;

  if (!obj || obj.destroyed) {
    onComplete?.();
    return;
  }

  const startY = obj.y;
  const JUMP_H = 55;
  const DURATION = 600;
  let elapsed = 0;

  const onTick = () => {
    elapsed += PIXI.Ticker.shared.elapsedMS;

    if (obj.destroyed) {
      PIXI.Ticker.shared.remove(onTick);
      onComplete?.();
      return;
    }

    const t = Math.min(elapsed / DURATION, 1);
    const arc = Math.sin(t * Math.PI * 1.25) * JUMP_H;
    const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;

    obj.y = startY - arc;
    obj.alpha = Math.max(0, fade);

    if (t >= 1) {
      PIXI.Ticker.shared.remove(onTick);
      obj.y = startY;
      obj.alpha = 0;
      onComplete?.();
    }
  };

  PIXI.Ticker.shared.add(onTick);
}
