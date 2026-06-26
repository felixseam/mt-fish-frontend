<template>
  <main class="throw-debug-page">
    <header class="throw-toolbar">
      <div>
        <p class="throw-kicker">Spine Debug</p>
        <h1>Throw Animation Tester</h1>
      </div>

      <div class="throw-meta">
        <span>{{ animationNames.length }} animations</span>
        <span>Spine {{ spineVersion || "-" }}</span>
        <span>{{ selectedAnimation || "Loading" }}</span>
      </div>
    </header>

    <section class="throw-workspace">
      <aside class="throw-panel throw-sidebar">
        <div class="throw-control-row">
          <button
            class="throw-button throw-button-primary"
            type="button"
            :disabled="!isSpineReady || isLoading"
            @click="playAllAnimations"
          >
            Play All
          </button>
          <button
            class="throw-button"
            type="button"
            :disabled="!isSpineReady || isLoading"
            @click="replaySelected"
          >
            Replay
          </button>
        </div>

        <label class="throw-toggle">
          <input v-model="loopAnimation" type="checkbox" @change="replaySelected" />
          <span>Loop animation</span>
        </label>

        <label class="throw-field">
          <span>Speed</span>
          <input
            v-model.number="animationSpeed"
            type="range"
            min="0.2"
            max="2.5"
            step="0.1"
          />
          <strong>{{ animationSpeed.toFixed(1) }}x</strong>
        </label>

        <label class="throw-field">
          <span>Scale</span>
          <input
            v-model.number="previewScale"
            type="range"
            min="0.4"
            max="2"
            step="0.05"
            @input="frameSpine"
          />
          <strong>{{ previewScale.toFixed(2) }}x</strong>
        </label>

        <div class="throw-list" aria-label="Throw animations">
          <button
            v-for="name in animationNames"
            :key="name"
            class="throw-animation-button"
            :class="{ active: name === selectedAnimation }"
            type="button"
            @click="selectAnimation(name)"
          >
            {{ name }}
          </button>
        </div>
      </aside>

      <section class="throw-stage-shell">
        <div ref="pixiMountRef" class="throw-stage" />

        <div v-if="isLoading || errorMessage" class="throw-overlay">
          <div class="throw-state" :class="{ error: Boolean(errorMessage) }">
            {{ errorMessage || "Loading throw animation..." }}
          </div>
        </div>
      </section>

      <aside class="throw-panel throw-info">
        <h2>Asset</h2>
        <dl>
          <div>
            <dt>JSON</dt>
            <dd>/throw/skeleton.json</dd>
          </div>
          <div>
            <dt>Atlas</dt>
            <dd>/throw/skeleton.atlas</dd>
          </div>
          <div>
            <dt>Texture</dt>
            <dd>/throw/skeleton.png</dd>
          </div>
          <div>
            <dt>Skins</dt>
            <dd>{{ skinNames.join(", ") || "-" }}</dd>
          </div>
        </dl>
      </aside>
    </section>
  </main>
</template>

<script setup lang="ts">
import { Spine } from "pixi-spine";
import * as PIXI from "pixi.js";
import { nextTick, onBeforeUnmount, onMounted, ref, watch } from "vue";

type ThrowSkeleton = {
  skeleton?: {
    spine?: string;
  };
  animations?: Record<string, unknown>;
  skins?: Record<string, unknown> | Array<{ name?: string }>;
};

type SpineConstructorData = ConstructorParameters<typeof Spine>[0];
type SpineAssetResource = {
  spineData?: SpineConstructorData;
};

const STAGE_WIDTH = 960;
const STAGE_HEIGHT = 640;
const THROW_JSON_URL = "/throw/skeleton.json";
const THROW_ATLAS_URL = "/throw/skeleton.atlas";

const pixiMountRef = ref<HTMLDivElement | null>(null);
const animationNames = ref<string[]>([]);
const skinNames = ref<string[]>([]);
const spineVersion = ref("");
const selectedAnimation = ref("");
const animationSpeed = ref(1);
const previewScale = ref(1);
const loopAnimation = ref(true);
const isLoading = ref(true);
const isSpineReady = ref(false);
const errorMessage = ref("");

let app: PIXI.Application | null = null;
let resizeObserver: ResizeObserver | null = null;
let spine: Spine | null = null;
let playAllTimeout: number | null = null;

function getSkinNames(skins: ThrowSkeleton["skins"]) {
  if (!skins) return [];
  if (Array.isArray(skins)) {
    return skins.map((skin) => skin.name).filter(Boolean) as string[];
  }
  return Object.keys(skins);
}

function fitCanvas(container: HTMLDivElement) {
  if (!app) return;

  const bounds = container.getBoundingClientRect();
  const scale = Math.min(bounds.width / STAGE_WIDTH, bounds.height / STAGE_HEIGHT);
  const view = app.view as HTMLCanvasElement;
  view.style.width = `${STAGE_WIDTH * scale}px`;
  view.style.height = `${STAGE_HEIGHT * scale}px`;
}

