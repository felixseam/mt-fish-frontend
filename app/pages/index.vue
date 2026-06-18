<template>
  <div ref="pixiMountRef" class="game-container" />
  <GameResumeDialog v-model="isGamePausedDialogOpen" @resume="handleResume" />

  <GameSessionExpiredDialog v-model="isSessionExpiredDialogOpen" :countdown-seconds="10"
    :auto-countdown="sessionExpiredAutoCountdown" @refresh="handleSessionExpiredRefresh" />

  <ProfileDialog v-model="isProfileDialogOpen" :current-avatar="memberStore.info.avatar || '/avatar/Avatar6.png'"
    :username="memberStore.info.user_name || 'Player'" @avatar-changed="handleAvatarChanged"
    @coin-transaction="handleCoinTransaction" />

  <Notificationdialog v-model="isNotificationDialogOpen" :notifications="notifications" @mark-read="handleMarkRead"
    @mark-all-read="handleMarkAllRead" @delete="handleDeleteNotification" @clear-all="handleClearAllNotifications" />

  <Insufficientbalancedialog v-model="isInsufficientBalanceDialogOpen" :current-balance="currentCoins"
    @purchase-confirmed="handleCoinPurchase" />

  <GameSettingsDialog v-model="isGameSettingsDialogOpen" />
  <StatementSheet ref="statementSheetRef" />
  <TransactionSheet ref="transactionSheetRef" />

  <LogoutDialog v-model="isLogoutDialogOpen" @confirm="handleLogoutConfirm" />
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import GameSettingsDialog from '~/components/GameSettingsDialog.vue'
import Insufficientbalancedialog from '~/components/Insufficientbalancedialog.vue'
import LogoutDialog from '~/components/LogoutDialog.vue'
import Notificationdialog from '~/components/Notificationdialog.vue'
import ProfileDialog from '~/components/ProfileDialog.vue'
import StatementSheet from '~/components/StatementSheet.vue'
import TransactionSheet from '~/components/TransactionSheet.vue'
import type { Notification } from '~/components/Notificationdialog.vue'
import type { PurchasePayload } from '~/components/Insufficientbalancedialog.vue'
import { useFishGameplayScene } from '~/composables/game_core/game/useFishGameplayScene'
import {
  deleteNotification,
  getMyNotifications,
  markNotificationAsRead,
  type NotificationItem,
} from '~/composables/service/notificationApi'
import { useAuthStore } from '~/stores/authStore'
import { useMemberStore } from '~/stores/memberStore'

const pixiMountRef = ref<HTMLDivElement | null>(null)
const isProfileDialogOpen = ref(false)
const isNotificationDialogOpen = ref(false)
const isInsufficientBalanceDialogOpen = ref(false)
const isGameSettingsDialogOpen = ref(false)
const isLogoutDialogOpen = ref(false)
const isGamePausedDialogOpen = ref(false)
const isSessionExpiredDialogOpen = ref(false)
const sessionExpiredAutoCountdown = ref(false)
const notifications = ref<Notification[]>([])
const notificationTotal = ref(0)
const notificationUnreadTotal = ref(0)
const notificationPage = ref(1)
const isLoadingNotifications = ref(false)
const statementSheetRef = ref<{ open: () => Promise<void> | void } | null>(null)
const transactionSheetRef = ref<{ open: () => Promise<void> | void } | null>(null)
const memberStore = useMemberStore()
const authStore = useAuthStore()
const { mount, destroy, setPlayerAvatar, resumeGame } = useFishGameplayScene()
const notificationsPerPage = 10

const currentCoins = computed(() => Number(memberStore.info.coin_amount ?? '0') || 0)
const hasMoreNotifications = computed(() => notifications.value.length < notificationTotal.value)

