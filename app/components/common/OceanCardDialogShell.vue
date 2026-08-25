<template>
  <v-dialog v-model="dialogVisible" :max-width="maxWidth" :persistent="persistent" :scrim="true"
    :scrim-color="scrimColor" transition="dialog-bottom-transition" :fullscreen="$vuetify.display.xs">
    <v-card rounded="l" class="report-card">
      <v-toolbar class="report-toolbar">
        <slot name="title-prefix" />
        <slot name="icon">
          <!-- default icon rendering here if you want one -->
        </slot>
        <v-toolbar-title class="text-bold text-2xl toolbar-title">
          <slot name="title">{{ title }}</slot>
        </v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="close" class="close-btn">
          <v-icon color="error">mdi-close</v-icon>
        </v-btn>
      </v-toolbar>
      <slot />
    </v-card>

  </v-dialog>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(defineProps<{
  modelValue: boolean;
  title?: string;
  icon?: string;
  iconColor?: string;
  iconBg?: string;
  iconBorder?: string;
  maxWidth?: string | number;
  persistent?: boolean;
  scrimColor?: string;
  cardClass?: string | Record<string, boolean>;
}>(), {
  title: "",
  icon: "mdi-tune-variant",
  iconColor: "#7de7d4",
  iconBg: "rgba(68, 215, 197, 0.16)",
  iconBorder: "rgba(68, 215, 197, 0.32)",
  maxWidth: "480",
  persistent: false,
  scrimColor: "rgba(0,0,0,0.75)",
  cardClass: "",
});

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
}>();

const dialogVisible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});

function close() {
  emit("update:modelValue", false);
}
</script>

<style>
.report-card {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: rgba(7, 19, 31, 0.01) !important;
  color: #f4fbff !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
}

.report-card::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(circle at 18% 12%, rgba(255, 221, 115, 0.15), transparent 34%),
    radial-gradient(circle at 82% 88%, rgba(94, 218, 255, 0.12), transparent 38%);
}

.report-card>* {
  position: relative;
  z-index: 1;
}

.report-toolbar {
  background: rgba(7, 19, 31, 0.01) !important;
  border-bottom: 2px solid rgba(255, 219, 127, 0.22) !important;
}

.toolbar-title {
  color: #9fe9f5 !important;
  font-weight: 900;
}

:deep(.v-dialog--fullscreen) .ocean-card {
  border-radius: 0 !important;
  border: none !important;
  max-height: 100dvh;
}
</style>