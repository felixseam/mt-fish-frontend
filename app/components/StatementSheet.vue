<template>
  <v-dialog v-model="showSheet" fullscreen>
    <v-card height="100vh" class="report-card">
      <v-toolbar class="report-toolbar">
        <v-toolbar-title class="text-bold text-2xl toolbar-title">របាយការណ៍</v-toolbar-title>
        <v-spacer />
        <v-btn icon @click="showSheet = false" class="close-btn">
          <v-icon color="error">mdi-close</v-icon>
        </v-btn>
      </v-toolbar>

      <v-card-text>
        <div class="filter-row">
          <div class="filter-left">
            <span class="text-xl filter-label">កាលបរិច្ឆេទ</span>
            <v-text-field v-model="filterDate" type="date" density="compact" hide-details variant="outlined"
              style="max-width: 180px" class="ocean-input" @update:model-value="handleDateChange" />
          </div>

          <!-- <div class="filter-right">
            <v-btn class="text-capitalize filter-btn filter-btn--today" @click="setQuickDate(0)">Today</v-btn>
            <v-btn class="text-capitalize filter-btn filter-btn--outline" @click="setQuickDate(1)">Yesterday</v-btn>
            <v-btn class="text-capitalize filter-btn filter-btn--outline" @click="setQuickDate(7)">Week</v-btn>
          </div> -->

          <div class="filter-right">
            <v-btn color="#00C2D4" class="text-capitalize filter-btn" @click="setQuickDate(0)">Today</v-btn>
            <v-btn color="#FFD54F" class="text-capitalize filter-btn" @click="setQuickDate(1)">Yesterday</v-btn>
            <v-btn color="#FF6B35" class="text-capitalize filter-btn" @click="setQuickDate(7)">Week</v-btn>
          </div>
        </div>

        <AppTable :columns="columns" :items="reportData" :loading="isLoading" :error="errorMessage"
          height="calc(100vh - 210px)" :page="currentPage" :page-size="itemsPerPage" :total-pages="totalPages"
          :subtotals="pageSubtotals" :grand-totals="grandTotalsRow" @update:page="currentPage = $event" />
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getStatements, type StatementItem } from "~/composables/service/statementApi";
import AppTable, { type TableColumn, type TotalRow } from "~/components/common/AppTable.vue";

// ── State ────────────────────────────────────────────────────────────────────

const showSheet = ref(false);
const filterDate = ref(formatDateForInput(new Date()));
const currentPage = ref(1);
const itemsPerPage = 20;
const totalItems = ref(0);
const reportData = ref<StatementItem[]>([]);
const isLoading = ref(false);
const errorMessage = ref("");

const allBetTotal = ref(0);
const allValidTotal = ref(0);
const allWinLoseTotal = ref(0);

// ── Columns ──────────────────────────────────────────────────────────────────

const columns: TableColumn<StatementItem>[] = [
  { key: "index", label: "លេខ", type: "index" },
  { key: "session_no", label: "Session No" },
  { key: "bet_no", label: "Bet No" },
  { key: "ticket_no", label: "Ticket No" },
  { key: "fish_type_name", label: "Fish" },
  {
    key: "bet_amount",
    label: "លុយចាក់",
    format: (_v, item) => formatAmount(parseAmount(item.bet_amount)),
  },
  {
    key: "bet_valid",
    label: "Valid Bet",
    format: (_v, item) => formatAmount(parseAmount(item.bet_valid)),
  },
  {
    key: "bet_invalid",
    label: "Invalid Bet",
    format: (_v, item) => formatAmount(parseAmount(item.bet_invalid)),
  },
  {
    key: "is_kill",
    label: "Kill",
    format: (_v, item) => (item.is_kill ? "Yes" : "No"),
  },
  {
    key: "win_lose",
    label: "Outcome",
    cellClass: (item) => (item.win_lose === "win" ? "positive" : "negative"),
  },
  {
    key: "reward",
    label: "Reward",
    format: (_v, item) => formatAmount(getRewardAmount(item)),
  },
  {
    key: "total_win_lose",
    label: "ឈ្នះ/ចាញ់",
    format: (_v, item) => formatAmount(parseAmount(item.total_win_lose)),
    cellClass: (item) => (parseAmount(item.total_win_lose) >= 0 ? "positive" : "negative"),
  },
  {
    key: "created_at",
    label: "Time",
    format: (_v, item) => formatDateTime(item.created_at),
  },
];

// ── Computed ─────────────────────────────────────────────────────────────────

const totalPages = computed(() =>
  Math.max(1, Math.ceil(totalItems.value / itemsPerPage)),
);

