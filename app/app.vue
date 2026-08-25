<template>
  <v-app class="app-root">
    <VSonner position="top-right" :visible-toasts="4" />

    <div :class="['app-shell', { 'app-shell--blocked': isAuthenticated && !hasEnteredExperience }]">
      <NuxtLayout>
        <NuxtPage />
      </NuxtLayout>
    </div>

    <!-- Rotate-to-landscape warning: only shown after loading has finished
         (or immediately for unauthenticated users, e.g. login screens) -->
    <div v-if="showRotateOverlay" class="rotate-overlay">
      <p>Please rotate your device to landscape</p>
    </div>

    <div v-if="isAuthenticated && isPreloading" class="app-preload">
      <div class="app-preload__bottom">
        <v-progress-linear class="app-preload__bar" color="light-blue" height="10" :model-value="loadProgress" striped
          rounded />
        <p class="app-preload__percent">Loading... {{ loadProgress }}%</p>
      </div>
    </div>

    <div v-else-if="isAuthenticated && preloadError" class="app-preload">
      <div class="app-preload__error">
        <p class="app-preload__error-title">Asset Preload Failed</p>
        <p class="app-preload__error-message">{{ preloadError }}</p>
        <!-- <button type="button" class="app-preload__retry" @click="runPreload">
          Retry
        </button> -->
      </div>
    </div>

    <!-- <div v-else-if="isAuthenticated && readyToEnter && !hasEnteredExperience && !isMobileDevice"
      class="app-preload app-enter">
      <div class="app-enter__inner">
        <button type="button" class="app-enter__button" @click="enterExperience">
          Tap to Play
        </button>
      </div>
    </div> -->
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import { useFishAssetPreload } from "~/composables/game_core/assets/useFishAssetPreload";
import { useExperienceStore } from "~/stores/experienceStore";
import { useGameManifestStore } from "~/stores/gameManifestStore";
import { hydrateAccessToken } from "~/utils/authToken";

const { preloadAppAssets } = useFishAssetPreload();
const manifestStore = useGameManifestStore();
const experienceStore = useExperienceStore();

const token = hydrateAccessToken();
const isAuthenticated = computed(() => !!token.value);
const hasEnteredExperience = computed(() => experienceStore.entered);

const isPreloading = ref(false);
const preloadError = ref("");
const loadProgress = ref(0);
const readyToEnter = ref(false);
const isMobileDevice = ref(false);

const SESSION_FLAG = "aqua_preload_done_this_session";
let hasAttemptedThisLoad = false;

function markPreloadedThisSession() {
  try {
    sessionStorage.setItem(SESSION_FLAG, "1");
  } catch {
  }
}

function wasPreloadedThisSession() {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === "1";
  } catch {
    return false;
  }
}

let progressTimer: ReturnType<typeof setInterval> | null = null;

function clearProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function animateProgressTo(target: number, stepMs = 120) {
  clearProgressTimer();
  progressTimer = setInterval(() => {
    if (loadProgress.value < target) {
      loadProgress.value = Math.min(loadProgress.value + 1, target);
    } else {
      clearProgressTimer();
    }
  }, stepMs);
}

function animateProgressToAsync(target: number, stepMs = 30): Promise<void> {
  return new Promise((resolve) => {
    clearProgressTimer();
    progressTimer = setInterval(() => {
      if (loadProgress.value < target) {
        loadProgress.value = Math.min(loadProgress.value + 1, target);
      } else {
        clearProgressTimer();
        resolve();
      }
    }, stepMs);
  });
}

