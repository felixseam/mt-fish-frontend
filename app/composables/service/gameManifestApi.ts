// ~/composables/service/gameManifestApi.ts

import { useApiInterceptor } from "~/composables/api/useApiInterceptor";

// ── nested types ──────────────────────────────────────────────

export interface ManifestGameConfig {
  id: number;
  game_code: string;
  game_name: string;
  rtp_target: string;
  rtp_floor: string;
  rtp_ceiling: string;
  jackpot_rate: string;
  max_bullet_per_second: string;
  allow_auto_fire: boolean;
  allow_auto_lock: boolean;
  kill_rate_min: string;
  kill_rate_max: string;
  rtp_adjust_strength: string;
}

export interface ManifestPathVersion {
  id: number;
  version_code: string;
  version_name: string;
  content_hash: string;
  source_name: string;
}

export interface ManifestAssetManifest {
  base_path: string;
  file_config_url: string;
  file_config: {
    files: Record<string, string[]>;
    config: any[];
  };
}

export interface ManifestScene {
  id: string;
  label: string;
  background_url: string;
  ambient_kind: string;
  order: number;
}

export interface ManifestCannonLevel {
  id: number;
  level_code: string;
  level_name: string;
  cannon_frame: string;
  bullet_frame: string;
  net_frame: string;
  order: number;
}

export interface ManifestCannonType {
  id: number;
  cannon_code: string;
  cannon_name: string;
  bet_amount: string;
  cannon_level_id: number;
  order: number;
}

export interface ManifestRenderType {
  id: number;
  type_code: string;
}

export interface ManifestRenderState {
  id: number;
  render_family_id: number;
  state_code: string;
  prefix: string;
  frame_array: string[];
  is_default: boolean;
}

export interface ManifestRenderFamily {
  id: number;
  render_family_name: string;
  render_type_id: number;
  spine_json_path: string | null;
  spine_atlas_path: string | null;
  spine_png_path: string | null;
  render_type: ManifestRenderType | null;
  render_states: ManifestRenderState[];
}

export interface ManifestFishType {
  id: number;
  fish_type_name: string;
  runtime_kind_1based: number;
  internal_kind: number;
  has_runtime_config: boolean;
  is_boss: boolean;
  boss_name: string | null;
  min_odd: number | null;
  max_odd: number | null;
  min_kill_odd: number | null;
  max_kill_odd: number | null;
  base_difficulty: number | null;
  difficulty_weight: number | null;
  render_family_id: number | null;
  default_state_code: string;
  scale: number;
  zindex: number;
  base_speed: number;
  walk_speed: number | null;
  behavior: string | null;
  used_in_path: boolean;
  path_usage_count: number;
  asset_key: string | null;
  prefab: string | null;
  base_skin: string | null;
  render_family: ManifestRenderFamily | null;
}

// ── root response ─────────────────────────────────────────────

export interface GameManifest {
  game: ManifestGameConfig;
  path_version: ManifestPathVersion;
  asset_manifest: ManifestAssetManifest;
  scenes: ManifestScene[];
  cannon_levels: ManifestCannonLevel[];
  cannon_types: ManifestCannonType[];
  fish_types: ManifestFishType[];
}

// ── API call ──────────────────────────────────────────────────

export async function getGameManifest() {
  return useApiInterceptor<GameManifest>(
    "/game-manifest",
    {
      method: "GET",
    },
    { redirectOnError: false },
  );
}
