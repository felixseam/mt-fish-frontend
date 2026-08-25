<script setup lang="ts">
import { computed } from 'vue'

const { t } = useFrontendI18n()

const props = withDefaults(defineProps<{
  modelValue: boolean
  currentBalance?: number
  requiredBalance?: number
  currencyCode?: string
}>(), {
  currentBalance: 0,
  requiredBalance: 0,
  currencyCode: 'USD',
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
}>()


function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <v-dialog :model-value="modelValue" max-width="380" 
    scrim-color="rgba(0,0,0,0.75)" transition="dialog-bottom-transition"
    @update:model-value="(v) => emit('update:modelValue', v)">
    <v-card class="insufficient-card" rounded="xl">
      <div class="top-accent" />

      <div class="insufficient-body">
        <div class="insufficient-icon-wrap">
          <div class="insufficient-icon-ring" />
          <div class="insufficient-icon-ring insufficient-icon-ring--outer" />
          <v-icon color="#fac775" size="34">mdi-wallet-outline</v-icon>
        </div>

        <div class="insufficient-title">{{ t('balance.notEnoughBalanceTitle') }}</div>
        <div class="insufficient-desc">
          {{ t('balance.notEnoughBalanceMessage') }}
        </div>


      </div>
    </v-card>
  </v-dialog>
</template>

<style scoped>
.insufficient-card {
  position: relative;
  overflow: hidden;
  background: rgba(7, 19, 31, 0.01) !important;
  color: #f4fbff !important;
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1.5px solid rgba(240, 149, 149, 0.28) !important;
}

.insufficient-card::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 0;
  background:
    radial-gradient(circle at 18% 8%, rgba(250, 199, 117, 0.16), transparent 36%),
    radial-gradient(circle at 85% 92%, rgba(240, 149, 149, 0.1), transparent 40%);
}

.top-accent {
  position: relative;
  z-index: 1;
  height: 3px;
  background: linear-gradient(90deg, transparent, #fac775, #f08b8b, transparent);
}

.insufficient-body {
  position: relative;
  z-index: 1;
  padding: 26px 22px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  text-align: center;
}

.insufficient-icon-wrap {
  position: relative;
  width: 68px;
  height: 68px;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 2px;
}

.insufficient-icon-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(250, 199, 117, 0.1);
  border: 1.5px solid rgba(250, 199, 117, 0.3);
  animation: pulse-ring 2.2s ease-in-out infinite;
}

.insufficient-icon-ring--outer {
  inset: -8px;
  background: transparent;
  border-color: rgba(250, 199, 117, 0.14);
  animation-delay: 0.4s;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.12); opacity: 0.5; }
}

.insufficient-title {
  font-size: 17px;
  font-weight: 700;
  color: #f4fbff;
  letter-spacing: -0.01em;
}

.insufficient-desc {
  font-size: 12.5px;
  color: rgba(220, 240, 250, 0.6);
  line-height: 1.6;
  max-width: 270px;
  margin-top: -6px;
}

.balance-card {
  width: 100%;
  background: rgba(6, 22, 36, 0.55);
  border: 1px solid rgba(58, 168, 232, 0.16);
  border-radius: 16px;
  padding: 14px 16px 12px;
}

.balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.insuf-stat {
  display: flex;
  flex-direction: column;
  gap: 3px;
  flex: 1;
}

.insuf-divider {
  width: 1px;
  align-self: stretch;
  background: rgba(173, 228, 242, 0.14);
  margin: 0 2px;
}

.insuf-stat-label {
  font-size: 9.5px;
  color: rgba(173, 228, 242, 0.45);
  letter-spacing: 0.07em;
  text-transform: uppercase;
}

.insuf-stat-value {
  font-size: 18px;
  font-weight: 700;
  line-height: 1.1;
  color: #eafcff;
}

.insuf-stat-value--required {
  color: #fac775;
}

.progress-track {
  margin-top: 12px;
  height: 4px;
  border-radius: 4px;
  background: rgba(173, 228, 242, 0.1);
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, #f08b8b, #fac775);
  transition: width 0.3s ease;
}

.insufficient-gap-pill {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 7px;
  width: 100%;
  padding: 9px 12px;
  border-radius: 12px;
  background: linear-gradient(135deg, rgba(250, 199, 117, 0.13), rgba(68, 215, 197, 0.07));
  border: 1px solid rgba(250, 199, 117, 0.26);
  color: rgba(255, 255, 255, 0.88);
  font-size: 12px;
  line-height: 1.4;
}

.insuf-primary-btn {
  margin-top: 4px;
  background: linear-gradient(135deg, #44d7c5, #378add) !important;
  color: #04101a !important;
  font-weight: 700;
  text-transform: none;
  letter-spacing: 0.01em;
  height: 44px;
}
</style>