// Turns whatever got thrown (Error, string, ProgressEvent from a failed
// asset/image load, API error payload, etc.) into a readable message
// instead of collapsing everything to "Unable to preload game assets."
function describePreloadError(error: unknown): string {
  if (error instanceof Error) return error.message;

  if (typeof error === "string") return error;

  if (error && typeof error === "object") {
    const anyErr = error as Record<string, unknown>;
    if (typeof anyErr.message === "string" && anyErr.message.length > 0) {
      return anyErr.message;
    }
    if (typeof anyErr.statusMessage === "string" && anyErr.statusMessage.length > 0) {
      return `${anyErr.statusMessage}${anyErr.statusCode ? ` (${anyErr.statusCode})` : ""}`;
    }
  }

  if (typeof ProgressEvent !== "undefined" && error instanceof ProgressEvent) {
    const target = error.target as { src?: string; currentSrc?: string } | null;
    const src = target?.src ?? target?.currentSrc;
    return src ? `Failed to load asset: ${src}` : "Failed to load a game asset.";
  }

  return "Unable to preload game assets.";
}

// --- NEW: detect an auth-shaped failure so we know when a retry is worth it ---
function isUnauthorizedError(error: unknown): boolean {
  if (error && typeof error === "object") {
    const anyErr = error as Record<string, unknown>;
    const status = anyErr.statusCode ?? anyErr.status ?? (anyErr.response as any)?.status;
    if (status === 401) return true;
    const msg = (typeof anyErr.message === "string" && anyErr.message) ||
      (typeof anyErr.statusMessage === "string" && anyErr.statusMessage) || "";
    if (/unauthorized|401/i.test(msg)) return true;
  }
  if (typeof error === "string" && /unauthorized|401/i.test(error)) return true;
  return false;
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runPreload(isRetry = false) {
  if (!isAuthenticated.value) return;
  if (manifestStore.ready && wasPreloadedThisSession()) {
    readyToEnter.value = true;
    return;
  }

  hasAttemptedThisLoad = true;
  isPreloading.value = true;
  preloadError.value = "";
  loadProgress.value = 0;

  try {
    animateProgressTo(30, 250);
    await manifestStore.fetchManifest();

    const fileConfig = manifestStore.fileConfig;
    if (!fileConfig) throw new Error("File configuration is missing.");

    animateProgressTo(95, 250);
    await preloadAppAssets();

    await animateProgressToAsync(100, 30);

    manifestStore.ready = true;
    markPreloadedThisSession();

    isPreloading.value = false;
    readyToEnter.value = true;

    console.log("manifestStore=============================", manifestStore.cannonTypes)
  } catch (error) {
    clearProgressTimer();
    console.error("[preload] failed:", error);

    // --- NEW: if this is the *first* attempt and it looks like an auth
    // race (token not yet attached to the http client), wait a beat and
    // retry once automatically instead of showing the error screen.
    // A refresh "fixes" this today because the token source is fully
    // initialized before this component mounts on a hard reload; on an
    // in-app auth transition there can be a brief gap.
    if (!isRetry && isUnauthorizedError(error) && isAuthenticated.value) {
      console.warn("[preload] got 401 on first attempt, retrying once after short delay");
      await delay(400);
      await runPreload(true);
      return;
    }

    preloadError.value = describePreloadError(error);
    isPreloading.value = false;
  }
}

async function requestFullscreen() {
  const el = document.documentElement as HTMLElement & {
    webkitRequestFullscreen?: () => Promise<void> | void;
  };
  try {
    if (el.requestFullscreen) {
      await el.requestFullscreen();
    } else if (el.webkitRequestFullscreen) {
      await el.webkitRequestFullscreen();
    }
  } catch (e) {
    console.warn("Fullscreen request failed", e);
  }
}

async function lockLandscape() {
  try {
    const orientation = screen.orientation as ScreenOrientation & {
      lock?: (o: string) => Promise<void>;
    };
    await orientation?.lock?.("landscape");
  } catch (e) {
    console.warn("Orientation lock failed", e);
  }
}

async function enterExperience() {
  await requestFullscreen();
  await lockLandscape();
  experienceStore.enterExperience();
}

// --- CHANGED: give one extra tick before the first attempt, so any
// plugin/interceptor that reacts to auth state on the same tick has a
// chance to finish setting up before we fire the manifest request.
watch(
  isAuthenticated,
  async (authed) => {
    if (authed && !hasAttemptedThisLoad) {
      await nextTick();
      void runPreload();
    }
  },
  { immediate: true },
);

/* ---------------- Orientation tracking ---------------- */

const isPortrait = ref(false);
let orientationMql: MediaQueryList | null = null;

function handleOrientationChange(e: MediaQueryListEvent | MediaQueryList) {
  isPortrait.value = e.matches;
}

const loadingFinished = computed(
  () =>
    !isPreloading.value &&
    !preloadError.value &&
    (readyToEnter.value || hasEnteredExperience.value),
);

const showRotateOverlay = computed(() => {
  if (!isPortrait.value) return false;
  if (!isAuthenticated.value) return true;
  return loadingFinished.value;
});

onMounted(async () => {
  isMobileDevice.value = window.matchMedia("(pointer: coarse)").matches;

  orientationMql = window.matchMedia("(orientation: portrait) and (max-width: 900px)");
  isPortrait.value = orientationMql.matches;
  orientationMql.addEventListener("change", handleOrientationChange);

  await nextTick();
  if (isAuthenticated.value && !hasAttemptedThisLoad) {
    void runPreload();
  }
});

onBeforeUnmount(() => {
  orientationMql?.removeEventListener("change", handleOrientationChange);
});

watch(readyToEnter, (ready) => {
  if (!ready || hasEnteredExperience.value) return;

  if (isMobileDevice.value) {
    void enterExperience();
    return;
  }

  experienceStore.enterExperience();
});
</script>

<style scoped>
.app-root {
  min-height: 100dvh;
}

.app-shell {
  min-height: 100dvh;
}

.app-shell--blocked {
  opacity: 0;
  pointer-events: none;
}

.app-preload {
  position: fixed;
  inset: 0;
  z-index: 99999;
  display: flex;
  align-items: flex-end;
  justify-content: center;
  background-image: url("/backgrounds/loading.png");
  background-size: cover;
  background-position: center;
  background-repeat: no-repeat;
}

.app-preload__bottom {
  width: 100%;
  max-width: 520px;
  padding: 0 24px 24px;
  /* was 0 24px 64px */
  text-align: center;
}

.app-preload__bar {
  border-radius: 999px;
  overflow: hidden;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
}

.app-preload__percent {
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: 0.02em;
  color: #ffffff;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.6);
}

.app-preload__error {
  max-width: 480px;
  margin-bottom: 64px;
  padding: 24px 28px;
  border-radius: 16px;
  border: 1px solid rgba(255, 137, 137, 0.28);
  background: rgba(6, 18, 29, 0.9);
  color: #eef8ff;
  text-align: center;
}

.app-preload__error-title {
  margin: 0 0 8px;
  font-size: 1.3rem;
  font-weight: 700;
}

.app-preload__error-message {
  margin: 0;
  line-height: 1.5;
  color: rgba(223, 239, 248, 0.85);
}

.app-preload__retry {
  margin-top: 16px;
  min-width: 140px;
  height: 42px;
  border: 1px solid rgba(129, 197, 240, 0.32);
  border-radius: 999px;
  background: rgba(16, 33, 48, 0.96);
  color: #eef8ff;
  font-weight: 700;
  cursor: pointer;
}

/* ---- Tap-to-play gate ---- */
.app-enter {
  align-items: center;
}

.app-enter__inner {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.app-enter__button {
  min-width: 200px;
  height: 52px;
  padding: 0 32px;
  border: 1px solid rgba(129, 197, 240, 0.32);
  border-radius: 999px;
  background: rgba(16, 33, 48, 0.96);
  color: #eef8ff;
  font-weight: 700;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.4);
  animation: pulse 1.6s ease-in-out infinite;
}

@keyframes pulse {

  0%,
  100% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }
}

/* ---- Rotate-to-landscape overlay ----
   Visibility is now controlled entirely by JS (showRotateOverlay),
   not by a CSS @media query, so it can be gated behind loading state. */
.rotate-overlay {
  display: flex;
  position: fixed;
  inset: 0;
  z-index: 999999;
  align-items: center;
  justify-content: center;
  background: #06121d;
  color: #eef8ff;
  text-align: center;
  padding: 24px;
  font-size: 18px;
  font-weight: 600;
}
</style>
