<template>
  <OceanCardDialogShell
    v-model="dialogVisible"
    :title="t('settings.title')"
    icon="mdi-tune-variant"
    max-width="480"
  >
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
      <v-btn block variant="flat" class="settings-close-btn" @click="dialogVisible = false">
        {{ t("common.close") }}
      </v-btn>
    </v-card-actions>
  </OceanCardDialogShell>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useGameAudioSettings } from "~/composables/game_core/audio/useGameAudioSettings";
import OceanCardDialogShell from "~/components/common/OceanCardDialogShell.vue";

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
</script>

<style scoped>
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