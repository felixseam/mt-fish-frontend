<template>
  <v-bottom-sheet v-model="showSheet" fullscreen>
    <v-card height="100vh" class="report-card">
      <v-toolbar class="report-toolbar">
        <v-toolbar-title class="text-bold text-2xl toolbar-title">ប្រតិបត្តិការ</v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="showSheet = false" class="close-btn">
          <v-icon>mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text>
        <div class="filter-row">
          <div class="filter-left">
            <span class="text-xl filter-label">កាលបរិច្ឆេទ</span>

            <v-text-field
              v-model="filterDate"
              type="date"
              density="compact"
              hide-details
              variant="outlined"
              style="max-width: 180px"
              class="ocean-input"
              @update:model-value="handleDateChange"
            />
          </div>

          <div class="filter-right">
            <v-btn color="#00C2D4" class="text-capitalize filter-btn" @click="setQuickDate(0)">Today</v-btn>
            <v-btn color="#FFD54F" class="text-capitalize filter-btn" @click="setQuickDate(1)">Yesterday</v-btn>
            <v-btn color="#FF6B35" class="text-capitalize filter-btn" @click="setQuickDate(7)">Week</v-btn>
          </div>
        </div>

        <AppTable
          :columns="columns"
          :items="transactions"
          :loading="isLoading"
          :error="errorMessage"
          height="calc(100vh - 220px)"
          :page="currentPage"
          :page-size="itemsPerPage"
          :total-pages="totalPages"
          :subtotals="pageSubtotals"
          @update:page="currentPage = $event"
        />
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getTransactions, type TransactionItem } from '~/composables/service/transactionApi'
import AppTable, { type TableColumn, type TotalRow } from '~/components/common/AppTable.vue'

const showSheet = ref(false)
const filterDate = ref(formatDateForInput(new Date()))
const currentPage = ref(1)
const itemsPerPage = 10
const totalItems = ref(0)
const transactions = ref<TransactionItem[]>([])
const isLoading = ref(false)
const errorMessage = ref('')

// ── Columns ──────────────────────────────────────────────────────────────────

const columns: TableColumn<TransactionItem>[] = [
  { key: 'index', label: 'លេខ', type: 'index' },
  { key: 'id', label: 'ប្រតិបត្តិការអាយឌី' },
  { key: 'member_coin_id', label: 'លេខសម្គាល់កាក់' },
  { key: 'reference', label: 'Reference' },
  { key: 'remark', label: 'Remark' },
  {
    key: 'transaction_type',
    label: 'ប្រភេទ',
    format: (_v, item) => formatTransactionType(item),
  },
  {
    key: 'amount',
    label: 'Amount',
    format: (_v, item) => formatAmount(parseAmount(item.amount)),
    cellClass: (item) => (parseAmount(item.amount) >= 0 ? 'positive' : 'negative'),
  },
  {
    key: 'before_coin',
    label: 'Before',
    format: (_v, item) => formatAmount(parseAmount(item.before_coin)),
  },
  {
    key: 'after_coin',
    label: 'After',
    format: (_v, item) => formatAmount(parseAmount(item.after_coin)),
  },
  {
    key: 'created_at',
    label: 'Time',
    format: (_v, item) => formatDateTime(item.created_at),
  },
]

// ── Computed ─────────────────────────────────────────────────────────────────

const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / itemsPerPage)))
const pageAmountTotal = computed(() =>
  transactions.value.reduce((sum, item) => sum + parseAmount(item.amount), 0),
)

const pageSubtotals = computed<TotalRow | undefined>(() => {
  if (!transactions.value.length) return undefined
  return {
    labelSpan: 6,
    pageLabel: 'សរុបក្នុងមួយទំព័រ',
    cols: [
      {
        key: 'amount',
        value: formatAmount(pageAmountTotal.value),
        class: pageAmountTotal.value >= 0 ? 'positive' : 'negative',
      },
      { key: 'before_coin', value: `${transactions.value.length} records` },
      { key: 'after_coin', value: '' },
      { key: 'created_at', value: '' },
    ],
  }
})

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAmount(value: string | undefined | null): number {
  return Number.parseFloat(value ?? '0') || 0
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value)
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDateTime(value: string): string {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value

  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(date)
}

function formatTransactionType(item: TransactionItem): string {
  return item.transaction_type || `Type ${item.transaction_type_id}`
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchTransactions() {
  isLoading.value = true
  errorMessage.value = ''

  try {
    const response = await getTransactions(currentPage.value, itemsPerPage, filterDate.value)
    const payload = response?.data.value

    transactions.value = payload?.data?.transactions ?? []
    totalItems.value = payload?.total ?? 0
  } catch (error: any) {
    console.error('[transactions] failed to load', error)
    transactions.value = []
    totalItems.value = 0
    errorMessage.value = error?.message || 'Failed to load transactions'
  } finally {
    isLoading.value = false
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleDateChange() {
  if (currentPage.value !== 1) {
    currentPage.value = 1
    return
  }

  fetchTransactions()
}

function setQuickDate(daysAgo: number) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  filterDate.value = formatDateForInput(date)

  if (currentPage.value !== 1) {
    currentPage.value = 1
    return
  }

  fetchTransactions()
}

async function open() {
  showSheet.value = true
  await fetchTransactions()
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(currentPage, () => {
  fetchTransactions()
})

defineExpose({ open })
</script>

<style scoped>
.report-card {
  background: rgb(var(--v-theme-background)) !important;
  color: rgb(var(--v-theme-on-background)) !important;
}

.report-toolbar {
  background: rgb(var(--v-theme-surface)) !important;
  border-bottom: 2px solid rgb(var(--v-theme-secondary)) !important;
}

.toolbar-title {
  color: rgb(var(--v-theme-primary)) !important;
  font-weight: bold;
}

.close-btn {
  color: rgb(var(--v-theme-close-btn)) !important;
}

.filter-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  margin-bottom: 15px;
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
  color: rgb(var(--v-theme-primary)) !important;
}

.filter-btn {
  border-width: 1.5px !important;
  font-weight: 600 !important;
  letter-spacing: 0.5px;
  color: white !important;
}

.ocean-input :deep(.v-field) {
  background: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
}

.ocean-input :deep(.v-field__outline) {
  color: rgb(var(--v-theme-secondary)) !important;
}

.ocean-input :deep(input),
.ocean-input :deep(.v-select__selection-text) {
  color: rgb(var(--v-theme-on-surface)) !important;
}
</style>