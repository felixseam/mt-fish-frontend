<template>
  <OceanDialogShell
    v-model="showSheet"
    variant="dialog"
    title="របាយការណ៍"
    :filter-date="filterDate"
    @update:filterDate="onFilterDateInput"
    @quickDate="setQuickDate"
  >
    <AppTable
      :columns="columns"
      :items="reportData"
      :loading="isLoading"
      :error="errorMessage"
      height="calc(100vh - 210px)"
      :page="currentPage"
      :page-size="itemsPerPage"
      :total-pages="totalPages"
      :subtotals="pageSubtotals"
      :grand-totals="grandTotalsRow"
      @update:page="currentPage = $event"
    />
  </OceanDialogShell>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { getStatements, type StatementItem } from "~/composables/service/statementApi";
import AppTable, { type TableColumn, type TotalRow } from "~/components/common/AppTable.vue";
import OceanDialogShell from "~/components/common/OceanDialogShell.vue";

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

function onFilterDateInput(value: string) {
  filterDate.value = value;
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