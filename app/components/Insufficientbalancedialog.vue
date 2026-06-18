<template>
  <!-- ── Insufficient Coins Dialog ── -->
  <v-dialog v-model="insufficientCoinsVisible" max-width="360" persistent :scrim="true"
    scrim-color="rgba(0,0,0,0.75)" transition="dialog-bottom-transition">
    <v-card class="ocean-card insufficient-card" rounded="xl">
      <div class="insufficient-body">
        <!-- Animated coin icon -->
        <div class="insufficient-icon-wrap">
          <div class="insufficient-icon-ring" />
          <v-icon color="#fac775" size="38">mdi-circle-multiple-outline</v-icon>
        </div>

        <div class="insufficient-title">{{ t('balance.notEnoughCoinsTitle') }}</div>
        <div class="insufficient-desc">
          {{ t('balance.notEnoughCoinsMessage') }}<br />
          {{ t('balance.notEnoughCoinsSubmessage') }}
        </div>

        <!-- Coin status -->
        <div class="insufficient-status-row">
          <div class="insuf-stat">
            <div class="insuf-stat-label">{{ t('balance.youHave') }}</div>
            <div class="insuf-stat-value" style="color:#fac775">{{ formatCoins(currentCoinBalance) }}</div>
            <div class="insuf-stat-unit">{{ t('balance.coins') }}</div>
          </div>
          <div class="insuf-arrow">
            <v-icon color="rgba(173,228,242,0.25)" size="18">mdi-arrow-right</v-icon>
          </div>
          <div class="insuf-stat">
            <div class="insuf-stat-label">{{ t('balance.betRequires') }}</div>
            <div class="insuf-stat-value" style="color:#f09595">{{ formatCoins(insufficientBetAmount) }}</div>
            <div class="insuf-stat-unit">{{ t('balance.coins') }}</div>
          </div>
        </div>

        <div class="insufficient-actions">
          <v-btn variant="flat" class="ocean-btn-confirm insuf-exchange-btn" @click="openExchangeFromInsufficient">
            <v-icon start size="15">mdi-swap-horizontal</v-icon>
            {{ t('balance.exchangeCoinsNow') }}
          </v-btn>
          <v-btn variant="text" class="insuf-cancel-btn" @click="closeInsufficientDialog">
            {{ t('common.cancel') }}
          </v-btn>
        </div>
      </div>
    </v-card>
  </v-dialog>

  <!-- ── Main Exchange Dialog ── -->
  <v-dialog v-model="internalVisible" max-width="500" persistent :scrim="true" scrim-color="rgba(0,0,0,0.75)"
    transition="dialog-bottom-transition" :fullscreen="$vuetify.display.xs" @update:model-value="onDialogUpdate">
    <v-card class="ocean-card" rounded="xl">

      <!-- ── Header ── -->
      <v-card-title class="ocean-header d-flex align-center gap-3 pa-4">
        <div class="header-icon" :class="headerIconClass">
          <v-icon :color="headerIconColor" size="20">{{ headerIcon }}</v-icon>
        </div>
        <span class="text-subtitle-1 font-weight-medium text-white">{{ headerTitle }}</span>
        <v-spacer />
        <v-btn icon variant="text" size="small" @click="close">
          <v-icon color="rgba(173,228,242,0.5)" size="18">mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider color="rgba(58,168,232,0.15)" />

      <!-- ── Tab bar (hidden on confirm/success steps) ── -->
      <div v-if="currentStep === 'form'" class="tab-bar">
        <button class="exchange-tab" :class="{ 'tab-active-b2c': activeTab === 'b2c' }" @click="switchTab('b2c')">
          <div class="tab-inner">
            <div class="tab-icon-wrap tab-icon-b2c">
              <v-icon size="14">mdi-wallet-outline</v-icon>
            </div>
            <div class="tab-text-wrap">
              <span class="tab-label">{{ t('balance.topUpCoins') }}</span>
              <!-- <span class="tab-desc">Balance → Coins</span> -->
            </div>
          </div>
        </button>
        <button class="exchange-tab" :class="{ 'tab-active-c2b': activeTab === 'c2b' }" @click="switchTab('c2b')">
          <div class="tab-inner">
            <div class="tab-icon-wrap tab-icon-c2b">
              <v-icon size="14">mdi-circle-multiple-outline</v-icon>
            </div>
            <div class="tab-text-wrap">
              <span class="tab-label">{{ t('balance.cashOut') }}</span>
              <!-- <span class="tab-desc">Coins → Balance</span> -->
            </div>
          </div>
        </button>
      </div>

      <!-- ══════════════════════════════════════════════════════════
           FORM STEP
      ══════════════════════════════════════════════════════════ -->
      <template v-if="currentStep === 'form'">

        <!-- ── B2C: Top Up Coins ── -->
        <div v-if="activeTab === 'b2c'" class="step-scroll-body">
          <div class="pa-4">
            <!-- Currency selector -->
            <div class="slabel mb-2">{{ t('balance.payWith') }}</div>
            <div class="bar-outer mb-3">
              <button class="bar-arrow-btn" :class="{ hidden: balBarAtStart }" @click="scrollBalBar(-1)">
                <v-icon size="13">mdi-chevron-left</v-icon>
              </button>
              <div class="bar-scroll-area">
                <div ref="balBarRef" class="bar-scroll-track" @scroll="updateBalBarArrows">
                  <template v-for="(bal, i) in walletBalances" :key="bal.currency_id">
                    <div v-if="i > 0" class="bar-sep" />
                    <button class="bar-bal-item"
                      :class="{ 'bar-bal-item-active': selectedCurrency === bal.currency_code }"
                      :disabled="isLoadingForm || isLoadingPackages" @click="onSelectCurrency(bal.currency_code)">
                      <div class="bar-bal-code">{{ bal.currency_code }}</div>
                      <div class="bar-bal-amount">{{ formatCurrencyByCode(toNumber(bal.amount), bal.currency_code) }}</div>
                    </button>
                  </template>
                </div>
              </div>
              <button class="bar-arrow-btn" :class="{ hidden: balBarAtEnd }" @click="scrollBalBar(1)">
                <v-icon size="13">mdi-chevron-right</v-icon>
              </button>
            </div>

            <!-- Rate info -->
            <div class="rate-bar mb-3">
              <v-icon size="13" color="#5fd4b0" class="mr-1">mdi-information-outline</v-icon>
              <span class="rate-text">
                {{ t('balance.rate') }} <strong>{{ t('balance.oneCoin') }}</strong> = {{ ratePerCoinFormatted }}
              </span>
            </div>

            <!-- Packages -->
            <div class="slabel mb-2">{{ t('balance.selectPackage') }}</div>

            <div v-if="isLoadingPackages" class="pkg-empty-state mb-2">{{ t('common.loading') }}</div>

            <div v-else-if="packages.length" class="pkg-list mb-2">
              <div v-for="pkg in packages" :key="pkg.id" class="pkg-card"
                :class="{ 'pkg-selected': selectedPackage?.id === pkg.id && !isCustomMode, 'pkg-popular': pkg.popular }"
                @click="selectPackage(pkg)">
                <div class="pkg-icon-wrap">
                  <v-icon :color="pkg.popular ? '#fac775' : '#44d7c5'" size="19">mdi-circle-multiple-outline</v-icon>
                </div>
                <div class="pkg-info">
                  <div class="pkg-title">
                    {{ formatCoins(pkg.coinAmount) }} {{ t('balance.coins') }}
                    <span v-if="pkg.popular" class="pkg-popular-tag">
                      <v-icon size="9">mdi-star</v-icon> {{ t('balance.popular') }}
                    </span>
                  </div>
                  <div class="pkg-subtitle">
                    {{ pkg.name }}
                    <template v-if="pkg.description">· {{ pkg.description }}</template>
                  </div>
                </div>
                <div class="pkg-right">
                  <div class="pkg-price" :style="pkg.popular ? 'color:#fac775' : ''">
                    {{ formatCurrencyByCode(pkg.priceAmount, pkg.currencyCode) }}
                  </div>
                  <div class="pkg-price-sub">{{ pkg.currencyCode }}</div>
                </div>
                <div class="pkg-check">
                  <div class="pkg-check-inner" />
                </div>
              </div>
            </div>

            <div v-else class="pkg-empty-state mb-2">
              {{ t('balance.noPackagesAvailable') }}
            </div>

            <!-- OR divider -->
            <div class="or-divider mb-3">
              <div class="or-line" /><span class="or-text">{{ t('balance.orCustom') }}</span>
              <div class="or-line" />
            </div>

            <!-- Custom amount -->
            <div class="pkg-card custom-pkg-card mb-1" :class="{ 'pkg-selected': isCustomMode }">
              <div class="pkg-icon-wrap">
                <v-icon color="rgba(173,228,242,0.5)" size="17">mdi-pencil-outline</v-icon>
              </div>
              <div class="pkg-info">
                <div class="custom-label mb-1">{{ t('balance.enterCoinAmount') }}</div>
                <div class="custom-input-row">
                  <input v-model.number="customAmount" type="number" class="custom-input"
                    :placeholder="t('balance.customPlaceholder')" min="100" step="100" @input="onCustomInput" />
                  <span class="custom-unit">{{ t('balance.coins') }}</span>
                </div>
                <div v-if="(customAmount ?? 0) > 0 && !canAffordCustom" class="custom-error mt-1">
                  <v-icon size="11" color="#f09595">mdi-alert-circle-outline</v-icon>
                  {{ t('balance.insufficientCurrency', { currency: selectedCurrency }) }}
                </div>
              </div>
              <div class="pkg-right">
                <div class="pkg-price" style="color:#5fd4b0;font-size:13px">{{ customCostFormatted }}</div>
                <div class="pkg-price-sub">{{ t('balance.minCoins') }}</div>
              </div>
              <div class="pkg-check">
                <div class="pkg-check-inner" />
              </div>
            </div>

            <!-- Summary -->
            <div v-if="b2cFinalCoins > 0 && canAffordFinal" class="summary-row mt-4">
              <div>
                <div class="summary-label">{{ t('balance.youWillReceive') }}</div>
                <div class="summary-value" style="color:#44d7c5">
                  <v-icon size="13" color="#44d7c5">mdi-circle-multiple-outline</v-icon>
                  {{ formatCoins(b2cFinalCoins) }} {{ t('balance.coins') }}
                </div>
              </div>
              <v-icon color="rgba(173,228,242,0.3)" size="17">mdi-arrow-right</v-icon>
              <div class="text-right">
                <div class="summary-label">{{ t('balance.deductedFrom', { currency: selectedCurrency }) }}</div>
                <div class="summary-value" style="color:#fac775">{{ b2cFinalCostFormatted }}</div>
              </div>
            </div>

            <!-- After balance preview -->
            <div v-if="b2cFinalCoins > 0 && canAffordFinal" class="after-balance-row mt-2">
              <div class="ab-item">
                <div class="ab-label">{{ t('balance.coinsAfter') }}</div>
                <div class="ab-value" style="color:#44d7c5">{{ formatCoins(currentCoinBalance + b2cFinalCoins) }}</div>
              </div>
              <div class="ab-divider" />
              <div class="ab-item">
                <div class="ab-label">{{ t('balance.currencyAfter', { currency: selectedCurrency }) }}</div>
                <div class="ab-value" style="color:#fac775">{{ b2cAfterCurrencyBalance }}</div>
              </div>
            </div>

            <!-- Warning -->
            <div class="warn-box mt-3">
              <v-icon size="13" color="#fac775" class="mt-1 flex-shrink-0">mdi-alert-triangle-outline</v-icon>
              <span>{{ t('balance.warning', { currency: selectedCurrency }) }}</span>
            </div>

          </div>
        </div>

        <!-- ── C2B: Cash Out (Coins → Balance) ── -->
        <div v-else class="step-scroll-body">
          <div class="pa-4">

            <!-- Currency selector -->
            <div class="slabel mb-2">{{ t('balance.receiveInto') }}</div>
            <div class="bar-outer mb-3">
              <button class="bar-arrow-btn" :class="{ hidden: balBarAtStart }" @click="scrollBalBar(-1)">
                <v-icon size="13">mdi-chevron-left</v-icon>
              </button>
              <div class="bar-scroll-area">
                <div ref="balBarRef" class="bar-scroll-track" @scroll="updateBalBarArrows">
                  <template v-for="(bal, i) in walletBalances" :key="bal.currency_id">
                    <div v-if="i > 0" class="bar-sep" />
                    <button class="bar-bal-item"
                      :class="{ 'bar-bal-item-active': selectedCurrency === bal.currency_code }"
                      :disabled="isLoadingForm" @click="onSelectCurrency(bal.currency_code)">
                      <div class="bar-bal-code">{{ bal.currency_code }}</div>
                      <div class="bar-bal-amount">{{ formatCurrencyByCode(toNumber(bal.amount), bal.currency_code) }}</div>
                    </button>
                  </template>
                </div>
              </div>
              <button class="bar-arrow-btn" :class="{ hidden: balBarAtEnd }" @click="scrollBalBar(1)">
                <v-icon size="13">mdi-chevron-right</v-icon>
              </button>
            </div>

            <!-- Rate info -->
            <div class="rate-bar mb-3">
              <v-icon size="13" color="#5fd4b0" class="mr-1">mdi-information-outline</v-icon>
              <span class="rate-text">
                {{ t('balance.rate') }} <strong>{{ t('balance.oneCoin') }}</strong> = {{ ratePerCoinFormatted }}
              </span>
            </div>

            <!-- Coin balance badge -->
            <div class="coin-balance-badge mb-3">
              <v-icon color="#fac775" size="20" class="mr-2">mdi-circle-multiple-outline</v-icon>
              <div>
                <div class="balance-label">{{ t('balance.availableCoins') }}</div>
                <div class="balance-value">{{ formatCoins(currentCoinBalance) }}</div>
              </div>
            </div>

            <!-- Coin amount input -->
            <div class="slabel mb-2">{{ t('balance.coinsToCashOut') }}</div>
            <div class="inp-card mb-3" :class="{ 'inp-card-focus': c2bCoins > 0 }">
              <div class="inp-row">
                <input v-model.number="c2bCoins" type="number" class="big-input" placeholder="0" min="100" step="100"
                  @input="onC2BInput" />
                <span class="inp-unit">{{ t('balance.coins') }}</span>
              </div>
              <div class="inp-cost" :style="c2bCoins > 0 ? 'color:#44d7c5' : 'color:rgba(173,228,242,0.3)'">
                {{ c2bCoins > 0 ? '≈ ' + formatCurrencyByCode(c2bReceiveAmount, selectedCurrency) : '—' }}
              </div>
              <div v-if="c2bErrorMsg" class="custom-error mt-1">
                <v-icon size="11" color="#f09595">mdi-alert-circle-outline</v-icon>
                {{ c2bErrorMsg }}
              </div>
            </div>

            <!-- Summary -->
            <div v-if="c2bCoins >= 100 && !c2bErrorMsg" class="summary-row mt-1">
              <div>
                <div class="summary-label">{{ t('balance.youSpend') }}</div>
                <div class="summary-value" style="color:#fac775">
                  <v-icon size="13" color="#fac775">mdi-circle-multiple-outline</v-icon>
                  {{ formatCoins(c2bCoins) }} {{ t('balance.coins') }}
                </div>
              </div>
              <v-icon color="rgba(173,228,242,0.3)" size="17">mdi-arrow-right</v-icon>
              <div class="text-right">
                <div class="summary-label">{{ t('balance.youReceive') }}</div>
                <div class="summary-value" style="color:#44d7c5">
                  {{ formatCurrencyByCode(c2bReceiveAmount, selectedCurrency) }}
                </div>
              </div>
            </div>

            <div v-if="c2bCoins >= 100 && !c2bErrorMsg" class="after-balance-row mt-2">
              <div class="ab-item">
                <div class="ab-label">{{ t('balance.coinsAfter') }}</div>
                <div class="ab-value" style="color:#fac775">{{ formatCoins(Math.max(0, currentCoinBalance - c2bCoins)) }}</div>
              </div>
              <div class="ab-divider" />
              <div class="ab-item">
                <div class="ab-label">{{ t('balance.currencyAfter', { currency: selectedCurrency }) }}</div>
                <div class="ab-value" style="color:#44d7c5">{{ c2bAfterCurrencyBalance }}</div>
              </div>
            </div>

            <!-- Warning -->
            <!-- <div class="warn-box mt-3">
              <v-icon size="13" color="#fac775" class="mt-1 flex-shrink-0">mdi-alert-triangle-outline</v-icon>
              <span>{{ t('balance.c2bWarning') }}</span>
            </div> -->

          </div>
        </div>

      </template>

      <!-- ══════════════════════════════════════════════════════════
           CONFIRM STEP
      ══════════════════════════════════════════════════════════ -->
      <template v-else-if="currentStep === 'confirm'">
        <div class="pa-4" style="display:flex;flex-direction:column;gap:14px">

          <p class="ocean-subtitle">
            <template v-if="activeTab === 'b2c'">
              {{ t('balance.confirmMessage', {
                amount: b2cFinalCostFormatted,
                currency: selectedCurrency,
                coins: formatCoins(b2cFinalCoins),
              }) }}
            </template>
            <template v-else>
              {{ t('balance.cashOutConfirmMessage', {
                coins: formatCoins(c2bCoins),
                amount: formatCurrencyByCode(c2bReceiveAmount, selectedCurrency),
                currency: selectedCurrency,
              }) }}
            </template>
          </p>

          <!-- B2C confirm detail -->
          <div v-if="activeTab === 'b2c'" class="confirm-detail-row">
            <div class="detail-item">
              <v-icon size="15" color="#fac775" class="mb-1">mdi-cash-minus</v-icon>
              <div class="detail-label">{{ t('balance.deducted') }}</div>
              <div class="detail-value" style="color:#fac775">-{{ b2cFinalCostFormatted }}</div>
              <div class="detail-sub">{{ t('balance.fromCurrency', { currency: selectedCurrency }) }}</div>
            </div>
            <div class="detail-divider" />
            <div class="detail-item">
              <v-icon size="15" color="#44d7c5" class="mb-1">mdi-circle-multiple-outline</v-icon>
              <div class="detail-label">{{ t('balance.youReceive') }}</div>
              <div class="detail-value" style="color:#44d7c5">+{{ formatCoins(b2cFinalCoins) }}</div>
              <div class="detail-sub">{{ t('balance.coins') }}</div>
            </div>
            <div class="detail-divider" />
            <div class="detail-item">
              <v-icon size="15" color="rgba(173,228,242,0.6)" class="mb-1">mdi-wallet-outline</v-icon>
              <div class="detail-label">{{ t('balance.balanceAfter') }}</div>
              <div class="detail-value" style="font-size:12px">{{ b2cAfterCurrencyBalance }}</div>
              <div class="detail-sub">{{ t('balance.currencyLeft', { currency: selectedCurrency }) }}</div>
            </div>
          </div>

          <!-- C2B confirm detail -->
          <div v-else class="confirm-detail-row">
            <div class="detail-item">
              <v-icon size="15" color="#fac775" class="mb-1">mdi-circle-multiple-outline</v-icon>
              <div class="detail-label">{{ t('balance.deducted') }}</div>
              <div class="detail-value" style="color:#fac775">-{{ formatCoins(c2bCoins) }}</div>
              <div class="detail-sub">{{ t('balance.coins') }}</div>
            </div>
            <div class="detail-divider" />
            <div class="detail-item">
              <v-icon size="15" color="#44d7c5" class="mb-1">mdi-wallet-outline</v-icon>
              <div class="detail-label">{{ t('balance.youReceive') }}</div>
              <div class="detail-value" style="color:#44d7c5">+{{ formatCurrencyByCode(c2bReceiveAmount, selectedCurrency) }}</div>
              <div class="detail-sub">{{ selectedCurrency }}</div>
            </div>
            <div class="detail-divider" />
            <div class="detail-item">
              <v-icon size="15" color="rgba(173,228,242,0.6)" class="mb-1">mdi-circle-multiple-outline</v-icon>
              <div class="detail-label">{{ t('balance.coinsAfter') }}</div>
              <div class="detail-value" style="font-size:12px">{{ formatCoins(Math.max(0, currentCoinBalance - c2bCoins)) }}</div>
              <div class="detail-sub">{{ t('balance.remaining') }}</div>
            </div>
          </div>

          <v-alert type="warning" variant="tonal" density="compact" border="start" color="amber">
            <span style="font-size:12px">
              <template v-if="activeTab === 'b2c'">
                {{ t('balance.warning', { currency: selectedCurrency }) }}
              </template>
              <template v-else>
                {{ t('balance.c2bConfirmWarning') }}
              </template>
            </span>
          </v-alert>

        </div>
      </template>

      <!-- ══════════════════════════════════════════════════════════
           SUCCESS STEP
      ══════════════════════════════════════════════════════════ -->
      <template v-else-if="currentStep === 'success'">
        <div class="success-body">
          <v-icon color="#44d7c5" size="52">mdi-check-circle-outline</v-icon>
          <div class="success-title">{{ t('balance.exchangeSuccessfulTitle') }}</div>
          <div class="success-pill">
            <template v-if="activeTab === 'b2c'">+{{ formatCoins(b2cFinalCoins) }} {{ t('balance.coins') }}</template>
            <template v-else>+{{ formatCurrencyByCode(c2bReceiveAmount, selectedCurrency) }}</template>
          </div>
          <div class="success-sub">
            <template v-if="activeTab === 'b2c'">−{{ b2cFinalCostFormatted }} {{ t('balance.deductedFrom', { currency: selectedCurrency }) }}</template>
            <template v-else>−{{ formatCoins(c2bCoins) }} {{ t('balance.coinsDeducted') }}</template>
          </div>
          <v-btn variant="flat" class="ocean-btn-confirm mt-4" style="width:160px" @click="close">
            <v-icon start size="15">mdi-check</v-icon> {{ t('common.done') }}
          </v-btn>
        </div>
      </template>

      <v-divider v-if="currentStep !== 'success'" color="rgba(58,168,232,0.1)" />

      <!-- ── Footer buttons ── -->
      <v-card-actions v-if="currentStep !== 'success'" class="px-4 py-3 gap-3">

        <!-- Form step -->
        <template v-if="currentStep === 'form'">
          <v-btn variant="outlined" color="rgba(173,228,242,0.4)" class="ocean-btn-cancel flex-grow-1" @click="close">
            {{ t('common.cancel') }}
          </v-btn>
          <v-btn variant="flat" class="ocean-btn-confirm flex-grow-1"
            :disabled="!isFormValid || isLoadingForm || isLoadingPackages" @click="goToConfirm">
            {{ t('common.confirm') }}
            <v-icon end size="15">mdi-arrow-right</v-icon>
          </v-btn>
        </template>

        <!-- Confirm step -->
        <template v-else-if="currentStep === 'confirm'">
          <v-btn variant="outlined" color="rgba(173,228,242,0.4)" class="ocean-btn-cancel flex-grow-1" @click="backToForm">
            <v-icon start size="15">mdi-arrow-left</v-icon>
            {{ t('common.back') }}
          </v-btn>
          <v-btn variant="flat" class="ocean-btn-danger flex-grow-1" :loading="purchasing" @click="confirmExchange">
            <v-icon start size="15">mdi-check-circle-outline</v-icon>
            {{ t('balance.confirmExchange') }}
          </v-btn>
        </template>

      </v-card-actions>

    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { sonnerToast } from '~/utils/sonnerToast'
