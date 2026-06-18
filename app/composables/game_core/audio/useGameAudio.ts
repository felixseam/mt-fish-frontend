type GameSoundName =
  | "uiClick"
  | "shoot"
  | "coinReward"
  | "bossAlert"
  | "bgmMain"
  | "bgmCrocodile"
  | "bgmPhoenix";

type BackgroundMusicName = Extract<
  GameSoundName,
  "bgmMain" | "bgmCrocodile" | "bgmPhoenix"
>;

type SoundDefinition = {
  path: string;
  loop?: boolean;
  volume?: number;
};

type RegisteredSound = SoundDefinition & {
  element: HTMLAudioElement | null;
};

const SOUND_DEFINITIONS: Record<GameSoundName, SoundDefinition> = {
  uiClick: {
    path: "/sounds/fas_click.mp3",
    volume: 0.5,
  },
  shoot: {
    path: "/sounds/fas_shoot_normal.mp3",
    volume: 0.75,
  },
  coinReward: {
    path: "/sounds/fas_fish_normal_coin_1.mp3",
    volume: 0.9,
  },
  bossAlert: {
    path: "/sounds/fas_alert.mp3",
    volume: 0.85,
  },
  bgmMain: {
    path: "/sounds/fas_bgm.mp3",
    loop: true,
    volume: 0.45,
  },
  bgmCrocodile: {
    path: "/sounds/fas_bgm_crocodile.mp3",
    loop: true,
    volume: 0.5,
  },
  bgmPhoenix: {
    path: "/sounds/fas_bgm_phoenix.mp3",
    loop: true,
    volume: 0.5,
  },
};

const sounds = new Map<GameSoundName, RegisteredSound>();
const activeEffects = new Set<HTMLAudioElement>();

let initialized = false;
let muted = false;
let currentBgmName: BackgroundMusicName | null = null;
let pendingBgmName: BackgroundMusicName | null = null;

function buildAudio(definition: SoundDefinition) {
  const audio = new Audio(definition.path);
  audio.preload = "auto";
  audio.loop = Boolean(definition.loop);
  audio.volume = definition.volume ?? 1;
  audio.muted = muted;
  return audio;
}

function ensureInitialized() {
  if (!import.meta.client || initialized) return;

  (Object.entries(SOUND_DEFINITIONS) as [GameSoundName, SoundDefinition][])
    .forEach(([name, definition]) => {
      sounds.set(name, {
        ...definition,
        element: buildAudio(definition),
      });
    });

  initialized = true;
}

function stopCurrentBackgroundMusic(resetTime = true) {
  if (!currentBgmName) return;
  const current = sounds.get(currentBgmName)?.element;
  if (current) {
    current.pause();
    if (resetTime) current.currentTime = 0;
  }
  currentBgmName = null;
}

function playPendingBackgroundMusic() {
  if (!pendingBgmName) return;
  const nextName = pendingBgmName;
  pendingBgmName = null;
  playBackgroundMusic(nextName);
}

function playBackgroundMusic(name: BackgroundMusicName) {
  ensureInitialized();
  if (!import.meta.client) return;

  if (currentBgmName === name) return;

  stopCurrentBackgroundMusic();
  pendingBgmName = null;

  const registered = sounds.get(name);
  const audio = registered?.element;
  if (!audio) return;

  currentBgmName = name;
  audio.currentTime = 0;
  audio.play().catch(() => {
    pendingBgmName = name;
    currentBgmName = null;
  });
}

function syncMutedState(nextMuted: boolean) {
  muted = nextMuted;

  sounds.forEach((sound) => {
    if (sound.element) sound.element.muted = nextMuted;
  });

  activeEffects.forEach((audio) => {
    audio.muted = nextMuted;
  });
}

export function useGameAudio() {
  ensureInitialized();

  function preloadAudio() {
    ensureInitialized();

    sounds.forEach((sound) => {
      sound.element?.load();
    });
  }

  function playSoundEffect(name: Exclude<GameSoundName, "bgmMain" | "bgmCrocodile" | "bgmPhoenix">) {
    ensureInitialized();
    if (!import.meta.client || muted) return;

    const registered = sounds.get(name);
    if (!registered?.element) return;

    const audio = registered.element.cloneNode() as HTMLAudioElement;
    audio.loop = false;
    audio.volume = registered.volume ?? 1;
    audio.muted = muted;
    activeEffects.add(audio);

    const cleanup = () => {
      activeEffects.delete(audio);
      audio.removeEventListener("ended", cleanup);
      audio.removeEventListener("pause", cleanup);
    };

    audio.addEventListener("ended", cleanup, { once: true });
    audio.addEventListener("pause", cleanup, { once: true });
    audio.play().catch(() => {
      cleanup();
    });
  }

  function queueBackgroundMusic(name: BackgroundMusicName) {
    pendingBgmName = name;
    playBackgroundMusic(name);
  }

  function stopBackgroundMusic() {
    pendingBgmName = null;
    stopCurrentBackgroundMusic();
  }

  function setMuted(nextMuted: boolean) {
    syncMutedState(nextMuted);

    if (nextMuted) {
      stopCurrentBackgroundMusic(false);
      return;
    }

    playPendingBackgroundMusic();
  }

  function toggleMuted() {
    setMuted(!muted);
  }

  return {
    preloadAudio,
    playSoundEffect,
    playBackgroundMusic,
    queueBackgroundMusic,
    stopBackgroundMusic,
    playPendingBackgroundMusic,
    setMuted,
    toggleMuted,
    isMuted: () => muted,
    soundNames: SOUND_DEFINITIONS,

    // Backward-compatible aliases
    preload: preloadAudio,
    play: playSoundEffect,
    playBGM: playBackgroundMusic,
    stopAllBGM: stopBackgroundMusic,
    toggleMute: toggleMuted,
    resumePendingBGM: playPendingBackgroundMusic,
  };
}
