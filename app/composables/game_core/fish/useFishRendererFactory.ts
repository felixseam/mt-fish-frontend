/**
 * useFishRendererFactory2.ts
 *
 * Re-implementation of useFishRendererFactory that consumes ONLY manifest fish data.
 * Replaces fishCatalog + fishAnimationDb + fishScaleDb + fishZOrderDb with API manifest data.
 */

import * as PIXI from "pixi.js";
import { Spine } from "pixi-spine";
import { FISH_BASE_PATH } from "~/composables/game_core/assets/useFishAssetPreload";
import { getManifestFishTypes } from "~/composables/game_core/fish/useManifestFishData";

type ApiRenderState = {
  id: number;
  render_family_id: number;
  state_code: string;
  prefix: string;
  frame_array: string[];
  is_default: boolean;
};

type ApiRenderFamily = {
  id: number;
  render_family_name: string;
  render_type_id: number;
  spine_json_path: string | null;
  spine_atlas_path: string | null;
  spine_png_path: string | null;
  render_type: { id: number; type_code: string } | null;
  render_states: ApiRenderState[];
};

type ApiFishType = {
  id: number;
  default_state_code: string;
  scale: number;
  zindex: number;
  base_speed: number;
  render_family: ApiRenderFamily | null;
};

type AtlasSpriteState = {
  atlasUrl: string;
  prefix: string | null;
  frames: string[];
};

type FishRenderCacheEntry = {
  fish: ApiFishType;
  scale: number;
  zIndex: number;
  spriteAnimationSpeed: number;
  spineAnimationSpeed: number;
  states: Map<string, AtlasSpriteState | null>;
};

export type FishDisplayHandle = {
  display: PIXI.DisplayObject;
  destroy: () => void;
};

const DEFAULT_SPRITE_ANIMATION_SPEED = 0.25;
const DEFAULT_SPINE_ANIMATION_SPEED = 1;
const fishEntryCache = new Map<number, FishRenderCacheEntry>();
const sortedFrameCache = new WeakMap<string[], string[]>();

function getFishEntry(spawnFishId: number): ApiFishType | undefined {
  let cached = fishEntryCache.get(spawnFishId);
  if (cached) return cached.fish;

  const entry = getManifestFishTypes().find((f) => f.id === spawnFishId) as
    | ApiFishType
    | undefined;
  if (!entry) return undefined;

  const scale =
    typeof entry.scale === "number" && Number.isFinite(entry.scale)
      ? entry.scale
      : 1;
  const zIndex =
    typeof entry.zindex === "number" && Number.isFinite(entry.zindex)
      ? entry.zindex
      : 0;
  const baseSpeed =
    typeof entry.base_speed === "number" && Number.isFinite(entry.base_speed)
      ? entry.base_speed
      : null;

  cached = {
    fish: entry,
    scale,
    zIndex,
    spriteAnimationSpeed: baseSpeed ?? DEFAULT_SPRITE_ANIMATION_SPEED,
    spineAnimationSpeed: baseSpeed ?? DEFAULT_SPINE_ANIMATION_SPEED,
    states: new Map(),
  };
  fishEntryCache.set(spawnFishId, cached);
  return entry;
}

function getFishScale(spawnFishId: number): number {
  getFishEntry(spawnFishId);
  return fishEntryCache.get(spawnFishId)?.scale ?? 1;
}

function getFishZOrder(spawnFishId: number): number {
  getFishEntry(spawnFishId);
  return fishEntryCache.get(spawnFishId)?.zIndex ?? 0;
}

function getFishAnimationSpeed(
  spawnFishId: number,
  renderer: "atlas_sprite_anim" | "spine",
): number {
  getFishEntry(spawnFishId);
  const cached = fishEntryCache.get(spawnFishId);
  return renderer === "spine"
    ? (cached?.spineAnimationSpeed ?? DEFAULT_SPINE_ANIMATION_SPEED)
    : (cached?.spriteAnimationSpeed ?? DEFAULT_SPRITE_ANIMATION_SPEED);
}

function buildShadowSprite(
  textures: PIXI.Texture[],
  animationSpeed: number,
): PIXI.AnimatedSprite {
  const shadow = new PIXI.AnimatedSprite(textures);
  shadow.anchor.set(0.5);
  shadow.animationSpeed = animationSpeed;
  shadow.tint = 0x000000;
  shadow.alpha = 0.25;
  shadow.play();
  return shadow;
}

