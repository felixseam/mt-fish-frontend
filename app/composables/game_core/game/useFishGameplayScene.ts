import * as PIXI from "pixi.js";
import {
  createCannonBetUi,
  type BulletCollisionTarget,
} from "~/composables/game_core/game/createCannonBetUi";
import { useFishAssetPreload } from "~/composables/game_core/assets/useFishAssetPreload";
import {
  createFishContextMachine,
  type FishContextPerfOptions,
} from "~/composables/game_core/fish/useFishContextMachine";
import { createFishRendererFactory } from "~/composables/game_core/fish/useFishRendererFactory";
import { createCrocodileAmbient } from "~/composables/game_core/mapAmbient/useCrocodileAmbient";
import { createNagaAmbient } from "~/composables/game_core/mapAmbient/useNagaAmbient";
import { createNormalMapAmbient } from "~/composables/game_core/mapAmbient/useNormalMapAmbient";
import { createPhoenixAmbient } from "~/composables/game_core/mapAmbient/usePhoenixAmbient";
import {
  createMapTransitionManager,
  type MapTransitionMode,
} from "~/composables/game_core/mapTransition/useMapTransitionManager";
import { createFishInfoDialog } from "./createFishInfoDialog";
import { createPlayerProfileUi } from "./createPlayerProfileUi";
import { createMenuUi } from "./createMenuUi";
import { useMemberStore } from "~/stores/memberStore";
import { useFishSessionRuntime } from "./useFishSessionRuntime";
import { useGameAudio } from "~/composables/game_core/audio/useGameAudio";
import {
  getGameManifest,
  type GameManifest,
  type ManifestCannonType,
} from "~/composables/service/gameManifestApi";

type SceneDef = {
  id: string;
  label: string;
  backgroundUrl: string;
};

type SceneDisplay = {
  id: string;
  container: PIXI.Container;
  background: PIXI.Sprite;
  ambient: {
    container: PIXI.Container;
    setActive: (active: boolean) => void;
    destroy: () => void;
    setBackgroundTexture?: (source: PIXI.Texture | PIXI.Sprite | null) => void;
  } | null;
};

type FishDisplayObject = PIXI.DisplayObject & {
  __anim?: PIXI.DisplayObject;
  hitFlashTimeoutId?: number | null;
  hitFlashOriginalFilters?: PIXI.Filter[] | null;
  isDying?: boolean;
  __isDying?: boolean;
  __isDeadFish?: boolean;
};

type FishPerfDebugOptions = FishContextPerfOptions & {
  disableBullets?: boolean;
  disableRewards?: boolean;
  disableHitEffects?: boolean;
};

type PlayerBalance = {
  currencyId: number;
  code: string;
  amount: number;
};

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const BURN_NOISE_URL =
  "/fish/fish-all-star/resources/shader/noise_burn_out.png";
const BURN_COLOR_URL =
  "/fish/fish-all-star/resources/shader/burn_color_texture.png";
const NAGA_ATLAS_URL = "/fish/fish-all-star/resources/naga.atlas.txt";

const PROFILE_UI_X = 12;
const PROFILE_UI_Y = 12;
const PAUSE_RELOAD_THRESHOLD_MS = 30_000;
const DESKTOP_MAX_RESOLUTION = 2;
const IOS_MAX_RESOLUTION = 1.5;
const IOS_TARGET_RENDER_PIXELS = 950_000;

// Menu button placement
const MENU_BTN_MARGIN = 12;
const MENU_BTN_TOP_MARGIN = 30;
const MENU_BTN_SIZE_TOUCH = 88;
const isTouchLikeDevice =
  typeof window !== "undefined" &&
  ((window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ?? false) ||
    window.innerWidth < 900);

function isIOSWebKitDevice() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const platform = navigator.platform;
  const iPadOS =
    platform === "MacIntel" && typeof navigator.maxTouchPoints === "number" &&
    navigator.maxTouchPoints > 1;
  return /iP(hone|od|ad)/.test(platform) || /iP(hone|od|ad)/.test(ua) || iPadOS;
}

function getPixiRendererResolution(width: number, height: number) {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  if (!isIOSWebKitDevice()) return Math.min(dpr, DESKTOP_MAX_RESOLUTION);

  const cssPixels = Math.max(1, width * height);
  const pixelBudgetResolution = Math.sqrt(IOS_TARGET_RENDER_PIXELS / cssPixels);
  return Math.max(1, Math.min(dpr, IOS_MAX_RESOLUTION, pixelBudgetResolution));
}

function shouldLogFishPerf() {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return (
      params.has("fishPerf") ||
      window.localStorage.getItem("fishPerf") === "1" ||
      isIOSWebKitDevice()
    );
  } catch {
    return isIOSWebKitDevice();
  }
}

function getFishPerfFlag(name: string) {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name) ?? window.localStorage.getItem(name);
    return value === "1" || value === "true" || value === "";
  } catch {
    return false;
  }
}

