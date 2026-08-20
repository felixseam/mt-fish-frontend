<template>
  <div class="app-table-wrapper">
    <v-table class="app-table" fixed-header :height="tableHeight">
      <thead>
        <tr>
          <th v-for="col in columns" :key="col.key" :class="{ 'sticky-col': col.sticky }" :style="getColStyle(col)">
            {{ col.label }}
          </th>
        </tr>
      </thead>

      <tbody>
        <!-- Loading: skeleton rows -->
        <template v-if="loading">
          <tr v-for="n in skeletonRowCount" :key="`skeleton-${n}`" class="no-hover skeleton-row">
            <td v-for="col in columns" :key="col.key" :class="{ 'sticky-col': col.sticky }"
              :style="getColStyle(col, true)">
              <v-skeleton-loader type="text" class="skeleton-cell" />
            </td>
          </tr>
        </template>

        <!-- Error -->
        <tr v-else-if="error" class="no-hover">
          <td :colspan="columns.length" class="empty-cell">
            <div class="empty-state">
              <v-icon size="40" color="#FF6B4A">mdi-alert-circle-outline</v-icon>
              <div class="empty-text error-text">{{ error }}</div>
            </div>
          </td>
        </tr>

        <!-- Empty -->
        <tr v-else-if="!items.length" class="no-hover">
          <td :colspan="columns.length" class="empty-cell">
            <div class="empty-state">
              <img src="/emptyData/empty_data.svg"
                :alt="t('common.noData')" class="empty-img" />
              <div class="empty-text">{{ t('common.noData') }}</div>
            </div>
          </td>
        </tr>

        <!-- Rows -->
        <template v-else>
          <tr v-for="(item, rowIndex) in items" :key="rowIndex" :class="{ 'clickable-row': !!onRowClick }"
            @click="onRowClick?.(item)">
            <td v-for="col in columns" :key="col.key" :class="[getCellClass(col, item), { 'sticky-col': col.sticky }]"
              :style="getColStyle(col, true)">
              <slot :name="`cell-${col.key}`" :item="item" :value="item[col.key]" :index="rowIndex">
                <!-- Badge -->
                <span v-if="col.type === 'badge'" class="cell-badge" :class="getBadgeClass(col, item)">
                  {{ formatCell(col, item) }}
                </span>

                <!-- Index -->
                <span v-else-if="col.type === 'index'">
                  {{ (page - 1) * pageSize + rowIndex + 1 }}
                </span>

                <!-- Default -->
                <span v-else>{{ formatCell(col, item) }}</span>
              </slot>
            </td>
          </tr>

          <!-- Page subtotal row -->
          <tr v-if="subtotals" class="summary-row">
            <td :colspan="subtotals.labelSpan ?? 1" class="summary-label">
              {{ subtotals.pageLabel ?? t('report.pageSubtotal') }}
            </td>
            <td v-for="sub in subtotals.cols" :key="sub.key" :class="sub.class">
              {{ sub.value }}
            </td>
          </tr>

          <!-- Grand total row -->
          <tr v-if="grandTotals" class="summary-row grand-total-row">
            <td :colspan="grandTotals.labelSpan ?? 1" class="summary-label">
              {{ grandTotals.pageLabel ?? t('report.grandTotal') }}
            </td>
            <td v-for="sub in grandTotals.cols" :key="sub.key" :class="sub.class">
              {{ sub.value }}
            </td>
          </tr>
        </template>
      </tbody>
    </v-table>

    <!-- Pagination -->
    <div v-if="totalPages > 1" class="pagination">
      <v-pagination :model-value="page" :length="totalPages" :total-visible="5" density="compact" rounded="circle"
        @update:model-value="$emit('update:page', $event)" />
    </div>
  </div>
</template>

<script setup lang="ts" generic="T extends Record<string, any>">
import { computed } from 'vue'


// ── Types ──────────────────────────────────────────────
export interface TableColumn<T = any> {
  key: string
  label: string
  type?: 'text' | 'index' | 'badge'
  align?: 'left' | 'center' | 'right'
  width?: string
  sticky?: boolean
  format?: (value: any, item: T) => string
  cellClass?: string | ((item: T) => string)
  badge?: {
    map: Record<string, string>
    default?: string
  }
}

export interface TotalRow {
  labelSpan?: number
  pageLabel?: string
  cols: { key: string; value: string; class?: string }[]
}

