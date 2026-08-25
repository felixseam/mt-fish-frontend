<template>
  <div class="app-main-layout">
    <!-- <LanguageSwitcher /> -->

    <div v-if="showOrientationOverlay" class="app-orientation-overlay" role="dialog" aria-modal="true"
      :aria-label="t('layout.rotateDevice')">
      <div class="app-orientation-overlay__content">
        <img class="app-orientation-overlay__image"
          src="https://media2.giphy.com/media/v1.Y2lkPTc5MGI3NjExYm01aGdqZTV5MzJlOTlnYWFidm0zcTU1dGllZGU5ZGkzZGw2eHBpZSZlcD12MV9zdGlja2Vyc19zZWFyY2gmY3Q9cw/1DtYcLp3GDlY2RsVXd/giphy.webp"
          alt="">
        <p class="app-orientation-overlay__text">{{ t('layout.rotateDevice') }}</p>
      </div>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const { t } = useFrontendI18n();
const isMobileDevice = ref(false);
const isPortraitMode = ref(false);
const showOrientationOverlay = computed(
  () => isMobileDevice.value && isPortraitMode.value,
);

let portraitMediaQuery: MediaQueryList | null = null;

function detectMobileDevice() {
  if (typeof window === "undefined") return false;

  const ua = navigator.userAgent || navigator.vendor || "";
  const isTouchDevice =
    navigator.maxTouchPoints > 0 || window.matchMedia("(pointer: coarse)").matches;
  const isSmallViewport = window.innerWidth <= 1024;
  const isMobileUserAgent =
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);

  return isMobileUserAgent || (isTouchDevice && isSmallViewport);
}

function updateOrientationState() {
  if (typeof window === "undefined") return;

  isMobileDevice.value = detectMobileDevice();
  isPortraitMode.value =
    window.matchMedia("(orientation: portrait)").matches ||
    window.innerHeight > window.innerWidth;
}

onMounted(async () => {
  portraitMediaQuery = window.matchMedia("(orientation: portrait)");
  portraitMediaQuery.addEventListener("change", updateOrientationState);
  window.addEventListener("resize", updateOrientationState);
  updateOrientationState();

});

onBeforeUnmount(() => {
  portraitMediaQuery?.removeEventListener("change", updateOrientationState);
  window.removeEventListener("resize", updateOrientationState);
});
</script>

<style scoped>
.app-main-layout {
  min-height: 100dvh;
  overflow: auto;
}

.app-orientation-overlay {
  position: fixed;
  inset: 0;
  z-index: 100000;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(circle at center, rgba(87, 194, 248, 0.18), transparent 40%),
    rgba(3, 10, 17, 0.96);
}

.app-orientation-overlay__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 18px;
  text-align: center;
}

.app-orientation-overlay__image {
  width: min(52vw, 220px);
  max-width: 100%;
  height: auto;
}

.app-orientation-overlay__text {
  margin: 0;
  font-size: clamp(1.25rem, 5vw, 1.75rem);
  font-weight: 700;
  color: #eef8ff;
}
</style>
