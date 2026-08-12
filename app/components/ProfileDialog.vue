<!-- components/dialogs/ProfileDialog.vue -->
<template>
  <!-- ─── MAIN PROFILE / PASSWORD DIALOG ─── -->
  <v-dialog
    v-model="dialogVisible"
    max-width="520"
    persistent
    :scrim="true"
    scrim-color="rgba(0,0,0,0.7)"
    transition="dialog-bottom-transition"
    :fullscreen="$vuetify.display.xs"
  >
    <v-card class="profile-card" rounded="xl">
      <!-- Header -->
      <v-card-title class="profile-header d-flex align-center justify-space-between pa-4 flex-shrink-0">
        <div class="d-flex align-center ga-2">
          <v-btn
            v-if="activeView === 'password'"
            icon
            variant="text"
            size="small"
            @click="activeView = 'profile'"
          >
            <v-icon color="white">mdi-arrow-left</v-icon>
          </v-btn>
          <span class="text-h6 font-weight-bold text-white">
            {{ activeView === 'password' ? t('profile.changePassword') : t('profile.title') }}
          </span>
        </div>
        <v-btn icon variant="text" size="small" @click="close">
          <v-icon color="white">mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider color="cyan-darken-3" />

      <!-- ─── PROFILE VIEW ─── -->
      <template v-if="activeView === 'profile'">
        <v-card-text class="dialog-scroll-area pa-4 pa-sm-6">
          <!-- Avatar -->
          <div class="profile-summary text-center mb-6">
            <button type="button" class="avatar-trigger" @click="openAvatarDialog">
              <div class="current-avatar-wrapper mx-auto">
                <v-avatar size="92" class="current-avatar elevation-8">
                  <v-img :src="currentAvatarSource" alt="Current Avatar" cover />
                </v-avatar>
                <v-icon class="edit-badge" color="cyan-lighten-2" size="22">
                  mdi-pencil-circle
                </v-icon>
              </div>
            </button>
            <div class="text-h6 text-white mt-3">{{ displayUsername }}</div>
            <!-- <p class="text-grey-lighten-1 text-body-2 mt-1">{{ t('profile.tapAvatarToChange') }}</p> -->
          </div>

          <!-- Stats -->
          <div class="profile-stats mb-4">
            <div class="info-card">
              <div class="info-label">{{ t('profile.username') }}</div>
              <div class="info-value text-white">{{ displayUsername }}</div>
            </div>
            <div class="info-card">
              <div class="info-label">{{ t('profile.coins') }}</div>
              <div class="info-value coin-value">
                <v-icon size="18" color="#fac775">mdi-circle-multiple-outline</v-icon>
                {{ formatCoins(memberStore.info.coin_amount) }}
              </div>
            </div>
          </div>

          <!-- Balance -->
          <div class="balance-panel mb-5">
            <div class="panel-title text-white mb-3">{{ t('profile.balance') }}</div>
            <div v-if="profileBalances.length" class="balance-list">
              <div
                v-for="balance in profileBalances"
                :key="balance.currency_id"
                class="balance-row"
              >
                <div class="balance-code">{{ balance.code }}</div>
                <div class="balance-amount">{{ balance.formatted }}</div>
              </div>
            </div>
            <div v-else class="empty-hint">{{ t('profile.noBalanceData') }}</div>
          </div>

          <!-- Actions — flex row -->
          <div class="action-list">
            <v-btn
              size="large"
              color="cyan-lighten-2"
              variant="flat"
              class="text-capitalize action-btn flex-1"
              @click="startCoinTransaction"
            >
              <v-icon start>mdi-swap-horizontal</v-icon>
              {{ t('profile.newCoinTransaction') }}
            </v-btn>

            <v-btn
              size="large"
              variant="outlined"
              color="grey-lighten-1"
              class="text-capitalize action-btn flex-1"
              @click="activeView = 'password'"
            >
              <v-icon start>mdi-lock-reset</v-icon>
              {{ t('profile.changePassword') }}
            </v-btn>
          </div>
        </v-card-text>
      </template>

      <!-- ─── PASSWORD VIEW ─── -->
      <template v-else-if="activeView === 'password'">
        <div class="dialog-scroll-area">
          <v-card-text class="pa-4 pa-sm-6">
            <v-form ref="passwordForm" v-model="passwordFormValid" @submit.prevent="submitPassword">
              <v-text-field
                v-model="oldPassword"
                :label="t('profile.currentPassword')"
                :type="showOldPassword ? 'text' : 'password'"
                :rules="[rules.required]"
                prepend-inner-icon="mdi-lock-outline"
                :append-inner-icon="showOldPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showOldPassword = !showOldPassword"
                variant="outlined"
                color="cyan-lighten-2"
                bg-color="rgba(10, 40, 64, 0.9)"
                class="mb-2"
                autocomplete="current-password"
              />

              <v-text-field
                v-model="newPassword"
                :label="t('profile.newPassword')"
                :type="showNewPassword ? 'text' : 'password'"
                :rules="[rules.required, rules.minLength]"
                prepend-inner-icon="mdi-lock-plus-outline"
                :append-inner-icon="showNewPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showNewPassword = !showNewPassword"
                variant="outlined"
                color="cyan-lighten-2"
                bg-color="rgba(10, 40, 64, 0.9)"
                class="mb-2"
                autocomplete="new-password"
              />

              <div v-if="newPassword" class="mb-4">
                <div class="d-flex align-center ga-2 mb-1">
                  <span class="text-caption text-grey-lighten-1">{{ t('profile.strength') }}</span>
                  <span class="text-caption font-weight-bold" :class="passwordStrengthColor">
                    {{ passwordStrengthLabel }}
                  </span>
                </div>
                <v-progress-linear
                  :model-value="passwordStrengthValue"
                  :color="passwordStrengthBarColor"
                  rounded
                  height="4"
                />
              </div>

              <v-text-field
                v-model="confirmPassword"
                :label="t('profile.confirmNewPassword')"
                :type="showConfirmPassword ? 'text' : 'password'"
                :rules="[rules.required, rules.matchPassword]"
                prepend-inner-icon="mdi-lock-check-outline"
                :append-inner-icon="showConfirmPassword ? 'mdi-eye-off' : 'mdi-eye'"
                @click:append-inner="showConfirmPassword = !showConfirmPassword"
                variant="outlined"
                color="cyan-lighten-2"
                bg-color="rgba(10, 40, 64, 0.9)"
                autocomplete="new-password"
              />

              <v-alert
                v-if="passwordError"
                type="error"
                variant="tonal"
                density="compact"
                closable
                class="mt-3"
                @click:close="passwordError = ''"
              >
                {{ passwordError }}
              </v-alert>

              <v-alert v-if="passwordSuccess" type="success" variant="tonal" density="compact" class="mt-3">
                {{ passwordSuccess }}
              </v-alert>
            </v-form>
          </v-card-text>

          <v-card-actions class="px-4 px-sm-6 pb-4 pt-2 flex-shrink-0">
            <v-spacer />
            <v-btn variant="outlined" color="grey-lighten-1" class="mr-2" @click="activeView = 'profile'">
              {{ t('common.back') }}
            </v-btn>
            <v-btn
              color="cyan-lighten-2"
              variant="flat"
              :disabled="!passwordFormValid"
              :loading="savingPassword"
              min-width="120"
              @click="submitPassword"
            >
              <v-icon start>mdi-content-save</v-icon>
              {{ t('profile.savePassword') }}
            </v-btn>
          </v-card-actions>
        </div>
      </template>
    </v-card>
  </v-dialog>

  <!-- ─── AVATAR DIALOG (separate overlay) ─── -->
  <v-dialog
    v-model="avatarDialogVisible"
    max-width="520"
    persistent
    :scrim="true"
    scrim-color="rgba(0,0,0,0.7)"
    transition="dialog-bottom-transition"
    :fullscreen="$vuetify.display.xs"
  >
    <v-card class="profile-card" rounded="xl">
      <v-card-title class="profile-header d-flex align-center justify-space-between pa-4 flex-shrink-0">
        <div class="d-flex align-center ga-2">
          <v-btn icon variant="text" size="small" @click="closeAvatarDialog">
            <v-icon color="white">mdi-arrow-left</v-icon>
          </v-btn>
          <span class="text-h6 font-weight-bold text-white">{{ t('profile.changeAvatar') }}</span>
        </div>
        <v-btn icon variant="text" size="small" @click="close">
          <v-icon color="white">mdi-close</v-icon>
        </v-btn>
      </v-card-title>

      <v-divider color="cyan-darken-3" />

      <div class="dialog-scroll-area">
        <v-card-text class="pa-4 pa-sm-6">
          <div class="text-center mb-4 mb-sm-6">
            <div class="current-avatar-wrapper mx-auto">
              <v-avatar size="80" class="current-avatar elevation-8">
                <v-img :src="selectedAvatar" alt="Selected Avatar" cover />
              </v-avatar>
              <v-icon class="edit-badge" color="cyan-lighten-2" size="20">mdi-pencil-circle</v-icon>
            </div>
            <p class="text-grey-lighten-1 mt-2 text-body-2">{{ t('profile.selectAvatar') }}</p>
          </div>

          <div class="avatar-grid">
            <div
              v-for="(avatar, index) in avatarList"
              :key="index"
              class="avatar-slot"
              :class="{ 'avatar-selected': selectedAvatar === avatar.path }"
              @click="selectAvatar(avatar.path)"
            >
              <v-avatar
                size="72"
                class="avatar-item"
                :class="{ 'selected-ring': selectedAvatar === avatar.path }"
              >
                <v-img :src="avatar.path" :alt="avatar.name" cover />
              </v-avatar>
              <v-fade-transition>
                <div v-if="selectedAvatar === avatar.path" class="check-badge">
                  <v-icon color="white" size="14">mdi-check</v-icon>
                </div>
              </v-fade-transition>
              <span class="avatar-name text-grey-lighten-1">{{ avatar.name }}</span>
            </div>
          </div>
        </v-card-text>

        <v-card-actions class="px-4 px-sm-6 pb-4 pt-2 flex-shrink-0">
          <v-spacer />
          <v-btn variant="outlined" color="grey-lighten-1" class="text-capitalize mr-2" @click="closeAvatarDialog">
            {{ t('common.back') }}
          </v-btn>
          <v-btn
            color="cyan-lighten-2"
            variant="flat"
            :disabled="selectedAvatar === currentAvatarSource"
            :loading="savingAvatar"
            min-width="120"
            class="text-capitalize"
            @click="confirmAvatar"
          >
            {{ t('common.confirm') }}
          </v-btn>
        </v-card-actions>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { sonnerToast } from '~/utils/sonnerToast'
