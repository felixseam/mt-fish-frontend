import {
  endGameSession,
  enterGameSession,
  saveGameSessionSnapshot,
  type SessionPayload,
} from "~/composables/service/sessionApi";
import { createBet } from "~/composables/service/betApi";

type SnapshotProducer = () => {
  total_elapsed_seconds: string;
  current_context_index?: number | null;
  current_context_no?: number | null;
  current_group_id?: number | null;
  current_scene_id?: string;
  current_boss_fish_type_id?: number | null;
  pending_next_context_index?: number | null;
  pending_next_scene_id?: string;
  boss_scene_active?: boolean;
  boss_scene_lock_id?: string;
  spawn_cursor?: number;
  runtime_state_json?: Record<string, unknown>;
  device_meta_json?: Record<string, unknown>;
};

export function useFishSessionRuntime() {
  const session = ref<SessionPayload | null>(null);
  const snapshotVersion = ref<number>(0);
  let timer: ReturnType<typeof setInterval> | null = null;
  let snapshotBusy = false;
  let snapshotConsecutiveFailures = 0;
  let syncLost = false;

  async function openSession(pathVersionId: number) {
    const result = await enterGameSession({
      force_new: false,
      current_path_version_id: pathVersionId,
      runtime_state_json: {},
      device_meta_json: {},
      expires_in_seconds: 43200,
    });
    const payload = (result?.data.value as any)?.data ?? result?.data.value;
    session.value = payload.session;
    snapshotVersion.value = payload.session.snapshot_version;
    snapshotConsecutiveFailures = 0;
    syncLost = false;
    return payload;
  }

  async function pushSnapshot(getPayload: SnapshotProducer) {
    if (!session.value || snapshotBusy) return;
    snapshotBusy = true;
    try {
      const payload = getPayload();
      const result = await saveGameSessionSnapshot(session.value.id, {
        snapshot_version: snapshotVersion.value,
        total_elapsed_seconds: payload.total_elapsed_seconds,
        current_context_index: payload.current_context_index ?? null,
        current_context_no: payload.current_context_no ?? null,
        current_group_id: payload.current_group_id ?? null,
        current_scene_id: payload.current_scene_id ?? "",
        current_boss_fish_type_id: payload.current_boss_fish_type_id ?? null,
        pending_next_context_index: payload.pending_next_context_index ?? null,
        pending_next_scene_id: payload.pending_next_scene_id ?? "",
        boss_scene_active: payload.boss_scene_active ?? false,
        boss_scene_lock_id: payload.boss_scene_lock_id ?? "",
        spawn_cursor: payload.spawn_cursor ?? 0,
        runtime_state_json: payload.runtime_state_json ?? {},
        device_meta_json: payload.device_meta_json ?? {},
      });
      const responsePayload =
        (result?.data.value as any)?.data ?? result?.data.value;
      session.value = responsePayload.session;
      snapshotVersion.value = responsePayload.session.snapshot_version;
      snapshotConsecutiveFailures = 0;
      syncLost = false;
    } catch (err: any) {
      const m = String(err?.message ?? "");
      if (m.includes("stale_snapshot")) {
        console.warn("[session] stale snapshot");
      } else {
        console.error("[session] snapshot failed", err);
      }
      snapshotConsecutiveFailures += 1;
    } finally {
      snapshotBusy = false;
    }
  }

  function startSnapshotLoop(
    getPayload: SnapshotProducer,
    options?: {
      maxFailuresBeforeSyncLost?: number;
      onSyncLost?: () => void;
    },
  ) {
    if (timer) clearInterval(timer);
    const maxFailures = options?.maxFailuresBeforeSyncLost ?? 3;
    timer = setInterval(() => {
      void pushSnapshot(getPayload).finally(() => {
        if (!syncLost && snapshotConsecutiveFailures >= maxFailures) {
          syncLost = true;
          options?.onSyncLost?.();
        }
      });
    }, 7000);
  }

  async function stopAndClose(getPayload: SnapshotProducer) {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    if (!session.value) return;
    const payload = getPayload();
    await endGameSession(session.value.id, {
      total_elapsed_seconds: payload.total_elapsed_seconds,
      current_scene_id: payload.current_scene_id ?? "",
      runtime_state_json: payload.runtime_state_json ?? {},
      device_meta_json: payload.device_meta_json ?? {},
    });
    session.value = null;
    snapshotVersion.value = 0;
  }

  async function fireBet(
    fishTypeId: number,
    cannonTypeId: number,
    elapsedSeconds: string,
  ) {
    if (!session.value) throw new Error("Session not ready");
    return createBet({
      session_id: session.value.id,
      fish_type_id: fishTypeId,
      cannon_type_id: cannonTypeId,
      elapsed_seconds: elapsedSeconds,
    });
  }

  function pauseSnapshotLoop() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function resumeSnapshotLoop(
    getPayload: SnapshotProducer,
    options?: {
      maxFailuresBeforeSyncLost?: number;
      onSyncLost?: () => void;
    },
  ) {
    startSnapshotLoop(getPayload, options);
  }

  return {
    session,
    snapshotVersion,
    get isSyncLost() {
      return syncLost;
    },
    openSession,
    pushSnapshot,
    startSnapshotLoop,
    stopAndClose,
    fireBet,
    pauseSnapshotLoop,
    resumeSnapshotLoop,
  };
}
