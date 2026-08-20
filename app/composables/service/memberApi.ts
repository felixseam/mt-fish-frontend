import { useApiInterceptor } from '~/composables/api/useApiInterceptor'

export interface ApiResponse<T> {
  success: boolean
  message: string
  status_code: number
  data: T
}

export interface MemberBalanceItem {
  currency_id: number
  currency_code: string
  currency_symbol: string
  balance_amount: string
}

export interface MyInfoData {
  user_name: string
  avatar: string
  balances: MemberBalanceItem[]
}

export interface UpdateAvatarRequest {
  avatar: string
}

export interface UpdateAvatarData {
  avatar: string
}

export async function getMyInfo() {
  return useApiInterceptor<ApiResponse<MyInfoData>>('/member/me', {
    method: 'GET',
  })
}

export async function updateAvatar(payload: UpdateAvatarRequest) {
  return useApiInterceptor<ApiResponse<UpdateAvatarData>>('/member/avatar', {
    method: 'PATCH',
    body: payload,
  })
}