import { useMemberStore } from '~/stores/memberStore'

const { t } = useFrontendI18n()

interface AvatarItem {
  path: string
  name: string
}

type ProfileView = 'profile' | 'password'

const props = withDefaults(defineProps<{
  modelValue: boolean
  currentAvatar?: string
  avatars?: AvatarItem[]
  username?: string
}>(), {
  currentAvatar: '/avatar/Avatar6.png',
  username: 'Player',
  avatars: () => [
    { path: '/avatar/Avatar3.png', name: 'Avatar 1' },
    { path: '/avatar/Avatar4.png', name: 'Avatar 2' },
    { path: '/avatar/Avatar6.png', name: 'Avatar 3' },
    { path: '/avatar/Avatar7.png', name: 'Avatar 4' },
  ],
})

const emit = defineEmits<{
  'update:modelValue': [value: boolean]
  'avatar-changed': [path: string]
  'password-changed': [payload: { oldPassword: string; newPassword: string }]
  'coin-transaction': []
}>()

const memberStore = useMemberStore()

// ─── View state ───
const activeView = ref<ProfileView>('profile')
const avatarDialogVisible = ref(false)

// ─── Dialog visibility ───
const dialogVisible = computed({
  get: () => props.modelValue,
  set: (val: boolean) => emit('update:modelValue', val),
})

