<template>
  <component :is="variant === 'bottom-sheet' ? 'v-bottom-sheet' : 'v-dialog'" v-model="model" fullscreen>
    <v-card height="100vh" class="report-card">
      <v-toolbar class="report-toolbar">
        <v-toolbar-title class="text-bold text-2xl toolbar-title">{{ title }}</v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="model = false" class="close-btn">
          <v-icon color="error">mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text>
        <div class="filter-row">
          <div class="filter-left">
            <span class="text-xl filter-label">កាលបរិច្ឆេទ</span>
            <v-text-field
              :model-value="filterDate"
              type="date"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 180px"
              class="ocean-input"
              @update:model-value="$emit('update:filterDate', $event as string)"
            />
          </div>

          <div class="filter-right">
            <slot name="filter-right">
              <v-btn color="#00C2D4" class="text-capitalize filter-btn" @click="$emit('quickDate', 0)">Today</v-btn>
              <v-btn color="#FFD54F" class="text-capitalize filter-btn" @click="$emit('quickDate', 1)">Yesterday</v-btn>
              <v-btn color="#FF6B35" class="text-capitalize filter-btn" @click="$emit('quickDate', 7)">Week</v-btn>
            </slot>
          </div>
        </div>

        <slot />
      </v-card-text>
    </v-card>
  </component>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  modelValue: boolean;
  title: string;
  filterDate: string;
  variant?: "dialog" | "bottom-sheet";
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "update:filterDate", value: string): void;
  (e: "quickDate", daysAgo: number): void;
}>();

const model = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit("update:modelValue", v),
});
</script>

<style scoped>
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

.report-card > * {
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

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 10px;
}

.filter-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.filter-right {
  display: flex;
  gap: 10px;
}

.filter-label {
  color: #9fe9f5 !important;
  font-weight: 600;
}

.filter-btn {
  color: #fff !important;
  font-weight: 700 !important;
}

.filter-btn--today {
  background: linear-gradient(180deg, #4de8ff, #17b9d6) !important;
  color: #fff !important;
  border: 1px solid rgba(255, 255, 255, 0.5) !important;
}

.filter-btn--outline {
  background: rgba(255, 255, 255, 0.04) !important;
  color: #eafcff !important;
  border: 1.5px solid rgba(160, 230, 245, 0.55) !important;
}

.filter-btn--outline:hover {
  background: rgba(48, 226, 255, 0.14) !important;
}

.ocean-input :deep(.v-field) {
  background: rgba(255, 255, 255, 0.06) !important;
  color: #eef8ff !important;
}

.ocean-input :deep(.v-field__outline) {
  color: rgba(165, 214, 241, 0.28) !important;
}

.ocean-input :deep(input),
.ocean-input :deep(.v-select__selection-text) {
  color: #eef8ff !important;
}
</style>