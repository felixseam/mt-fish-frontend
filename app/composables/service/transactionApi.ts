import { useApiInterceptor } from '~/composables/api/useApiInterceptor'

export interface ApiResponse<T> {
  success: boolean
  message: string
  status_code: number
  data: T
  page: number
  per_page: number
  total: number
}

export interface TransactionItem {
  id: number
  member_coin_id: number
  before_coin: string
  amount: string
  after_coin: string
  transaction_type_id: number
  transaction_group_type_id: number
  transaction_type: string
  reference: string
  remark: string
  require_approval: boolean
  status_id: number
  created_at: string
}

export interface TransactionListData {
  transactions: TransactionItem[]
}

export async function getTransactions(page = 1, perPage = 10, createdAt: string) {
  const encodedDate = encodeURIComponent(createdAt)

  return useApiInterceptor<ApiResponse<TransactionListData>>(
    `/coins/transactions?page=${page}&per_page=${perPage}&filters[0][property]=created_at&filters[0][value]=${encodedDate}&filters[0][operator]=eq`,
    { method: 'GET' },
  )
}
