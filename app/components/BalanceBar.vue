<!-- components/ui/BalanceBar.vue -->
<template>
  <div class="bar-outer">
    <!-- Left arrow -->
    <button
      class="arrow-btn"
      :class="{ hidden: atStart }"
      aria-label="Scroll left"
      @click="scrollTrack(-1)"
    >
      <v-icon size="16">mdi-chevron-left</v-icon>
    </button>

    <!-- Scrollable track -->
    <div class="scroll-area">
      <div ref="trackRef" class="scroll-track" @scroll="updateArrows">
        <template v-for="(bal, i) in balances" :key="bal.currency_code">
          <div v-if="i > 0" class="sep" />
          <div class="bal-item">
            <!-- <v-icon size="15" color="#44d7c5">{{ currencyIcon(bal.currency_code) }}</v-icon> -->
            <div>
              <div class="bal-code">{{ bal.currency_code }}</div>
              <!-- <div class="bal-amount">{{ formatCurrencyByCode(toNumber(bal.amount), bal.currency_code) }}</div> -->
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- Right arrow -->
    <button
      class="arrow-btn"
      :class="{ hidden: atEnd }"
      aria-label="Scroll right"
      @click="scrollTrack(1)"
    >
      <v-icon size="16">mdi-chevron-right</v-icon>
    </button>

    <!-- Wallet button -->
    <button class="wallet-btn" aria-label="Wallet" @click="emit('wallet-click')">
      <v-icon size="17" color="#44d7c5">mdi-wallet-outline</v-icon>
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from 'vue'

interface BalanceItem {
  currency_code: string
  amount: string | number
}

const props = defineProps<{
  balances: BalanceItem[]
}>()

const emit = defineEmits<{
  'wallet-click': []
}>()

const trackRef = ref<HTMLElement | null>(null)
const atStart = ref(true)
const atEnd = ref(false)
const STEP = 160

function scrollTrack(dir: number) {
  trackRef.value?.scrollBy({ left: dir * STEP, behavior: 'smooth' })
}

function updateArrows() {
  const el = trackRef.value
  if (!el) return
  atStart.value = el.scrollLeft <= 4
  atEnd.value = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4
}

// drag-to-scroll
let isDown = false
let startX = 0
let scrollStart = 0

function onMouseDown(e: MouseEvent) {
  isDown = true
  startX = e.pageX
  scrollStart = trackRef.value?.scrollLeft ?? 0
}
function onMouseUp() {
  isDown = false
}
function onMouseMove(e: MouseEvent) {
  if (!isDown || !trackRef.value) return
  trackRef.value.scrollLeft = scrollStart - (e.pageX - startX)
}

onMounted(() => {
  nextTick(() => updateArrows())
  trackRef.value?.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mouseup', onMouseUp)
  document.addEventListener('mousemove', onMouseMove)
})

onBeforeUnmount(() => {
  trackRef.value?.removeEventListener('mousedown', onMouseDown)
  document.removeEventListener('mouseup', onMouseUp)
  document.removeEventListener('mousemove', onMouseMove)
})

// re-check arrows when balances change
watch(() => props.balances, () => nextTick(() => updateArrows()), { deep: true })

// ── Helpers ────────────────────────────────────────────────────────────────────
function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

</script>

<style scoped>
.bar-outer {
  display: flex;
  align-items: center;
  background: #0d1f2d;
  border: 1px solid rgba(58, 168, 232, 0.25);
  border-radius: 10px;
  padding: 4px;
  gap: 4px;
  min-width: 0;
}

/* ── Scroll area ─────────────────────────────────────────────────────────────── */
.scroll-area {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.scroll-track {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scroll-behavior: smooth;
  -ms-overflow-style: none;
  scrollbar-width: none;
  padding: 2px 0;
  cursor: grab;
}
.scroll-track::-webkit-scrollbar { display: none; }
.scroll-track:active { cursor: grabbing; }

/* ── Balance item ─────────────────────────────────────────────────────────────── */
.bal-item {
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 7px 13px;
  border-radius: 7px;
  flex-shrink: 0;
  white-space: nowrap;
  transition: background 0.15s;
}
.bal-item:hover { background: rgba(58, 168, 232, 0.08); }

.bal-code {
  font-size: 10px;
  color: rgba(68, 215, 197, 0.55);
  letter-spacing: 0.07em;
  line-height: 1;
  margin-bottom: 1px;
}
.bal-amount {
  font-size: 13px;
  font-weight: 600;
  color: #44d7c5;
  line-height: 1.3;
}

/* ── Separator ───────────────────────────────────────────────────────────────── */
.sep {
  width: 1px;
  height: 22px;
  background: rgba(58, 168, 232, 0.18);
  flex-shrink: 0;
  align-self: center;
}

/* ── Arrow buttons ───────────────────────────────────────────────────────────── */
.arrow-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 7px;
  border: 1px solid rgba(58, 168, 232, 0.22);
  background: transparent;
  color: rgba(68, 215, 197, 0.7);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s, width 0.2s, opacity 0.2s, padding 0.2s;
  overflow: hidden;
}
.arrow-btn:hover { background: rgba(68, 215, 197, 0.1); color: #44d7c5; }
.arrow-btn:active { background: rgba(68, 215, 197, 0.18); }
.arrow-btn.hidden {
  opacity: 0;
  pointer-events: none;
  width: 0;
  padding: 0;
  border-width: 0;
}

/* ── Wallet button ───────────────────────────────────────────────────────────── */
.wallet-btn {
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  border-radius: 7px;
  border: 1px solid rgba(68, 215, 197, 0.35);
  background: rgba(68, 215, 197, 0.1);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s;
}
.wallet-btn:hover { background: rgba(68, 215, 197, 0.2); }
.wallet-btn:active { background: rgba(68, 215, 197, 0.28); }

@media (max-width: 768px) {
  .bar-outer {
    padding: 6px;
    gap: 6px;
  }

  .bal-item {
    padding: 8px 12px;
  }

  .arrow-btn,
  .wallet-btn {
    width: 40px;
    height: 40px;
    border-radius: 10px;
  }

  .bal-code {
    font-size: 11px;
  }

  .bal-amount {
    font-size: 14px;
  }
}
</style>