const props = withDefaults(defineProps<{
  columns: TableColumn<T>[]
  items: T[]
  loading?: boolean
  error?: string
  height?: string
  emptyHeight?: string
  page?: number
  pageSize?: number
  totalPages?: number
  subtotals?: TotalRow
  grandTotals?: TotalRow
  onRowClick?: (item: T) => void
  minRowsForFixedHeight?: number
  skeletonRows?: number
}>(), {
  loading: false,
  error: '',
  height: 'auto',
  emptyHeight: 'calc(100vh - 180px)',
  page: 1,
  pageSize: 10,
  totalPages: 1,
  minRowsForFixedHeight: 8,
})

// how many skeleton rows to render while loading — defaults to pageSize
const skeletonRowCount = computed(() => props.skeletonRows ?? props.pageSize ?? 8)

const tableHeight = computed(() => {
  if (props.loading) return props.height
  if (props.error || !props.items.length) return props.emptyHeight
  if (props.items.length < props.minRowsForFixedHeight) return 'auto'
  return props.height
})
defineEmits<{ 'update:page': [page: number] }>()
const { t } = useFrontendI18n()

function formatCell(col: TableColumn<T>, item: T): string {
  const val = item[col.key]
  if (col.format) return col.format(val, item)
  return val ?? '-'
}

function getCellClass(col: TableColumn<T>, item: T): string {
  if (!col.cellClass) return ''
  return typeof col.cellClass === 'function' ? col.cellClass(item) : col.cellClass
}

function getBadgeClass(col: TableColumn<T>, item: T): string {
  const val = String(item[col.key] ?? '').toLowerCase()
  return col.badge?.map?.[val] ?? col.badge?.default ?? ''
}

const STICKY_FALLBACK_WIDTH = 80

function parseWidthPx(width?: string): number {
  if (!width) return STICKY_FALLBACK_WIDTH
  const match = width.match(/[\d.]+/)
  return match ? parseFloat(match[0]) : STICKY_FALLBACK_WIDTH
}

function getStickyLeft(col: TableColumn<T>): number {
  let left = 0
  for (const c of props.columns) {
    if (c.key === col.key) break
    if (c.sticky) left += parseWidthPx(c.width)
  }
  return left
}

function getColStyle(col: TableColumn<T>, isBody = false): string {
  const parts: string[] = []
  if (col.width) parts.push(`width: ${col.width}`)
  if (isBody && col.align) parts.push(`text-align: ${col.align}`)
  if (col.sticky) {
    parts.push(`left: ${getStickyLeft(col)}px`)
    if (!col.width) parts.push(`width: ${STICKY_FALLBACK_WIDTH}px`)
  }
  return parts.join('; ')
}
</script>

<style scoped>

.app-table-wrapper {
  display: flex;
  flex-direction: column;
  gap: 0;
  /* background: rgba(4, 20, 30, 0.55); */
  border-radius: 14px;
}

.app-table {
  background: transparent !important;
  overflow: hidden;
  border: none;
}

.app-table :deep(table) {
  height: 100%;
  border-collapse: collapse;
}

.app-table :deep(tbody) {
  height: 100%;
}

.app-table :deep(thead) {
  position: sticky;
  top: 0;
  z-index: 3;
}

