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

        <v-table class="report-table" fixed-header height="calc(100vh - 220px)">
          <thead>
            <tr>
              <th>លេខ</th>
              <th>ប្រតិបត្តិការអាយឌី</th>
              <th>លេខសម្គាល់កាក់</th>
              <th>Reference</th>
              <th>Remark</th>
              <th>ប្រភេទ</th>
              <th>Amount</th>
              <th>Before</th>
              <th>After</th>
              <th>Time</th>
            </tr>
          </thead>

          <tbody>
            <tr v-if="isLoading">
              <td colspan="10" class="empty">កំពុងទាញយកទិន្នន័យ...</td>
            </tr>

            <tr v-else-if="errorMessage">
              <td colspan="10" class="empty">{{ errorMessage }}</td>
            </tr>

            <template v-else>
              <tr v-for="(item, index) in transactions" :key="item.id">
                <td>{{ getRowNo(index) }}</td>
                <td>{{ item.id }}</td>
                <td>{{ item.member_coin_id }}</td>
                <td>{{ item.reference }}</td>
                <td>{{ item.remark }}</td>
                <td>{{ formatTransactionType(item) }}</td>
                <td :class="parseAmount(item.amount) >= 0 ? 'positive' : 'negative'">
                  {{ formatAmount(parseAmount(item.amount)) }}
                </td>
                <td>{{ formatAmount(parseAmount(item.before_coin)) }}</td>
                <td>{{ formatAmount(parseAmount(item.after_coin)) }}</td>
                <td>{{ formatDateTime(item.created_at) }}</td>
              </tr>

              <tr v-if="transactions.length > 0" class="summary-row">
                <td colspan="6" class="summary-label">សរុបក្នុងមួយទំព័រ</td>
                <td :class="pageAmountTotal >= 0 ? 'positive' : 'negative'">
                  {{ formatAmount(pageAmountTotal) }}
                </td>
                <td colspan="2">{{ transactions.length }} records</td>
                <td></td>
              </tr>

              <tr v-if="transactions.length === 0">
                <td colspan="10" class="empty">គ្មានទិន្នន័យ</td>
              </tr>
            </template>
          </tbody>
        </v-table>

        <div class="pagination">
          <v-pagination
            v-model="currentPage"
            :length="totalPages"
            :total-visible="5"
            density="compact"
            rounded="circle"
          />
        </div>
      </v-card-text>
    </v-card>
  </v-bottom-sheet>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { getTransactions, type TransactionItem } from '~/composables/service/transactionApi'

const showSheet = ref(false)
const filterDate = ref(formatDateForInput(new Date()))
const currentPage = ref(1)
const itemsPerPage = 10
const totalItems = ref(0)
const transactions = ref<TransactionItem[]>([])
const isLoading = ref(false)
const errorMessage = ref('')

const totalPages = computed(() => Math.max(1, Math.ceil(totalItems.value / itemsPerPage)))
const pageAmountTotal = computed(() =>
  transactions.value.reduce((sum, item) => sum + parseAmount(item.amount), 0),
)

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

function getRowNo(index: number): number {
  return (currentPage.value - 1) * itemsPerPage + index + 1
}

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

.report-table {
  background: transparent !important;
  border-radius: 10px;
  overflow: hidden;
}

.report-table :deep(table) {
  border-collapse: collapse;
  width: 100%;
}

.report-table :deep(thead th) {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  font-weight: 700 !important;
  font-size: 15px !important;
  text-align: center !important;
  border: 1.5px solid rgb(var(--v-theme-secondary)) !important;
  white-space: nowrap;
}

.report-table :deep(tbody td) {
  background: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-on-surface)) !important;
  border: 1px solid rgb(var(--v-theme-secondary)) !important;
  text-align: center !important;
  font-size: 14px;
}

.report-table :deep(tbody tr:nth-child(even) td) {
  background: rgba(var(--v-theme-primary), 0.06) !important;
}

.report-table :deep(tbody tr:hover td) {
  background: rgba(var(--v-theme-primary), 0.14) !important;
  transition: background 0.2s ease;
}

.report-table :deep(tbody tr.summary-row td) {
  background: rgba(var(--v-theme-primary), 0.10) !important;
  font-weight: 700 !important;
  font-size: 14px !important;
}

.report-table :deep(tbody tr.summary-row td.summary-label) {
  text-align: right !important;
  color: rgb(var(--v-theme-primary)) !important;
  padding-right: 12px !important;
}

.report-table :deep(tbody td.positive) {
  color: rgb(var(--v-theme-success)) !important;
  font-weight: 700 !important;
}

.report-table :deep(tbody td.negative) {
  color: rgb(var(--v-theme-warning)) !important;
  font-weight: 700 !important;
}

.empty {
  padding: 20px;
  color: rgb(var(--v-theme-primary));
  text-align: center;
  background: rgb(var(--v-theme-background)) !important;
}

.pagination {
  display: flex;
  justify-content: center;
  margin-top: 15px;
}

.pagination :deep(.v-pagination__item button),
.pagination :deep(.v-pagination__prev button),
.pagination :deep(.v-pagination__next button) {
  background: rgb(var(--v-theme-surface)) !important;
  color: rgb(var(--v-theme-primary)) !important;
  border: 1px solid rgb(var(--v-theme-secondary)) !important;
}

.pagination :deep(.v-pagination__item--is-active button) {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  border-color: rgb(var(--v-theme-secondary)) !important;
}

.pagination :deep(.v-pagination__item button:hover),
.pagination :deep(.v-pagination__prev button:hover),
.pagination :deep(.v-pagination__next button:hover) {
  background: rgba(var(--v-theme-primary), 0.14) !important;
  color: rgb(var(--v-theme-primary)) !important;
}
</style>