// ─── Reset on open/close ───
watch(() => props.modelValue, (val) => {
  if (!val) {
    activeView.value = 'profile'
    avatarDialogVisible.value = false
    return
  }
  selectedAvatar.value = normalizeAvatarPath(memberStore.info.avatar || props.currentAvatar)
  activeView.value = 'profile'
  resetPasswordForm()
})

// ─── Avatar ───
const displayUsername = computed(() => memberStore.info.user_name || props.username || 'Player')
const currentAvatarSource = computed(() => normalizeAvatarPath(memberStore.info.avatar || props.currentAvatar))
const avatarList = computed(() => props.avatars)
const selectedAvatar = ref(normalizeAvatarPath(props.currentAvatar))
const savingAvatar = ref(false)

function normalizeAvatarPath(path: string): string {
  if (!path) return '/avatar/Avatar6.png'
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('/')) return path
  return `/avatar/${path}`
}

watch(() => memberStore.info.avatar, (val) => {
  if (val) selectedAvatar.value = normalizeAvatarPath(val)
})

function openAvatarDialog(): void {
  selectedAvatar.value = currentAvatarSource.value
  avatarDialogVisible.value = true
}

function closeAvatarDialog(): void {
  avatarDialogVisible.value = false
}

function selectAvatar(path: string): void {
  selectedAvatar.value = path
}