import {
  exchangeCoin,
  exchangeBalance,
  getExchangeBalanceForm,
  getExchangeCoinForm,
  getExchangePackages,
  purchaseExchangePackage,
  type ExchangePackage,
  type ExchangeCoinFormItem,
  type ExchangeFormBalance,
} from '~/composables/service/balanceApi'

const { t } = useFrontendI18n()

// ─── Types ─────────────────────────────────────────────────────────────────────
interface CoinPackage {
  id: number
  name: string
  description: string
  currencyCode: string
  priceAmount: number
  coinAmount: number
  popular?: boolean
}

type CurrencyCode = string
type TabMode = 'b2c' | 'c2b'
type StepName = 'form' | 'confirm' | 'success'

export interface PurchasePayload {
  coins: number
  currency: CurrencyCode
  amount: number
  direction: TabMode
}

// ─── Props / Emits ─────────────────────────────────────────────────────────────
const props = withDefaults(defineProps<{
  modelValue: boolean
  currentBalance?: number
  balanceUSD?: number
  balanceKHR?: number
}>(), {
  currentBalance: 0,
  balanceUSD: 80,
  balanceKHR: 40000,
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'purchase-confirmed': [payload: PurchasePayload]
}>()

// ─── Dialog visibility ─────────────────────────────────────────────────────────
const internalVisible = ref(false)

function onDialogUpdate(val: boolean) {
  if (!val) close()
}

// ─── Insufficient coins dialog state ──────────────────────────────────────────
const insufficientCoinsVisible = ref(false)
const insufficientBetAmount = ref(0)

/**
 * Call this from your game/bet logic to show the insufficient coins dialog.
 * e.g. showInsufficientCoinsDialog(betAmount)
 */
function showInsufficientCoinsDialog(betAmount: number) {
  insufficientBetAmount.value = betAmount
  insufficientCoinsVisible.value = true
}

function closeInsufficientDialog() {
  insufficientCoinsVisible.value = false
}

function openExchangeFromInsufficient() {
  insufficientCoinsVisible.value = false
  // Open exchange dialog on the top-up tab
  activeTab.value = 'b2c'
  internalVisible.value = true
  emit('update:modelValue', true)
  void openDialog()
}

// ─── Tab / Step state ──────────────────────────────────────────────────────────
const activeTab = ref<TabMode>('b2c')
const currentStep = ref<StepName>('form')

// ─── Shared form state ─────────────────────────────────────────────────────────
const selectedCurrency = ref<CurrencyCode>('USD')
const isLoadingForm = ref(false)
const isLoadingPackages = ref(false)
const purchasing = ref(false)

// ─── API data ──────────────────────────────────────────────────────────────────
const walletBalances = ref<ExchangeFormBalance[]>([])
const currentCoinBalance = ref(0)
const currentCurrencyId = ref<number | null>(null)
const exchangeRateByCurrencyId = ref<Record<number, number>>({})

// ─── B2C state ─────────────────────────────────────────────────────────────────
const packages = ref<CoinPackage[]>([])
const selectedPackage = ref<CoinPackage | null>(null)
const customAmount = ref<number | null>(null)

// ─── C2B state ─────────────────────────────────────────────────────────────────
const c2bCoins = ref<number>(0)

// ─── Balance bar scroll ────────────────────────────────────────────────────────
const balBarRef = ref<HTMLElement | null>(null)
const balBarAtStart = ref(true)
const balBarAtEnd = ref(false)
const BAL_BAR_STEP = 140

function scrollBalBar(dir: number) {
  balBarRef.value?.scrollBy({ left: dir * BAL_BAR_STEP, behavior: 'smooth' })
}
function updateBalBarArrows() {
  const el = balBarRef.value
  if (!el) return
  balBarAtStart.value = el.scrollLeft <= 4
  balBarAtEnd.value = el.scrollLeft >= el.scrollWidth - el.clientWidth - 4
}

// ─── Fallback rates ────────────────────────────────────────────────────────────
const FALLBACK_USD_RATE = 0.001
const FALLBACK_KHR_RATE = 4

// ─── Computed: shared ──────────────────────────────────────────────────────────
const selectedExchangeRate = computed<number>(() => {
  if (currentCurrencyId.value !== null) {
    const r = exchangeRateByCurrencyId.value[currentCurrencyId.value]
    if (r && r > 0) return r
  }
  if (selectedCurrency.value === 'USD') return FALLBACK_USD_RATE
  if (selectedCurrency.value === 'KHR') return FALLBACK_KHR_RATE
  return FALLBACK_USD_RATE
})

const ratePerCoinFormatted = computed(() =>
  formatRateByCode(selectedExchangeRate.value, selectedCurrency.value),
)

const currentCurrencyBalance = computed(() => {
  const found = walletBalances.value.find(b => b.currency_code === selectedCurrency.value)
  if (found) return toNumber(found.amount)
  if (selectedCurrency.value === 'USD') return props.balanceUSD
  if (selectedCurrency.value === 'KHR') return props.balanceKHR
  return 0
})

// ─── Computed: B2C ────────────────────────────────────────────────────────────
const isCustomMode = computed(() =>
  selectedPackage.value === null && (customAmount.value ?? 0) > 0,
)

const b2cFinalCoins = computed(() => {
  if (selectedPackage.value) return selectedPackage.value.coinAmount
  return customAmount.value ?? 0
})

const b2cFinalCost = computed(() => {
  if (selectedPackage.value) return selectedPackage.value.priceAmount
  return coinsToCost(customAmount.value ?? 0)
})

const b2cFinalCostFormatted = computed(() => formatCurrencyByCode(b2cFinalCost.value, selectedCurrency.value))

const customCostFormatted = computed(() => {
  const coins = customAmount.value ?? 0
  return formatCurrencyByCode(coins <= 0 ? 0 : coinsToCost(coins), selectedCurrency.value)
})

const canAffordCustom = computed(() => {
  const coins = customAmount.value ?? 0
  if (coins <= 0) return true
  return currentCurrencyBalance.value >= coinsToCost(coins)
})

const canAffordFinal = computed(() =>
  currentCurrencyBalance.value >= b2cFinalCost.value,
)

const b2cAfterCurrencyBalance = computed(() => {
  const after = Math.max(0, currentCurrencyBalance.value - b2cFinalCost.value)
  return formatCurrencyByCode(after, selectedCurrency.value)
})

// ─── Computed: C2B ────────────────────────────────────────────────────────────
const c2bReceiveAmount = computed(() =>
  Math.max(0, c2bCoins.value) * selectedExchangeRate.value,
)

const c2bAfterCurrencyBalance = computed(() => {
  const after = currentCurrencyBalance.value + c2bReceiveAmount.value
  return formatCurrencyByCode(after, selectedCurrency.value)
})

const c2bErrorMsg = computed(() => {
  if (c2bCoins.value <= 0) return ''
  if (c2bCoins.value < 100) return t('balance.minimumCoins')
  if (c2bCoins.value > currentCoinBalance.value) return t('balance.notEnoughCoinsShort')
  return ''
})

// ─── Computed: form validity ───────────────────────────────────────────────────
const isFormValid = computed(() => {
  if (activeTab.value === 'b2c') {
    return b2cFinalCoins.value >= 100 && canAffordFinal.value && b2cFinalCost.value > 0
  }
  return c2bCoins.value >= 100 && !c2bErrorMsg.value
})

// ─── Computed: header ─────────────────────────────────────────────────────────
const headerIcon = computed(() => {
  if (currentStep.value === 'confirm') return 'mdi-shield-check-outline'
  if (currentStep.value === 'success') return 'mdi-check-circle-outline'
  return activeTab.value === 'b2c' ? 'mdi-wallet-outline' : 'mdi-circle-multiple-outline'
})

const headerIconColor = computed(() => {
  if (currentStep.value === 'confirm') return '#378add'
  return currentStep.value === 'success' || activeTab.value === 'b2c' ? '#44d7c5' : '#fac775'
})

const headerIconClass = computed(() => {
  if (currentStep.value === 'confirm') return 'icon-check'
  if (currentStep.value === 'success') return 'icon-coin'
  return activeTab.value === 'b2c' ? 'icon-coin' : 'icon-warn'
})

const headerTitle = computed(() => {
  if (currentStep.value === 'confirm') return t('balance.confirmTitle')
  if (currentStep.value === 'success') return t('balance.exchangeSuccessful')
  return activeTab.value === 'b2c' ? t('balance.topUpCoins') : t('balance.cashOutCoins')
})

// ─── Watchers ─────────────────────────────────────────────────────────────────
watch(() => props.modelValue, (val) => {
  if (val) {
    internalVisible.value = true
    void openDialog()
  } else {
    internalVisible.value = false
  }
})

watch(customAmount, (val) => {
  if (val && val > 0) selectedPackage.value = null
})

watch(walletBalances, () => {
  nextTick(() => updateBalBarArrows())
}, { deep: true })

// ─── Helpers ──────────────────────────────────────────────────────────────────
function toNumber(v: unknown): number {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

function coinsToCost(coins: number): number {
  return Math.max(0, coins) * selectedExchangeRate.value
}

function currencyIdByCode(code: CurrencyCode): number | null {
  return walletBalances.value.find(b => b.currency_code === code)?.currency_id ?? null
}

function currencyCodeFromId(id: number): CurrencyCode | null {
  return walletBalances.value.find(b => b.currency_id === id)?.currency_code ?? null
}

function syncCoinForm(form: ExchangeCoinFormItem) {
  currentCurrencyId.value = form.currency_id
  currentCoinBalance.value = toNumber(form.coin_available)
  walletBalances.value = Array.isArray(form.balance) ? form.balance : []
  const rate = toNumber(form.exchange_rate)
  if (form.currency_id > 0 && rate > 0) {
    exchangeRateByCurrencyId.value = { ...exchangeRateByCurrencyId.value, [form.currency_id]: rate }
  }
}

function normalizePackage(pkg: ExchangePackage, index: number, total: number): CoinPackage {
  return {
    id: pkg.id,
    name: pkg.package_name,
    description: pkg.package_description,
    currencyCode: pkg.currency_code,
    priceAmount: toNumber(pkg.price_amount),
    coinAmount: toNumber(pkg.coin_amount),
    popular: total >= 3 ? index === Math.floor(total / 2) : false,
  }
}

function applyDefaultPackageSelection() {
  if (selectedPackage.value) {
    selectedPackage.value = packages.value.find(p => p.id === selectedPackage.value?.id) ?? null
    return
  }
  selectedPackage.value = packages.value.find(p => p.popular) ?? packages.value[0] ?? null
}

function resetSelection() {
  customAmount.value = null
  selectedPackage.value = null
  c2bCoins.value = 0
}

// ─── API calls ─────────────────────────────────────────────────────────────────
async function hydrateForms(targetCode?: CurrencyCode) {
  isLoadingForm.value = true
  try {
    const targetCurrencyId = targetCode ? currencyIdByCode(targetCode) : null
    const coinFormResp = await getExchangeCoinForm(targetCurrencyId ?? undefined)
    const coinFormItem = coinFormResp?.data?.value?.data?.exchange_coin_form?.[0]
    if (!coinFormItem) throw new Error(t('balance.exchangeCoinFormUnavailable'))

    syncCoinForm(coinFormItem)

    const activeCode = targetCode
      ?? currencyCodeFromId(coinFormItem.currency_id)
      ?? walletBalances.value[0]?.currency_code
      ?? selectedCurrency.value
    selectedCurrency.value = activeCode

    const [balanceFormResp] = await Promise.all([
      getExchangeBalanceForm(coinFormItem.currency_id),
      loadPackages(coinFormItem.currency_id),
    ])

    const balanceFormItem = balanceFormResp?.data?.value?.data?.exchange_balance_form?.[0]
    if (balanceFormItem?.balance) {
      walletBalances.value = Array.isArray(balanceFormItem.balance)
        ? balanceFormItem.balance
        : walletBalances.value
    }
  } catch (error: any) {
    const msg = error?.message || error?.data?.error || t('balance.failedToLoadExchangeForm')
    sonnerToast(t('balance.loadFailed'), String(msg), 'error')
  } finally {
    isLoadingForm.value = false
  }
}

async function loadPackages(currencyId: number) {
  isLoadingPackages.value = true
  try {
    const response = await getExchangePackages(currencyId)
    const list = response?.data?.value?.data?.packages ?? []
    packages.value = list.map((pkg, i) => normalizePackage(pkg, i, list.length))
    applyDefaultPackageSelection()
  } catch {
    packages.value = []
    selectedPackage.value = null
  } finally {
    isLoadingPackages.value = false
  }
}

// ─── Dialog flow ───────────────────────────────────────────────────────────────
async function openDialog() {
  currentStep.value = 'form'
  resetSelection()
  await hydrateForms()
  nextTick(() => updateBalBarArrows())
}

function switchTab(tab: TabMode) {
  if (activeTab.value === tab) return
  activeTab.value = tab
  currentStep.value = 'form'
  resetSelection()
}

function selectPackage(pkg: CoinPackage) {
  selectedPackage.value = pkg
  customAmount.value = null
}

function onCustomInput() {
  if ((customAmount.value ?? 0) > 0) selectedPackage.value = null
}

function onSelectCurrency(code: CurrencyCode) {
  if (!code || code === selectedCurrency.value || isLoadingForm.value) return
  selectedCurrency.value = code
  resetSelection()
  void hydrateForms(code)
}

function onC2BInput() {
  // reactivity handles the rest via computed
}

function goToConfirm() {
  if (!isFormValid.value) return
  currentStep.value = 'confirm'
}

function backToForm() {
  currentStep.value = 'form'
}

async function confirmExchange() {
  purchasing.value = true
  try {
    if (activeTab.value === 'b2c') {
      await doBuyCoins()
    } else {
      await doSellCoins()
    }
    currentStep.value = 'success'
  } catch (error: any) {
    const msg = error?.error || error?.message || t('balance.genericExchangeError')
    sonnerToast(t('balance.exchangeFailed'), String(msg), 'error')
  } finally {
    purchasing.value = false
  }
}

async function doBuyCoins() {
  let coinReceived = 0
  let exchangedAmount = 0

  if (selectedPackage.value) {
    const response = await purchaseExchangePackage(selectedPackage.value.id)
    const data = response?.data?.value?.data
    coinReceived = toNumber(data?.coin_received)
    exchangedAmount = toNumber(data?.price_amount)
  } else {
    if (currentCurrencyId.value === null) throw new Error(t('balance.currencyNotReady'))
    const response = await exchangeCoin({
      currency_id: currentCurrencyId.value,
      amount_coin: b2cFinalCoins.value.toFixed(3),
      reference: '',
      remark: '',
    })
    const data = response?.data?.value?.data
    coinReceived = toNumber(data?.coin_received)
    exchangedAmount = toNumber(data?.balance_exchanged)
  }

  emit('purchase-confirmed', {
    coins: coinReceived,
    currency: selectedCurrency.value,
    amount: exchangedAmount,
    direction: 'b2c',
  })

  sonnerToast(
    t('balance.exchangeSuccessful'),
    `+${formatCoins(coinReceived)} ${t('balance.coins')} · -${formatCurrencyByCode(exchangedAmount, selectedCurrency.value)}`,
    'success',
  )

  await hydrateForms(selectedCurrency.value)
}

async function doSellCoins() {
  if (currentCurrencyId.value === null) throw new Error(t('balance.currencyNotReady'))

  const response = await exchangeBalance({
    currency_id: currentCurrencyId.value,
    amount_coin: c2bCoins.value.toFixed(3),
    reference: '',
    remark: '',
  })

  const data = response?.data?.value?.data
  const balanceReceived = toNumber(data?.balance_received)
  const coinExchanged = toNumber(data?.coin_exchanged)

  emit('purchase-confirmed', {
    coins: -coinExchanged,
    currency: selectedCurrency.value,
    amount: balanceReceived,
    direction: 'c2b',
  })

  sonnerToast(
    t('balance.cashOutSuccessful'),
    `+${formatCurrencyByCode(balanceReceived, selectedCurrency.value)} · -${formatCoins(coinExchanged)} ${t('balance.coins')}`,
    'success',
  )

  await hydrateForms(selectedCurrency.value)
}

function close() {
  internalVisible.value = false
  emit('update:modelValue', false)
  setTimeout(() => {
    currentStep.value = 'form'
    activeTab.value = 'b2c'
    resetSelection()
  }, 300)
}

// ─── Formatters ────────────────────────────────────────────────────────────────
function formatCoins(n: number): string {
  return new Intl.NumberFormat('en-US').format(Math.floor(n))
}

function formatCurrencyByCode(n: number, code: CurrencyCode): string {
  if (code === 'USD') return `$${(+n).toFixed(2)}`
  if (code === 'KHR') return `${new Intl.NumberFormat('en-US').format(Math.floor(+n))}៛`
  if (code === 'CNY') return `¥${(+n).toFixed(2)}`
  if (code === 'EUR') return `€${(+n).toFixed(2)}`
  if (code === 'GBP') return `£${(+n).toFixed(2)}`
  return `${new Intl.NumberFormat('en-US').format(Math.floor(+n))} ${code}`
}

function formatRateByCode(rate: number, code: CurrencyCode): string {
  const safe = Number.isFinite(rate) ? rate : 0
  if (code === 'USD') return `$${safe.toFixed(4)}`
  if (code === 'KHR') return `${safe.toFixed(3)}៛`
  return `${safe.toFixed(4)} ${code}`
}

// ─── Expose for parent use ─────────────────────────────────────────────────────
defineExpose({ showInsufficientCoinsDialog })
</script>

<style scoped>
/* ── Card shell ──────────────────────────────────────────────────────────────── */
.ocean-card {
  background: linear-gradient(180deg, #0a1929 0%, #051928 55%, #0a2240 100%) !important;
  border: 1.5px solid rgba(26, 111, 168, 0.5) !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ocean-header {
  background: linear-gradient(90deg, rgba(26, 111, 168, 0.22), transparent);
}

/* ── Header icon variants ────────────────────────────────────────────────────── */
.header-icon {
  width: 34px;
  height: 34px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.icon-warn {
  background: rgba(186, 117, 23, 0.18);
  border: 1px solid rgba(186, 117, 23, 0.38);
}

.icon-coin {
  background: rgba(29, 158, 117, 0.18);
  border: 1px solid rgba(29, 158, 117, 0.38);
}

.icon-check {
  background: rgba(26, 111, 168, 0.18);
  border: 1px solid rgba(26, 111, 168, 0.38);
}

.ocean-subtitle {
  font-size: 13px;
  color: rgba(173, 228, 242, 0.72);
  line-height: 1.6;
}

/* ── Tab bar ─────────────────────────────────────────────────────────────────── */
.tab-bar {
  display: flex;
  background: rgba(5, 15, 30, 0.6);
  border-bottom: 1px solid rgba(58, 168, 232, 0.18);
}

.exchange-tab {
  flex: 1;
  padding: 10px 8px;
  border: none;
  background: transparent;
  color: rgba(173, 228, 242, 0.4);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  transition: all 0.2s;
}

.exchange-tab:hover {
  background: rgba(255, 255, 255, 0.03);
}

.tab-inner {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 9px;
}

.tab-icon-wrap {
  width: 30px;
  height: 30px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: all 0.2s;
}

.tab-icon-b2c {
  background: rgba(68, 215, 197, 0.08);
  border: 1px solid rgba(68, 215, 197, 0.18);
  color: rgba(68, 215, 197, 0.5);
}

.tab-icon-c2b {
  background: rgba(250, 199, 117, 0.08);
  border: 1px solid rgba(250, 199, 117, 0.18);
  color: rgba(250, 199, 117, 0.5);
}

.tab-text-wrap {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 1px;
}

.tab-label {
  font-size: 13px;
  font-weight: 600;
  line-height: 1.2;
  color: rgba(173, 228, 242, 0.45);
  transition: color 0.2s;
}

.tab-desc {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.28);
  letter-spacing: 0.04em;
  transition: color 0.2s;
}

/* B2C active */
.tab-active-b2c {
  border-bottom-color: #44d7c5 !important;
  background: rgba(68, 215, 197, 0.06) !important;
}

.tab-active-b2c .tab-label {
  color: #44d7c5;
}

.tab-active-b2c .tab-desc {
  color: rgba(68, 215, 197, 0.55);
}

.tab-active-b2c .tab-icon-b2c {
  background: rgba(68, 215, 197, 0.15);
  border-color: rgba(68, 215, 197, 0.4);
  color: #44d7c5;
}

/* C2B active */
.tab-active-c2b {
  border-bottom-color: #fac775 !important;
  background: rgba(250, 199, 117, 0.05) !important;
}

.tab-active-c2b .tab-label {
  color: #fac775;
}

.tab-active-c2b .tab-desc {
  color: rgba(250, 199, 117, 0.55);
}

.tab-active-c2b .tab-icon-c2b {
  background: rgba(250, 199, 117, 0.15);
  border-color: rgba(250, 199, 117, 0.4);
  color: #fac775;
}

/* ── Scrollable body ─────────────────────────────────────────────────────────── */
.step-scroll-body {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  max-height: 60vh;
  scrollbar-width: thin;
  scrollbar-color: rgba(58, 168, 232, 0.2) transparent;
}

.step-scroll-body::-webkit-scrollbar {
  width: 3px;
}

.step-scroll-body::-webkit-scrollbar-thumb {
  background: rgba(58, 168, 232, 0.22);
  border-radius: 3px;
}

/* ── Section label ───────────────────────────────────────────────────────────── */
.slabel {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.4);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

/* ── Balance bar ─────────────────────────────────────────────────────────────── */
.bar-outer {
  display: flex;
  align-items: center;
  background: rgba(5, 25, 40, 0.7);
  border: 1px solid rgba(29, 158, 117, 0.22);
  border-radius: 12px;
  padding: 3px;
  gap: 3px;
}

.bar-scroll-area {
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.bar-scroll-track {
  display: flex;
  align-items: center;
  gap: 2px;
  overflow-x: auto;
  scroll-behavior: smooth;
  -ms-overflow-style: none;
  scrollbar-width: none;
  padding: 2px 0;
}

.bar-scroll-track::-webkit-scrollbar { display: none; }

.bar-bal-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 7px 11px;
  border-radius: 8px;
  flex-shrink: 0;
  white-space: nowrap;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s;
}

.bar-bal-item:hover { background: rgba(29, 158, 117, 0.08); }
.bar-bal-item:disabled { cursor: wait; opacity: 0.7; }

.bar-bal-item-active {
  background: rgba(68, 215, 197, 0.12);
  border-color: rgba(68, 215, 197, 0.28);
}

.bar-bal-code {
  font-size: 10px;
  color: rgba(95, 212, 176, 0.55);
  letter-spacing: 0.07em;
  line-height: 1;
  margin-bottom: 1px;
}

.bar-bal-item-active .bar-bal-code { color: rgba(173, 228, 242, 0.78); }

.bar-bal-amount {
  font-size: 13px;
  font-weight: 600;
  color: #5fd4b0;
  line-height: 1.3;
}

.bar-bal-item-active .bar-bal-amount { color: #9ff6dd; }

.bar-sep {
  width: 1px;
  height: 22px;
  background: rgba(29, 158, 117, 0.2);
  flex-shrink: 0;
  align-self: center;
}

.bar-arrow-btn {
  width: 26px;
  height: 26px;
  flex-shrink: 0;
  border-radius: 7px;
  border: 1px solid rgba(29, 158, 117, 0.22);
  background: transparent;
  color: rgba(95, 212, 176, 0.65);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 0.15s, color 0.15s, width 0.2s, opacity 0.2s;
  overflow: hidden;
}

.bar-arrow-btn:hover {
  background: rgba(29, 158, 117, 0.12);
  color: #5fd4b0;
}

.bar-arrow-btn.hidden {
  opacity: 0;
  pointer-events: none;
  width: 0;
  padding: 0;
  border-width: 0;
}

/* ── Rate bar ────────────────────────────────────────────────────────────────── */
.rate-bar {
  display: flex;
  align-items: center;
  background: rgba(29, 158, 117, 0.07);
  border: 1px solid rgba(29, 158, 117, 0.18);
  border-radius: 8px;
  padding: 7px 11px;
}

.rate-text {
  font-size: 12px;
  color: rgba(95, 212, 176, 0.8);
}

.rate-text strong { color: #5fd4b0; }

/* ── Coin balance badge ───────────────────────────────────────────────────────── */
.coin-balance-badge {
  display: flex;
  align-items: center;
  background: rgba(186, 117, 23, 0.1);
  border: 1px solid rgba(186, 117, 23, 0.28);
  border-radius: 12px;
  padding: 10px 14px;
}

.balance-label {
  font-size: 11px;
  color: rgba(250, 199, 117, 0.75);
  letter-spacing: 0.04em;
}

.balance-value {
  font-size: 20px;
  font-weight: 600;
  color: #fac775;
}

/* ── Input card ──────────────────────────────────────────────────────────────── */
.inp-card {
  background: rgba(5, 20, 38, 0.8);
  border: 1.5px solid rgba(58, 168, 232, 0.18);
  border-radius: 12px;
  padding: 12px 14px;
  transition: border-color 0.15s;
}

.inp-card-focus { border-color: rgba(68, 215, 197, 0.45); }

.inp-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.big-input {
  flex: 1;
  background: transparent;
  border: none;
  outline: none;
  font-size: 26px;
  font-weight: 600;
  color: #edf9ff;
  caret-color: #44d7c5;
  -moz-appearance: textfield;
  appearance: textfield;
}

.big-input::-webkit-outer-spin-button,
.big-input::-webkit-inner-spin-button { -webkit-appearance: none; }

.big-input::placeholder { color: rgba(173, 228, 242, 0.18); }

.inp-unit {
  font-size: 12px;
  color: rgba(173, 228, 242, 0.35);
  flex-shrink: 0;
}

.inp-cost {
  font-size: 13px;
  font-weight: 600;
  min-height: 18px;
  margin-top: 3px;
}

/* ── Packages ────────────────────────────────────────────────────────────────── */
.pkg-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.pkg-empty-state {
  border: 1px dashed rgba(58, 168, 232, 0.18);
  border-radius: 11px;
  padding: 10px 13px;
  font-size: 12px;
  color: rgba(173, 228, 242, 0.5);
  text-align: center;
  background: rgba(5, 20, 38, 0.45);
}

.pkg-card {
  display: flex;
  align-items: center;
  gap: 11px;
  background: rgba(5, 20, 38, 0.75);
  border: 1px solid rgba(58, 168, 232, 0.18);
  border-radius: 11px;
  padding: 10px 13px;
  cursor: pointer;
  position: relative;
  overflow: hidden;
  transition: border-color 0.15s, background 0.15s;
}

.pkg-card::before {
  content: '';
  position: absolute;
  left: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  background: transparent;
  transition: background 0.15s;
}

.pkg-card:hover {
  border-color: rgba(68, 215, 197, 0.32);
  background: rgba(14, 40, 72, 0.85);
}

.pkg-selected {
  border-color: rgba(68, 215, 197, 0.6) !important;
  background: rgba(14, 40, 72, 0.9) !important;
}

.pkg-selected::before {
  background: linear-gradient(180deg, #44d7c5, #378add) !important;
}

.pkg-popular { border-color: rgba(250, 199, 117, 0.32); }

.pkg-popular.pkg-selected {
  border-color: rgba(250, 199, 117, 0.7) !important;
  background: rgba(30, 20, 5, 0.85) !important;
}

.pkg-popular.pkg-selected::before {
  background: linear-gradient(180deg, #fac775, #ba7517) !important;
}

.pkg-icon-wrap {
  width: 36px;
  height: 36px;
  border-radius: 9px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(26, 111, 168, 0.18);
  border: 1px solid rgba(58, 168, 232, 0.22);
  transition: background 0.15s, border-color 0.15s;
}

.pkg-selected .pkg-icon-wrap {
  background: rgba(68, 215, 197, 0.12);
  border-color: rgba(68, 215, 197, 0.3);
}

.pkg-popular .pkg-icon-wrap {
  background: rgba(186, 117, 23, 0.14);
  border-color: rgba(250, 199, 117, 0.28);
}

.pkg-info { flex: 1; min-width: 0; }

.pkg-title {
  font-size: 13px;
  font-weight: 600;
  color: #edf9ff;
  display: flex;
  align-items: center;
  gap: 5px;
  flex-wrap: wrap;
}

.pkg-subtitle {
  font-size: 11px;
  color: rgba(173, 228, 242, 0.5);
  margin-top: 2px;
}

.pkg-popular-tag {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.04em;
  background: rgba(186, 117, 23, 0.2);
  border: 1px solid rgba(250, 199, 117, 0.32);
  color: #fac775;
  padding: 1px 6px;
  border-radius: 4px;
}

.pkg-right { text-align: right; flex-shrink: 0; }

.pkg-price {
  font-size: 13px;
  font-weight: 600;
  color: #5fd4b0;
}

.pkg-price-sub {
  font-size: 10px;
  color: rgba(95, 212, 176, 0.45);
  margin-top: 1px;
}

.pkg-check {
  width: 17px;
  height: 17px;
  border-radius: 50%;
  flex-shrink: 0;
  border: 1.5px solid rgba(58, 168, 232, 0.3);
  display: flex;
  align-items: center;
  justify-content: center;
  background: transparent;
  transition: all 0.15s;
}

.pkg-selected .pkg-check {
  background: linear-gradient(135deg, #44d7c5, #378add);
  border-color: transparent;
}

.pkg-popular.pkg-selected .pkg-check {
  background: linear-gradient(135deg, #fac775, #ba7517);
}

.pkg-check-inner {
  width: 5px;
  height: 5px;
  border-radius: 50%;
  background: #fff;
  opacity: 0;
  transform: scale(0);
  transition: all 0.15s;
}

.pkg-selected .pkg-check-inner { opacity: 1; transform: scale(1); }

/* ── Custom amount ───────────────────────────────────────────────────────────── */
.custom-pkg-card { cursor: default; }

.custom-label {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.45);
  letter-spacing: 0.05em;
}

.custom-input-row {
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.custom-input {
  background: transparent;
  border: none;
  outline: none;
  font-size: 18px;
  font-weight: 600;
  color: #edf9ff;
  width: 100%;
  caret-color: #44d7c5;
  -moz-appearance: textfield;
  appearance: textfield;
}

.custom-input::-webkit-outer-spin-button,
.custom-input::-webkit-inner-spin-button { -webkit-appearance: none; }

.custom-input::placeholder { color: rgba(173, 228, 242, 0.18); }

.custom-unit {
  font-size: 11px;
  color: rgba(173, 228, 242, 0.38);
  white-space: nowrap;
}

.custom-error {
  font-size: 11px;
  color: rgba(240, 149, 149, 0.9);
  display: flex;
  align-items: center;
  gap: 4px;
}

/* ── OR divider ──────────────────────────────────────────────────────────────── */
.or-divider {
  display: flex;
  align-items: center;
  gap: 8px;
}

.or-line {
  flex: 1;
  height: 1px;
  background: rgba(58, 168, 232, 0.14);
}

.or-text {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.28);
  letter-spacing: 0.06em;
  white-space: nowrap;
}

/* ── Summary ─────────────────────────────────────────────────────────────────── */
.summary-row {
  background: rgba(26, 111, 168, 0.1);
  border: 1px solid rgba(26, 111, 168, 0.22);
  border-radius: 12px;
  padding: 11px 14px;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.summary-label {
  font-size: 11px;
  color: rgba(173, 228, 242, 0.62);
  margin-bottom: 2px;
}

.summary-value {
  font-size: 14px;
  font-weight: 600;
  color: #edf9ff;
  display: flex;
  align-items: center;
  gap: 4px;
}

.after-balance-row {
  display: flex;
  background: rgba(5, 25, 40, 0.5);
  border: 1px solid rgba(58, 168, 232, 0.14);
  border-radius: 10px;
  overflow: hidden;
}

.ab-item { flex: 1; padding: 7px 12px; text-align: center; }

.ab-divider { width: 1px; background: rgba(58, 168, 232, 0.14); }

.ab-label {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.45);
  letter-spacing: 0.05em;
  margin-bottom: 2px;
}

.ab-value { font-size: 13px; font-weight: 600; }

/* ── Warning box ─────────────────────────────────────────────────────────────── */
.warn-box {
  background: rgba(186, 117, 23, 0.1);
  border: 1px solid rgba(250, 199, 117, 0.25);
  border-radius: 9px;
  padding: 8px 11px;
  font-size: 11px;
  color: rgba(250, 199, 117, 0.8);
  display: flex;
  align-items: flex-start;
  gap: 6px;
}

/* ── Confirm detail ──────────────────────────────────────────────────────────── */
.confirm-detail-row {
  display: flex;
  background: rgba(26, 111, 168, 0.1);
  border: 1px solid rgba(26, 111, 168, 0.22);
  border-radius: 12px;
  overflow: hidden;
}

.detail-item {
  flex: 1;
  padding: 11px 7px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.detail-divider { width: 1px; background: rgba(58, 168, 232, 0.18); }

.detail-label {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.62);
  margin-bottom: 3px;
}

.detail-value { font-size: 14px; font-weight: 600; color: #edf9ff; }

.detail-sub {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.4);
  margin-top: 1px;
}

/* ── Success ─────────────────────────────────────────────────────────────────── */
.success-body {
  padding: 28px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  text-align: center;
}

.success-title { font-size: 17px; font-weight: 600; color: #edf9ff; }

.success-pill {
  background: rgba(68, 215, 197, 0.12);
  border: 1px solid rgba(68, 215, 197, 0.3);
  border-radius: 50px;
  padding: 5px 18px;
  font-size: 13px;
  font-weight: 600;
  color: #44d7c5;
}

.success-sub { font-size: 13px; color: rgba(173, 228, 242, 0.65); }

/* ── Buttons ─────────────────────────────────────────────────────────────────── */
.ocean-btn-cancel {
  color: rgba(173, 228, 242, 0.65) !important;
  border-color: rgba(173, 228, 242, 0.22) !important;
  text-transform: none;
  letter-spacing: 0.02em;
}

.ocean-btn-confirm {
  background: linear-gradient(135deg, #44d7c5, #378add) !important;
  color: #051928 !important;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.02em;
}

.ocean-btn-danger {
  background: linear-gradient(135deg, #d85a30, #993c1d) !important;
  color: #fff !important;
  font-weight: 600;
  text-transform: none;
  letter-spacing: 0.02em;
}

/* ── Insufficient coins dialog ───────────────────────────────────────────────── */
.insufficient-card {
  border-color: rgba(240, 149, 149, 0.35) !important;
}

.insufficient-body {
  padding: 28px 22px 22px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
  text-align: center;
}

.insufficient-icon-wrap {
  position: relative;
  width: 72px;
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.insufficient-icon-ring {
  position: absolute;
  inset: 0;
  border-radius: 50%;
  background: rgba(250, 199, 117, 0.1);
  border: 1.5px solid rgba(250, 199, 117, 0.3);
  animation: pulse-ring 2s ease-in-out infinite;
}

@keyframes pulse-ring {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.1); opacity: 0.6; }
}

.insufficient-title {
  font-size: 18px;
  font-weight: 700;
  color: #edf9ff;
  letter-spacing: -0.01em;
}

.insufficient-desc {
  font-size: 13px;
  color: rgba(173, 228, 242, 0.62);
  line-height: 1.6;
  max-width: 280px;
}

.insufficient-status-row {
  display: flex;
  align-items: center;
  gap: 10px;
  background: rgba(5, 25, 40, 0.7);
  border: 1px solid rgba(58, 168, 232, 0.18);
  border-radius: 14px;
  padding: 12px 16px;
  width: 100%;
  justify-content: center;
}

.insuf-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  min-width: 80px;
}

.insuf-stat-label {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.42);
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.insuf-stat-value {
  font-size: 20px;
  font-weight: 700;
  line-height: 1.1;
}

.insuf-stat-unit {
  font-size: 10px;
  color: rgba(173, 228, 242, 0.35);
}

.insuf-arrow { flex-shrink: 0; }

.insufficient-actions {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 100%;
}

.insuf-exchange-btn {
  width: 100%;
  height: 44px !important;
  font-size: 14px !important;
}

.insuf-cancel-btn {
  color: rgba(173, 228, 242, 0.4) !important;
  font-size: 12px !important;
  text-transform: none;
  letter-spacing: 0.02em;
}

/* ── Fullscreen ──────────────────────────────────────────────────────────────── */
:deep(.v-dialog--fullscreen) .ocean-card {
  border-radius: 0 !important;
  border: none !important;
  max-height: 100dvh;
}

:deep(.v-dialog--fullscreen) .step-scroll-body {
  max-height: calc(100dvh - 200px);
}
</style>
