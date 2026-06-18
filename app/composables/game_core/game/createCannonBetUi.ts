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
    requireTexture(
      CANNON_ATLAS_URL,
      getCannonFrameName(getCannonLevel(getBetStep(currentBetIndex))),
    ),
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

  const playMuzzleFlash = (rotation: number) => {
    const muzzle = getMuzzlePosition(rotation);

    const offset = 25; // push fire forward (adjust 20–40 for perfect look)

    const posX = muzzle.x + Math.sin(rotation) * offset;
    const posY = muzzle.y - Math.cos(rotation) * offset;

    // 🔥 big core flame
    const flashCore = new PIXI.Sprite(
      requireTexture(CANNON_ATLAS_URL, "fire_03-4.png"),
    );
    flashCore.anchor.set(0.5, 0.9);
    flashCore.position.set(posX, posY);
    flashCore.rotation = rotation;
    flashCore.scale.set(0.65);
    flashCore.alpha = 1;
    flashCore.zIndex = 5;
    flashCore.blendMode = PIXI.BLEND_MODES.ADD;

    container.addChild(flashCore);

    // 🔥 small burst flame
    const flash = new PIXI.Sprite(
      requireTexture(CANNON_ATLAS_URL, "fire_1.png"),
    );
    flash.anchor.set(0.5, 0.9);
    flash.position.set(posX, posY);
    flash.rotation = rotation;
    flash.scale.set(1.0);
    flash.alpha = 1;
    flash.zIndex = 5;
    flash.blendMode = PIXI.BLEND_MODES.ADD;

    container.addChild(flash);

    let elapsed = 0;
    const DURATION = 160;
    const onFlash = () => {
      elapsed += PIXI.Ticker.shared.elapsedMS;
      const progress = Math.min(elapsed / DURATION, 1);
      flashCore.scale.set(0.65 + progress * 0.25, 0.65 + progress * 0.75);
      flashCore.alpha = 1 - progress;
      flash.scale.set(1.0 + progress * 0.8, 1.0 + progress * 1.8);
      flash.alpha = 1 - progress * 1.2;
      if (progress >= 1) {
        PIXI.Ticker.shared.remove(onFlash);
        container.removeChild(flash);
        container.removeChild(flashCore);
        flash.destroy();
        flashCore.destroy();
      }
    };
    PIXI.Ticker.shared.add(onFlash);
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

  // burst effect sprite
  const burstSprite = new PIXI.Sprite(
    requireTexture(CANNON_ATLAS_URL, "ef_bb_01.png"),
  );
  burstSprite.anchor.set(0.5, 0.5);
  burstSprite.position.set(0, cannonCenterY + BURST_Y_OFFSET);
  burstSprite.alpha = 0;
  burstSprite.visible = false;
  burstSprite.zIndex = 4;

  // framefx flash sprite
  const framefxSprite = new PIXI.Sprite(
    requireTexture(CANNON_ATLAS_URL, "framefx.png"),
  );
  framefxSprite.anchor.set(0.5, 0.5);
  framefxSprite.position.set(0, cannonCenterY + BURST_Y_OFFSET);
  framefxSprite.alpha = 0;
  framefxSprite.visible = false;
  framefxSprite.zIndex = 5;

  let burstOnTick: (() => void) | null = null;

  // playBurstEffect — replace burstTicker
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
        burstSprite.texture = requireTexture(
          CANNON_ATLAS_URL,
          BURST_FRAMES[frameIdx % BURST_FRAMES.length]!,
        );
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
    const marker = new PIXI.Sprite(
      requireTexture(UI_ATLAS_URL, "ui/mouse_position.png"),
    );
    marker.anchor.set(0.5, 0.5);
    marker.position.set(x, y);
    marker.scale.set(0.78);
    marker.alpha = 1;
    marker.zIndex = 9;
    container.addChild(marker);

    let elapsed = 0;
    const DURATION = 240;
    const onMarker = () => {
      elapsed += PIXI.Ticker.shared.elapsedMS;
      const progress = Math.min(elapsed / DURATION, 1);
      const eased = easeOutExpo(progress);
      marker.scale.set(0.78 + eased * 0.3);
      marker.alpha = 1 - eased;
      if (progress >= 1) {
        PIXI.Ticker.shared.remove(onMarker);
        container.removeChild(marker);
        marker.destroy();
      }
    };
    PIXI.Ticker.shared.add(onMarker);
  };

  // --- Hit net ---
  const playHitRing = (x: number, y: number, level: CannonLevel) => {
    const ring = new PIXI.Sprite(
      requireTexture(BULLET_ATLAS_URL, getNetFrameName(level)),
    );
    ring.anchor.set(0.5, 0.5);
    ring.position.set(x, y);
    ring.scale.set(0.1);
    ring.alpha = 1;
    ring.zIndex = 8;
    container.addChild(ring);

    let elapsed = 0;
    const DURATION = 400;
    const onRing = () => {
      elapsed += PIXI.Ticker.shared.elapsedMS;
      const p = Math.min(elapsed / DURATION, 1);
      const eased = easeOutExpo(p);
      ring.scale.set(0.1 + eased * 1.4);
      ring.alpha = Math.max(0, 1 - eased * 0.3);
      if (p >= 1) {
        PIXI.Ticker.shared.remove(onRing);
        container.removeChild(ring);
        ring.destroy();
      }
    };
    PIXI.Ticker.shared.add(onRing);
  };

  // --- Bullet ---
  type BulletInstance = {
    sprite: PIXI.Sprite;
    ticker: PIXI.Ticker;
    vx: number;
    vy: number;
  };

  const activeBullets: BulletInstance[] = [];
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

  const destroyBullet = (inst: BulletInstance) => {
    // with shared ticker, nothing to destroy on ticker itself
    const idx = activeBullets.indexOf(inst);
    if (idx !== -1) activeBullets.splice(idx, 1);
    if (inst.sprite.parent === container) container.removeChild(inst.sprite);
    inst.sprite.destroy();
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

  // Replace all individual tickers in fireBullet with shared ticker
  const fireBullet = (targetX: number, targetY: number) => {
    const level = getCannonLevel(getBetStep(currentBetIndex));
    const rotation = getAimRotation(targetX, targetY);
    const muzzle = getMuzzlePosition(rotation);
    const startX = muzzle.x - Math.sin(rotation) * BULLET_START_INSET;
    const startY = muzzle.y + Math.cos(rotation) * BULLET_START_INSET;
    playMuzzleFlash(rotation);
    gameAudio.playSoundEffect("shoot");

    const sprite = new PIXI.Sprite(
      requireTexture(BULLET_ATLAS_URL, getBulletFrameName(level)),
    );
    sprite.anchor.set(0.5, 0.5);
    sprite.position.set(startX, startY);
    sprite.scale.set(0.7);
    sprite.zIndex = BULLET_Z_INDEX;
    container.addChild(sprite);

    const dx = targetX - startX;
    const dy = targetY - startY;
    sprite.rotation = rotation;
    const dist = Math.max(Math.sqrt(dx * dx + dy * dy), 0.0001);
    const velocityScale = BULLET_SPEED / dist;

    const inst: BulletInstance = {
      sprite,
      ticker: PIXI.Ticker.shared, // ← shared ticker
      vx: dx * velocityScale,
      vy: dy * velocityScale,
    };

    const onTick = () => {
      if (sprite.destroyed) {
        PIXI.Ticker.shared.remove(onTick);
        return;
      }

      const deltaSeconds = PIXI.Ticker.shared.elapsedMS / 1000;
      sprite.x += inst.vx * deltaSeconds;
      sprite.y += inst.vy * deltaSeconds;
      bounceBulletWithinPlayfield(inst);

      const bulletGlobal = container.toGlobal(
        new PIXI.Point(sprite.x, sprite.y),
      );
      const collisionTargets = options?.getCollisionTargets?.() ?? [];
      const level = getCannonLevel(getBetStep(currentBetIndex));
      const netTexture = requireTexture(
        BULLET_ATLAS_URL,
        getNetFrameName(level),
      );
      const worldScale = container.worldTransform.a;
      const netRadiusPx = netTexture.width * 0.6 * worldScale;

      const hitTargets = collisionTargets.filter((target) => {
        const dx = bulletGlobal.x - target.center.x;
        const dy = bulletGlobal.y - target.center.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        return dist <= target.radius || dist <= netRadiusPx;
      });

      if (hitTargets.length > 0) {
        for (const target of hitTargets) target.onHit?.();
        playHitRing(sprite.x, sprite.y, level);

        const worldHit = container.toGlobal(new PIXI.Point(sprite.x, sprite.y));
        const layer = container.parent as PIXI.Container;
        const layerPos = layer ? layer.toLocal(worldHit) : worldHit;
        const bet = getBetStep(currentBetIndex);
        let betRequestStarted = false;

        // NOW safe to remove/destroy
        PIXI.Ticker.shared.remove(onTick);
        const idx = activeBullets.indexOf(inst);
        if (idx !== -1) activeBullets.splice(idx, 1);
        if (sprite.parent) sprite.parent.removeChild(sprite);
        sprite.destroy();

        // console.log("[bullet] HIT detected", {
        //   bulletGlobal: { x: worldHit.x.toFixed(2), y: worldHit.y.toFixed(2) },
        //   layerPos: { x: layerPos.x.toFixed(2), y: layerPos.y.toFixed(2) },
        //   hitCount: hitTargets.length,
        //   fishs: hitTargets.map((t) => ({
        //     hasFishData: !!t.fishData,
        //     fishData: t.fishData,
        //   })),
        // });

        // reward + backend bet using first hit target with fish id
        for (const target of hitTargets) {
          const fish = target.fishData;
          const fishTypeId = fish?.id ?? null;
          if (!fishTypeId) continue;
          const cannonTypeId = options?.resolveCannonTypeId?.(bet) ?? null;
          if (!cannonTypeId) continue;
          betRequestStarted = true;

          // ── use dedicated reward layer, fallback to parent ───────────
          const rewardLayer = options?.getRewardLayer?.() ?? layer ?? container;
          const rewardPos = rewardLayer.toLocal(worldHit);

          void options
            ?.onFishHitResolved?.({
              fishTypeId,
              cannonTypeId,
              target,
            })
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
                  if (amount >= 500) {
                    showBigRewardEffect({
                      layer: rewardLayer,
                      x: rewardPos.x,
                      y: rewardPos.y,
                      amount,
                      boxTarget: options?.getCoinBoxPosition?.(),
                    });
                    return;
                  }

                  showRewardEffect({
                    layer: rewardLayer,
                    x: rewardPos.x,
                    y: rewardPos.y,
                    amount,
                    boxTarget: options?.getCoinBoxPosition?.(),
                  });
                }
              }
              if (result.isReward) {
                const rewardAmount = result.reward || 0;
                if (rewardAmount > 0) {
                  gameAudio.playSoundEffect("coinReward");
                  // Random position biased toward center of screen
                  // rewardLayer coords: 0,0 top-left to GAME_WIDTH,GAME_HEIGHT bottom-right
                  const margin = 150; // keep away from edges

                  // Gaussian-ish: average of 3 randoms pulls toward center
                  const randX = () =>
                    (Math.random() + Math.random() + Math.random()) / 3;
                  const randY = () =>
                    (Math.random() + Math.random() + Math.random()) / 3;

                  const missX = margin + randX() * (GAME_WIDTH - margin * 2);
                  const missY = margin + randY() * (GAME_HEIGHT - margin * 2);

                  // Convert from fishLayer coords to rewardLayer coords
                  // Both are the same layer so no conversion needed
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
                gameAudio.playSoundEffect("coinReward");
                showBigRewardEffect({
                  layer: rewardLayer,
                  x: rewardPos.x,
                  y: rewardPos.y,
                  amount: result.jackpotReward || 0,
                  boxTarget: options?.getCoinBoxPosition?.(),
                });
              }
              // playFishKillAnimation()
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
      }
    };

    PIXI.Ticker.shared.add(onTick);
    activeBullets.push(inst);
  };

  // --- Bet buttons ---
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
    cannonSprite.texture = requireTexture(
      CANNON_ATLAS_URL,
      getCannonFrameName(currentLevel),
    );
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
  // Keep pointer input available across the whole visible playfield
  // even after the container is scaled or rotated by the scene.
  container.hitArea = new PIXI.Rectangle(-4000, -4000, 8000, 8000);

  container.on("pointermove", (e: PIXI.FederatedPointerEvent) => {
    const local = container.toLocal(e.global);
    aimCannonAt(local.x, local.y);
  });

  container.on("pointertap", (e: PIXI.FederatedPointerEvent) => {
    if (options?.isInputBlocked?.()) {
      return;
    }
    // don't fire if tapping bet buttons
    const local = container.toLocal(e.global);
    const currentBet = getBetStep(currentBetIndex);
    const currentCoins = getSpendableCoins();

    if (currentCoins < currentBet) {
      options?.onInsufficientBalance?.(currentBet, currentCoins);
      return;
    }
    aimCannonAt(local.x, local.y);
    playClickMarker(local.x, local.y);
    reserveCoinsForShot(currentBet);
    fireBullet(local.x, local.y);
  });

  // add all children
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
    for (const b of [...activeBullets]) destroyBullet(b);
    activeBullets.length = 0;
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

  const JUMP_H = 55; // px upward at peak

  const DURATION = 600; // ms total

  let elapsed = 0;

  const onTick = () => {
    elapsed += PIXI.Ticker.shared.elapsedMS;

    if (obj.destroyed) {
      PIXI.Ticker.shared.remove(onTick);
      onComplete?.();
      return;
    }

    const t = Math.min(elapsed / DURATION, 1);

    // arc: sin curve peaks at t=0.4, back at baseline by t=0.8

    const arc = Math.sin(t * Math.PI * 1.25) * JUMP_H;

    // fade: hold full opacity until t=0.35, then fade out

    const fade = t < 0.35 ? 1 : 1 - (t - 0.35) / 0.65;

    obj.y = startY - arc;

    obj.alpha = Math.max(0, fade);

    if (t >= 1) {
      PIXI.Ticker.shared.remove(onTick);

      obj.y = startY; // restore for pool reuse

      obj.alpha = 0;

      onComplete?.();
    }
  };

  PIXI.Ticker.shared.add(onTick);
}