const pageBetTotal = computed(() =>
  reportData.value.reduce((sum, item) => sum + parseAmount(item.bet_amount), 0),
);
const pageValidTotal = computed(() =>
  reportData.value.reduce((sum, item) => sum + parseAmount(item.bet_valid), 0),
);
const pageInvalidTotal = computed(() =>
  reportData.value.reduce((sum, item) => sum + parseAmount(item.bet_invalid), 0),
);
const pageWinLoseTotal = computed(() =>
  reportData.value.reduce((sum, item) => sum + parseAmount(item.total_win_lose), 0),
);

const pageSubtotals = computed<TotalRow | undefined>(() => {
  if (!reportData.value.length) return undefined;
  return {
    labelSpan: 5,
    pageLabel: "សរុបក្នុងមួយទំព័រ",
    cols: [
      { key: "bet_amount", value: formatAmount(pageBetTotal.value) },
      { key: "bet_valid", value: formatAmount(pageValidTotal.value) },
      { key: "bet_invalid", value: formatAmount(pageInvalidTotal.value) },
      { key: "is_kill", value: "-" },
      { key: "win_lose", value: "-" },
      { key: "reward", value: "-" },
      {
        key: "total_win_lose",
        value: formatAmount(pageWinLoseTotal.value),
        class: pageWinLoseTotal.value >= 0 ? "positive" : "negative",
      },
      { key: "created_at", value: "" },
    ],
  };
});

const grandTotalsRow = computed<TotalRow | undefined>(() => {
  if (!reportData.value.length) return undefined;
  return {
    labelSpan: 5,
    pageLabel: "សរុបទាំងអស់",
    cols: [
      { key: "bet_amount", value: formatAmount(allBetTotal.value) },
      { key: "bet_valid", value: formatAmount(allValidTotal.value) },
      { key: "bet_invalid", value: "-" },
      { key: "is_kill", value: "-" },
      { key: "win_lose", value: "-" },
      { key: "reward", value: "-" },
      {
        key: "total_win_lose",
        value: formatAmount(allWinLoseTotal.value),
        class: allWinLoseTotal.value >= 0 ? "positive" : "negative",
      },
      { key: "created_at", value: "" },
    ],
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function parseAmount(value: string | undefined | null): number {
  return Number.parseFloat(value ?? "0") || 0;
}

function formatAmount(value: number): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 3,
    maximumFractionDigits: 3,
  }).format(value);
}

function formatDateForInput(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

function getRewardAmount(item: StatementItem): number {
  return parseAmount(item.is_kill ? item.kill_reward : item.miss_reward)
    + parseAmount(item.jackpot);
}

// ── Data fetching ─────────────────────────────────────────────────────────────

async function fetchStatements() {
  isLoading.value = true;
  errorMessage.value = "";

  try {
    const response = await getStatements(currentPage.value, itemsPerPage, filterDate.value);
    const payload = response?.data.value;
    const report = payload?.data?.total_report;

    reportData.value = payload?.data?.statements ?? [];
    totalItems.value = payload?.total ?? 0;

    allBetTotal.value = parseAmount(report?.total_bet);
    allValidTotal.value = parseAmount(report?.total_valid_bet);
    allWinLoseTotal.value = parseAmount(report?.total_winlose);
  } catch (error: any) {
    console.error("[statements] failed to load", error);
    reportData.value = [];
    totalItems.value = 0;
    allBetTotal.value = 0;
    allValidTotal.value = 0;
    allWinLoseTotal.value = 0;
    errorMessage.value = error?.message || "Failed to load statements";
  } finally {
    isLoading.value = false;
  }
}

// ── Event handlers ────────────────────────────────────────────────────────────

function handleDateChange() {
  currentPage.value = 1;
  fetchStatements();
}

function setQuickDate(daysAgo: number) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  filterDate.value = formatDateForInput(date);
  currentPage.value = 1;
  fetchStatements();
}

async function open() {
  showSheet.value = true;
  if (currentPage.value !== 1) {
    currentPage.value = 1;
    return;
  }
  await fetchStatements();
}

// ── Watchers ──────────────────────────────────────────────────────────────────

watch(currentPage, (page, previousPage) => {
  if (page === previousPage || !showSheet.value) return;
  fetchStatements();
});

defineExpose({ open });
</script>

<style scoped>
.report-card {
  position: relative;
  height: 100%;
  overflow: hidden;
  background: rgba(7, 19, 31, 0.01) !important;
  /* was 0.82 → 0.55 → now 0.3 */
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

.ocean-input :deep(input) {
  color: #eef8ff !important;
}
</style>