async function confirmAvatar(): Promise<void> {
  if (selectedAvatar.value === normalizeAvatarPath(memberStore.info.avatar)) return
  savingAvatar.value = true
  try {
    await memberStore.changeAvatar(selectedAvatar.value)
    emit('avatar-changed', memberStore.info.avatar)
    sonnerToast(t('profile.avatarUpdated'), t('profile.avatarUpdatedMessage'), 'success')
    closeAvatarDialog()
  } catch (err: any) {
    const msg = err?.error || err?.message || t('profile.failedToUpdateAvatar')
    sonnerToast(t('profile.updateFailed'), String(msg), 'error')
  } finally {
    savingAvatar.value = false
  }
}

// ─── Coin transaction ───
function startCoinTransaction(): void {
  emit('coin-transaction')
  close()
}

// ─── Password ───
const passwordForm = ref<any>(null)
const passwordFormValid = ref(false)
const savingPassword = ref(false)
const passwordError = ref('')
const passwordSuccess = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmPassword = ref('')
const showOldPassword = ref(false)
const showNewPassword = ref(false)
const showConfirmPassword = ref(false)

const rules = {
  required: (v: string) => !!v || t('profile.fieldRequired'),
  minLength: (v: string) => (v && v.length >= 6) || t('profile.minLength'),
  matchPassword: (v: string) => v === newPassword.value || t('profile.passwordMismatch'),
}

const passwordStrengthValue = computed((): number => {
  const pw = newPassword.value
  if (!pw) return 0
  let score = 0
  if (pw.length >= 6) score += 25
  if (pw.length >= 10) score += 15
  if (/[a-z]/.test(pw)) score += 15
  if (/[A-Z]/.test(pw)) score += 15
  if (/[0-9]/.test(pw)) score += 15
  if (/[^a-zA-Z0-9]/.test(pw)) score += 15
  return Math.min(100, score)
})

const passwordStrengthLabel = computed((): string => {
  const v = passwordStrengthValue.value
  if (v <= 25) return t('profile.weak')
  if (v <= 50) return t('profile.fair')
  if (v <= 75) return t('profile.good')
  return t('profile.strong')
})

const passwordStrengthColor = computed((): string => {
  const v = passwordStrengthValue.value
  if (v <= 25) return 'text-red'
  if (v <= 50) return 'text-orange'
  if (v <= 75) return 'text-yellow'
  return 'text-green'
})

const passwordStrengthBarColor = computed((): string => {
  const v = passwordStrengthValue.value
  if (v <= 25) return 'red'
  if (v <= 50) return 'orange'
  if (v <= 75) return 'yellow'
  return 'green'
})

function resetPasswordForm(): void {
  oldPassword.value = ''
  newPassword.value = ''
  confirmPassword.value = ''
  passwordError.value = ''
  passwordSuccess.value = ''
  showOldPassword.value = false
  showNewPassword.value = false
  showConfirmPassword.value = false
}

async function submitPassword(): Promise<void> {
  if (!passwordFormValid.value) return
  passwordError.value = ''
  passwordSuccess.value = ''
  savingPassword.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 800))
    emit('password-changed', {
      oldPassword: oldPassword.value,
      newPassword: newPassword.value,
    })
    passwordSuccess.value = t('profile.passwordChanged')
    resetPasswordForm()
    passwordSuccess.value = t('profile.passwordChanged')
    setTimeout(() => {
      passwordSuccess.value = ''
      activeView.value = 'profile'
    }, 1500)
  } catch (err: any) {
    passwordError.value = err?.message || t('profile.failedToChangePassword')
  } finally {
    savingPassword.value = false
  }
}

// ─── Helpers ───
function toNumber(value: string | number | null | undefined): number {
  const next = Number(value)
  return Number.isFinite(next) ? next : 0
}

function formatCoins(value: string | number | null | undefined): string {
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(toNumber(value))
}

function formatCurrencyByCode(value: number, code: string, symbol?: string): string {
  const normalizedCode = (code || '').toUpperCase()
  const digits = normalizedCode === 'KHR' || normalizedCode === 'VND' ? 0 : 2

  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: normalizedCode,
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value)
  } catch {
    const formattedNumber = new Intl.NumberFormat('en-US', {
      maximumFractionDigits: digits,
      minimumFractionDigits: digits,
    }).format(value)
    return `${symbol || normalizedCode} ${formattedNumber}`.trim()
  }
}

