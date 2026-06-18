import { computed, ref } from "vue";
import { useGameAudio } from "~/composables/game_core/audio/useGameAudio";

const STORAGE_KEY = "game_audio_muted";
const mutedState = ref(false);
const initialized = ref(false);

function readStoredMutedState() {
  if (!import.meta.client) return false;
  return localStorage.getItem(STORAGE_KEY) === "true";
}

function applyMutedState(nextMuted: boolean) {
  if (!import.meta.client) return;

  useGameAudio().setMuted(nextMuted);

  for (const media of document.querySelectorAll<HTMLMediaElement>("audio, video")) {
    media.muted = nextMuted;
  }
}

export function useGameAudioSettings() {
  if (import.meta.client && !initialized.value) {
    mutedState.value = readStoredMutedState();
    applyMutedState(mutedState.value);
    initialized.value = true;
  }

  function setMuted(nextMuted: boolean) {
    mutedState.value = nextMuted;
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, String(nextMuted));
      applyMutedState(nextMuted);
    }
  }

  return {
    isMuted: computed(() => mutedState.value),
    setMuted,
    toggleMuted: () => setMuted(!mutedState.value),
  };
}