function formatNotificationTime(createdAt: string): string {
  const date = new Date(createdAt)

  if (Number.isNaN(date.getTime())) {
    return createdAt || 'Unknown time'
  }

  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

function handleResume() {
  isGamePausedDialogOpen.value = false
  resumeGame()
}

function mapNotificationType(item: NotificationItem): Notification['type'] {
  const name = item.notification_type_name?.toLowerCase() ?? ''

  if (name.includes('success') || name.includes('reward')) return 'success'
  if (name.includes('warn')) return 'warning'
  if (name.includes('error') || name.includes('fail')) return 'error'
  if (name.includes('system')) return 'system'
  return 'info'
}

function mapNotification(item: NotificationItem): Notification {
  return {
    id: String(item.id),
    type: mapNotificationType(item),
    title: item.subject || item.notification_type_name || 'Notification',
    message: item.description || item.context || '',
    time: formatNotificationTime(item.created_at),
    read: item.status_id === 2,
  }
}

async function loadNotifications(page = 1, append = false) {
  if (isLoadingNotifications.value) return

  isLoadingNotifications.value = true

  try {
    const response = await getMyNotifications(page, notificationsPerPage)
    const payload = response?.data?.value
    const list = response?.data?.value?.data?.notifications ?? []
    const mappedNotifications = list.map(mapNotification)

    notificationTotal.value = payload?.total ?? mappedNotifications.length
    notificationUnreadTotal.value = payload?.data?.total_unread ?? notificationUnreadTotal.value
    notificationPage.value = payload?.page ?? page

    if (append) {
      const existingIds = new Set(notifications.value.map((item) => item.id))
      notifications.value = [
        ...notifications.value,
        ...mappedNotifications.filter((item) => !existingIds.has(item.id)),
      ]
    } else {
      notifications.value = mappedNotifications
    }
  } catch (error) {
    console.error('[notifications] failed to load', error)
    if (!append) {
      notifications.value = []
      notificationTotal.value = 0
      notificationUnreadTotal.value = 0
      notificationPage.value = 1
    }
  } finally {
    isLoadingNotifications.value = false
  }
}

function loadMoreNotifications() {
  if (!hasMoreNotifications.value || isLoadingNotifications.value) return
  loadNotifications(notificationPage.value + 1, true)
}

async function handleMarkRead(id: string) {
  const targetId = Number(id)
  if (!Number.isFinite(targetId)) return

  const targetNotification = notifications.value.find((item) => item.id === id)
  notifications.value = notifications.value.map((item) =>
    item.id === id ? { ...item, read: true } : item,
  )
  if (targetNotification && !targetNotification.read) {
    notificationUnreadTotal.value = Math.max(0, notificationUnreadTotal.value - 1)
  }

  try {
    await markNotificationAsRead(targetId)
  } catch (error) {
    console.error('[notifications] failed to mark read', error)
  }
}

async function handleMarkAllRead() {
  const unreadIds = notifications.value
    .filter((item) => !item.read)
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id))

  notifications.value = notifications.value.map((item) => ({ ...item, read: true }))
  notificationUnreadTotal.value = Math.max(0, notificationUnreadTotal.value - unreadIds.length)

  await Promise.all(
    unreadIds.map(async (id) => {
      try {
        await markNotificationAsRead(id)
      } catch (error) {
        console.error('[notifications] failed to mark read', error)
      }
    }),
  )
}

async function handleDeleteNotification(id: string) {
  const targetId = Number(id)
  if (!Number.isFinite(targetId)) return

  const targetNotification = notifications.value.find((item) => item.id === id)
  notifications.value = notifications.value.filter((item) => item.id !== id)
  notificationTotal.value = Math.max(0, notificationTotal.value - 1)
  if (targetNotification && !targetNotification.read) {
    notificationUnreadTotal.value = Math.max(0, notificationUnreadTotal.value - 1)
  }

  try {
    await deleteNotification(targetId)
  } catch (error) {
    console.error('[notifications] failed to delete', error)
  }
}

async function handleClearAllNotifications() {
  const ids = notifications.value
    .map((item) => Number(item.id))
    .filter((id) => Number.isFinite(id))
  const unreadCount = notifications.value.filter((item) => !item.read).length

  notifications.value = []
  notificationTotal.value = 0
  notificationUnreadTotal.value = Math.max(0, notificationUnreadTotal.value - unreadCount)

  await Promise.all(
    ids.map(async (id) => {
      try {
        await deleteNotification(id)
      } catch (error) {
        console.error('[notifications] failed to delete', error)
      }
    }),
  )
}

function handleCoinPurchase(_payload: PurchasePayload) {
  // Coin display is now driven by websocket updates through memberStore.
}

function handleSessionExpiredRefresh() {
  window.location.reload()
}

function handleAvatarChanged(path: string) {
  setPlayerAvatar(path)
}

function handleCoinTransaction() {
  isInsufficientBalanceDialogOpen.value = true
}

function handleLogoutConfirm() {
  memberStore.reset()
  destroy()
  authStore.logout()
}

onMounted(async () => {
  await memberStore.fetchMyInfo()
  await loadNotifications()

  if (!pixiMountRef.value) return

  await mount(pixiMountRef.value, {
    onPauseTooLong: () => {
      // Away too long — show expired dialog, manual refresh only
      isGamePausedDialogOpen.value = false
      sessionExpiredAutoCountdown.value = false
      isSessionExpiredDialogOpen.value = true
    },
    onPause: () => {
      isGamePausedDialogOpen.value = true   // ← show dialog when paused
    },
    onAvatarClick: () => {
      isProfileDialogOpen.value = true
    },
    onMute: () => {
      isGameSettingsDialogOpen.value = true
    },
    onNote: () => {
      statementSheetRef.value?.open()
    },
    onTransition: () => {
      transactionSheetRef.value?.open()
    },
    onSetting: () => {
      isGameSettingsDialogOpen.value = true
    },
    onBell: () => {
      isNotificationDialogOpen.value = true
    },
    onLogout: () => {
      isLogoutDialogOpen.value = true
    },
    onInsufficientBalance: () => {
      isInsufficientBalanceDialogOpen.value = true
    },
    onSessionSyncLost: () => {
      // API failure — show expired dialog with auto countdown
      isGamePausedDialogOpen.value = false
      sessionExpiredAutoCountdown.value = true
      isSessionExpiredDialogOpen.value = true
    },
  })
})

onBeforeUnmount(() => {
  destroy()
})

if (import.meta.hot) {
  import.meta.hot.accept(() => {
    window.location.reload()
  })

  import.meta.hot.dispose(() => {
    destroy()
  })
}
</script>

<style scoped>
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body {
  overflow: auto;
  width: 100%;
  height: 100%;
}

.game-container {
  width: 100vw;
  height: 100vh;
  overflow: hidden;
  display: block;
  background: #010b16;
}

.game-container :deep(canvas) {
  display: block;
  width: 100%;
  height: 100%;
}
</style>