function frameSpine() {
  if (!spine) return;

  spine.skeleton?.updateWorldTransform?.();
  const bounds = spine.getLocalBounds();
  const fitScale = Math.min(
    (STAGE_WIDTH * 0.7) / Math.max(bounds.width, 1),
    (STAGE_HEIGHT * 0.72) / Math.max(bounds.height, 1),
  );

  spine.pivot.set(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2);
  spine.position.set(STAGE_WIDTH / 2, STAGE_HEIGHT / 2 + 22);
  spine.scale.set(fitScale * previewScale.value);
}

function clearPlayAllTimer() {
  if (!playAllTimeout) return;
  window.clearTimeout(playAllTimeout);
  playAllTimeout = null;
}

function setAnimation(name: string, loop = loopAnimation.value) {
  if (!spine?.state?.hasAnimation(name)) return;

  selectedAnimation.value = name;
  spine.skeleton?.setToSetupPose?.();
  spine.state.setAnimation(0, name, loop);
  spine.state.timeScale = animationSpeed.value;
  spine.update(0);
  frameSpine();
}

function selectAnimation(name: string) {
  clearPlayAllTimer();
  setAnimation(name);
}

function replaySelected() {
  if (!selectedAnimation.value) return;
  setAnimation(selectedAnimation.value);
}

function playAllAnimations() {
  if (!animationNames.value.length) return;

  clearPlayAllTimer();
  loopAnimation.value = false;

  let index = Math.max(animationNames.value.indexOf(selectedAnimation.value), 0);

  const playNext = () => {
    const name = animationNames.value[index % animationNames.value.length];
    if (!name) return;

    setAnimation(name, false);
    index += 1;
    playAllTimeout = window.setTimeout(playNext, 1500 / animationSpeed.value);
  };

  playNext();
}

async function loadThrowStage(container: HTMLDivElement) {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const manifest = await $fetch<ThrowSkeleton>(THROW_JSON_URL);
    animationNames.value = Object.keys(manifest.animations ?? {}).sort((left, right) =>
      left.localeCompare(right),
    );
    skinNames.value = getSkinNames(manifest.skins);
    spineVersion.value = manifest.skeleton?.spine ?? "";

    app = new PIXI.Application({
      width: STAGE_WIDTH,
      height: STAGE_HEIGHT,
      antialias: true,
      backgroundAlpha: 0,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
    });

    container.innerHTML = "";
    container.appendChild(app.view as HTMLCanvasElement);

    const background = new PIXI.Graphics();
    background.beginFill(0x08131f, 1);
    background.drawRect(0, 0, STAGE_WIDTH, STAGE_HEIGHT);
    background.endFill();

    const grid = new PIXI.Graphics();
    grid.lineStyle(1, 0x23455f, 0.34);
    for (let x = 0; x <= STAGE_WIDTH; x += 80) {
      grid.moveTo(x, 0);
      grid.lineTo(x, STAGE_HEIGHT);
    }
    for (let y = 0; y <= STAGE_HEIGHT; y += 80) {
      grid.moveTo(0, y);
      grid.lineTo(STAGE_WIDTH, y);
    }

    const centerLine = new PIXI.Graphics();
    centerLine.lineStyle(2, 0xf4b95b, 0.42);
    centerLine.moveTo(STAGE_WIDTH / 2, 0);
    centerLine.lineTo(STAGE_WIDTH / 2, STAGE_HEIGHT);
    centerLine.moveTo(0, STAGE_HEIGHT / 2 + 22);
    centerLine.lineTo(STAGE_WIDTH, STAGE_HEIGHT / 2 + 22);

    app.stage.addChild(background, grid, centerLine);

    const resource = (await PIXI.Assets.load({
      src: THROW_JSON_URL,
      data: { spineAtlasFile: THROW_ATLAS_URL },
    })) as SpineAssetResource | SpineConstructorData;
    const spineData =
      "spineData" in Object(resource)
        ? (resource as SpineAssetResource).spineData
        : (resource as SpineConstructorData);

    if (!spineData) {
      throw new Error(`Failed to load spine data from ${THROW_JSON_URL}.`);
    }

    spine = new Spine(spineData);
    spine.autoUpdate = true;
    app.stage.addChild(spine);
    isSpineReady.value = true;

    setAnimation(animationNames.value[0] ?? "", true);
    fitCanvas(container);
    resizeObserver = new ResizeObserver(() => fitCanvas(container));
    resizeObserver.observe(container);
  } catch (error) {
    console.error(error);
    errorMessage.value =
      error instanceof Error ? error.message : "Unable to load throw animation.";
  } finally {
    isLoading.value = false;
  }
}

