import * as PIXI from "pixi.js";
import { Spine } from "pixi-spine";
import {
  FISH_BASE_PATH,
  useFishAssetPreload,
} from "~/composables/game_core/assets/useFishAssetPreload";
import { useGameManifestStore } from "~/stores/gameManifestStore";
import type { ManifestFishType } from "~/composables/service/gameManifestApi";

// ── constants ─────────────────────────────────────────────────

const DIALOG_WIDTH = 860;
const DIALOG_HEIGHT = 560;
const CONTENT_X = 26;
const CONTENT_Y = 92;
const CONTENT_WIDTH = DIALOG_WIDTH - CONTENT_X * 2;
const CONTENT_HEIGHT = DIALOG_HEIGHT - 156;
const CARDS_PER_ROW = 4;
const ROWS_PER_PAGE = 2;
const CARDS_PER_PAGE = CARDS_PER_ROW * ROWS_PER_PAGE;

const SOLO_SPINE_FAMILIES = new Set([
  "spine_crystal_crab",
  "spine_turtle",
  "spine_octopus",
  "spine_phoenix",
  "spine_crocodile",
  "spine_naga",
]);

// ── local types ───────────────────────────────────────────────

type FishInfoEntry = {
  id: number;
  label: string;
  familyName: string;
  rewardLabel: string;
  stateCode: string;
  isBoss: boolean;
  previewKind: "atlas_sprite_anim" | "spine";
  atlasUrl?: string;
  frames?: string[];
  spineJsonUrl?: string;
  spineAtlasUrl?: string;
  scale: number;
  isSoloPage?: boolean;
  internal_kind: number;
};

type PageSlot =
  | { kind: "solo"; entry: FishInfoEntry }
  | { kind: "group"; entries: FishInfoEntry[] };

// ── helpers ───────────────────────────────────────────────────

function sortFramesForPlayback(frames: string[]): string[] {
  return [...frames].sort((a, b) => {
    const aNums = a.match(/\d+/g)?.map(Number) ?? [];
    const bNums = b.match(/\d+/g)?.map(Number) ?? [];
    const maxLen = Math.max(aNums.length, bNums.length);
    for (let i = 0; i < maxLen; i++) {
      const diff = (aNums[i] ?? 0) - (bNums[i] ?? 0);
      if (diff !== 0) return diff;
    }
    return a.localeCompare(b);
  });
}

function getAtlasUrlFromPrefix(prefix: string | null): string | null {
  if (!prefix) return null;
  return `${FISH_BASE_PATH}/${prefix.replace(/\/+$/, "")}.atlas.txt`;
}

function formatRewardLabel(fish: ManifestFishType): string {
  const min = fish.min_odd;
  const max = fish.max_odd;
  if (min != null && max != null) return min === max ? `${min}x` : `${min}-${max}x`;
  if (min != null) return `${min}x`;
  if (max != null) return `${max}x`;
  return "-";
}

function formatFishLabel(fish: ManifestFishType): string {
  const name = fish.fish_type_name?.trim();
  if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  return fish.is_boss
    ? fish.boss_name?.trim()
      ? fish.boss_name.trim()
      : `Boss ${fish.id}`
    : `Fish ${fish.id}`;
}

// ── data building ─────────────────────────────────────────────

