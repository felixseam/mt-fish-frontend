<template>
  <v-app class="app-root">
    <VSonner position="top-right" :visible-toasts="4" />

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
        <button type="button" class="app-preload__retry" @click="runPreload">
          Retry
        </button>
      </div>
    </div>

    <NuxtLayout v-else>
      <NuxtPage />
    </NuxtLayout>
  </v-app>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, nextTick } from "vue";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import { useFishAssetPreload } from "~/composables/game_core/assets/useFishAssetPreload";
import { useGameManifestStore } from "~/stores/gameManifestStore";
import { hydrateAccessToken } from "~/utils/authToken";

const { preloadAppAssets } = useFishAssetPreload();
const manifestStore = useGameManifestStore();

const token = hydrateAccessToken();
const isAuthenticated = computed(() => !!token.value);

const isPreloading = ref(false);
const preloadError = ref("");
const loadProgress = ref(0);


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

async function runPreload() {
  if (!isAuthenticated.value) return;

  if (manifestStore.ready && wasPreloadedThisSession()) return;

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
  } catch (error) {
    clearProgressTimer();
    preloadError.value =
      error instanceof Error ? error.message : "Unable to preload game assets.";
  } finally {
    isPreloading.value = false;
  }
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

watch(
  isAuthenticated,
  (authed) => {
    if (authed && !hasAttemptedThisLoad) {
      void runPreload();
    }
  },
  { immediate: true },
);

// Fallback — covers the case where hydrateAccessToken() resolves the
// token asynchronously/late and the immediate watch fired too early
// with isAuthenticated === false, so it never ran again.
onMounted(async () => {
  await nextTick();
  if (isAuthenticated.value && !hasAttemptedThisLoad) {
    void runPreload();
  }
});
</script>

<style scoped>
.app-root {
  min-height: 100dvh;
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
</style>