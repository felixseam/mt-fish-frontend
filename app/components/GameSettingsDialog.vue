<template>
  <v-dialog
    v-model="dialogVisible"
    max-width="480"
    :scrim="true"
    scrim-color="rgba(0,0,0,0.75)"
    transition="dialog-bottom-transition"
    :fullscreen="$vuetify.display.xs"
  >
    <v-card class="settings-card" rounded="xl">
      <v-card-title class="settings-header d-flex align-center gap-3 pa-4">
        <div class="header-icon">
          <v-icon color="#7de7d4" size="20">mdi-tune-variant</v-icon>
        </div>
        <span class="text-subtitle-1 font-weight-medium text-white">
          {{ t("settings.title") }}
        </span>
        <v-spacer />
        <v-btn icon variant="text" size="small" @click="close">
          <v-icon color="rgba(173,228,242,0.5)" size="18">mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider color="rgba(58,168,232,0.15)" />

      <v-card-text class="pa-5">
        <section class="settings-section">
          <p class="settings-label">{{ t("settings.audioTitle") }}</p>
          <p class="settings-description">{{ t("settings.audioDescription") }}</p>
          <div class="settings-actions">
            <v-btn
              variant="flat"
              class="settings-pill"
              :class="{ 'settings-pill--active': isMuted }"
              @click="setMuted(true)"
            >
              {{ t("settings.mute") }}
            </v-btn>
            <v-btn
              variant="flat"
              class="settings-pill"
              :class="{ 'settings-pill--active': !isMuted }"
              @click="setMuted(false)"
            >
              {{ t("settings.unmute") }}
            </v-btn>
          </div>
        </section>

        <section class="settings-section">
          <p class="settings-label">{{ t("settings.languageTitle") }}</p>
          <p class="settings-description">{{ t("settings.languageDescription") }}</p>
          <div class="settings-actions">
            <v-btn
              variant="flat"
              class="settings-pill"
              :class="{ 'settings-pill--active': locale === 'en' }"
              @click="setLocale('en')"
            >
              {{ t("common.english") }}
            </v-btn>
            <v-btn
              variant="flat"
              class="settings-pill"
              :class="{ 'settings-pill--active': locale === 'km' }"
              @click="setLocale('km')"
            >
              {{ t("common.khmer") }}
            </v-btn>
          </div>
        </section>
      </v-card-text>

      <v-card-actions class="px-5 pb-5 pt-0">
        <v-btn
          block
          variant="flat"
          class="settings-close-btn"
          @click="close"
        >
          {{ t("common.close") }}
        </v-btn>
      </v-card-actions>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { useGameAudioSettings } from '~/composables/game_core/audio/useGameAudioSettings'

const props = defineProps<{
  modelValue: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();

const { t, locale, setLocale } = useFrontendI18n();
const { isMuted, setMuted } = useGameAudioSettings();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (value: boolean) => emit("update:modelValue", value),
});

function close() {
  emit("update:modelValue", false);
}
</script>

<style scoped>
.settings-card {
  background: linear-gradient(180deg, #0a1929 0%, #051928 55%, #0a2240 100%) !important;
  border: 1.5px solid rgba(26, 111, 168, 0.5) !important;
  overflow: hidden;
}

.settings-header {
  background: linear-gradient(90deg, rgba(26, 111, 168, 0.22), transparent);
  border-bottom: 1px solid rgba(58, 168, 232, 0.15);
}

.header-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  background: rgba(68, 215, 197, 0.16);
  border: 1px solid rgba(68, 215, 197, 0.32);
}

.settings-section + .settings-section {
  margin-top: 20px;
}

.settings-label {
  margin-bottom: 6px;
  color: #f2fbff;
  font-size: 14px;
  font-weight: 700;
}

.settings-description {
  margin-bottom: 12px;
  color: rgba(173, 228, 242, 0.72);
  font-size: 13px;
  line-height: 1.5;
}

.settings-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
}

.settings-pill {
  min-width: 110px;
  border: 1px solid rgba(173, 228, 242, 0.18) !important;
  background: rgba(8, 27, 44, 0.88) !important;
  color: rgba(218, 248, 255, 0.84) !important;
}

.settings-pill--active {
  background: linear-gradient(135deg, #44d7c5, #378add) !important;
  border-color: transparent !important;
  color: #04101a !important;
}

.settings-close-btn {
  background: linear-gradient(135deg, #44d7c5, #378add) !important;
  color: #04101a !important;
  font-weight: 700;
}
</style>