function buildFishEntries(fishTypes: ManifestFishType[]): FishInfoEntry[] {
  const deduped = new Map<string, FishInfoEntry>();

  for (const fish of fishTypes) {
    const family = fish.render_family;
    const renderType = family?.render_type?.type_code;
    if (!family || !renderType) continue;

    const label = formatFishLabel(fish);
    const isSoloPage =
      renderType === "spine" && SOLO_SPINE_FAMILIES.has(family.render_family_name);

    if (renderType === "atlas_sprite_anim") {
      const targetStateCode = fish.default_state_code || "move";
      const targetState =
        family.render_states.find((s) => s.state_code === targetStateCode) ??
        family.render_states[0];

      if (!targetState?.prefix || !targetState.frame_array?.length) continue;

      const atlasUrl = getAtlasUrlFromPrefix(targetState.prefix);
      if (!atlasUrl) continue;

      const frames = sortFramesForPlayback(targetState.frame_array);
      const visualKey = `atlas:${atlasUrl}:${frames.join(",")}`;
      if (deduped.has(visualKey)) continue;

      deduped.set(visualKey, {
        id: fish.id,
        label,
        familyName: family.render_family_name || "Unknown",
        rewardLabel: formatRewardLabel(fish),
        stateCode: targetState.state_code,
        isBoss: fish.is_boss,
        previewKind: "atlas_sprite_anim",
        atlasUrl,
        frames,
        scale: fish.scale ?? 1,
        isSoloPage: false,
        internal_kind: fish.internal_kind,
      });
      continue;
    }

    if (renderType === "spine") {
      const spineJsonUrl = family.spine_json_path ?? undefined;
      const spineAtlasUrl = family.spine_atlas_path ?? undefined;
      if (!spineJsonUrl || !spineAtlasUrl) continue;

      const visualKey = `spine:${spineJsonUrl}`;
      if (deduped.has(visualKey)) continue;

      deduped.set(visualKey, {
        id: fish.id,
        label,
        familyName: family.render_family_name || "Unknown",
        rewardLabel: formatRewardLabel(fish),
        stateCode: fish.default_state_code || "run",
        isBoss: fish.is_boss,
        previewKind: "spine",
        spineJsonUrl,
        spineAtlasUrl,
        scale: fish.scale ?? 1,
        isSoloPage,
        internal_kind: fish.internal_kind,
      });
    }
  }

  return [...deduped.values()].sort((a, b) => a.internal_kind - b.internal_kind);
}

function buildPageSlots(entries: FishInfoEntry[]): PageSlot[] {
  const slots: PageSlot[] = [];
  const normalBatch: FishInfoEntry[] = [];

  function flushBatch() {
    for (let i = 0; i < normalBatch.length; i += CARDS_PER_PAGE) {
      slots.push({ kind: "group", entries: normalBatch.slice(i, i + CARDS_PER_PAGE) });
    }
    normalBatch.length = 0;
  }

  for (const entry of entries) {
    if (entry.isSoloPage) {
      flushBatch();
      slots.push({ kind: "solo", entry });
    } else {
      normalBatch.push(entry);
    }
  }
  flushBatch();

  return slots;
}

// ── main export ───────────────────────────────────────────────

