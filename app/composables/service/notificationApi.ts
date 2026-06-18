import { useApiInterceptor } from '~/composables/api/useApiInterceptor'

export interface ApiResponse<T> {
  success: boolean
  message: string
  status_code: number
  data: T
  page?: number
  per_page?: number
  total?: number
}

export interface NotificationItem {
  id: number
  notification_type_id: number
  notification_type_name: string
  icon: string
  context: string
  subject: string
  description: string
  status_id: number
  order: number
  created_by: number
  created_at: string
}

export interface NotificationListData {
  notifications: NotificationItem[]
  total_unread: number
}

export interface NotificationListResponse {
  success: boolean
  message: string
  status_code: number
  data: NotificationListData
  page: number
  per_page: number
  total: number
}

export async function getMyNotifications(page: number = 1, perPage: number = 10) {
  return useApiInterceptor<NotificationListResponse>(
    `/notifications?paging_options[page]=${page}&paging_options[per_page]=${perPage}`,
    {
      method: 'GET',
    }
  )
}

export async function markNotificationAsRead(id: number) {
  return useApiInterceptor<ApiResponse<null>>(`/notifications/${id}/read`, {
    method: 'PATCH',
  })
}

export async function deleteNotification(id: number) {
  return useApiInterceptor<ApiResponse<null>>(`/notifications/${id}`, {
    method: 'DELETE',
  })
}