function buildShadowSpine(
  spineData: unknown,
  animationName: string,
  loop: boolean,
  timeScale: number,
): Spine {
  const shadow = new Spine(spineData as never);
  shadow.alpha = 0.25;
  (shadow as unknown as { tint?: number }).tint = 0x000000;
  shadow.skeleton?.setToSetupPose?.();
  if (shadow.state?.hasAnimation(animationName)) {
    shadow.state.setAnimation(0, animationName, loop);
    shadow.state.timeScale = timeScale;
    shadow.state.update(0);
    shadow.state.apply(shadow.skeleton);
  }
  shadow.skeleton?.updateWorldTransform?.();
  shadow.update(0);
  return shadow;
}

function getAtlasUrlFromPrefix(prefix: string | null): string | null {
  if (!prefix) return null;
  const cleanPrefix = prefix.replace(/\/+$/, "");
  return `${FISH_BASE_PATH}/${cleanPrefix}.atlas.txt`;
}

function sortFramesForPlayback(frames: string[]) {
  const cached = sortedFrameCache.get(frames);
  if (cached) return cached;

  const sorted = [...frames].sort((left, right) => {
    const leftNums = left.match(/\d+/g)?.map(Number) ?? [];
    const rightNums = right.match(/\d+/g)?.map(Number) ?? [];
    const maxLen = Math.max(leftNums.length, rightNums.length);

    for (let index = 0; index < maxLen; index += 1) {
      const leftVal = leftNums[index] ?? 0;
      const rightVal = rightNums[index] ?? 0;
      if (leftVal !== rightVal) return leftVal - rightVal;
    }

    return left.localeCompare(right);
  });
  sortedFrameCache.set(frames, sorted);
  return sorted;
}

function normalizeStateFrames(state: ApiRenderState): AtlasSpriteState | null {
  const atlasUrl = getAtlasUrlFromPrefix(state.prefix);
  return atlasUrl
    ? {
        atlasUrl,
        prefix: state.prefix ?? null,
        frames: sortFramesForPlayback(state.frame_array),
      }
    : null;
}

function getAtlasState(
  spawnFishId: number,
  stateName?: string,
): AtlasSpriteState | null {
  const fishEntry = getFishEntry(spawnFishId);
  if (!fishEntry?.render_family) return null;

  const cache = fishEntryCache.get(spawnFishId);

  const family = fishEntry.render_family;
  const typeCode = family.render_type?.type_code;
  if (typeCode !== "atlas_sprite_anim") return null;

  const targetState = stateName ?? fishEntry.default_state_code ?? "move";
  const cachedState = cache?.states.get(targetState);
  if (cachedState !== undefined) return cachedState;

  const state = family.render_states.find((s) => s.state_code === targetState);
  if (!state) {
    cache?.states.set(targetState, null);
    return null;
  }

  const normalized = normalizeStateFrames(state);
  cache?.states.set(targetState, normalized);
  return normalized;
}

export function getRenderableFishAtlasUrls(): string[] {
  const urls = new Set<string>();

  for (const fish of getManifestFishTypes() as ApiFishType[]) {
    const family = fish.render_family;
    if (family?.render_type?.type_code !== "atlas_sprite_anim") continue;

    for (const state of family.render_states) {
      const normalized = normalizeStateFrames(state);
      if (normalized?.atlasUrl) {
        urls.add(normalized.atlasUrl);
      }
    }
  }

  return [...urls];
}

export function getRenderableSpineManifests(): Array<{
  json: string;
  atlas: string;
}> {
  const seenJson = new Set<string>();
  const manifests: Array<{ json: string; atlas: string }> = [];

  for (const fish of getManifestFishTypes() as ApiFishType[]) {
    const family = fish.render_family;
    if (family?.render_type?.type_code !== "spine") continue;
    if (!family.spine_json_path || !family.spine_atlas_path) continue;
    if (seenJson.has(family.spine_json_path)) continue;

    seenJson.add(family.spine_json_path);
    manifests.push({
      json: family.spine_json_path,
      atlas: family.spine_atlas_path,
    });
  }

  return manifests;
}

