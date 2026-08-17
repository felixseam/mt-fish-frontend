import { Howl, Howler } from "howler";

type GameSoundName =
  | "uiClick"
  | "shoot"
  | "coinReward"
  | "specialCoin"
  | "specialAddCoin"
  | "bossAlert"
  | "bgmMain"
  | "bgmCrocodile"
  | "bgmPhoenix";

type BackgroundMusicName = Extract<
  GameSoundName,
  "bgmMain" | "bgmCrocodile" | "bgmPhoenix"
>;

type EffectSoundName = Exclude<
  GameSoundName,
  BackgroundMusicName
>;

type SoundDefinition = {
  path: string;
  loop?: boolean;
  volume?: number;
  pool?: number;
};

const SOUND_DEFINITIONS: Record<GameSoundName, SoundDefinition> = {
  uiClick: {
    path: "/sounds/fas_click.mp3",
    volume: 0.5,
    pool: 2,
  },

  shoot: {
    path: "/sounds/fas_shoot_normal.mp3",
    volume: 0.75,
    pool: 5,
  },

  coinReward: {
    path: "/sounds/fas_fish_normal_coin_1.mp3",
    volume: 0.9,
    pool: 4,
  },

  specialCoin: {
    path: "/sounds/fas_fish_special_coin.mp3",
    volume: 0.95,
    pool: 2,
  },

  specialAddCoin: {
    path: "/sounds/fas_fish_special_add_coin.mp3",
    volume: 0.95,
    pool: 2,
  },

  bossAlert: {
    path: "/sounds/fas_alert.mp3",
    volume: 0.85,
    pool: 2,
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

const EFFECT_NAMES: EffectSoundName[] = [
  "uiClick",
  "shoot",
  "coinReward",
  "specialCoin",
  "specialAddCoin",
  "bossAlert",
];

const BGM_NAMES: BackgroundMusicName[] = [
  "bgmMain",
  "bgmCrocodile",
  "bgmPhoenix",
];

const sounds = new Map<GameSoundName, Howl>();

let initialized = false;
let muted = false;

let currentBgmName: BackgroundMusicName | null = null;
let pendingBgmName: BackgroundMusicName | null = null;

let audioUnlocked = false;

/**
 * Maximum number of SFX plays allowed in a short period.
 *
 * This protects iPhone from hundreds of simultaneous
 * sound playback requests during heavy gameplay.
 */
const MAX_SFX_PLAYS_PER_SECOND = 30;

let sfxWindowStart = 0;
let sfxWindowCount = 0;

/**
 * Optional debug statistics.
 */
let debugEnabled = false;
let debugPlayCount = 0;

function createHowl(
  definition: SoundDefinition,
): Howl {
  return new Howl({
    src: [definition.path],

    loop: Boolean(definition.loop),

    volume: definition.volume ?? 1,

    preload: true,

    html5: false,

    pool: definition.pool ?? 1,

    onloaderror: (_id, error) => {
      if (debugEnabled) {
        console.warn(
          "[audio] failed to load",
          definition.path,
          error,
        );
      }
    },

    onplayerror: (_id, error) => {
      if (debugEnabled) {
        console.warn(
          "[audio] failed to play",
          definition.path,
          error,
        );
      }
    },
  });
}

function ensureInitialized() {
  if (!import.meta.client) {
    return;
  }

  if (initialized) {
    return;
  }

  for (const name of [
    ...EFFECT_NAMES,
    ...BGM_NAMES,
  ]) {
    const definition = SOUND_DEFINITIONS[name];

    sounds.set(
      name,
      createHowl(definition),
    );
  }

  initialized = true;
}

function canPlaySfx(): boolean {
  const now = performance.now();

  if (
    now - sfxWindowStart >= 1000
  ) {
    sfxWindowStart = now;
    sfxWindowCount = 0;
  }

  if (
    sfxWindowCount >= MAX_SFX_PLAYS_PER_SECOND
  ) {
    return false;
  }

  sfxWindowCount++;

  return true;
}

/**
 * Unlock WebAudio after a user gesture.
 *
 * iOS Safari requires audio to be initiated from a
 * user interaction in many situations.
 */
function unlockAudio() {
  if (!import.meta.client) {
    return;
  }

  if (audioUnlocked) {
    return;
  }

  try {
    Howler.ctx?.resume?.();

    Howler.autoUnlock = true;

    audioUnlocked = true;

    if (debugEnabled) {
      console.log("[audio] unlocked");
    }
  } catch (error) {
    if (debugEnabled) {
      console.warn(
        "[audio] unlock failed",
        error,
      );
    }
  }
}

function playBackgroundMusic(
  name: BackgroundMusicName,
) {
  ensureInitialized();

  if (
    !import.meta.client ||
    muted
  ) {
    return;
  }

  if (currentBgmName === name) {
    return;
  }

  stopCurrentBackgroundMusic();

  pendingBgmName = null;

  const sound = sounds.get(name);

  if (!sound) {
    return;
  }

  currentBgmName = name;

  unlockAudio();

  sound.stop();

  sound.volume(
    SOUND_DEFINITIONS[name].volume ?? 1,
  );

  sound.play();
}

function stopCurrentBackgroundMusic(
  reset = true,
) {
  if (!currentBgmName) {
    return;
  }

  const sound = sounds.get(
    currentBgmName,
  );

  if (sound) {
    sound.stop();

    if (reset) {
      sound.seek(0);
    }
  }

  currentBgmName = null;
}

function playPendingBackgroundMusic() {
  if (!pendingBgmName) {
    return;
  }

  const name = pendingBgmName;

  pendingBgmName = null;

  playBackgroundMusic(name);
}

function playSoundEffect(
  name: EffectSoundName,
) {
  ensureInitialized();

  if (
    !import.meta.client ||
    muted
  ) {
    return;
  }

  /**
   * Prevent audio from being hammered
   * during extremely heavy gameplay.
   */
  if (!canPlaySfx()) {
    return;
  }

  const sound = sounds.get(name);

  if (!sound) {
    return;
  }

  unlockAudio();

  const definition =
    SOUND_DEFINITIONS[name];

  sound.volume(
    definition.volume ?? 1,
  );

  /*
   * Howler manages the internal pool.
   *
   * We don't create or clone HTMLAudioElement
   * objects here.
   */
  sound.play();

  debugPlayCount++;
}

function preloadAudio() {
  ensureInitialized();

  for (const sound of sounds.values()) {
    sound.load();
  }
}

function queueBackgroundMusic(
  name: BackgroundMusicName,
) {
  pendingBgmName = name;

  if (muted) {
    return;
  }

  playBackgroundMusic(name);
}

function stopBackgroundMusic() {
  pendingBgmName = null;

  stopCurrentBackgroundMusic();
}

function setMuted(
  nextMuted: boolean,
) {
  muted = nextMuted;

  Howler.mute(nextMuted);

  if (nextMuted) {
    stopCurrentBackgroundMusic(false);
  } else {
    playPendingBackgroundMusic();
  }
}

function toggleMuted() {
  setMuted(!muted);
}

function pauseForBackground() {
  if (!import.meta.client) {
    return;
  }

  /*
   * Pause all Howler sounds.
   */
  Howler.mute(true);
}

function resumeFromBackground() {
  if (
    !import.meta.client ||
    muted
  ) {
    return;
  }

  unlockAudio();

  Howler.mute(false);

  if (currentBgmName) {
    const sound = sounds.get(
      currentBgmName,
    );

    if (sound && !sound.playing()) {
      sound.play();
    }
  } else if (pendingBgmName) {
    playPendingBackgroundMusic();
  }
}

function destroyAudio() {
  for (const sound of sounds.values()) {
    sound.stop();
    sound.unload();
  }

  sounds.clear();

  currentBgmName = null;
  pendingBgmName = null;

  initialized = false;
  audioUnlocked = false;
}

function setDebug(
  enabled: boolean,
) {
  debugEnabled = enabled;
}

function getDebugStats() {
  return {
    initialized,
    muted,
    audioUnlocked,
    currentBgmName,
    pendingBgmName,
    soundCount: sounds.size,
    debugPlayCount,
    sfxWindowCount,
    maxSfxPerSecond:
      MAX_SFX_PLAYS_PER_SECOND,
  };
}

export function useGameAudio() {
  ensureInitialized();

  return {
    /*
     * Main API
     */
    preloadAudio,
    playSoundEffect,
    playBackgroundMusic,
    queueBackgroundMusic,
    stopBackgroundMusic,
    playPendingBackgroundMusic,

    setMuted,
    toggleMuted,

    isMuted: () => muted,

    soundNames:
      SOUND_DEFINITIONS,

    pauseForBackground,
    resumeFromBackground,

    /*
     * Cleanup
     */
    destroyAudio,

    /*
     * Debug
     */
    setDebug,
    getDebugStats,

    /*
     * Backward-compatible aliases
     */
    preload: preloadAudio,
    play: playSoundEffect,
    playBGM: playBackgroundMusic,
    stopAllBGM: stopBackgroundMusic,
    toggleMute: toggleMuted,
    resumePendingBGM:
      playPendingBackgroundMusic,
  };
}