const profileBalances = computed(() => {
  return (memberStore.info.balances ?? []).map((balance) => {
    return {
      currency_id: balance.currency_id,
      code: balance.currency_code || `ID ${balance.currency_id}`,
      formatted: formatCurrencyByCode(
        toNumber(balance.balance_amount),
        balance.currency_symbol,
      ),
    }
  })
})

function close(): void {
  activeView.value = 'profile'
  avatarDialogVisible.value = false
  emit('update:modelValue', false)
}
</script>

<style scoped>
.profile-card {
  background: linear-gradient(180deg, #0a1929 0%, #051928 50%, #0a2240 100%) !important;
  border: 2px solid rgba(26, 111, 168, 0.6) !important;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  max-height: 90dvh;
  max-height: 90vh;
}

.dialog-scroll-area {
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  flex: 1 1 auto;
  min-height: 0;
}

.profile-header {
  background: linear-gradient(90deg, rgba(26, 111, 168, 0.3), transparent);
  border-bottom: 1px solid rgba(58, 168, 232, 0.2);
}

.profile-summary {
  padding: 8px 0;
}

.avatar-trigger {
  background: transparent;
  border: 0;
  padding: 0;
  cursor: pointer;
}

.current-avatar-wrapper {
  position: relative;
  display: inline-block;
}

.current-avatar {
  border: 3px solid rgba(58, 168, 232, 0.8);
  transition: all 0.3s ease;
}

.edit-badge {
  position: absolute;
  bottom: 2px;
  right: 2px;
  background: #0a1929;
  border-radius: 50%;
}

.profile-stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
}

.info-card,
.balance-panel {
  background: rgba(7, 32, 52, 0.92);
  border: 1px solid rgba(58, 168, 232, 0.18);
  border-radius: 18px;
  padding: 16px;
}

.info-label,
.panel-title,
.balance-code,
.empty-hint {
  color: rgba(173, 228, 242, 0.78);
}

.info-value {
  margin-top: 8px;
  font-size: 18px;
  font-weight: 700;
}

.coin-value {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #fac775;
}

.balance-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.balance-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 12px;
  border-radius: 14px;
  background: rgba(58, 168, 232, 0.08);
}

.balance-amount {
  color: #ffffff;
  font-weight: 600;
}

/* ─── Action buttons — flex row ─── */
.action-list {
  display: flex;
  flex-direction: row;
  gap: 12px;
}

.action-btn {
  min-height: 48px;
  flex: 1;
}

/* ─── Avatar grid ─── */
.avatar-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
  justify-items: center;
}

.avatar-slot {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  position: relative;
  padding: 6px;
  border-radius: 16px;
  transition: all 0.25s ease;
  width: 100%;
}

.avatar-slot:hover {
  background: rgba(58, 168, 232, 0.1);
  transform: translateY(-2px);
}

.avatar-slot.avatar-selected {
  background: rgba(58, 168, 232, 0.15);
}

.avatar-item {
  border: 3px solid rgba(26, 111, 168, 0.4);
  transition: all 0.25s ease;
}

.avatar-item:hover {
  border-color: rgba(85, 204, 255, 0.6);
  transform: scale(1.05);
}

.selected-ring {
  border: 3px solid rgba(58, 168, 232, 1) !important;
  box-shadow: 0 0 16px rgba(58, 168, 232, 0.5);
}

.check-badge {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgb(58, 168, 232);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
}

.avatar-name {
  font-size: 11px;
  text-align: center;
  max-width: 80px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* ─── Vuetify overrides ─── */
:deep(.v-text-field .v-field) {
  border-color: rgba(26, 111, 168, 0.6);
}

:deep(.v-text-field .v-field--focused) {
  border-color: rgba(58, 168, 232, 1);
}

:deep(.v-text-field input) {
  color: white !important;
}

:deep(.v-text-field label) {
  color: rgba(136, 187, 221, 0.8) !important;
}

:deep(.v-dialog--fullscreen) .profile-card {
  max-height: 100dvh;
  max-height: 100vh;
  border-radius: 0 !important;
  border: none !important;
}

/* ─── Responsive ─── */
@media (max-width: 500px) {
  .profile-stats {
    grid-template-columns: 1fr;
  }

  .avatar-grid {
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }

  .avatar-name {
    font-size: 10px;
  }

  /* Stack buttons on very small screens */
  .action-list {
    flex-direction: column;
  }
}

@media (max-width: 360px) {
  .avatar-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>