export async function createFishInfoDialog() {
  const manifestStore = useGameManifestStore();
  const { preloadAtlas, getAtlasTexture } = useFishAssetPreload();

  const entries = buildFishEntries(manifestStore.fishTypes);

  const uniqueAtlasUrls = [
    ...new Set(
      entries
        .map((e) => e.atlasUrl)
        .filter((u): u is string => typeof u === "string"),
    ),
  ];

  const uniqueSpines = [
    ...new Map(
      entries
        .filter((e) => e.previewKind === "spine" && e.spineJsonUrl && e.spineAtlasUrl)
        .map((e) => [e.spineJsonUrl!, { json: e.spineJsonUrl!, atlas: e.spineAtlasUrl! }]),
    ).values(),
  ];

  await Promise.all(uniqueAtlasUrls.map((url) => preloadAtlas(url)));
  await Promise.all(
    uniqueSpines.map((m) =>
      PIXI.Assets.load({ src: m.json, data: { spineAtlasFile: m.atlas } }),
    ),
  );

  const pageSlots = buildPageSlots(entries);

  // ── PIXI scene setup ──────────────────────────────────────────

  const container = new PIXI.Container();
  container.visible = false;
  container.eventMode = "static";
  container.zIndex = 50;

  const livePreviews: PIXI.DisplayObject[] = [];
  let currentPage = 0;

  const overlay = new PIXI.Graphics();
  overlay.beginFill(0x000000, 0.52);
  overlay.drawRect(-3000, -3000, 6000, 6000);
  overlay.endFill();
  overlay.eventMode = "static";
  container.addChild(overlay);

  const panel = new PIXI.Container();
  panel.position.set(210, 76);
  container.addChild(panel);

  const background = new PIXI.Graphics();
  background.lineStyle(4, 0x46d3ff, 0.85);
  background.beginFill(0x051c2d, 0.97);
  background.drawRoundedRect(0, 0, DIALOG_WIDTH, DIALOG_HEIGHT, 28);
  background.endFill();
  panel.addChild(background);

  const innerBorder = new PIXI.Graphics();
  innerBorder.lineStyle(2, 0x1e7ca2, 0.45);
  innerBorder.drawRoundedRect(10, 10, DIALOG_WIDTH - 20, DIALOG_HEIGHT - 20, 22);
  panel.addChild(innerBorder);

  const title = new PIXI.Text("Fish Encyclopedia", {
    fill: 0xffffff,
    fontFamily: "Poppins",
    fontSize: 30,
    fontWeight: "700",
    align: "center",
  });
  title.anchor.set(0.5, 0);
  title.position.set(DIALOG_WIDTH / 2, 20);
  panel.addChild(title);

  const divider = new PIXI.Graphics();
  divider.lineStyle(2, 0x1e7ca2, 0.5);
  divider.moveTo(24, 82);
  divider.lineTo(DIALOG_WIDTH - 24, 82);
  panel.addChild(divider);

  const closeButton = new PIXI.Container();
  closeButton.position.set(DIALOG_WIDTH - 38, 34);
  closeButton.eventMode = "static";
  closeButton.cursor = "pointer";

  const closeBg = new PIXI.Graphics();
  closeBg.beginFill(0x0d3a57, 1);
  closeBg.drawCircle(0, 0, 18);
  closeBg.endFill();
  closeButton.addChild(closeBg);

  const closeLabel = new PIXI.Text("X", {
    fill: 0xffffff,
    fontFamily: "Poppins",
    fontSize: 16,
    fontWeight: "700",
  });
  closeLabel.anchor.set(0.5);
  closeButton.addChild(closeLabel);
  panel.addChild(closeButton);

  const content = new PIXI.Container();
  content.position.set(CONTENT_X, CONTENT_Y);
  panel.addChild(content);

  const pageIndicator = new PIXI.Text("1 / 1", {
    fill: 0xa8dbff,
    fontFamily: "Poppins",
    fontSize: 18,
    fontWeight: "600",
  });
  pageIndicator.anchor.set(0.5);
  pageIndicator.position.set(DIALOG_WIDTH / 2, DIALOG_HEIGHT - 34);
  panel.addChild(pageIndicator);

  function makeNavButton(label: string, x: number, onClick: () => void) {
    const btn = new PIXI.Container();
    btn.position.set(x, DIALOG_HEIGHT - 34);
    btn.eventMode = "static";
    btn.cursor = "pointer";

    const bg = new PIXI.Graphics();
    bg.lineStyle(2, 0x46d3ff, 0.65);
    bg.beginFill(0x0d3a57, 1);
    bg.drawRoundedRect(-26, -18, 52, 36, 10);
    bg.endFill();
    btn.addChild(bg);

    const lbl = new PIXI.Text(label, {
      fill: 0xffffff,
      fontFamily: "Poppins",
      fontSize: 20,
      fontWeight: "700",
    });
    lbl.anchor.set(0.5);
    btn.addChild(lbl);
    btn.on("pointertap", onClick);
    return btn;
  }

  const prevButton = makeNavButton("<", DIALOG_WIDTH / 2 - 90, () => goToPage(currentPage - 1));
  const nextButton = makeNavButton(">", DIALOG_WIDTH / 2 + 90, () => goToPage(currentPage + 1));
  panel.addChild(prevButton);
  panel.addChild(nextButton);

  // ── preview helpers ───────────────────────────────────────────

  function clearLivePreviews() {
    for (const p of livePreviews) {
      if (p instanceof PIXI.AnimatedSprite) p.stop();
      p.destroy();
    }
    livePreviews.length = 0;
  }

  function buildPlaceholderPreview() {
    const g = new PIXI.Graphics();
    g.beginFill(0x12344a, 1);
    g.drawRoundedRect(-44, -44, 88, 88, 16);
    g.endFill();
    g.lineStyle(2, 0x46d3ff, 0.45);
    g.moveTo(-22, -22); g.lineTo(22, 22);
    g.moveTo(22, -22);  g.lineTo(-22, 22);
    return g;
  }

  function fitPreviewToCard(
    preview: PIXI.DisplayObject,
    cardWidth: number,
    cardHeight: number,
    scaleBoost = 1,
  ) {
    const b = preview.getLocalBounds();
    const scale =
      Math.min((cardWidth * 0.6) / Math.max(b.width, 1), (cardHeight * 0.38) / Math.max(b.height, 1), 1);
    preview.scale.set(scale * scaleBoost);
    preview.position.set(
      (cardWidth - 12) / 2 - (b.x + b.width / 2) * preview.scale.x,
      86 - (b.y + b.height / 2) * preview.scale.y,
    );
  }

  function fitPreviewSolo(preview: PIXI.DisplayObject, scaleBoost = 1) {
    const b = preview.getLocalBounds();
    const scale = Math.min(
      (CONTENT_WIDTH * 0.55) / Math.max(b.width, 1),
      (CONTENT_HEIGHT * 0.62) / Math.max(b.height, 1),
      1,
    );
    preview.scale.set(scale * scaleBoost);
    preview.position.set(
      CONTENT_WIDTH / 2 - (b.x + b.width / 2) * preview.scale.x,
      CONTENT_HEIGHT * 0.42 - (b.y + b.height / 2) * preview.scale.y,
    );
  }

  function buildSpinePreview(entry: FishInfoEntry): PIXI.DisplayObject {
    const resource = entry.spineJsonUrl
      ? (PIXI.Assets.get(entry.spineJsonUrl) as { spineData?: unknown } | undefined)
      : undefined;
    const spineData = resource?.spineData ?? resource;
    if (!spineData || typeof spineData !== "object") return buildPlaceholderPreview();

    const spine = new Spine(spineData as never);
    const anim = entry.stateCode || "run";
    spine.skeleton?.setToSetupPose?.();
    if (spine.state?.hasAnimation(anim)) {
      spine.state.setAnimation(0, anim, true);
      spine.state.update(0);
      spine.state.apply(spine.skeleton);
    }
    spine.skeleton?.updateWorldTransform?.();
    spine.update(0);
    livePreviews.push(spine);
    return spine;
  }

  function buildAtlasPreview(entry: FishInfoEntry): PIXI.DisplayObject {
    const textures = (entry.frames ?? [])
      .map((f) => getAtlasTexture(entry.atlasUrl!, f))
      .filter((t) => t !== PIXI.Texture.WHITE);
    if (!textures.length) return buildPlaceholderPreview();

    const sprite = new PIXI.AnimatedSprite(textures);
    sprite.anchor.set(0.5);
    sprite.animationSpeed = 0.16;
    sprite.loop = true;
    sprite.play();
    livePreviews.push(sprite);
    return sprite;
  }

  // ── card builders ─────────────────────────────────────────────

  function buildCard(entry: FishInfoEntry, index: number) {
    const cardWidth = (CONTENT_WIDTH - 24) / CARDS_PER_ROW;
    const cardHeight = (CONTENT_HEIGHT - 20) / ROWS_PER_PAGE;
    const col = index % CARDS_PER_ROW;
    const row = Math.floor(index / CARDS_PER_ROW);

    // ── center the grid horizontally within CONTENT_WIDTH ──
    const totalGridWidth = CARDS_PER_ROW * cardWidth;
    const gridOffsetX = (CONTENT_WIDTH - totalGridWidth) / 2;

    const card = new PIXI.Container();
    card.position.set(gridOffsetX + col * cardWidth, row * cardHeight);

    const bg = new PIXI.Graphics();
    bg.lineStyle(2, 0x2d99c7, 0.7);
    bg.beginFill(entry.isBoss ? 0x14263c : 0x082437, 0.95);
    bg.drawRoundedRect(0, 0, cardWidth - 12, cardHeight - 12, 18);
    bg.endFill();
    card.addChild(bg);

    if (entry.isBoss) {
      const badge = new PIXI.Text("BOSS", {
        fill: 0xffd166,
        fontFamily: "Poppins",
        fontSize: 12,
        fontWeight: "700",
      });
      badge.position.set(cardWidth - 56, 14);
      card.addChild(badge);
    }

    // fish_type_name as card title (centered)
    const nameText = new PIXI.Text(entry.label, {
      fill: 0xffffff,
      fontFamily: "Poppins",
      fontSize: 15,
      fontWeight: "700",
      align: "center",
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set((cardWidth - 12) / 2, 12);
    card.addChild(nameText);

    const preview =
      entry.previewKind === "spine"
        ? buildSpinePreview(entry)
        : buildAtlasPreview(entry);
    fitPreviewToCard(preview, cardWidth - 12, cardHeight - 12, entry.scale);
    card.addChild(preview);

    // reward centered (moved up slightly since familyName is removed)
    const rewardText = new PIXI.Text(`${entry.rewardLabel}`, {
      fill: 0xffd166,
      fontFamily: "Poppins",
      fontSize: 20,
      fontWeight: "700",
      align: "center",
    });
    rewardText.anchor.set(0.5, 0);
    rewardText.position.set((cardWidth - 12) / 2, cardHeight - 46);
    card.addChild(rewardText);

    return card;
  }

  function buildSoloCard(entry: FishInfoEntry) {
    const card = new PIXI.Container();

    const bg = new PIXI.Graphics();
    bg.lineStyle(3, entry.isBoss ? 0xffd166 : 0x2d99c7, 0.85);
    bg.beginFill(entry.isBoss ? 0x14263c : 0x082437, 0.97);
    bg.drawRoundedRect(0, 0, CONTENT_WIDTH, CONTENT_HEIGHT, 24);
    bg.endFill();
    card.addChild(bg);

    if (entry.isBoss) {
      const badge = new PIXI.Text("BOSS", {
        fill: 0xffd166,
        fontFamily: "Poppins",
        fontSize: 14,
        fontWeight: "700",
      });
      badge.anchor.set(0.5, 0);
      badge.position.set(CONTENT_WIDTH / 2, 16);
      card.addChild(badge);
    }

    const preview = buildSpinePreview(entry);
    fitPreviewSolo(preview, entry.scale);
    card.addChild(preview);

    // fish_type_name as large centered title (solo page)
    const nameText = new PIXI.Text(entry.label, {
      fill: 0xffffff,
      fontFamily: "Poppins",
      fontSize: 26,
      fontWeight: "700",
      align: "center",
    });
    nameText.anchor.set(0.5, 0);
    nameText.position.set(CONTENT_WIDTH / 2, CONTENT_HEIGHT - 72);
    card.addChild(nameText);

    // reward centered (moved up since familyName is removed)
    const rewardText = new PIXI.Text(`${entry.rewardLabel}`, {
      fill: 0xffd166,
      fontFamily: "Poppins",
      fontSize: 22,
      fontWeight: "700",
      align: "center",
    });
    rewardText.anchor.set(0.5, 0);
    rewardText.position.set(CONTENT_WIDTH / 2, CONTENT_HEIGHT - 36);
    card.addChild(rewardText);

    return card;
  }

  //pagination 

  function renderPage(page: number) {
    clearLivePreviews();
    content.removeChildren().forEach((c) => c.destroy());

    const totalPages = Math.max(pageSlots.length, 1);
    currentPage = Math.max(0, Math.min(page, totalPages - 1));

    const slot = pageSlots[currentPage];

    if (!slot) {
      const empty = new PIXI.Text("No fish data available.", {
        fill: 0xa8dbff, fontFamily: "Poppins", fontSize: 24,
      });
      empty.anchor.set(0.5);
      empty.position.set(CONTENT_WIDTH / 2, CONTENT_HEIGHT / 2);
      content.addChild(empty);
    } else if (slot.kind === "solo") {
      content.addChild(buildSoloCard(slot.entry));
    } else {
      slot.entries.forEach((entry, i) => content.addChild(buildCard(entry, i)));
    }

    pageIndicator.text = `${currentPage + 1} / ${totalPages}`;
    prevButton.alpha = currentPage === 0 ? 0.45 : 1;
    nextButton.alpha = currentPage >= totalPages - 1 ? 0.45 : 1;
  }

  function goToPage(page: number) { renderPage(page); }

  overlay.on("pointertap", () => { container.visible = false; });
  closeButton.on("pointertap", () => { container.visible = false; });
  renderPage(0);

  return {
    container,
    open() { renderPage(currentPage); container.visible = true; },
    close() { container.visible = false; },
    destroy() { clearLivePreviews(); container.destroy({ children: true }); },
  };
}