.app-table :deep(thead th) {
  /* fully opaque — a translucent sticky header lets scrolled rows ghost through it */
  background: #0b3448 !important;
  background-image: linear-gradient(180deg, #12495f, #0a2c3d) !important;
  color: #d8fbff !important;
  font-weight: 700 !important;
  font-size: 12px !important;
  text-align: center !important;
  border: 1px solid rgba(56, 232, 255, 0.35) !important;
  white-space: nowrap;
  /* padding: 6px 10px !important; */
  line-height: 1.2 !important;
  height: 50px !important;
  text-shadow: 0 0 8px rgba(56, 232, 255, 0.4);
  position: relative;
  z-index: 3;
}

.app-table :deep(thead th)::before {
  /* extra opaque backing layer so nothing behind can bleed through at the edges */
  content: "";
  position: absolute;
  inset: 0;
  background: #0b3448;
  z-index: -1;
}

.app-table :deep(tbody td) {
  background: rgba(6, 26, 38, 0.7) !important;
  color: #eaf9ff !important;
  border: 1px solid rgba(56, 232, 255, 0.18) !important;
  text-align: center !important;
  font-size: 12px !important;
  padding: 4px 10px !important;
  line-height: 1.2 !important;
  box-sizing: border-box;
  height: 36px !important;
  max-height: 36px !important;
  overflow: hidden;
}

/* subtle alternating row tint, like the reef-glow rows in game UI */
.app-table :deep(tbody tr:nth-child(even) td) {
  background: rgba(10, 34, 48, 0.7) !important;
}

.app-table :deep(tbody td.positive) {
  color: #4ADE80 !important;
  font-weight: 700 !important;
  text-shadow: 0 0 8px rgba(74, 222, 128, 0.35);
}

.app-table :deep(tbody td.negative) {
  color: #FF9142 !important;
  font-weight: 700 !important;
  text-shadow: 0 0 8px rgba(255, 145, 66, 0.35);
}

.app-table :deep(tbody tr:hover td) {
  background: rgba(56, 232, 255, 0.14) !important;
  transition: background 0.2s ease;
}

/* ── No hover for state rows ── */
.app-table :deep(tbody tr.no-hover:hover td) {
  background: rgba(6, 26, 38, 0.7) !important;
  cursor: default;
}

/* ── Skeleton loading rows ── */
.skeleton-row td {
  padding: 8px 10px !important;
}

.skeleton-cell {
  background: transparent !important;
}

.skeleton-cell :deep(.v-skeleton-loader__bone) {
  background: rgba(56, 232, 255, 0.16) !important;
  margin: 0 auto;
  height: 14px;
  border-radius: 4px;
}

/* ── Empty state ── */
.empty-cell {
  background: rgba(6, 26, 38, 0.7) !important;
  padding: 0 !important;
  border: none !important;
  height: 100%;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 48px 24px;
  background: rgba(6, 26, 38, 0.7);
  height: 100%;
  box-sizing: border-box;
}

.empty-img {
  width: 240px;
  height: 240px;
  object-fit: contain;
  opacity: 0.85;
}

.empty-text {
  font-size: 22px;
  font-weight: 600;
  color: #7fe8f5;
  opacity: 0.8;
}

.error-text {
  color: #FF9142;
}

/* ── Pagination ── */
.pagination {
  margin-top: 10px;
  display: flex;
  justify-content: center;
}

.pagination :deep(.v-pagination__item button),
.pagination :deep(.v-pagination__prev button),
.pagination :deep(.v-pagination__next button) {
  background: rgba(6, 26, 38, 0.8) !important;
  color: #9fe9f5 !important;
  border: 1.5px solid rgba(56, 232, 255, 0.5) !important;
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  font-size: 12px !important;
}

.pagination :deep(.v-pagination__item--is-active button) {
  background: linear-gradient(180deg, #4de8ff, #17b9d6) !important;
  color: #04222c !important;
  border-color: #4de8ff !important;
  box-shadow: 0 0 10px rgba(56, 232, 255, 0.6);
}

.pagination :deep(.v-pagination__item button:hover),
.pagination :deep(.v-pagination__prev button:hover),
.pagination :deep(.v-pagination__next button:hover) {
  background: rgba(56, 232, 255, 0.18) !important;
  color: #d8fbff !important;
}

.pagination :deep(.v-pagination__prev button),
.pagination :deep(.v-pagination__next button) {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
}

.pagination :deep(.v-pagination__prev .v-icon),
.pagination :deep(.v-pagination__next .v-icon) {
  font-size: 16px !important;
}

/* ── Summary rows ── */
.app-table :deep(tbody tr.summary-row td) {
  background: rgba(56, 232, 255, 0.14) !important;
  font-weight: 700 !important;
  color: #eaf9ff !important;
}

.app-table :deep(tbody tr.grand-total-row td) {
  background: rgba(56, 232, 255, 0.24) !important;
}

.app-table :deep(tbody tr.summary-row td.summary-label) {
  text-align: right !important;
  color: #7fe8f5 !important;
  padding-right: 12px !important;
}

.app-table :deep(tbody tr.summary-row td.positive),
.app-table :deep(tbody tr.grand-total-row td.positive) {
  color: #4ADE80 !important;
  font-weight: 700 !important;
}

.app-table :deep(tbody tr.summary-row td.negative),
.app-table :deep(tbody tr.grand-total-row td.negative) {
  color: #FF9142 !important;
  font-weight: 700 !important;
}
</style>