/**
 * useFishContextMachine2.ts
 *
 * Re-implementation of useFishContextMachine that consumes ONLY manifest fish data.
 * Replaces fishCatalog + fishAnimationDb with API manifest data.
 * Keeps path.json (runtime paths are independent data).
 */

import * as PIXI from "pixi.js";
import { Spine } from "pixi-spine";
import pathData from "../../../../public/fish/fish-all-star/path.json";
import {
  getManifestFishById,
  getManifestFishTypes,
} from "~/composables/game_core/fish/useManifestFishData";

type PathPoint = {
  x: number;
  y: number;
  duration?: number;
  delay?: number;
  isSpline?: boolean;
  distance?: number;
};

type PathEntry = {
  id: number;
  duration?: number;
  point: PathPoint[];
};

type GroupFishEntry = {
  id: number;
  fish: number;
  path: number;
  delay?: number;
};

type GroupEntry = {
  id: number;
  delay?: number;
  duration?: number;
  fish: GroupFishEntry[];
};

type MainEntry = {
  no?: number;
  randoms?: Array<{
    random?: number[];
    name?: string;
  }>;
};

type RandomEntry = {
  id: number;
  random?: Array<{
    id: number;
    rate?: number;
  }>;
};

type SpawnEvent = {
  fishId: number;
  pathId: number;
  delayMs: number;
  renderable: boolean;
  isBoss: boolean;
};

type SceneChangeMode = "normal" | "boss" | "context_wipe";

type LiveFish = {
  display: PIXI.DisplayObject;
  destroy: () => void;
  fishId: number;
  pathId: number;
  elapsedMs: number;
  segments: PathSegment[];
  segmentIndex: number;
  segmentElapsedMs: number;
  delayRemainingMs: number;
  baseScaleX: number;
  baseScaleY: number;
  isBoss: boolean;
  angle: number;
  isExiting: boolean;
  exitTarget?: PIXI.Point;
  exitSpeed?: number;
  walkAnimSpeed?: number;
};

type RestoredLiveFishState = {
  fish_id: number;
  path_id: number;
  x: number;
  y: number;
  segment_index: number;
  segment_elapsed_ms: number;
  delay_remaining_ms: number;
  elapsed_ms: number;
  base_scale_x: number;
  base_scale_y: number;
  angle: number;
  is_boss: boolean;
  is_exiting: boolean;
  exit_target_x?: number;
  exit_target_y?: number;
  exit_speed?: number;
};

type PathSegment = {
  p0: PIXI.Point;
  p1: PIXI.Point;
  p2: PIXI.Point;
  p3: PIXI.Point;
  durationMs: number;
  delayMs: number;
  sourceDuration: number;
  sourceDistance: number;
};

type ApiFishType = {
  id: number;
  is_boss: boolean;
  has_runtime_config: boolean;
  base_speed: number;
  walk_speed: number | null;
  behavior: string | null;
  render_family: unknown;
};

type PathRoot = {
  main?: MainEntry[];
  random?: RandomEntry[];
  group: GroupEntry[];
  path: PathEntry[];
};

type FishFactory = {
  createAnimatedFishBySpawnFishId: (spawnFishId: number) => {
    display: PIXI.DisplayObject;
    destroy: () => void;
  } | null;
};

type RestoredRuntimeState = {
  current_context_index?: number;
  current_group_id?: number;
  spawn_cursor?: number;
  context_elapsed_ms?: number;
  current_scene_id?: string;
  boss_scene_active?: boolean;
  boss_scene_lock_id?: string;
  live_fish?: RestoredLiveFishState[];
};

const GAME_WIDTH = 1280;
const GAME_HEIGHT = 720;
const MAX_SPAWN_PER_GROUP = 99999;
const CONTEXT_LINGER_MS = 0;
const CONTEXT_SWITCH_LEAD_MS = 2200;
const TIME_SCALE = 1.0;
const HEADING_OFFSET = Math.PI / 2;
const SPINE_MAX_TILT = Math.PI * 0.38;
const DEBUG_CONTEXT = true;
const USE_WEIGHTED_GROUP = false;
const NORMAL_SCENES = ["bg1", "bg2", "bg3"] as const;
const BOSS_SCENE_BY_FISH_ID: Record<number, string> = {
  20: "crocodileBoss",
  19: "phoenix",
  21: "naga",
};

const pathRoot = pathData as PathRoot;

const mainEntries = (pathRoot.main ?? []).filter((entry) =>
  entry.randoms?.some((random) => (random.random ?? []).length > 0),
);
const randomTable = new Map<number, RandomEntry>(
  (pathRoot.random ?? []).map((entry) => [entry.id, entry]),
);
const groupMap = new Map(pathRoot.group.map((entry) => [entry.id, entry]));
const pathMap = new Map(pathRoot.path.map((entry) => [entry.id, entry]));

function getRenderableFishIds() {
  return new Set(
    (getManifestFishTypes() as ApiFishType[])
      .filter((fish) => fish.render_family != null)
      .map((fish) => fish.id),
  );
}

function getRenderableGroupIds() {
  const renderableFishIds = getRenderableFishIds();
  return pathRoot.group
    .filter((group) =>
      group.fish.some((entry) => {
        if (!renderableFishIds.has(entry.fish)) return false;
        const pathPoints = pathMap.get(entry.path)?.point;
        return Array.isArray(pathPoints) && pathPoints.length >= 2;
      }),
    )
    .map((group) => group.id);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function lerpAngle(current: number, target: number, alpha: number) {
  let delta = target - current;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return current + delta * alpha;
}

function dtLerpAngle(
  current: number,
  target: number,
  halfLifeMs: number,
  deltaMs: number,
) {
  const alpha = 1 - Math.pow(0.5, deltaMs / halfLifeMs);
  return lerpAngle(current, target, alpha);
}

function easeInOut(t: number): number {
  return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
}

function pickWeightedRandom(items: Array<{ id: number; rate?: number }>) {
  const total = items.reduce((sum, item) => sum + (item.rate ?? 0), 0);
  if (total <= 0) return items[0]?.id ?? null;

  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.rate ?? 0;
    if (roll <= 0) return item.id;
  }
  return items[items.length - 1]?.id ?? null;
}

