import * as PIXI from "pixi.js";
import {
  createCannonBetUi,
  type BulletCollisionTarget,
} from "~/composables/game_core/game/createCannonBetUi";
import { useFishAssetPreload } from "~/composables/game_core/assets/useFishAssetPreload";
import { createFishContextMachine } from "~/composables/game_core/fish/useFishContextMachine";
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
  let bannerLayer: PIXI.Container<PIXI.DisplayObject> | null = null; // ✅ add
  let uiLayer: PIXI.Container<PIXI.DisplayObject> | null = null;
  let currentSceneDisplay: SceneDisplay | null = null;
  let cannonBetUi: Awaited<ReturnType<typeof createCannonBetUi>> | null = null;
  let playerProfileUi: Awaited<
    ReturnType<typeof createPlayerProfileUi>
  > | null = null;
  let pendingWhilePaused: Array<() => void> = [];
  let onSessionSyncLostHandler: (() => void) | null = null;

  // Add at the top level of useFishGameplayScene(), alongside other let variables:
  let debugRect: PIXI.Graphics | null = null;

  function drawDebugRect() {
    if (!debugRect) return;
    debugRect.clear();

    // Semi-transparent red fill
    debugRect.beginFill(0xff0000, 0.15);
    debugRect.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    debugRect.endFill();

    // Green border - edge indicator
    debugRect.lineStyle(6, 0x00ff00, 1);
    debugRect.drawRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Yellow corner markers
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

  let avatarClickHandler: (() => void) | null = null;
  let currentCoins = 0;
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
  const CANNON_TYPE_BY_BET_AMOUNT: Record<number, number> = {
    10: 1,
    20: 2,
    50: 3,
    100: 4,
    200: 5,
    500: 6,
    1000: 7,
    2000: 8,
    5000: 9,
    10000: 10,
  };

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
    // fishLayer.position.set(GAME_WIDTH / 2, GAME_HEIGHT / 2);
    // fishLayer.scale.set(1, 1);
  }

  // Add this variable alongside other lets at the top of useFishGameplayScene
  let coinBoxWorldPosition: { x: number; y: number } | undefined = undefined;

  // Add this helper to compute and cache it
  function updateCoinBoxPosition() {
    if (!playerProfileUi || !uiLayer || !fishLayer) {
      coinBoxWorldPosition = undefined;
      return;
    }

    // uiLayer and fishLayer both start at (0,0) with the same scale
    // so uiLayer local coords === fishLayer local coords
    // profile is at (PROFILE_UI_X, PROFILE_UI_Y) in uiLayer
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
    menuUi.container.position.set(12, GAME_HEIGHT / 2 - 50);
  }

  function flashFishHit(displayObject: PIXI.DisplayObject) {
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

    const flashFilter = new PIXI.ColorMatrixFilter();
    flashFilter.brightness(1.8, false);
    targetWithFilters.filters = [flashFilter];

    fishDisplay.hitFlashTimeoutId = window.setTimeout(() => {
      targetWithFilters.filters = fishDisplay.hitFlashOriginalFilters ?? null;
      fishDisplay.hitFlashTimeoutId = null;
      fishDisplay.hitFlashOriginalFilters = null;
    }, 90);
  }

  function getFishCollisionTargets(): BulletCollisionTarget[] {
    if (!fishLayer) return [];
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

      const bounds = child.getBounds();
      if (bounds.width <= 0 || bounds.height <= 0) continue;

      const centerX = bounds.x + bounds.width / 2;
      const centerY = bounds.y + bounds.height / 2;
      const radius = Math.min(bounds.width, bounds.height) * 0.35;
      const fishData =
        (child as any).fishData ?? (child as any).__fishData ?? null;

      targets.push({
        bounds: {
          x: bounds.x,
          y: bounds.y,
          width: bounds.width,
          height: bounds.height,
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

    return targets;
  }

  function applySceneViewport() {
    if (!pixiApp || !sceneRoot) return;
    if (isResizing) return;
    isResizing = true;

    const canvas = pixiApp.view as HTMLCanvasElement;
    const cont = canvas.parentElement as HTMLElement;
    const screenW = cont.clientWidth;
    const screenH = cont.clientHeight;
    const isPortrait = screenH > screenW;
    console.log(
      `Applying viewport resize: ${screenW}x${screenH}, portrait: ${isPortrait}`,
    );

    if (isPortrait) {
      // swap W/H for rotation
      pixiApp.renderer.resize(screenH, screenW);
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

      // BG layer
      backgroundLayer!.scale.set(scaleX, scaleY);
      backgroundLayer!.position.set(0, 0);

      // Fish layer
      fishLayer!.scale.set(scaleX, scaleY);
      fishLayer!.position.set(0, 0);

      // UI layer
      uiLayer!.scale.set(scaleX, scaleY);
      // console.log("UI scale set to:", uiLayer!.scale);
      uiLayer!.position.set(0, 0);

      // Banner layer
      bannerLayer!.scale.set(scaleX, scaleY);
      bannerLayer!.position.set(0, 0);

      // Child scale
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

        // ✅ uniform — use min of both child scales
        const uniformChildScale = Math.min(childScaleX, childScaleY);
        (child as PIXI.Container).scale.set(
          bsx * uniformChildScale,
          bsy * uniformChildScale,
        );
      }

      const effectiveW = GAME_WIDTH / childScaleX;
      const effectiveH = GAME_HEIGHT / childScaleY;
      cannonBetUi?.setPlayfieldSize(effectiveW, effectiveH);

      cannonBetUi?.container.scale.set(childScaleX, childScaleY);
      playerProfileUi?.container.scale.set(childScaleX, childScaleY);
      menuUi?.container.scale.set(childScaleX, childScaleY);
    } else {
      pixiApp.renderer.resize(screenW, screenH);
      canvas.style.cssText = ""; // clear portrait styles

      const scaleX = screenW / GAME_WIDTH;
      const scaleY = screenH / GAME_HEIGHT;
      const uniform = Math.min(scaleX, scaleY);

      // BG layer
      backgroundLayer!.scale.set(scaleX, scaleY);
      backgroundLayer!.position.set(0, 0);

      // Fish layer
      fishLayer!.scale.set(scaleX, scaleY);
      fishLayer!.position.set(0, 0);

      // UI layer
      uiLayer!.scale.set(scaleX, scaleY);
      // console.log("UI scale set to:", uiLayer!.scale);
      uiLayer!.position.set(0, 0);

      // Banner layer
      bannerLayer!.scale.set(scaleX, scaleY);
      bannerLayer!.position.set(0, 0);

      // Child scale
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

        // ✅ uniform — use min of both child scales
        const uniformChildScale = Math.min(childScaleX, childScaleY);
        (child as PIXI.Container).scale.set(
          bsx * uniformChildScale,
          bsy * uniformChildScale,
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

  function resumeGame() {
    if (!pixiApp || !isGamePausedByFocus) return;
    if (pauseReloadTimer) {
      clearTimeout(pauseReloadTimer);
      pauseReloadTimer = null;
    }
    isGamePausedByFocus = false;
    contextMachine?.setPaused(false);
    pixiApp.ticker.start();

    sessionRuntime.resumeSnapshotLoop(
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
          onSessionSyncLostHandler?.(); // ← no more scope error
        },
      },
    );

    if (pendingWhilePaused.length > 0) {
      const pending = pendingWhilePaused.splice(0);
      setTimeout(() => {
        for (const flush of pending) flush();
      }, 50);
    }
  }

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
      onPause?: () => void;
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

    function setGamePaused(paused: boolean) {
      if (!pixiApp) return;
      if (paused) {
        if (isGamePausedByFocus) return;
        isGamePausedByFocus = true; // ← set BEFORE ticker stop
        contextMachine?.setPaused(true);
        pixiApp.ticker.stop();
        sessionRuntime.pauseSnapshotLoop();
        pauseReloadTimer = setTimeout(() => {
          pauseReloadTimer = null;
          options?.onPauseTooLong?.();
        }, PAUSE_RELOAD_THRESHOLD_MS);
        options?.onPause?.();
        return;
      }
    }

    // ── Fetch member info ─────────────────────────────────────────────────
    await memberStore.fetchMyInfo();
    const memberInfo = memberStore.info;
    currentCoins = parseFloat(memberInfo.coin_amount ?? "0");
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

    pixiApp = new PIXI.Application({
      width: container.clientWidth,
      height: container.clientHeight,
      antialias: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

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
    // fishLayer.addChildAt(debugRect, 0);
    drawDebugRect(); // draw immediately

    renderScene(currentSceneIndex.value, true);
    cannonBetUi = await createCannonBetUi({
      getCollisionTargets: getFishCollisionTargets,
      isInputBlocked: () =>
        sessionSyncLost || Boolean(options?.isInputBlocked?.()),
      getCurrentCoins: () => Number(memberStore.info.coin_amount ?? "0") || 0,
      onCoinsSpent: (_spentCoins, remainingCoins) => {
        // currentCoins = remainingCoins;
        // memberStore.setCoins(String(currentCoins));
        // playerProfileUi?.setCoins(currentCoins);
      },
      onInsufficientBalance: (requiredCoins, availableCoins) => {
        options?.onInsufficientBalance?.({
          requiredCoins,
          currentCoins: availableCoins,
        });
      },
      resolveCannonTypeId: (betAmount) =>
        CANNON_TYPE_BY_BET_AMOUNT[betAmount] ?? null,
      onFishHitResolved: async ({ fishTypeId, cannonTypeId, target }) => {
        try {
          const betResp = await sessionRuntime.fireBet(
            fishTypeId,
            cannonTypeId,
            getElapsedSecondsString(),
          );
          const response = betResp?.data.value.data.bet;
          // let payout = response?.result.reward.total_payout_amount
          const isKill = response?.result.is_kill;
          const killReward = response?.result.reward.kill_reward.reward_amount;
          const isReward = response?.result.is_reward;
          const reward = response?.result.reward.miss_reward.reward_amount;
          const isJackpot = response?.result.is_jackpot;
          const jackpotReward =
            response?.result.reward.jackpot_reward.payout_amount;

          console.log("===========================================", isReward);

          if (isKill && target.display) {
            contextMachine?.playKillAnimationForDisplay(target.display);
          }

          const result = {
            isKill,
            isReward,
            isJackpot,
            killReward: Math.max(0, Math.round(Number(killReward ?? 0))),
            reward: Math.max(0, Math.round(Number(reward ?? 0))),
            jackpotReward: Math.max(0, Math.round(Number(jackpotReward ?? 0))),
          };

          // ── If paused, defer reward effects until resume ───────────────────
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
    });
    uiLayer.addChild(cannonBetUi.container);
    layoutCannonUi();

    // ── Player profile UI ─────────────────────────────────────────────────
    playerProfileUi = await createPlayerProfileUi(
      memberInfo.avatar || "/avatar/Avatar6.png",
      undefined,
      memberInfo.user_name || "Player",
      () => avatarClickHandler?.(),
      {
        initialCoins: parseFloat(memberInfo.coin_amount ?? "0"),
        getAtlasTexture,
      },
    );
    uiLayer.addChild(playerProfileUi.container);
    layoutProfileUi();
    updateCoinBoxPosition();

    fishInfoDialog = await createFishInfoDialog();
    uiLayer.addChild(fishInfoDialog.container);

    // ── Menu UI ───────────────────────────────────────────────────────────
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
    });
    contextMachine = machine;
    machine.start();
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
    resizeObserver = new ResizeObserver(() => applySceneViewport());
    resizeObserver.observe(container);

    visibilityHandler = () => {
      if (document.hidden) {
        setGamePaused(true);
      } else {
        setGamePaused(false);
      }
    };

    windowBlurHandler = () => {
      setGamePaused(true);
    };

    windowFocusHandler = () => {
      // Only unpause on focus if document is actually visible
      if (!document.hidden) {
        setGamePaused(false);
      }
    };

    document.addEventListener("visibilitychange", visibilityHandler);
    window.addEventListener("blur", windowBlurHandler);
    window.addEventListener("focus", windowFocusHandler);

    if (document.hidden) {
      setGamePaused(true);
    }
  }

  function destroy() {
    pendingWhilePaused = [];
    onSessionSyncLostHandler = null;
    if (pauseReloadTimer) {
      clearTimeout(pauseReloadTimer);
      pauseReloadTimer = null;
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

    if (pixiApp) {
      pixiApp.destroy(true, { children: true, texture: false });
      pixiApp = null;
    }
  }

  watch(
    () => memberStore.info.coin_amount,
    (coinAmount) => {
      currentCoins = Math.max(0, Number(coinAmount ?? "0") || 0);
      playerProfileUi?.setCoins(currentCoins);
    },
    { immediate: true },
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
    setPlayerCoins: (_amount: number) => {},
    isSessionSyncLost: () => sessionSyncLost,
    resumeGame,
  };
}