export function createFishRendererFactory(options: {
  getAtlasTexture: (atlasUrl: string, frame: string) => PIXI.Texture;
}) {
  const { getAtlasTexture } = options;
  const textureFramesCache = new Map<string, PIXI.Texture[]>();

  const getTexturesForState = (state: AtlasSpriteState) => {
    const cacheKey = `${state.atlasUrl}\n${state.frames.join("\n")}`;
    const cached = textureFramesCache.get(cacheKey);
    if (cached) return cached;

    const textures: PIXI.Texture[] = [];
    for (const frame of state.frames) {
      const texture = getAtlasTexture(state.atlasUrl, frame);
      if (texture !== PIXI.Texture.WHITE) textures.push(texture);
    }
    textureFramesCache.set(cacheKey, textures);
    return textures;
  };

  function createAnimatedFishBySpawnFishId(
    spawnFishId: number,
    stateName?: string,
  ): FishDisplayHandle | null {
    const state = getAtlasState(spawnFishId, stateName);
    if (!state) {
      // Try spine fallback
      const fishEntry = getFishEntry(spawnFishId);
      if (!fishEntry?.render_family) return null;

      const family = fishEntry.render_family;
      if (family.render_type?.type_code !== "spine" || !family.spine_json_path)
        return null;

      const spineResource = PIXI.Assets.get(family.spine_json_path) as
        | { spineData?: unknown }
        | undefined;
      const spineData = spineResource?.spineData ?? spineResource;
      if (!spineData || typeof spineData !== "object") return null;

      const spine = new Spine(spineData as never);
      const scale = getFishScale(spawnFishId);
      const anim = stateName ?? fishEntry.default_state_code ?? "run";
      const animationSpeed = getFishAnimationSpeed(spawnFishId, "spine");
      spine.skeleton?.setToSetupPose?.();
      if (spine.state?.hasAnimation(anim)) {
        spine.state.setAnimation(0, anim, true);
        spine.state.timeScale = animationSpeed;
        spine.state.update(0);
        spine.state.apply(spine.skeleton);
      }
      spine.skeleton?.updateWorldTransform?.();
      spine.update(0);

      const shadow = buildShadowSpine(spineData, anim, true, animationSpeed);
      shadow.position.set(8, 10);

      const wrapper = new PIXI.Container() as PIXI.Container & {
        __spineUpright?: boolean;
        __fishId?: number;
        __anim?: PIXI.DisplayObject;
        __shadowAnim?: PIXI.DisplayObject;
        __baseAnimSpeed?: number;
      };
      wrapper.__spineUpright = true;
      wrapper.__fishId = spawnFishId;
      wrapper.__anim = spine;
      wrapper.__shadowAnim = shadow;
      wrapper.__baseAnimSpeed = animationSpeed;
      wrapper.addChild(shadow);
      wrapper.addChild(spine);
      wrapper.scale.set(scale);
      wrapper.zIndex = getFishZOrder(spawnFishId);

      return {
        display: wrapper,
        destroy: () => wrapper.destroy({ children: true }),
      };
    }

    const textures = getTexturesForState(state);

    if (textures.length === 0) return null;

    const sprite = new PIXI.AnimatedSprite(textures);
    sprite.anchor.set(0.5);
    sprite.animationSpeed = getFishAnimationSpeed(
      spawnFishId,
      "atlas_sprite_anim",
    );
    sprite.play();

    const shadow = buildShadowSprite(textures, sprite.animationSpeed);
    shadow.position.set(8, 10);

    const wrapper = new PIXI.Container() as PIXI.Container & {
      __fishId?: number;
      __anim?: PIXI.DisplayObject;
      __shadowAnim?: PIXI.DisplayObject;
      __baseAnimSpeed?: number;
    };
    wrapper.__fishId = spawnFishId;
    wrapper.__anim = sprite;
    wrapper.__shadowAnim = shadow;
    wrapper.__baseAnimSpeed = sprite.animationSpeed;
    wrapper.addChild(shadow);
    wrapper.addChild(sprite);
    wrapper.scale.set(getFishScale(spawnFishId));
    wrapper.zIndex = getFishZOrder(spawnFishId);

    return {
      display: wrapper,
      destroy: () => wrapper.destroy({ children: true }),
    };
  }

  return {
    createAnimatedFishBySpawnFishId,
  };
}