function pickNextGroupId(lastNo: number | null): {
  groupId: number | null;
  no: number | null;
} {
  if (mainEntries.length === 0) return { groupId: null, no: null };
  const candidates = mainEntries.filter((entry) => entry.no != null);
  const pool = candidates.length > 0 ? candidates : mainEntries;
  let entry = pool[Math.floor(Math.random() * pool.length)];
  if (entry && lastNo != null && pool.length > 1 && entry.no === lastNo) {
    entry = pool[Math.floor(Math.random() * pool.length)];
  }
  if (!entry) return { groupId: null, no: null };
  const randomPool =
    entry.randoms?.filter((random) => (random.random ?? []).length > 0) ?? [];
  if (randomPool.length === 0) return { groupId: null, no: entry.no ?? null };

  const randomEntry = randomPool[Math.floor(Math.random() * randomPool.length)];
  if (!randomEntry) return { groupId: null, no: entry.no ?? null };
  const randomIds = randomEntry.random ?? [];
  if (randomIds.length === 0) return { groupId: null, no: entry.no ?? null };

  const randomId = randomIds[Math.floor(Math.random() * randomIds.length)];
  if (!randomId) return { groupId: null, no: entry.no ?? null };

  const randomTableEntry = randomTable.get(randomId);
  const weighted = randomTableEntry?.random ?? [];
  if (weighted.length === 0) return { groupId: null, no: entry.no ?? null };

  const groupId = USE_WEIGHTED_GROUP
    ? pickWeightedRandom(weighted)
    : (weighted[0]?.id ?? null);
  return { groupId, no: entry.no ?? null };
}

function pickFallbackGroupId(): number | null {
  const renderableGroupIds = getRenderableGroupIds();
  if (renderableGroupIds.length === 0) return null;
  const selected =
    renderableGroupIds[Math.floor(Math.random() * renderableGroupIds.length)];
  return selected ?? null;
}

function pickRandomNormalScene(
  previousSceneId: string | null,
  excludeSceneId: string | null = null,
) {
  const pool = NORMAL_SCENES.filter(
    (sceneId) => sceneId !== previousSceneId && sceneId !== excludeSceneId,
  );
  const candidates = pool.length > 0 ? pool : [...NORMAL_SCENES];
  return candidates[Math.floor(Math.random() * candidates.length)] ?? "bg1";
}

function toStagePoint(point: PathPoint): PathPoint {
  const S = GAME_WIDTH;
  const L = GAME_HEIGHT;
  const x = point.x + point.x / S + 0.5 * S;
  const y = point.y + point.y / L + 0.5 * L;
  return {
    x: S - x,
    y,
    duration: point.duration,
    delay: point.delay ?? 0,
    isSpline: point.isSpline,
    distance: point.distance,
  };
}

function getPathPoints(pathId: number): PathPoint[] | null {
  const entry = pathMap.get(pathId);
  if (!entry?.point?.length || entry.point.length < 2) return null;
  return entry.point.map(toStagePoint);
}

function getPathDurationMs(pathId: number): number {
  const entry = pathMap.get(pathId);
  return Math.max(2500, (entry?.duration ?? 8) * 1000 * TIME_SCALE);
}

function derivative(prev: PathPoint, next: PathPoint, factor: number) {
  return new PIXI.Point((next.x - prev.x) * factor, (next.y - prev.y) * factor);
}

function buildBezierSegments(points: PathPoint[]): PathSegment[] {
  if (points.length < 2) return [];
  const extended = [...points];
  const last = extended[extended.length - 1];
  if (last) {
    extended.push({
      x: last.x,
      y: last.y,
      duration: 2,
      delay: 0,
      isSpline: last.isSpline,
      distance: last.distance,
    });
  }

  const segments: PathSegment[] = [];
  let previousPoint = extended[0];
  if (!previousPoint) return [];
  const secondPoint = extended[1];
  if (!secondPoint) return [];
  let previousDerivative = derivative(previousPoint, secondPoint, 0.5);

  for (let index = 1; index < extended.length; index += 1) {
    const currentPoint = extended[index];
    if (!currentPoint) continue;
    const nextPoint = extended[index + 1] ?? currentPoint;
    const previousControlPoint = extended[index - 1];
    if (!previousControlPoint) continue;
    const nextDerivative = derivative(previousControlPoint, nextPoint, 0.5);

    const p0 = new PIXI.Point(previousPoint.x, previousPoint.y);
    const p3 = new PIXI.Point(currentPoint.x, currentPoint.y);
    const p1 = new PIXI.Point(
      previousPoint.x + previousDerivative.x / 3,
      previousPoint.y + previousDerivative.y / 3,
    );
    const p2 = new PIXI.Point(
      currentPoint.x - nextDerivative.x / 3,
      currentPoint.y - nextDerivative.y / 3,
    );

    segments.push({
      p0,
      p1,
      p2,
      p3,
      durationMs: Math.max(0, (currentPoint.duration ?? 0) * 1000),
      delayMs: Math.max(0, ((currentPoint.delay ?? 0) as number) * 1000),
      sourceDuration: Math.max(0, currentPoint.duration ?? 0),
      sourceDistance: Math.max(0, currentPoint.distance ?? 0),
    });

    previousPoint = currentPoint;
    previousDerivative = nextDerivative;
  }

  return segments;
}

function getFishWalkAnimSpeed(spawnFishId: number): number {
  const fish = getManifestFishById(spawnFishId) as ApiFishType | undefined;
  const speed = fish?.walk_speed;
  return typeof speed === "number" && Number.isFinite(speed) ? speed : 0;
}