function getFishPerfNumber(name: string) {
  if (typeof window === "undefined") return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const value = params.get(name) ?? window.localStorage.getItem(name);
    if (value == null || value.trim() === "") return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function getFishPerfDebugOptions(): FishPerfDebugOptions {
  const fishLimit = getFishPerfNumber("fishPerfFishLimit");
  return {
    enabled: shouldLogFishPerf(),
    disableFishAnimation: getFishPerfFlag("fishPerfDisableFishAnimation"),
    disableSpineAnimation: getFishPerfFlag("fishPerfDisableSpine"),
    fishLimit,
    disableBullets: getFishPerfFlag("fishPerfDisableBullets"),
    disableRewards: getFishPerfFlag("fishPerfDisableRewards"),
    disableHitEffects: getFishPerfFlag("fishPerfDisableHitEffects"),
  };
}

const scenes: SceneDef[] = [
  {
    id: "bg1",
    label: "Start",
    backgroundUrl: "/fish/fish-all-star/resources/background/bg1.webp",
  },
  {
    id: "bg2",
    label: "Normal 2",
    backgroundUrl: "/fish/fish-all-star/resources/background/bg2.webp",
  },
  {
    id: "crocodileBoss",
    label: "Crocodile",
    backgroundUrl: "/fish/fish-all-star/resources/background/bg_crocodile.png",
  },
  {
    id: "bg3",
    label: "Normal 3",
    backgroundUrl: "/fish/fish-all-star/resources/background/bg3.webp",
  },
  {
    id: "naga",
    label: "Naga",
    backgroundUrl: "/fish/fish-all-star/resources/background/bg_naga.webp",
  },
  {
    id: "phoenix",
    label: "Phoenix",
    backgroundUrl: "/fish/fish-all-star/resources/background/bg_phoenix.webp",
  },
];

export function useFishGameplayScene() {
  const sessionRuntime = useFishSessionRuntime();
  const memberStore = useMemberStore();
  const gameManifestStore = useGameManifestStore();
  const gameAudio = useGameAudio();
  const currentSceneId = ref(scenes[0]?.id ?? "bg1");
  const transitionMode = ref<MapTransitionMode>("normal");
  const currentSceneIndex = ref(0);
  const { getTexture, getEffectTexture, getAtlasTexture, getLocalizedTexture } =
    useFishAssetPreload();

  let mountedAtMs = 0;
  let pixiApp: PIXI.Application | null = null;
  let sceneRoot: PIXI.Container<PIXI.DisplayObject> | null = null;
  let backgroundLayer: PIXI.Container<PIXI.DisplayObject> | null = null;
  let fishLayer: PIXI.Container<PIXI.DisplayObject> | null = null;
  let bannerLayer: PIXI.Container<PIXI.DisplayObject> | null = null;
  let uiLayer: PIXI.Container<PIXI.DisplayObject> | null = null;
  let currentSceneDisplay: SceneDisplay | null = null;
  let cannonBetUi: Awaited<ReturnType<typeof createCannonBetUi>> | null = null;
  let playerProfileUi: Awaited<
    ReturnType<typeof createPlayerProfileUi>
  > | null = null;
  let pendingWhilePaused: Array<() => void> = [];
  let onSessionSyncLostHandler: (() => void) | null = null;

  let debugRect: PIXI.Graphics | null = null;

  function drawDebugRect() {
    if (!debugRect) return;
    debugRect.clear();

    debugRect.beginFill(0xff0000, 0.15);
    debugRect.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    debugRect.endFill();

    debugRect.lineStyle(6, 0x00ff00, 1);
    debugRect.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    const m = 40;
    debugRect.lineStyle(4, 0xffff00, 1);
    debugRect.moveTo(0, m).lineTo(0, 0).lineTo(m, 0);
    debugRect
      .moveTo(GAME_WIDTH - m, 0)
      .lineTo(GAME_WIDTH, 0)
      .lineTo(GAME_WIDTH, m);
    debugRect
      .moveTo(0, GAME_HEIGHT - m)
      .lineTo(0, GAME_HEIGHT)
      .lineTo(m, GAME_HEIGHT);
    debugRect
      .moveTo(GAME_WIDTH - m, GAME_HEIGHT)
      .lineTo(GAME_WIDTH, GAME_HEIGHT)
      .lineTo(GAME_WIDTH, GAME_HEIGHT - m);
  }

  let menuUi: Awaited<ReturnType<typeof createMenuUi>> | null = null;
  let fishInfoDialog: Awaited<ReturnType<typeof createFishInfoDialog>> | null =
    null;

  let burnNoiseTexture: PIXI.Texture | null = null;
  let burnColorTexture: PIXI.Texture | null = null;
  let contextMachine: ReturnType<typeof createFishContextMachine> | null = null;
  let isTransitionRunning = false;
  let activeTransitionPromise: Promise<void> | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let visibilityHandler: (() => void) | null = null;
  let windowBlurHandler: (() => void) | null = null;
  let windowFocusHandler: (() => void) | null = null;
  let isGamePausedByFocus = false;
  let isResizing = false;
  let uiChildScale = { x: 1, y: 1 };
  let fishChildScale = { x: 1, y: 1 };
  let pauseReloadTimer: ReturnType<typeof setTimeout> | null = null;
  let viewportRetryRaf: number | null = null;
  let perfTicker: (() => void) | null = null;
  let originalPixiRender: (() => void) | null = null;
  let lastRenderMs = 0;
  let worstRenderMs = 0;
  let collisionBuildMs = 0;
  let collisionBuildCount = 0;
  let resizeEventCount = 0;
  let rendererResizeCount = 0;

  let avatarClickHandler: (() => void) | null = null;

  // ── Multi-currency balance state ─────────────────────────────────────────
  // Replaces the old single `currentCoins` figure. Populated from
  // memberInfo.balances on mount and kept in sync via the watcher below.
  let currentBalances: PlayerBalance[] = [];
  // ── Game manifest (cannon types / bet amounts per currency, etc.) ───────
  let gameManifest: GameManifest | null = null;

  let menuHandlers: {
    onMute?: () => void;
    onInfo?: () => void;
    onNote?: () => void;
    onTransition?: () => void;
    onSetting?: () => void;
    onBell?: () => void;
    onLogout?: () => void;
  } = {};
  let sessionSyncLost = false;
  const perfDebugOptions = getFishPerfDebugOptions();

  function getElapsedSecondsString() {
    if (!mountedAtMs) return "0";
    return ((Date.now() - mountedAtMs) / 1000).toFixed(3);
  }

  function isNormalAmbientScene(sceneId: string) {
    return sceneId === "bg1" || sceneId === "bg2" || sceneId === "bg3";
  }

  function isNagaAmbientScene(sceneId: string) {
    return sceneId === "naga";
  }

  function isCrocodileAmbientScene(sceneId: string) {
    return sceneId === "crocodileBoss";
  }

  function isPhoenixAmbientScene(sceneId: string) {
    return sceneId === "phoenix";
  }

  function getBackgroundMusicForScene(sceneId: string) {
    if (sceneId === "crocodileBoss") return "bgmCrocodile" as const;
    if (sceneId === "phoenix") return "bgmPhoenix" as const;
    return "bgmMain" as const;
  }

  function syncBackgroundMusic(sceneId: string) {
    gameAudio.queueBackgroundMusic(getBackgroundMusicForScene(sceneId));
  }

  function createBackgroundSprite(url: string) {
    const texture = getTexture(url);
    const sprite = new PIXI.Sprite(texture);

    sprite.anchor.set(0.5);
    sprite.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    sprite.width = GAME_WIDTH;
    sprite.height = GAME_HEIGHT;

    return sprite;
  }

  function syncFishLayerToScene(sceneDisplay: SceneDisplay | null) {
    if (!sceneDisplay || !fishLayer) return;
  }

  let coinBoxWorldPosition: { x: number; y: number } | undefined = undefined;

  function updateCoinBoxPosition() {
    if (!playerProfileUi || !uiLayer || !fishLayer) {
      coinBoxWorldPosition = undefined;
      return;
    }

    const profileContainer = playerProfileUi.container;

    coinBoxWorldPosition = {
      x: PROFILE_UI_X + profileContainer.width * uiChildScale.x * 0.75,
      y: PROFILE_UI_Y + profileContainer.height * uiChildScale.y * 0.5,
    };
  }

  function createSceneDisplay(scene: SceneDef): SceneDisplay {
    const container = new PIXI.Container();
    const background = createBackgroundSprite(scene.backgroundUrl);
    container.addChild(background);

    let ambient: SceneDisplay["ambient"] = null;

    if (pixiApp && isNormalAmbientScene(scene.id)) {
      const normalAmbient = createNormalMapAmbient({
        app: pixiApp,
        getTexture,
        getEffectTexture,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      });
      normalAmbient.setBackgroundTexture(background);
      normalAmbient.setActive(true);
      container.addChild(normalAmbient.container);
      ambient = normalAmbient;
    } else if (pixiApp && isCrocodileAmbientScene(scene.id)) {
      const crocodileAmbient = createCrocodileAmbient({
        app: pixiApp,
        getTexture,
        getEffectTexture,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      });
      crocodileAmbient.setBackgroundTexture?.(background);
      crocodileAmbient.setActive(true);
      container.addChild(crocodileAmbient.container);
      ambient = crocodileAmbient;
    } else if (pixiApp && isNagaAmbientScene(scene.id)) {
      const nagaAmbient = createNagaAmbient({
        app: pixiApp,
        getTexture,
        getAtlasTexture: (frame) => getAtlasTexture(NAGA_ATLAS_URL, frame),
        getEffectTexture,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      });
      nagaAmbient.setBackgroundTexture?.(background);
      nagaAmbient.setActive(true);
      container.addChild(nagaAmbient.container);
      ambient = nagaAmbient;
    } else if (pixiApp && isPhoenixAmbientScene(scene.id)) {
      const phoenixAmbient = createPhoenixAmbient({
        app: pixiApp,
        getTexture,
        getEffectTexture,
        width: GAME_WIDTH,
        height: GAME_HEIGHT,
      });
      phoenixAmbient.setBackgroundTexture?.(background);
      phoenixAmbient.setActive(true);
      container.addChild(phoenixAmbient.container);
      ambient = phoenixAmbient;
    }

    return {
      id: scene.id,
      container,
      background,
      ambient,
    };
  }

  function destroySceneDisplay(sceneDisplay: SceneDisplay | null) {
    if (!sceneDisplay) return;
    sceneDisplay.ambient?.destroy();
    sceneDisplay.container.destroy({ children: true });
  }

  function layoutCannonUi() {
    if (!cannonBetUi) return;
    cannonBetUi.container.rotation = 0;
    cannonBetUi.container.scale.set(1, 1);
    cannonBetUi.container.position.set(GAME_WIDTH / 2, GAME_HEIGHT);
  }

  function layoutProfileUi() {
    if (!playerProfileUi) return;
    playerProfileUi.container.position.set(PROFILE_UI_X, PROFILE_UI_Y);
  }

  function layoutMenuUi() {
    if (!menuUi) return;

    if (isTouchLikeDevice) {
      // Top-right on iPhone / touch devices
      menuUi.container.position.set(
        GAME_WIDTH - MENU_BTN_SIZE_TOUCH - MENU_BTN_MARGIN,
        MENU_BTN_TOP_MARGIN,
      );
    } else {
      // Unchanged desktop position: left-middle
      menuUi.container.position.set(12, GAME_HEIGHT / 2 - 50);
    }
  }

  const sharedHitFlashFilter = new PIXI.ColorMatrixFilter();
  sharedHitFlashFilter.brightness(1.8, false);

  function flashFishHit(displayObject: PIXI.DisplayObject) {
    if (perfDebugOptions.disableHitEffects) return;
    const fishDisplay = displayObject as FishDisplayObject;
    if (fishDisplay.isDying || fishDisplay.__isDying) return;
    const flashTarget = fishDisplay.__anim ?? fishDisplay;
    if (!flashTarget) return;

    const targetWithFilters = flashTarget as PIXI.DisplayObject & {
      filters?: PIXI.Filter[] | null;
    };

    if (fishDisplay.hitFlashTimeoutId) {
      window.clearTimeout(fishDisplay.hitFlashTimeoutId);
      fishDisplay.hitFlashTimeoutId = null;
    } else {
      fishDisplay.hitFlashOriginalFilters = targetWithFilters.filters ?? null;
    }

    targetWithFilters.filters = [sharedHitFlashFilter];

    fishDisplay.hitFlashTimeoutId = window.setTimeout(() => {
      targetWithFilters.filters = fishDisplay.hitFlashOriginalFilters ?? null;
      fishDisplay.hitFlashTimeoutId = null;
      fishDisplay.hitFlashOriginalFilters = null;
    }, 90);
  }

  let cachedCollisionTargets: BulletCollisionTarget[] = [];
  let cachedCollisionFrame = -1;
  let lastCollisionTargetCount = 0;

  function getFishCollisionTargets(): BulletCollisionTarget[] {
    if (!fishLayer) return [];
    const collisionStart = shouldLogFishPerf() ? performance.now() : 0;
    const targets: BulletCollisionTarget[] = [];

    for (const child of fishLayer.children) {
      if ((child as any).__isRewardEffect) continue;
      if (
        (child as any).__isDeadFish ||
        (child as any).__isDying ||
        (child as any).isDying
      )
        continue;
      if (!child.visible || !child.renderable || !child.worldVisible) continue;

      const tagged = child as PIXI.DisplayObject & {
        __collisionRadius?: number;
      };
      const localRadius = tagged.__collisionRadius;
      if (!localRadius || localRadius <= 0) continue;

      const transform = child.worldTransform;
      const scaleX = Math.hypot(transform.a, transform.b);
      const scaleY = Math.hypot(transform.c, transform.d);
      const radius = localRadius * Math.max(scaleX, scaleY);
      if (!Number.isFinite(radius) || radius <= 0) continue;

      const centerX = transform.tx;
      const centerY = transform.ty;
      const fishData =
        (child as any).fishData ?? (child as any).__fishData ?? null;

      targets.push({
        bounds: {
          x: centerX - radius,
          y: centerY - radius,
          width: radius * 2,
          height: radius * 2,
        },
        center: { x: centerX, y: centerY },
        radius,
        display: child,
        onHit: () => flashFishHit(child),
        fishData: fishData
          ? {
            kill_rate_modifier: fishData.kill_rate_modifier,
            id: fishData.id,
            min_reward_odd: fishData.min_odd,
            max_reward_odd: fishData.max_odd,
            fish_type_name: fishData.fish_type_name,
          }
          : null,
      });
    }

    lastCollisionTargetCount = targets.length;
    if (shouldLogFishPerf()) {
      collisionBuildMs += performance.now() - collisionStart;
      collisionBuildCount += 1;
    }
    return targets;
  }

  function getCachedCollisionTargets(): BulletCollisionTarget[] {
    const frame = pixiApp?.ticker.lastTime ?? 0;
    if (frame === cachedCollisionFrame) return cachedCollisionTargets;
    cachedCollisionFrame = frame;
    cachedCollisionTargets = getFishCollisionTargets();
    return cachedCollisionTargets;
  }

  function applySceneViewport() {
    if (!pixiApp || !sceneRoot) return;
    if (isResizing) return;

    const canvas = pixiApp.view as HTMLCanvasElement;
    const cont = canvas.parentElement as HTMLElement;
    const screenW = cont.clientWidth;
    const screenH = cont.clientHeight;

    if (screenW <= 0 || screenH <= 0) {
      console.warn(
        `[viewport] skipped resize with invalid size ${screenW}x${screenH}`,
      );
      if (viewportRetryRaf == null) {
        viewportRetryRaf = requestAnimationFrame(() => {
          viewportRetryRaf = null;
          applySceneViewport();
        });
      }
      return;
    }

    if (viewportRetryRaf != null) {
      cancelAnimationFrame(viewportRetryRaf);
      viewportRetryRaf = null;
    }

    isResizing = true;

    const isPortrait = screenH > screenW;
    const renderWidth = isPortrait ? screenH : screenW;
    const renderHeight = isPortrait ? screenW : screenH;
    const nextResolution = getPixiRendererResolution(renderWidth, renderHeight);
    if (Math.abs(pixiApp.renderer.resolution - nextResolution) > 0.01) {
      pixiApp.renderer.resolution = nextResolution;
    }

    if (isPortrait) {
      pixiApp.renderer.resize(renderWidth, renderHeight);
      rendererResizeCount += 1;
      canvas.style.position = "absolute";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = `${screenH}px`;
      canvas.style.height = `${screenW}px`;
      canvas.style.transformOrigin = "top left";
      canvas.style.transform = `rotate(90deg) translateY(-${screenW}px)`;

      const scaleX = screenH / GAME_WIDTH;
      const scaleY = screenW / GAME_HEIGHT;
      const uniform = Math.min(scaleX, scaleY);

      backgroundLayer!.scale.set(scaleX, scaleY);
      backgroundLayer!.position.set(0, 0);

      fishLayer!.scale.set(scaleX, scaleY);
      fishLayer!.position.set(0, 0);

      uiLayer!.scale.set(scaleX, scaleY);
      uiLayer!.position.set(0, 0);

      bannerLayer!.scale.set(scaleX, scaleY);
      bannerLayer!.position.set(0, 0);

      const childScaleX = uniform / scaleX;
      const childScaleY = uniform / scaleY;
      uiChildScale.x = childScaleX;
      uiChildScale.y = childScaleY;
      const uniformChildScale = Math.min(childScaleX, childScaleY);
      fishChildScale.x = uniformChildScale;
      fishChildScale.y = uniformChildScale;

      for (const child of bannerLayer!.children) {
        if ("scale" in child) {
          (child as PIXI.Container).scale.set(childScaleX, childScaleY);
        }
      }

      for (const child of fishLayer!.children) {
        if (child === debugRect) continue;
        if (!("scale" in child)) continue;
        const tagged = child as PIXI.Container & {
          __baseScaleX?: number;
          __baseScaleY?: number;
          baseScaleX?: number;
          baseScaleY?: number;
        };
        const bsx = tagged.__baseScaleX ?? tagged.baseScaleX;
        if (bsx === undefined) continue;
        const bsy = tagged.__baseScaleY ?? tagged.baseScaleY ?? bsx;

        const uniformChildScale2 = Math.min(childScaleX, childScaleY);
        (child as PIXI.Container).scale.set(
          bsx * uniformChildScale2,
          bsy * uniformChildScale2,
        );
      }

      const effectiveW = GAME_WIDTH / childScaleX;
      const effectiveH = GAME_HEIGHT / childScaleY;
      cannonBetUi?.setPlayfieldSize(effectiveW, effectiveH);

      cannonBetUi?.container.scale.set(childScaleX, childScaleY);
      playerProfileUi?.container.scale.set(childScaleX, childScaleY);
      menuUi?.container.scale.set(childScaleX, childScaleY);
    } else {
      pixiApp.renderer.resize(renderWidth, renderHeight);
      rendererResizeCount += 1;
      canvas.style.cssText = "";

      const scaleX = screenW / GAME_WIDTH;
      const scaleY = screenH / GAME_HEIGHT;
      const uniform = Math.min(scaleX, scaleY);

      backgroundLayer!.scale.set(scaleX, scaleY);
      backgroundLayer!.position.set(0, 0);

      fishLayer!.scale.set(scaleX, scaleY);
      fishLayer!.position.set(0, 0);

      uiLayer!.scale.set(scaleX, scaleY);
      uiLayer!.position.set(0, 0);

      bannerLayer!.scale.set(scaleX, scaleY);
      bannerLayer!.position.set(0, 0);

      const childScaleX = uniform / scaleX;
      const childScaleY = uniform / scaleY;
      uiChildScale.x = childScaleX;
      uiChildScale.y = childScaleY;
      const uniformChildScale = Math.min(childScaleX, childScaleY);
      fishChildScale.x = uniformChildScale;
      fishChildScale.y = uniformChildScale;

      for (const child of bannerLayer!.children) {
        if ("scale" in child) {
          (child as PIXI.Container).scale.set(childScaleX, childScaleY);
        }
      }

      for (const child of fishLayer!.children) {
        if (child === debugRect) continue;
        if (!("scale" in child)) continue;
        const tagged = child as PIXI.Container & {
          __baseScaleX?: number;
          __baseScaleY?: number;
          baseScaleX?: number;
          baseScaleY?: number;
        };
        const bsx = tagged.__baseScaleX ?? tagged.baseScaleX;
        if (bsx === undefined) continue;
        const bsy = tagged.__baseScaleY ?? tagged.baseScaleY ?? bsx;

        const uniformChildScale2 = Math.min(childScaleX, childScaleY);
        (child as PIXI.Container).scale.set(
          bsx * uniformChildScale2,
          bsy * uniformChildScale2,
        );
      }

      const effectiveW = GAME_WIDTH / childScaleX;
      const effectiveH = GAME_HEIGHT / childScaleY;
      cannonBetUi?.setPlayfieldSize(effectiveW, effectiveH);

      cannonBetUi?.container.scale.set(childScaleX, childScaleY);
      playerProfileUi?.container.scale.set(childScaleX, childScaleY);
      menuUi?.container.scale.set(childScaleX, childScaleY);
    }

    isResizing = false;
    drawDebugRect();
    updateCoinBoxPosition();
    if (shouldLogFishPerf()) {
      logRendererProfile("resize");
    }
  }

  function countSceneGraph(root: PIXI.Container | null) {
    const stats = {
      displayObjects: 0,
      visibleObjects: 0,
      renderableObjects: 0,
      rewardEffects: 0,
      spineObjects: 0,
      filters: 0,
    };
    if (!root) return stats;

    const visit = (node: PIXI.DisplayObject) => {
      stats.displayObjects += 1;
      if (node.visible) stats.visibleObjects += 1;
      if (node.renderable) stats.renderableObjects += 1;
      if ((node as any).__isRewardEffect) stats.rewardEffects += 1;
      if ((node as any).skeleton && (node as any).state) stats.spineObjects += 1;
      const filters = (node as PIXI.DisplayObject & {
        filters?: PIXI.Filter[] | null;
      }).filters;
      if (filters?.length) stats.filters += filters.length;

      const container = node as PIXI.Container;
      if (!container.children?.length) return;
      for (const child of container.children) visit(child);
    };

    visit(root);
    return stats;
  }

  function installRenderProbe() {
    if (!pixiApp || originalPixiRender || !shouldLogFishPerf()) return;
    originalPixiRender = pixiApp.render.bind(pixiApp);
    pixiApp.render = () => {
      const start = performance.now();
      originalPixiRender?.();
      lastRenderMs = performance.now() - start;
      worstRenderMs = Math.max(worstRenderMs, lastRenderMs);
    };
  }

  function uninstallRenderProbe() {
    if (!pixiApp || !originalPixiRender) return;
    pixiApp.render = originalPixiRender;
    originalPixiRender = null;
  }

  function logRendererProfile(reason: string) {
    if (!pixiApp || !shouldLogFishPerf()) return;
    const canvas = pixiApp.view as HTMLCanvasElement;
    const renderer = pixiApp.renderer;
    const drawPixels = canvas.width * canvas.height;
    console.info("[fish-perf] renderer", {
      reason,
      ios: isIOSWebKitDevice(),
      dpr: window.devicePixelRatio || 1,
      rendererResolution: renderer.resolution,
      css: {
        width: canvas.clientWidth,
        height: canvas.clientHeight,
      },
      drawingBuffer: {
        width: canvas.width,
        height: canvas.height,
        megapixels: Number((drawPixels / 1_000_000).toFixed(2)),
      },
      antialias: !isIOSWebKitDevice(),
    });
  }

  function startPerfProbe() {
    if (!pixiApp || perfTicker || !shouldLogFishPerf()) return;
    let elapsed = 0;
    let frames = 0;
    let worstFrameMs = 0;
    let spikeCount = 0;
    perfTicker = () => {
      if (!pixiApp) return;
      const dt = pixiApp.ticker.deltaMS;
      elapsed += dt;
      frames += 1;
      worstFrameMs = Math.max(worstFrameMs, dt);
      if (dt >= 50) {
        spikeCount += 1;
        const spikeCannonStats = cannonBetUi?.getPerfStats?.(false) ?? {
          activeBullets: 0,
          collisionFrames: 0,
          collisionTargetTests: 0,
        };
        const contextStats = contextMachine?.getPerfStats?.();
        const graphStats = countSceneGraph(sceneRoot);
        const canvas = pixiApp.view as HTMLCanvasElement;
        const renderMegapixels = (canvas.width * canvas.height) / 1_000_000;
        console.warn("[fish-perf] spike", {
          frameMs: Number(dt.toFixed(1)),
          js: contextStats,
          renderMs: Number(lastRenderMs.toFixed(2)),
          collisionBuildMs: Number(collisionBuildMs.toFixed(2)),
          collisionBuildCount,
          cannon: spikeCannonStats,
          sceneGraph: graphStats,
          renderer: {
            resolution: pixiApp.renderer.resolution,
            megapixels: Number(renderMegapixels.toFixed(2)),
          },
        });
      }
      if (elapsed < 2000) return;

      const cannonStats = cannonBetUi?.getPerfStats?.(true) ?? {
        activeBullets: 0,
        collisionFrames: 0,
        collisionTargetTests: 0,
      };
      const contextStats = contextMachine?.getPerfStats?.();
      const graphStats = countSceneGraph(sceneRoot);
      console.info("[fish-perf] sample", {
        fps: Number(((frames * 1000) / elapsed).toFixed(1)),
        worstFrameMs: Number(worstFrameMs.toFixed(1)),
        worstRenderMs: Number(worstRenderMs.toFixed(2)),
        spikeCount,
        resizeEventCount,
        rendererResizeCount,
        context: contextStats,
        fishChildren: fishLayer?.children.length ?? 0,
        collisionTargets: lastCollisionTargetCount,
        collisionBuildMs: Number(collisionBuildMs.toFixed(2)),
        collisionBuildCount,
        sceneGraph: graphStats,
        ...cannonStats,
      });
      elapsed = 0;
      frames = 0;
      worstFrameMs = 0;
      worstRenderMs = 0;
      spikeCount = 0;
      collisionBuildMs = 0;
      collisionBuildCount = 0;
      resizeEventCount = 0;
      rendererResizeCount = 0;
    };
    pixiApp.ticker.add(perfTicker);
  }

  function stopPerfProbe() {
    if (pixiApp && perfTicker) {
      pixiApp.ticker.remove(perfTicker);
    }
    perfTicker = null;
  }

  function applyBannerChildScale(child: PIXI.DisplayObject) {
    if ("scale" in child) {
      (child as PIXI.Container).scale.set(uiChildScale.x, uiChildScale.y);
    }
  }

  function applyFishChildScale(child: PIXI.DisplayObject) {
    if ("scale" in child) {
      (child as PIXI.Container).scale.set(fishChildScale.x, fishChildScale.y);
    }
  }

  // function resumeGame() {
  //   if (!pixiApp || !isGamePausedByFocus) return;
  //   if (pauseReloadTimer) {
  //     clearTimeout(pauseReloadTimer);
  //     pauseReloadTimer = null;
  //   }
  //   isGamePausedByFocus = false;
  //   contextMachine?.setPaused(false);
  //   pixiApp.ticker.start();
  //   gameAudio.resumeFromBackground();

  //   // sessionRuntime.resumeSnapshotLoop(
  //   //   () => ({
  //   //     total_elapsed_seconds: getElapsedSecondsString(),
  //   //     current_context_index:
  //   //       contextMachine?.getRuntimeState().current_context_index ?? null,
  //   //     current_group_id:
  //   //       contextMachine?.getRuntimeState().current_group_id ?? null,
  //   //     current_scene_id:
  //   //       contextMachine?.getRuntimeState().current_scene_id ??
  //   //       currentSceneId.value,
  //   //     boss_scene_active:
  //   //       contextMachine?.getRuntimeState().boss_scene_active ?? false,
  //   //     boss_scene_lock_id:
  //   //       contextMachine?.getRuntimeState().boss_scene_lock_id ?? "",
  //   //     spawn_cursor: contextMachine?.getRuntimeState().spawn_cursor ?? 0,
  //   //     runtime_state_json: contextMachine?.getRuntimeState() ?? {},
  //   //     device_meta_json: {},
  //   //   }),
  //   //   {
  //   //     maxFailuresBeforeSyncLost: 3,
  //   //     onSyncLost: () => {
  //   //       sessionSyncLost = true;
  //   //       onSessionSyncLostHandler?.();
  //   //     },
  //   //   },
  //   // );

  //   if (pendingWhilePaused.length > 0) {
  //     const pending = pendingWhilePaused.splice(0);
  //     setTimeout(() => {
  //       for (const flush of pending) flush();
  //     }, 50);
  //   }
  // }

  function renderScene(
    index: number,
    immediate = false,
    mode: MapTransitionMode = transitionMode.value,
  ): Promise<void> {
    if (!backgroundLayer || !sceneRoot) return Promise.resolve();

    const scene = scenes[index] ?? scenes[0];
    if (!scene) return Promise.resolve();
    if (!immediate && currentSceneDisplay?.id === scene.id)
      return Promise.resolve();
    if (!immediate && isTransitionRunning) {
      return activeTransitionPromise ?? Promise.resolve();
    }

    const nextSceneDisplay = createSceneDisplay(scene);
    const nextScene = nextSceneDisplay.container;

    if (!currentSceneDisplay || immediate || !pixiApp) {
      backgroundLayer.addChild(nextScene);
      destroySceneDisplay(currentSceneDisplay);
      currentSceneDisplay = nextSceneDisplay;
      currentSceneIndex.value = index;
      currentSceneId.value = scene.id;
      syncBackgroundMusic(scene.id);
      syncFishLayerToScene(currentSceneDisplay);
      return Promise.resolve();
    }

    const oldSceneDisplay = currentSceneDisplay;
    isTransitionRunning = true;
    const transitionManager = createMapTransitionManager({
      app: pixiApp,
      targetLayer: backgroundLayer,
      bannerLayer: bannerLayer!,
      burnNoiseTexture,
      burnColorTexture,
      sceneRoot,
      width: GAME_WIDTH,
      height: GAME_HEIGHT,
      getLocalizedTexture,
      localizedLang: "km",
      applyChildScale: applyBannerChildScale,
    });

    const transitionPromise = new Promise<void>((resolve, reject) => {
      try {
        transitionManager.run(
          scene.id,
          oldSceneDisplay.container,
          nextScene,
          () => {
            isTransitionRunning = false;
            activeTransitionPromise = null;
            if (oldSceneDisplay.container.parent === backgroundLayer) {
              backgroundLayer?.removeChild(oldSceneDisplay.container);
            }
            destroySceneDisplay(oldSceneDisplay);
            currentSceneDisplay = nextSceneDisplay;
            currentSceneIndex.value = index;
            currentSceneId.value = scene.id;
            syncBackgroundMusic(scene.id);
            syncFishLayerToScene(currentSceneDisplay);
            applySceneViewport();
            resolve();
          },
          mode,
        );
      } catch (error) {
        isTransitionRunning = false;
        activeTransitionPromise = null;
        destroySceneDisplay(nextSceneDisplay);
        reject(error);
      }
    });

    activeTransitionPromise = transitionPromise;

    return transitionPromise;
  }

  function switchSceneById(
    sceneId: string,
    mode: MapTransitionMode = transitionMode.value,
  ) {
    const index = scenes.findIndex((scene) => scene.id === sceneId);
    return renderScene(index >= 0 ? index : 0, false, mode);
  }

  async function mount(
    container: HTMLDivElement,
    options?: {
      onPauseTooLong?: () => void;
      onAvatarClick?: () => void;
      onMute?: () => void;
      onInfo?: () => void;
      onNote?: () => void;
      onTransition?: () => void;
      onSetting?: () => void;
      onBell?: () => void;
      onLogout?: () => void;
      onInsufficientBalance?: (payload: {
        requiredCoins: number;
        currentCoins: number;
      }) => void;
      isInputBlocked?: () => boolean;
      onSessionSyncLost?: () => void;
    },
  ) {
    avatarClickHandler = options?.onAvatarClick ?? null;
    onSessionSyncLostHandler = options?.onSessionSyncLost ?? null;
    menuHandlers = {
      onMute: options?.onMute,
      onInfo: options?.onInfo,
      onNote: options?.onNote,
      onTransition: options?.onTransition,
      onSetting: options?.onSetting,
      onBell: options?.onBell,
      onLogout: options?.onLogout,
    };

    // function setGamePaused(paused: boolean) {
    //   if (!pixiApp) return;
    //   if (paused) {
    //     if (isGamePausedByFocus) return;
    //     isGamePausedByFocus = true;
    //     contextMachine?.setPaused(true);
    //     pixiApp.ticker.stop();
    //     // sessionRuntime.pauseSnapshotLoop();
    //     gameAudio.pauseForBackground();
    //     pauseReloadTimer = setTimeout(() => {
    //       pauseReloadTimer = null;
    //       options?.onPauseTooLong?.();
    //     }, PAUSE_RELOAD_THRESHOLD_MS);
    //     return;
    //   }
    // }

    await memberStore.fetchMyInfo();
    const memberInfo = memberStore.info;

    // ── Populate multi-currency balances ────────────────────────────────
    currentBalances = (memberInfo.balances ?? []).map((b) => ({
      currencyId: b.currency_id,
      code: b.currency_code,
      amount: parseFloat(b.balance_amount ?? "0"),
    }));
    if (memberStore.selectedCurrencyID == null) {
      memberStore.selectedCurrencyID = currentBalances[0]?.currencyId ?? 0
    }
    // ── Fetch the game manifest (cannon types / bet amounts / fish, etc.) ─
    await gameManifestStore.fetchManifest();
    gameManifest = gameManifestStore.manifest;
    if (!gameManifest) {
      console.warn("[fish-scene] game manifest failed to load — cannon bet ladder will be empty");
    }
    mountedAtMs = Date.now();
    sessionSyncLost = false;
    const boot = await sessionRuntime.openSession(1);

    const resumedSceneId =
      boot?.session?.current_scene_id ||
      currentSceneId.value ||
      scenes[0]?.id ||
      "bg1";
    const resumedSceneIndex = scenes.findIndex(
      (scene) => scene.id === resumedSceneId,
    );
    currentSceneIndex.value = resumedSceneIndex >= 0 ? resumedSceneIndex : 0;
    currentSceneId.value = scenes[currentSceneIndex.value]?.id ?? "bg1";

    burnNoiseTexture = getTexture(BURN_NOISE_URL);
    burnColorTexture = getTexture(BURN_COLOR_URL);

    const rendererResolution = getPixiRendererResolution(
      container.clientWidth,
      container.clientHeight,
    );

    pixiApp = new PIXI.Application({
      width: container.clientWidth,
      height: container.clientHeight,
      antialias: !isIOSWebKitDevice(),
      backgroundAlpha: 0,
      resolution: rendererResolution,
      autoDensity: true,
      powerPreference: "high-performance",
    });
    installRenderProbe();
    logRendererProfile("mount");

    pixiApp.renderer.events.domElement.style.touchAction = "none";

    container.style.position = "relative";
    container.style.overflow = "hidden";
    container.innerHTML = "";
    container.appendChild(pixiApp.view as HTMLCanvasElement);

    sceneRoot = new PIXI.Container();
    pixiApp.stage.addChild(sceneRoot);

    backgroundLayer = new PIXI.Container();
    sceneRoot.addChild(backgroundLayer);
    fishLayer = new PIXI.Container();
    fishLayer.sortableChildren = true;
    sceneRoot.addChild(fishLayer);
    bannerLayer = new PIXI.Container();
    sceneRoot.addChild(bannerLayer);
    uiLayer = new PIXI.Container();
    sceneRoot.addChild(uiLayer);

    debugRect = new PIXI.Graphics();
    drawDebugRect();

    renderScene(currentSceneIndex.value, true);

    cannonBetUi = await createCannonBetUi({
      getCollisionTargets: getCachedCollisionTargets,
      isInputBlocked: () =>
        sessionSyncLost || Boolean(options?.isInputBlocked?.()),
      getCurrentBalance: () =>
        currentBalances.find((b) => b.currencyId === memberStore.selectedCurrencyID,)
          ?.amount ?? 0,
      onBalanceSpent: (_spentAmount, _remainingAmount) => { },
      onInsufficientBalance: (requiredAmount, availableAmount) => {
        options?.onInsufficientBalance?.({
          requiredCoins: requiredAmount,
          currentCoins: availableAmount,
        });
      },
      cannonTypes: gameManifest?.cannon_types ?? [],
      cannonLevels: gameManifest?.cannon_levels ?? [],
      getActiveCurrencyId: () => memberStore.selectedCurrencyID,
      onFishHitResolved: async ({ fishTypeId, cannonTypeId, target }) => {
        try {
          const betResp = await sessionRuntime.fireBet(
            fishTypeId,
            cannonTypeId,
            getElapsedSecondsString(),
            memberStore.selectedCurrencyID
          );
          const response = betResp?.data.value.data.bet;
          const isKill = response?.result.is_kill;
          const killReward = response?.result.reward.kill_reward.reward_amount;
          const isReward = response?.result.is_reward;
          const reward = response?.result.reward.miss_reward.reward_amount;
          const isJackpot = response?.result.is_jackpot;
          const jackpotReward =
            response?.result.reward.jackpot_reward.payout_amount;

          if (isKill && target.display) {
            contextMachine?.playKillAnimationForDisplay(target.display);
          }

          const result = {
            isKill,
            isReward,
            isJackpot,
            killReward: Math.max(0, Number(killReward ?? 0)),
            reward: Math.max(0, Number(reward ?? 0)),
            jackpotReward: Math.max(0, Number(jackpotReward ?? 0)),
          };

          if (isGamePausedByFocus) {
            return new Promise((resolve) => {
              pendingWhilePaused.push(() => resolve(result));
            });
          }

          return result;
        } catch (err) {
          console.error("[session] fireBet failed", err);
          return null;
        }
      },
      getCoinBoxPosition: () => coinBoxWorldPosition,
      getRewardLayer: () => fishLayer,
      getShakeTarget: () => sceneRoot,
      perfOptions: perfDebugOptions,
    });
    uiLayer.addChild(cannonBetUi.container);
    layoutCannonUi();

    playerProfileUi = await createPlayerProfileUi(
      memberInfo.avatar || "/avatar/Avatar6.png",
      undefined,
      memberInfo.user_name || "Player",
      () => avatarClickHandler?.(),
      {
        initialBalances: currentBalances,
        initialCurrencyId: memberStore.selectedCurrencyID,
        getAtlasTexture,
      },
    );
    uiLayer.addChild(playerProfileUi.container);
    layoutProfileUi();
    updateCoinBoxPosition();

    playerProfileUi.onSelectCurrency((currencyId) => {
      memberStore.selectedCurrencyID = currencyId
    });

    watch(
      () => memberStore.selectedCurrencyID,
      (currencyId) => {
        if (currencyId == null) return;
        cannonBetUi?.setCurrency(currencyId);
        playerProfileUi?.setBalances(currentBalances, currencyId);
        updateCoinBoxPosition();
      },
    );

    fishInfoDialog = await createFishInfoDialog();
    uiLayer.addChild(fishInfoDialog.container);

    menuUi = await createMenuUi({
      items: [
        {
          frame: "info.webp",
          label: "Info",
          onClick: () => {
            fishInfoDialog?.open();
            menuHandlers.onInfo?.();
          },
        },
        {
          frame: "notification.webp",
          label: "Bell",
          onClick: () => menuHandlers.onBell?.(),
        },
        {
          frame: "statement.webp",
          label: "Note",
          onClick: () => menuHandlers.onNote?.(),
        },
        {
          frame: "transition.webp",
          label: "Transition",
          onClick: () => menuHandlers.onTransition?.(),
        },
        {
          frame: "setting.webp",
          label: "Setting",
          onClick: () => menuHandlers.onSetting?.(),
        },
        {
          frame: "logout.webp",
          label: "Logout",
          onClick: () => menuHandlers.onLogout?.(),
        },
      ],
    });
    uiLayer.addChild(menuUi.container);
    layoutMenuUi();

    const fishFactory = createFishRendererFactory({
      getAtlasTexture,
    });
    const machine = createFishContextMachine({
      app: pixiApp,
      fishLayer,
      fishFactory,
      onSceneChange: switchSceneById,
      getFishChildScale: () => fishChildScale,
      initialRuntimeState:
        (boot?.session?.runtime_state_json as Record<string, unknown>) ?? null,
      perfOptions: perfDebugOptions,
    });
    contextMachine = machine;
    machine.start();
    startPerfProbe();
    sessionRuntime.startSnapshotLoop(
      () => ({
        total_elapsed_seconds: getElapsedSecondsString(),
        current_context_index:
          contextMachine?.getRuntimeState().current_context_index ?? null,
        current_group_id:
          contextMachine?.getRuntimeState().current_group_id ?? null,
        current_scene_id:
          contextMachine?.getRuntimeState().current_scene_id ??
          currentSceneId.value,
        boss_scene_active:
          contextMachine?.getRuntimeState().boss_scene_active ?? false,
        boss_scene_lock_id:
          contextMachine?.getRuntimeState().boss_scene_lock_id ?? "",
        spawn_cursor: contextMachine?.getRuntimeState().spawn_cursor ?? 0,
        runtime_state_json: contextMachine?.getRuntimeState() ?? {},
        device_meta_json: {},
      }),
      {
        maxFailuresBeforeSyncLost: 3,
        onSyncLost: () => {
          sessionSyncLost = true;
          onSessionSyncLostHandler?.();
        },
      },
    );

    applySceneViewport();
    logRendererProfile("viewport");
    resizeObserver = new ResizeObserver(() => {
      resizeEventCount += 1;
      applySceneViewport();
    });
    resizeObserver.observe(container);

    // visibilityHandler = () => {
    //   if (document.hidden) {
    //     setGamePaused(true);
    //   } else {
    //     setGamePaused(false);
    //   }
    // };

    // windowBlurHandler = () => {
    //   setGamePaused(true);
    // };

    // windowFocusHandler = () => {
    //   if (!document.hidden) {
    //     setGamePaused(false);
    //   }
    // };

    // document.addEventListener("visibilitychange", visibilityHandler);
    // window.addEventListener("blur", windowBlurHandler);
    // window.addEventListener("focus", windowFocusHandler);

    // if (document.hidden) {
    //   setGamePaused(true);
    // }
  }

  function destroy() {
    pendingWhilePaused = [];
    onSessionSyncLostHandler = null;
    if (pauseReloadTimer) {
      clearTimeout(pauseReloadTimer);
      pauseReloadTimer = null;
    }
    if (viewportRetryRaf != null) {
      cancelAnimationFrame(viewportRetryRaf);
      viewportRetryRaf = null;
    }

    if (visibilityHandler) {
      document.removeEventListener("visibilitychange", visibilityHandler);
      visibilityHandler = null;
    }
    if (windowBlurHandler) {
      window.removeEventListener("blur", windowBlurHandler);
      windowBlurHandler = null;
    }
    if (windowFocusHandler) {
      window.removeEventListener("focus", windowFocusHandler);
      windowFocusHandler = null;
    }
    isGamePausedByFocus = false;

    resizeObserver?.disconnect();
    resizeObserver = null;

    void sessionRuntime.stopAndClose(() => ({
      total_elapsed_seconds: getElapsedSecondsString(),
      current_context_index:
        contextMachine?.getRuntimeState().current_context_index ?? null,
      current_group_id:
        contextMachine?.getRuntimeState().current_group_id ?? null,
      current_scene_id:
        contextMachine?.getRuntimeState().current_scene_id ??
        currentSceneId.value,
      boss_scene_active:
        contextMachine?.getRuntimeState().boss_scene_active ?? false,
      boss_scene_lock_id:
        contextMachine?.getRuntimeState().boss_scene_lock_id ?? "",
      spawn_cursor: contextMachine?.getRuntimeState().spawn_cursor ?? 0,
      runtime_state_json: contextMachine?.getRuntimeState() ?? {},
      device_meta_json: {},
    }));
    mountedAtMs = 0;
    destroySceneDisplay(currentSceneDisplay);
    currentSceneDisplay = null;
    cannonBetUi?.destroy();
    cannonBetUi = null;
    playerProfileUi?.destroy();
    playerProfileUi = null;
    fishInfoDialog?.destroy();
    fishInfoDialog = null;
    menuUi?.destroy();
    menuUi = null;
    contextMachine?.destroy();
    contextMachine = null;
    stopPerfProbe();
    uninstallRenderProbe();
    avatarClickHandler = null;
    menuHandlers = {};

    sceneRoot = null;
    backgroundLayer = null;
    fishLayer = null;
    uiLayer = null;
    burnNoiseTexture = null;
    burnColorTexture = null;
    isTransitionRunning = false;
    activeTransitionPromise = null;
    isResizing = false;
    gameManifest = null;
    currentBalances = [];

    if (pixiApp) {
      pixiApp.destroy(true, { children: true, texture: false });
      pixiApp = null;
    }
  }

  // ── Keep local balance state + UI in sync with the member store ─────────
  // ── Balances watcher: stop touching the removed activeCurrencyId,
  //    fall back to the store instead ────────────────────────────────────
  watch(
    () => memberStore.info.balances,
    (balances) => {
      currentBalances = (balances ?? []).map((b) => ({
        currencyId: b.currency_id,
        code: b.currency_code,
        amount: Math.max(0, Number(b.balance_amount ?? "0") || 0),
      }));
      if (memberStore.selectedCurrencyID == null) {
        memberStore.selectedCurrencyID = currentBalances[0]?.currencyId ?? 0;
      }
      playerProfileUi?.setBalances(
        currentBalances,
        memberStore.selectedCurrencyID ?? undefined,
      );
    },
    { deep: true, immediate: true },
  );
  return {
    scenes,
    currentSceneId,
    transitionMode,
    mount,
    destroy,
    switchSceneById,
    setPlayerAvatar: (path: string) => playerProfileUi?.setAvatar(path),
    setPlayerUsername: (name: string) => playerProfileUi?.setUsername(name),
    setPlayerBalances: (
      balances: PlayerBalance[],
      activeId?: number,
    ) => {
      currentBalances = balances;
      if (activeId != null) memberStore.selectedCurrencyID = activeId;
      playerProfileUi?.setBalances(
        currentBalances,
        memberStore.selectedCurrencyID ?? undefined,
      );
    },
    isSessionSyncLost: () => sessionSyncLost,
    // resumeGame,
  };
}