watch(animationSpeed, () => {
  if (spine) {
    spine.state.timeScale = animationSpeed.value;
  }
});

onMounted(async () => {
  await nextTick();
  if (!pixiMountRef.value) return;
  void loadThrowStage(pixiMountRef.value);
});

onBeforeUnmount(() => {
  clearPlayAllTimer();
  resizeObserver?.disconnect();
  resizeObserver = null;
  isSpineReady.value = false;
  spine = null;

  if (app) {
    app.destroy(true, { children: true, texture: false, baseTexture: false });
    app = null;
  }
});
</script>

<style scoped>
.throw-debug-page {
  min-height: 100dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  background:
    linear-gradient(135deg, rgba(244, 185, 91, 0.14), transparent 28%),
    linear-gradient(225deg, rgba(83, 204, 166, 0.12), transparent 30%),
    #050b12;
  color: #edf7ff;
  overflow: auto;
}

.throw-toolbar {
  display: flex;
  align-items: end;
  justify-content: space-between;
  gap: 18px;
  padding: 18px 22px;
  border-bottom: 1px solid rgba(144, 192, 220, 0.18);
  background: rgba(4, 11, 18, 0.86);
}

.throw-kicker,
.throw-meta,
.throw-field span,
.throw-toggle,
dt {
  color: rgba(194, 226, 244, 0.76);
  font-size: 12px;
}

.throw-kicker {
  margin: 0 0 4px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h1,
h2 {
  margin: 0;
  letter-spacing: 0;
}

h1 {
  font-size: 26px;
  line-height: 1.15;
}

h2 {
  font-size: 15px;
}

.throw-meta {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
}

.throw-meta span {
  min-height: 30px;
  display: inline-flex;
  align-items: center;
  border: 1px solid rgba(144, 192, 220, 0.2);
  border-radius: 8px;
  padding: 0 10px;
  background: rgba(255, 255, 255, 0.04);
}

.throw-workspace {
  min-height: 0;
  display: grid;
  grid-template-columns: 260px minmax(360px, 1fr) 240px;
  gap: 14px;
  padding: 14px;
}

.throw-panel {
  border: 1px solid rgba(144, 192, 220, 0.18);
  border-radius: 8px;
  background: rgba(7, 17, 28, 0.82);
  padding: 14px;
}

.throw-sidebar {
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.throw-control-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 8px;
}

.throw-button,
.throw-animation-button {
  min-height: 38px;
  border: 1px solid rgba(144, 192, 220, 0.22);
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.05);
  color: inherit;
  cursor: pointer;
}

.throw-button:disabled {
  cursor: default;
  opacity: 0.48;
}

.throw-button-primary {
  border-color: rgba(244, 185, 91, 0.6);
  background: rgba(244, 185, 91, 0.18);
}

.throw-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
}

.throw-field {
  display: grid;
  grid-template-columns: 54px 1fr 48px;
  gap: 10px;
  align-items: center;
}

.throw-field input {
  width: 100%;
  accent-color: #f4b95b;
}

.throw-field strong {
  text-align: right;
  font-size: 13px;
}

.throw-list {
  min-height: 0;
  overflow: auto;
  display: grid;
  gap: 8px;
  padding-right: 2px;
}

.throw-animation-button {
  text-align: left;
  padding: 0 12px;
}

.throw-animation-button.active {
  border-color: rgba(83, 204, 166, 0.76);
  background: rgba(83, 204, 166, 0.16);
}

.throw-stage-shell {
  min-height: 420px;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid rgba(144, 192, 220, 0.18);
  border-radius: 8px;
  background: #08131f;
}

.throw-stage {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.throw-stage :deep(canvas) {
  display: block;
  max-width: 100%;
  max-height: 100%;
}

.throw-overlay {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  background: rgba(5, 11, 18, 0.64);
}

.throw-state {
  max-width: min(420px, calc(100% - 32px));
  border: 1px solid rgba(144, 192, 220, 0.22);
  border-radius: 8px;
  padding: 12px 14px;
  background: rgba(7, 17, 28, 0.92);
  color: #dcefff;
}

.throw-state.error {
  border-color: rgba(255, 111, 111, 0.54);
  color: #ffb7b7;
}

.throw-info {
  align-self: start;
}

dl {
  display: grid;
  gap: 12px;
  margin: 14px 0 0;
}

dt {
  margin-bottom: 3px;
}

dd {
  margin: 0;
  overflow-wrap: anywhere;
  font-size: 13px;
}

@media (max-width: 980px) {
  .throw-toolbar {
    align-items: start;
    flex-direction: column;
  }

  .throw-workspace {
    grid-template-columns: 1fr;
  }

  .throw-sidebar {
    order: 2;
  }

  .throw-info {
    order: 3;
  }

  .throw-stage-shell {
    min-height: 56dvh;
  }
}
</style>