function setDisplayAnimationSpeed(display: PIXI.DisplayObject, speed: number) {
  const tagged = display as PIXI.DisplayObject & {
    __anim?: PIXI.DisplayObject;
    __shadowAnim?: PIXI.DisplayObject;
    __baseAnimSpeed?: number;
  };

  if (tagged.__anim instanceof PIXI.AnimatedSprite) {
    tagged.__anim.animationSpeed = speed;
  } else if (tagged.__anim instanceof Spine) {
    tagged.__anim.state.timeScale = speed;
  }

  if (tagged.__shadowAnim instanceof PIXI.AnimatedSprite) {
    tagged.__shadowAnim.animationSpeed = speed;
  } else if (tagged.__shadowAnim instanceof Spine) {
    tagged.__shadowAnim.state.timeScale = speed;
  }
}

function resetDisplayAnimationSpeed(display: PIXI.DisplayObject) {
  const tagged = display as PIXI.DisplayObject & {
    __baseAnimSpeed?: number;
  };
  setDisplayAnimationSpeed(display, tagged.__baseAnimSpeed ?? 1);
}

function getWalkAdjustedAnimationSpeed(fish: LiveFish, segment: PathSegment) {
  const tagged = fish.display as PIXI.DisplayObject & {
    __baseAnimSpeed?: number;
  };
  const baseSpeed = tagged.__baseAnimSpeed ?? 1;
  if (
    !fish.walkAnimSpeed ||
    fish.walkAnimSpeed <= 0 ||
    segment.sourceDistance <= 0 ||
    segment.sourceDuration <= 0
  ) {
    return baseSpeed;
  }

  return (
    baseSpeed *
    (segment.sourceDistance / segment.sourceDuration / fish.walkAnimSpeed)
  );
}

function bezierPoint(
  p0: PIXI.Point,
  p1: PIXI.Point,
  p2: PIXI.Point,
  p3: PIXI.Point,
  t: number,
) {
  const inv = 1 - t;
  const a = inv * inv * inv;
  const b = 3 * inv * inv * t;
  const c = 3 * inv * t * t;
  const d = t * t * t;
  return new PIXI.Point(
    a * p0.x + b * p1.x + c * p2.x + d * p3.x,
    a * p0.y + b * p1.y + c * p2.y + d * p3.y,
  );
}

function bezierTangent(
  p0: PIXI.Point,
  p1: PIXI.Point,
  p2: PIXI.Point,
  p3: PIXI.Point,
  t: number,
) {
  const inv = 1 - t;
  const dx =
    3 * inv * inv * (p1.x - p0.x) +
    6 * inv * t * (p2.x - p1.x) +
    3 * t * t * (p3.x - p2.x);
  const dy =
    3 * inv * inv * (p1.y - p0.y) +
    6 * inv * t * (p2.y - p1.y) +
    3 * t * t * (p3.y - p2.y);
  return { dx, dy };
}

function buildSpawnEvents(groupId: number): {
  events: SpawnEvent[];
  bossCount: number;
} {
  const group = groupMap.get(groupId);
  if (!group) return { events: [], bossCount: 0 };

  const filtered = group.fish
    .filter((entry) => getPathPoints(entry.path) !== null)
    .sort((a, b) => (a.delay ?? 0) - (b.delay ?? 0))
    .slice(0, MAX_SPAWN_PER_GROUP);

  if (filtered.length === 0) return { events: [], bossCount: 0 };

  const firstDelay = Math.min(...filtered.map((entry) => entry.delay ?? 0));
  let bossCount = 0;

  const events = filtered.map((entry) => {
    const isBoss = Boolean(BOSS_SCENE_BY_FISH_ID[entry.fish]);
    if (isBoss) bossCount += 1;
    return {
      fishId: entry.fish,
      pathId: entry.path,
      delayMs: ((entry.delay ?? 0) - firstDelay) * 1000 * TIME_SCALE,
      renderable: getRenderableFishIds().has(entry.fish),
      isBoss,
    };
  });

  return { events, bossCount };
}

export function createFishContextMachine(options: {
  app: PIXI.Application;
  fishLayer: PIXI.Container;
  fishFactory: FishFactory;
  getFishChildScale: () => { x: number; y: number };
  onSceneChange: (
    sceneId: string,
    mode?: SceneChangeMode,
  ) => void | Promise<void>;
  initialRuntimeState?: RestoredRuntimeState | null;
}) {
  const { app, fishLayer, fishFactory, getFishChildScale, onSceneChange } =
    options;

  let currentContextIndex = -1;
  let currentGroupId: number | null = null;
  let lastContextNo: number | null = null;
  let currentNormalSceneId: string | null = null;
  let bossActiveCount = 0;
  let bossTimers: Array<{ remainingMs: number }> = [];
  let bossSceneLock: string | null = null;
  let pendingBossEvents: SpawnEvent[] = [];
  let activeSceneId: string | null = null;
  let contextStartTime = 0;
  let spawnEvents: SpawnEvent[] = [];
  let spawnCursor = 0;
  let liveFish: LiveFish[] = [];
  let currentContextDurationMs = 0;
  let leadInMs = 0;
  let pendingContextSwitch: {
    activateAtMs: number;
    nextIndex: number;
    nextSceneId: string;
    isActivating?: boolean;
  } | null = null;
  const initialRuntimeState = options.initialRuntimeState ?? null;
  let pausedAtMs: number | null = null;

  function clearFish() {
    for (const fish of liveFish) {
      fishLayer.removeChild(fish.display);
      fish.destroy();
    }
    liveFish = [];
  }

  function getExitTarget(
    from: PIXI.IPointData,
    direction: { dx: number; dy: number },
  ) {
    const margin = 120;
    let targetX = from.x + (direction.dx >= 0 ? GAME_WIDTH : -GAME_WIDTH);
    let targetY = from.y + (direction.dy >= 0 ? GAME_HEIGHT : -GAME_HEIGHT);

    if (Math.abs(direction.dx) > Math.abs(direction.dy)) {
      targetX = direction.dx >= 0 ? GAME_WIDTH + margin : -margin;
      targetY = from.y + direction.dy * 120;
    } else {
      targetY = direction.dy >= 0 ? GAME_HEIGHT + margin : -margin;
      targetX = from.x + direction.dx * 120;
    }

    return new PIXI.Point(targetX, targetY);
  }

  function accelerateExistingFish() {
    for (const fish of liveFish) {
      if (fish.isExiting) continue;
      fish.isExiting = true;
      const segment = fish.segments[fish.segmentIndex];
      const t =
        segment && segment.durationMs > 0
          ? Math.min(fish.segmentElapsedMs / segment.durationMs, 1)
          : 1;
      const direction = segment
        ? bezierTangent(segment.p0, segment.p1, segment.p2, segment.p3, t)
        : { dx: 1, dy: 0 };
      fish.exitTarget = getExitTarget(fish.display.position, direction);
      fish.exitSpeed = 520;
    }
  }

  function switchScene(
    sceneId: string,
    mode: SceneChangeMode = "normal",
  ): void | Promise<void> {
    if (activeSceneId === sceneId) return;
    activeSceneId = sceneId;
    if (DEBUG_CONTEXT) {
      // eslint-disable-next-line no-console
      console.log("[context2] switchScene", { sceneId, mode });
    }
    return onSceneChange(sceneId, mode);
  }

  function returnToRandomNormalScene() {
    currentNormalSceneId = pickRandomNormalScene(
      currentNormalSceneId,
      bossSceneLock,
    );
    bossSceneLock = null;
    switchScene(currentNormalSceneId, "normal");
  }

  function releaseBossSlot() {
    bossActiveCount = Math.max(0, bossActiveCount - 1);
    if (bossActiveCount > 0) return;

    const deferredBossEvent = pendingBossEvents.shift();
    if (deferredBossEvent) {
      spawnFish(deferredBossEvent);
      return;
    }

    if (currentNormalSceneId) {
      returnToRandomNormalScene();
    }
  }

  function scheduleNextContext(index: number) {
    if (pendingContextSwitch) return;
    accelerateExistingFish();
    const nextSceneId = pickRandomNormalScene(currentNormalSceneId);
    pendingContextSwitch = {
      activateAtMs: performance.now() + CONTEXT_SWITCH_LEAD_MS,
      nextIndex: index,
      nextSceneId,
    };
    if (DEBUG_CONTEXT) {
      // eslint-disable-next-line no-console
      console.log("[context2] scheduleNextContext", {
        currentIndex: currentContextIndex,
        nextIndex: index,
        nextSceneId,
      });
    }
  }

  function getHeadingAngle(direction: { dx: number; dy: number }) {
    return Math.atan2(direction.dy, direction.dx) + HEADING_OFFSET;
  }

  function getSpineHeadingForFish(
    direction: { dx: number; dy: number },
    fishId?: number,
  ) {
    const movingRight = direction.dx >= 0;
    const forwardDx = movingRight ? direction.dx : -direction.dx;
    const rawTilt = Math.atan2(direction.dy, Math.max(0.0001, forwardDx));
    const angle = clamp(rawTilt, -SPINE_MAX_TILT, SPINE_MAX_TILT);
    const defaultFlipX = movingRight ? -1 : 1;
    const reverseFacingFishIds = new Set([18, 19]);
    const flipX = reverseFacingFishIds.has(fishId ?? -1)
      ? -defaultFlipX
      : defaultFlipX;
    return { angle, flipX };
  }

  function getHeadingAngleForDisplay(
    display: PIXI.DisplayObject,
    direction: { dx: number; dy: number },
    baseScaleX: number,
    baseScaleY: number,
  ) {
    const isSpineUpright =
      display instanceof Spine ||
      (display as { __spineUpright?: boolean }).__spineUpright;
    if (isSpineUpright) {
      const fid = (display as { __fishId?: number }).__fishId;
      const spineHeading = getSpineHeadingForFish(direction, fid);
      if ("scale" in display) {
        const childScale = getFishChildScale();
        // ✅ use uniform child scale — same as normal fish
        const uniformChildScale = Math.min(childScale.x, childScale.y);
        display.scale.x =
          Math.abs(baseScaleX) * spineHeading.flipX * uniformChildScale;
        display.scale.y = Math.abs(baseScaleY) * uniformChildScale;
      }

      // // ✅ debug arrow — shows the forward direction in local space
      // const wrapper = display as PIXI.Container & {
      //   __debugArrow?: PIXI.Graphics;
      // };
      // if (!wrapper.__debugArrow) {
      //   const arrow = new PIXI.Graphics();
      //   wrapper.__debugArrow = arrow;
      //   wrapper.addChild(arrow);
      // }
      // const arrow = wrapper.__debugArrow;
      // arrow.clear();

      // // arrow pointing UP in local space = forward direction
      // // red line = forward axis
      // arrow.lineStyle(3, 0xff0000, 1);
      // arrow.moveTo(0, 0);
      // arrow.lineTo(0, -120); // up = forward for spine upright fish

      // // arrowhead
      // arrow.lineStyle(2, 0xff0000, 1);
      // arrow.moveTo(-10, -100);
      // arrow.lineTo(0, -120);
      // arrow.lineTo(10, -100);

      // // green dot = center/pivot
      // arrow.lineStyle(0);
      // arrow.beginFill(0x00ff00, 1);
      // arrow.drawCircle(0, 0, 6);
      // arrow.endFill();

      // // yellow line = movement direction in WORLD space (before rotation)
      // // draw it in local space by reversing the display rotation
      // const worldAngle = Math.atan2(direction.dy, direction.dx);
      // const localAngle = worldAngle - (display.rotation ?? 0);
      // arrow.lineStyle(3, 0xffff00, 1);
      // arrow.moveTo(0, 0);
      // arrow.lineTo(Math.cos(localAngle) * 100, Math.sin(localAngle) * 100);

      return spineHeading.angle;
    }
    return getHeadingAngle(direction);
  }

  function spawnFish(event: SpawnEvent) {
    const bossScene = BOSS_SCENE_BY_FISH_ID[event.fishId];
    if (event.isBoss && bossScene) {
      if (bossSceneLock && bossSceneLock !== bossScene && bossActiveCount > 0) {
        pendingBossEvents.push(event);
        return;
      }
      if (!bossSceneLock) {
        bossSceneLock = bossScene;
        bossActiveCount += 1;
        switchScene(bossScene, "boss");
      } else {
        bossActiveCount += 1;
      }
    }

    if (!event.renderable) {
      if (event.isBoss) {
        bossTimers.push({ remainingMs: getPathDurationMs(event.pathId) });
      }
      return;
    }

    const handle = fishFactory.createAnimatedFishBySpawnFishId(event.fishId);
    if (!handle) {
      if (event.isBoss) {
        bossTimers.push({ remainingMs: getPathDurationMs(event.pathId) });
      }
      return;
    }

    const pathPoints = getPathPoints(event.pathId);
    if (!pathPoints || pathPoints.length === 0) {
      handle.destroy();
      return;
    }

    const segments = buildBezierSegments(pathPoints);
    if (segments.length === 0) {
      handle.destroy();
      return;
    }
    const firstSegment = segments[0];
    const firstPoint = firstSegment?.p0 ?? pathPoints[0];
    if (!firstPoint || !firstSegment) {
      handle.destroy();
      return;
    }
    handle.display.position.set(firstPoint.x, firstPoint.y);
    const direction = bezierTangent(
      firstSegment.p0,
      firstSegment.p1,
      firstSegment.p2,
      firstSegment.p3,
      0,
    );

    // 1. read factory scale immediately — nothing has touched it yet
    const baseScaleX = (handle.display as PIXI.Container).scale.x || 1;
    const baseScaleY = (handle.display as PIXI.Container).scale.y || 1;

    // 2. tag immediately
    const d = handle.display as PIXI.Container & {
      __baseScaleX?: number;
      __baseScaleY?: number;
    };
    d.__baseScaleX = baseScaleX;
    d.__baseScaleY = baseScaleY;

    // 3. NOW apply childScale on top
    const childScale = getFishChildScale();
    (handle.display as PIXI.Container).scale.set(
      baseScaleX * childScale.x,
      baseScaleY * childScale.y,
    );

    const uniformChildScale = Math.min(childScale.x, childScale.y);
    (handle.display as PIXI.Container).scale.set(
      baseScaleX * uniformChildScale,
      baseScaleY * uniformChildScale,
    );

    console.log(
      "[spawnFish] fishId:",
      event.fishId,
      "baseScale:",
      baseScaleX,
      baseScaleY,
      "childScale:",
      childScale.x,
      childScale.y,
      "final:",
      baseScaleX * childScale.x,
      baseScaleY * childScale.y,
    );

    // 4. heading AFTER scale is set
    if ("rotation" in handle.display) {
      handle.display.rotation = getHeadingAngleForDisplay(
        handle.display,
        direction,
        baseScaleX,
        baseScaleY,
      );
    }

    fishLayer.addChild(handle.display);
    const apiFish = getManifestFishById(event.fishId);
    (handle.display as any).__fishData = apiFish ?? null;

    liveFish.push({
      display: handle.display,
      destroy: handle.destroy,
      fishId: event.fishId,
      pathId: event.pathId,
      elapsedMs: 0,
      segments,
      segmentIndex: 0,
      segmentElapsedMs: 0,
      delayRemainingMs: segments[0]?.delayMs ?? 0,
      baseScaleX,
      baseScaleY,
      isBoss: event.isBoss,
      angle: handle.display.rotation ?? 0,
      isExiting: false,
      walkAnimSpeed: getFishWalkAnimSpeed(event.fishId),
    });
  }

  function restoreLiveFishFromState(
    fishes: RestoredLiveFishState[] | undefined,
  ) {
    if (!Array.isArray(fishes) || fishes.length === 0) return;
    for (const saved of fishes) {
      if (!saved || saved.fish_id <= 0 || saved.path_id <= 0) continue;
      const handle = fishFactory.createAnimatedFishBySpawnFishId(saved.fish_id);
      if (!handle) continue;
      const pathPoints = getPathPoints(saved.path_id);
      if (!pathPoints || pathPoints.length === 0) {
        handle.destroy();
        continue;
      }
      const segments = buildBezierSegments(pathPoints);
      if (segments.length === 0) {
        handle.destroy();
        continue;
      }

      // ── Read raw factory scale BEFORE touching it — same as spawnFish ──────
      const baseScaleX = (handle.display as PIXI.Container).scale.x || 1;
      const baseScaleY = (handle.display as PIXI.Container).scale.y || 1;

      // ── Tag it ───────────────────────────────────────────────────────────────
      const d = handle.display as PIXI.Container & {
        __baseScaleX?: number;
        __baseScaleY?: number;
      };
      d.__baseScaleX = baseScaleX;
      d.__baseScaleY = baseScaleY;

      // ── Apply childScale on top — identical to spawnFish ─────────────────────
      const childScale = getFishChildScale();
      const uniformChildScale = Math.min(childScale.x, childScale.y);
      (handle.display as PIXI.Container).scale.set(
        baseScaleX * uniformChildScale,
        baseScaleY * uniformChildScale,
      );

      handle.display.position.set(saved.x, saved.y);
      if ("rotation" in handle.display) {
        handle.display.rotation = Number.isFinite(saved.angle)
          ? saved.angle
          : 0;
      }

      fishLayer.addChild(handle.display);
      const apiFish = getManifestFishById(saved.fish_id);
      (handle.display as any).__fishData = apiFish ?? null;

      liveFish.push({
        display: handle.display,
        destroy: handle.destroy,
        fishId: saved.fish_id,
        pathId: saved.path_id,
        elapsedMs: Math.max(0, saved.elapsed_ms ?? 0),
        segments,
        segmentIndex: Math.max(0, saved.segment_index ?? 0),
        segmentElapsedMs: Math.max(0, saved.segment_elapsed_ms ?? 0),
        delayRemainingMs: Math.max(0, saved.delay_remaining_ms ?? 0),
        baseScaleX, // ← fresh from factory, not from saved state
        baseScaleY, // ← fresh from factory, not from saved state
        isBoss: Boolean(saved.is_boss),
        angle: Number.isFinite(saved.angle) ? saved.angle : 0,
        isExiting: Boolean(saved.is_exiting),
        exitTarget:
          Number.isFinite(saved.exit_target_x) &&
            Number.isFinite(saved.exit_target_y)
            ? new PIXI.Point(saved.exit_target_x!, saved.exit_target_y!)
            : undefined,
        exitSpeed:
          Number.isFinite(saved.exit_speed) && (saved.exit_speed ?? 0) > 0
            ? saved.exit_speed
            : undefined,
        walkAnimSpeed: getFishWalkAnimSpeed(saved.fish_id),
      });
    }
  }

  function enterContext(index: number, forcedGroupId?: number | null) {
    currentContextIndex = index;
    let attempts = 0;
    let events: SpawnEvent[] = [];
    let bossCount = 0;
    let groupId: number | null = null;

    if (forcedGroupId != null && forcedGroupId > 0) {
      const built = buildSpawnEvents(forcedGroupId);
      if (built.events.length > 0) {
        groupId = forcedGroupId;
        events = built.events;
        bossCount = built.bossCount;
      }
    }

    while (groupId == null && attempts < mainEntries.length + 5) {
      const pick = pickNextGroupId(lastContextNo);
      groupId = pick.groupId;
      if (pick.no != null) {
        lastContextNo = pick.no;
      }
      if (!groupId) {
        groupId = pickFallbackGroupId();
      }
      if (!groupId) break;
      const built = buildSpawnEvents(groupId);
      events = built.events;
      bossCount = built.bossCount;
      if (events.length > 0) break;
      attempts += 1;
    }

    if (!groupId || events.length === 0) {
      spawnEvents = [];
      spawnCursor = 0;
      leadInMs = 0;
      contextStartTime = performance.now();
      currentContextDurationMs = 2000;
      if (DEBUG_CONTEXT) {
        // eslint-disable-next-line no-console
        console.warn("[context2] no valid group, retrying soon");
      }
      return;
    }
    currentGroupId = groupId;

    const group = groupMap.get(currentGroupId);
    leadInMs = 0;
    contextStartTime = performance.now();
    spawnEvents = events;
    spawnCursor = 0;
    pendingBossEvents = [];

    const maxDelayMs = Math.max(
      0,
      ...spawnEvents.map((event) => event.delayMs),
    );
    const maxEventLifetimeMs = Math.max(
      0,
      ...spawnEvents.map(
        (event) => event.delayMs + getPathDurationMs(event.pathId),
      ),
    );
    const naturalWindowMs = Math.max(
      15000,
      (group?.duration ?? 30) * 1000 * TIME_SCALE,
    );
    const spawnWindowMs = leadInMs + maxDelayMs + CONTEXT_LINGER_MS;
    const liveWindowMs = leadInMs + maxEventLifetimeMs + CONTEXT_LINGER_MS;
    currentContextDurationMs = Math.max(
      naturalWindowMs,
      spawnWindowMs,
      liveWindowMs,
    );

    if (DEBUG_CONTEXT) {
      // eslint-disable-next-line no-console
      console.log("[context2] start", {
        index: currentContextIndex,
        groupId: currentGroupId,
        leadInMs,
        spawnCount: spawnEvents.length,
        bossCount,
        maxDelayMs,
        durationMs: currentContextDurationMs,
        scene: currentNormalSceneId ?? "bg1",
      });
    }

    bossActiveCount = 0;
    bossTimers = [];
    bossSceneLock = null;
  }

  function buildRuntimeStateSnapshot() {
    const elapsed = Math.max(0, performance.now() - contextStartTime);
    return {
      current_context_index: currentContextIndex,
      current_group_id: currentGroupId,
      spawn_cursor: spawnCursor,
      context_elapsed_ms: elapsed,
      current_scene_id: activeSceneId ?? currentNormalSceneId ?? "bg1",
      boss_scene_active: bossActiveCount > 0,
      boss_scene_lock_id: bossSceneLock ?? "",
      live_fish: liveFish.map((fish) => ({
        fish_id: fish.fishId,
        path_id: fish.pathId,
        x: fish.display.position.x,
        y: fish.display.position.y,
        segment_index: fish.segmentIndex,
        segment_elapsed_ms: fish.segmentElapsedMs,
        delay_remaining_ms: fish.delayRemainingMs,
        elapsed_ms: fish.elapsedMs,
        base_scale_x: fish.baseScaleX,
        base_scale_y: fish.baseScaleY,
        angle: fish.angle,
        is_boss: fish.isBoss,
        is_exiting: fish.isExiting,
        exit_target_x: fish.exitTarget?.x,
        exit_target_y: fish.exitTarget?.y,
        exit_speed: fish.exitSpeed,
      })),
    };
  }

  function setPaused(paused: boolean) {
    const now = performance.now();
    if (paused) {
      if (pausedAtMs != null) return;
      pausedAtMs = now;
      return;
    }

    if (pausedAtMs == null) return;
    const pausedDuration = Math.max(0, now - pausedAtMs);
    pausedAtMs = null;

    // Shift all time references forward by pause duration
    contextStartTime += pausedDuration;

    if (pendingContextSwitch) {
      pendingContextSwitch.activateAtMs += pausedDuration;
    }

    // ── Clamp contextStartTime so elapsed never overshoots ──────────────────
    // If the context would have expired during pause, reset it so it runs
    // from a fresh start rather than immediately triggering scheduleNextContext
    const resumeElapsed = performance.now() - contextStartTime;
    if (resumeElapsed >= currentContextDurationMs) {
      // Context expired while paused — reset start time to now
      // This means the context gets a full fresh run instead of
      // immediately scheduling the next one on the first tick
      contextStartTime = performance.now();
      spawnCursor = spawnEvents.length; // skip all pending spawns — already stale
    }

    // Skip any spawn events whose delay passed during pause
    const spawnElapsedMs = Math.max(
      0,
      performance.now() - contextStartTime - leadInMs,
    );
    while (
      spawnCursor < spawnEvents.length &&
      (spawnEvents[spawnCursor]?.delayMs ?? Infinity) <= spawnElapsedMs
    ) {
      spawnCursor += 1;
    }
  }

  function updateFish(deltaMs: number) {
    liveFish = liveFish.filter((fish) => {
      fish.elapsedMs += deltaMs;
      if (fish.isExiting && fish.exitTarget && fish.exitSpeed) {
        resetDisplayAnimationSpeed(fish.display);
        const dx = fish.exitTarget.x - fish.display.position.x;
        const dy = fish.exitTarget.y - fish.display.position.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 1) {
          const step = (fish.exitSpeed * deltaMs) / 1000;
          fish.display.position.set(
            fish.display.position.x + (dx / dist) * step,
            fish.display.position.y + (dy / dist) * step,
          );
          if ("rotation" in fish.display) {
            const target = getHeadingAngleForDisplay(
              fish.display,
              { dx, dy },
              fish.baseScaleX,
              fish.baseScaleY,
            );
            fish.angle = dtLerpAngle(fish.angle, target, 380, deltaMs);
            fish.display.rotation = fish.angle;
          }
        }
      } else {
        if (fish.segmentIndex >= fish.segments.length) {
          fishLayer.removeChild(fish.display);
          fish.destroy();
          return false;
        }

        if (fish.delayRemainingMs > 0) {
          resetDisplayAnimationSpeed(fish.display);
          fish.delayRemainingMs = Math.max(0, fish.delayRemainingMs - deltaMs);
        } else {
          const segment = fish.segments[fish.segmentIndex];
          if (!segment) {
            fishLayer.removeChild(fish.display);
            fish.destroy();
            return false;
          }
          const durationMs = Math.max(1, segment.durationMs);
          fish.segmentElapsedMs = Math.min(
            fish.segmentElapsedMs + deltaMs,
            durationMs,
          );
          const t =
            segment.durationMs <= 0 ? 1 : fish.segmentElapsedMs / durationMs;
          const point = bezierPoint(
            segment.p0,
            segment.p1,
            segment.p2,
            segment.p3,
            t,
          );
          const direction = bezierTangent(
            segment.p0,
            segment.p1,
            segment.p2,
            segment.p3,
            t,
          );

          setDisplayAnimationSpeed(
            fish.display,
            getWalkAdjustedAnimationSpeed(fish, segment),
          );

          fish.display.position.set(point.x, point.y);

          if ("rotation" in fish.display) {
            const target = getHeadingAngleForDisplay(
              fish.display,
              direction,
              fish.baseScaleX,
              fish.baseScaleY,
            );
            fish.angle = dtLerpAngle(fish.angle, target, 320, deltaMs);
            fish.display.rotation = fish.angle;
          }

          if (fish.segmentElapsedMs >= durationMs) {
            fish.segmentIndex += 1;
            fish.segmentElapsedMs = 0;
            const nextSegment = fish.segments[fish.segmentIndex];
            fish.delayRemainingMs = nextSegment?.delayMs ?? 0;
          }
        }
      }

      const isOutOfScreen =
        fish.display.position.x < -200 ||
        fish.display.position.x > GAME_WIDTH + 200 ||
        fish.display.position.y < -200 ||
        fish.display.position.y > GAME_HEIGHT + 200;

      if (!fish.isExiting && fish.segmentIndex >= fish.segments.length) {
        fishLayer.removeChild(fish.display);
        fish.destroy();
        if (fish.isBoss) {
          releaseBossSlot();
        }
        return false;
      }

      if (fish.isExiting && isOutOfScreen) {
        fishLayer.removeChild(fish.display);
        fish.destroy();
        if (fish.isBoss) {
          releaseBossSlot();
        }
        return false;
      }

      return true;
    });
  }

  function tick() {
    if (pausedAtMs != null) return;
    if (currentContextIndex < 0) return;

    const elapsedMs = performance.now() - contextStartTime;
    const spawnElapsedMs = Math.max(0, elapsedMs - leadInMs);
    const deltaMs = app.ticker.deltaMS;

    if (pendingContextSwitch) {
      updateFish(deltaMs);
      if (
        performance.now() >= pendingContextSwitch.activateAtMs &&
        !pendingContextSwitch.isActivating
      ) {
        const { nextIndex, nextSceneId } = pendingContextSwitch;
        pendingContextSwitch.isActivating = true;
        currentNormalSceneId = nextSceneId;
        Promise.resolve(switchScene(nextSceneId, "context_wipe"))
          .catch((error) => {
            console.error("[context2] context wipe transition failed", error);
          })
          .finally(() => {
            enterContext(nextIndex);
            pendingContextSwitch = null;
          });
      }
      return;
    }

    while (spawnCursor < spawnEvents.length) {
      const event = spawnEvents[spawnCursor];
      if (!event || event.delayMs > spawnElapsedMs) break;
      spawnFish(event);
      if (DEBUG_CONTEXT && spawnCursor % 15 === 0) {
        // eslint-disable-next-line no-console
        console.log("[context2] spawn", {
          index: spawnCursor,
          fishId: event.fishId,
          pathId: event.pathId,
          delayMs: event.delayMs,
        });
      }
      spawnCursor += 1;
    }

    updateFish(deltaMs);

    if (bossTimers.length > 0) {
      bossTimers = bossTimers
        .map((timer) => ({ remainingMs: timer.remainingMs - deltaMs }))
        .filter((timer) => timer.remainingMs > 0);
      while (bossActiveCount > bossTimers.length && bossTimers.length === 0) {
        releaseBossSlot();
      }
    }

    if (elapsedMs >= currentContextDurationMs) {
      if (DEBUG_CONTEXT) {
        // eslint-disable-next-line no-console
        console.log("[context2] end", {
          index: currentContextIndex,
          elapsedMs,
          scene: activeSceneId,
        });
      }
      scheduleNextContext(currentContextIndex + 1);
    }
  }

  function start() {
    if (currentContextIndex >= 0) return;
    const restoredScene = initialRuntimeState?.current_scene_id;
    const restoredContextIndex = initialRuntimeState?.current_context_index;
    const restoredGroupId = initialRuntimeState?.current_group_id;
    const restoredSpawnCursor = initialRuntimeState?.spawn_cursor;
    const restoredContextElapsedMs = initialRuntimeState?.context_elapsed_ms;
    const startScene =
      restoredScene && restoredScene.length > 0
        ? restoredScene
        : pickRandomNormalScene(null);

    currentNormalSceneId = NORMAL_SCENES.includes(startScene as any)
      ? startScene
      : "bg1";
    switchScene(startScene, "normal");

    const startIndex =
      typeof restoredContextIndex === "number" && restoredContextIndex >= 0
        ? restoredContextIndex
        : 0;
    enterContext(startIndex, restoredGroupId);
    if (
      typeof restoredContextElapsedMs === "number" &&
      restoredContextElapsedMs >= 0
    ) {
      const boundedElapsed = Math.min(
        restoredContextElapsedMs,
        Math.max(0, currentContextDurationMs - 1),
      );
      contextStartTime = performance.now() - boundedElapsed;
    }
    if (
      typeof restoredSpawnCursor === "number" &&
      restoredSpawnCursor >= 0 &&
      restoredSpawnCursor <= spawnEvents.length
    ) {
      spawnCursor = restoredSpawnCursor;
    }
    restoreLiveFishFromState(initialRuntimeState?.live_fish);
    app.ticker.add(tick);
  }

  function destroy() {
    app.ticker.remove(tick);
    clearFish();
  }

  function playKillAnimationForDisplay(
    display: PIXI.DisplayObject | null | undefined,
  ) {
    if (!display) return;

    const liveIndex = liveFish.findIndex((fish) => fish.display === display);
    const live = liveIndex >= 0 ? liveFish[liveIndex] : null;
    const tagged = display as PIXI.DisplayObject & {
      isDying?: boolean;
      __isDying?: boolean;
      __isDeadFish?: boolean;
      x: number;
      y: number;
      alpha: number;
      rotation: number;
    };

    if (tagged.isDying || tagged.__isDying) return;
    tagged.isDying = true;
    tagged.__isDying = true;
    tagged.__isDeadFish = true;

    if (liveIndex >= 0) {
      liveFish.splice(liveIndex, 1);
    }

    const obj = display as PIXI.Container;

    // Stop swimming animation if it's an AnimatedSprite
    const anim = (obj as any).__anim as PIXI.AnimatedSprite | undefined;
    if (anim && !anim.destroyed) anim.stop();

    const startX = obj.x;
    const startY = obj.y;
    const startRot = obj.rotation ?? 0;
    const startAlpha = obj.alpha ?? 1;

    const SHOCK_MS = 90;
    const DROP_MS = 210;
    const PANIC_MS = 260;
    const FADE_MS = 240;
    const TOTAL_MS = SHOCK_MS + DROP_MS + PANIC_MS + FADE_MS;

    const SHOCK_LIFT = 18;
    const BOUNCE_DEPTH = 6;

    const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
    const easeInOut = (t: number) => t < 0.5
      ? 4 * t * t * t
      : 1 - Math.pow(-2 * t + 2, 3) / 2;

    let elapsed = 0;

    const onKill = () => {
      if (obj.destroyed) {
        PIXI.Ticker.shared.remove(onKill);
        cleanup();
        return;
      }

      elapsed += PIXI.Ticker.shared.elapsedMS;

      // Phase 1 — shock: shake sideways + lift up
      if (elapsed <= SHOCK_MS) {
        const t = Math.min(elapsed / SHOCK_MS, 1);
        obj.x = startX + Math.sin(t * Math.PI * 5) * 5 * (1 - t * 0.35);
        obj.y = startY - SHOCK_LIFT * easeOut(t);
        obj.rotation = startRot + Math.sin(t * Math.PI * 4) * 0.08 * (1 - t);
        obj.alpha = startAlpha;
        return;
      }

      // Phase 2 — drop: fall back down with a small bounce
      if (elapsed <= SHOCK_MS + DROP_MS) {
        const t = Math.min((elapsed - SHOCK_MS) / DROP_MS, 1);
        obj.x = startX + Math.sin(t * Math.PI * 6) * 1.5 * (1 - t);
        if (t < 0.78) {
          obj.y = startY - SHOCK_LIFT + (SHOCK_LIFT + BOUNCE_DEPTH) * easeInOut(t / 0.78);
        } else {
          obj.y = startY + BOUNCE_DEPTH * (1 - easeOut((t - 0.78) / 0.22));
        }
        obj.rotation = startRot + Math.sin(t * Math.PI * 3) * 0.04 * (1 - t);
        obj.alpha = startAlpha;
        return;
      }

      // Phase 3 & 4 — panic wiggle, then fade out
      const panicElapsed = elapsed - SHOCK_MS - DROP_MS;
      const wave = panicElapsed * 0.07;
      obj.x = startX + Math.sin(wave * 2.6) * 4;
      obj.y = startY + Math.sin(wave) * 2;
      obj.rotation = startRot + Math.sin(wave * 1.8) * 0.05;

      // Speed up the swim cycle during panic
      const animSprite = (obj as any).__anim as PIXI.AnimatedSprite | undefined;
      if (animSprite && !animSprite.destroyed) {
        animSprite.animationSpeed = Math.max(
          2.4,
          ((obj as any).__walkAnimSpeed ?? 1) * 2.8,
        );
        if (!animSprite.playing) animSprite.play();
      }

      if (panicElapsed > PANIC_MS) {
        const fadeT = Math.min((panicElapsed - PANIC_MS) / FADE_MS, 1);
        obj.alpha = startAlpha * (1 - easeOut(fadeT));
      } else {
        obj.alpha = startAlpha;
      }

      if (elapsed < TOTAL_MS) return;

      PIXI.Ticker.shared.remove(onKill);
      cleanup();
    };

    const cleanup = () => {
      if (!obj.destroyed) fishLayer.removeChild(obj);
      live?.destroy();
      if (live?.isBoss) releaseBossSlot();
    };

    PIXI.Ticker.shared.add(onKill);
  }
  return {
    start,
    destroy,
    playKillAnimationForDisplay,
    getRuntimeState: buildRuntimeStateSnapshot,
    setPaused,
  };
}
