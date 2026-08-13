import * as PIXI from "pixi.js";
import gsap from "gsap";
import type { FederatedPointerEvent } from "@pixi/events";
import {
  DEFAULT_AVATAR_URLS,
  useFishAssetPreload,
} from "~/composables/game_core/assets/useFishAssetPreload";

const FISH_BASE_PATH = "/fish/fish-all-star";
const UI_ATLAS_URL = `${FISH_BASE_PATH}/resources/ui.atlas.txt`;

// ── Design tokens ──────────────────────────────────────────────────────────
const COLOR = {
  panelBg:       0x0d1b2a,   // deep navy
  panelStroke:   0x1e3a5f,   // subtle blue border
  innerBg:       0x112233,   // slightly lighter inner panels
  innerStroke:   0x1a4a7a,   // neon-blue tint border
  accentGlow:    0x00d4ff,   // cyan neon accent
  accentAlt:     0xffc857,   // warm gold for coins
  textPrimary:   0xe8f4fd,   // near-white
  textCoin:      0xffc857,   // gold
  ringInner:     0x00d4ff,
  ringOuter:     0x0066aa,
  avatarShadow:  0x00d4ff,
};

const CORNER_RADIUS = 16;
const INNER_CORNER  = 10;

export async function createPlayerProfileUi(
  initialAvatarPath: string = "/avatar/Avatar6.png",
  allAvatarPaths: string[] = [...DEFAULT_AVATAR_URLS],
  initialUsername: string = "Player",
  avatarClickCb?: () => void,
  options?: {
    initialCoins?: number;
    getAtlasTexture?: (atlasUrl: string, frame: string) => PIXI.Texture;
  },
) {
  // ── Touch detection ────────────────────────────────────────────────────
  const isTouchLike =
    typeof window !== "undefined" &&
    ((window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ?? false) ||
      window.innerWidth < 900);

  // ── Dimensions ─────────────────────────────────────────────────────────
  // Bumped up on touch so the panel isn't tiny after the overall UI scale
  // (see SCALE below) shrinks everything down.
  const panelX = 0;
  const panelY = 0;
  const panelW = isTouchLike ? 300 : 260;
  const panelH = isTouchLike ? 130 : 110;

  const avatarD  = isTouchLike ? 88 : 72;
  const avatarR  = avatarD / 2;
  const avatarCX = avatarR + (isTouchLike ? 22 : 20);
  const avatarCY = panelH / 2;

  const innerX    = avatarCX + avatarR + 12;
  const innerW    = panelW - innerX - 14;
  const innerGap  = isTouchLike ? 8 : 6;
  const innerNameH = isTouchLike ? 42 : 36;
  const innerCoinH = isTouchLike ? 38 : 32;
  const totalInnerH = innerNameH + innerGap + innerCoinH;
  const innerNameY  = panelY + Math.floor((panelH - totalInnerH) / 2);
  const innerCoinY  = innerNameY + innerNameH + innerGap;

  const usernameFontSize = isTouchLike ? 20 : 17;
  const coinFontSize     = isTouchLike ? 21 : 18;
  const coinIconSize     = isTouchLike ? 26 : 22;

  // ── Helpers ─────────────────────────────────────────────────────────────
  const normalizeAvatarPath = (path: string) =>
    path.replace(/^\/resource\/avatar\//, "/avatar/");
  const normalizedInitialAvatarPath = normalizeAvatarPath(initialAvatarPath);
  const { getTexture } = useFishAssetPreload();

  const getAtlasTexture = options?.getAtlasTexture;
  const getAtlas = (frame: string): PIXI.Texture => {
    if (getAtlasTexture) {
      try { return getAtlasTexture(UI_ATLAS_URL, frame); }
      catch (e) { console.warn(`[ProfileUI] failed to get texture: ${frame}`, e); }
    }
    return PIXI.Texture.EMPTY;
  };

  const coinIconTexture = getAtlas("ui/coin.png");

  // ── Root container ───────────────────────────────────────────────────────
  const rootContainer = new PIXI.Container();

  // ── Helper: draw a rounded-rect panel with stroke ─────────────────────────
  function drawPanel(
    g: PIXI.Graphics,
    x: number, y: number, w: number, h: number,
    radius: number,
    fillColor: number,
    fillAlpha: number,
    strokeColor: number,
    strokeWidth: number,
  ) {
    g.lineStyle(strokeWidth, strokeColor, 0.8);
    g.beginFill(fillColor, fillAlpha);
    g.drawRoundedRect(x, y, w, h, radius);
    g.endFill();
  }

  // ── 1. Outer panel — no border, no fill (kept for layout reference) ──────
  const panelBg = new PIXI.Graphics();
  rootContainer.addChild(panelBg);

  // ── 2. Avatar glow ring (drawn, not atlas) ────────────────────────────────
  const ringGlow = new PIXI.Graphics();
  ringGlow.lineStyle(3, COLOR.accentGlow, 0.35);
  ringGlow.drawCircle(avatarCX, avatarCY, avatarR + 6);
  rootContainer.addChild(ringGlow);

  const ring = new PIXI.Graphics();
  ring.lineStyle(2.5, COLOR.accentGlow, 0.9);
  ring.drawCircle(avatarCX, avatarCY, avatarR + 2);
  rootContainer.addChild(ring);

  // ── 3. Avatar mask + sprite ───────────────────────────────────────────────
  const avatarMask = new PIXI.Graphics();
  avatarMask.beginFill(0xffffff);
  avatarMask.drawCircle(avatarCX, avatarCY, avatarR - 1);
  avatarMask.endFill();
  rootContainer.addChild(avatarMask);

  // Placeholder circle shown behind the avatar sprite. If the texture
  // fails to load you'll see this colored disc instead of a blank hole —
  // makes missing-asset issues visible instead of silent.
  const avatarPlaceholder = new PIXI.Graphics();
  avatarPlaceholder.beginFill(0x274a6b, 1);
  avatarPlaceholder.drawCircle(avatarCX, avatarCY, avatarR - 1);
  avatarPlaceholder.endFill();
  rootContainer.addChild(avatarPlaceholder);

  // A PIXI.Texture object always exists even when nothing loaded — it's
  // never `null`/`undefined`, and comparing against PIXI.Texture.EMPTY
  // isn't reliable across texture wrapping. `.valid` + non-zero width is
  // the real signal that pixel data actually loaded.
  function isTextureUsable(tex: PIXI.Texture | null | undefined): boolean {
    return !!tex && tex.valid && tex.width > 0 && tex.height > 0;
  }

  function resolveAvatarTexture(path: string): PIXI.Texture {
    const normalized = normalizeAvatarPath(path);
    const tex = getTexture(normalized);

    if (isTextureUsable(tex)) {
      return tex;
    }

    console.warn(
      `[ProfileUI] avatar texture not usable for "${normalized}" ` +
      `(requested as "${path}"). Falling back to default avatar. ` +
      `Check that this path was preloaded via useFishAssetPreload ` +
      `BEFORE createPlayerProfileUi runs, and that the path/casing ` +
      `matches exactly what was preloaded.`,
    );

    const fallback = getTexture("/avatar/Avatar6.png");

    if (!isTextureUsable(fallback)) {
      console.warn(
        `[ProfileUI] fallback "/avatar/Avatar6.png" is ALSO not usable. ` +
        `This means Avatar6.png itself was never preloaded (or preloaded ` +
        `under a different path/casing) in useFishAssetPreload — that's ` +
        `almost certainly why default avatars aren't showing. Showing a ` +
        `placeholder circle instead.`,
      );
    }

    return fallback;
  }

  const avatarSprite = new PIXI.Sprite(resolveAvatarTexture(initialAvatarPath));
  avatarSprite.anchor.set(0.5);
  avatarSprite.position.set(avatarCX, avatarCY);
  avatarSprite.width  = avatarD - 2;
  avatarSprite.height = avatarD - 2;
  avatarSprite.mask   = avatarMask;
  // Hide the placeholder once we actually have real pixel data.
  avatarPlaceholder.visible = !isTextureUsable(avatarSprite.texture);
  rootContainer.addChild(avatarSprite);

  // ── 4. Username sub-panel ─────────────────────────────────────────────────
  const usernameBg = new PIXI.Graphics();
  drawPanel(usernameBg, innerX, innerNameY, innerW, innerNameH, INNER_CORNER,
    COLOR.innerBg, 0.85, COLOR.innerStroke, 1);
  rootContainer.addChild(usernameBg);

  // Neon left-edge accent bar on username panel
  const nameAccent = new PIXI.Graphics();
  nameAccent.beginFill(COLOR.accentGlow, 0.9);
  nameAccent.drawRoundedRect(innerX + 1, innerNameY + 7, 3, innerNameH - 14, 2);
  nameAccent.endFill();
  rootContainer.addChild(nameAccent);

  const usernameText = new PIXI.Text(initialUsername || "Player", {
    fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
    fontSize: usernameFontSize,
    fontWeight: "bold",
    fill: COLOR.textPrimary,
    dropShadow: true,
    dropShadowColor: COLOR.accentGlow,
    dropShadowBlur: 6,
    dropShadowDistance: 0,
    dropShadowAlpha: 0.5,
  });
  usernameText.anchor.set(0, 0.5);
  usernameText.position.set(innerX + 12, innerNameY + innerNameH / 2);

  // Clamp username text width
  const maxNameW = innerW - 16;
  if (usernameText.width > maxNameW) {
    usernameText.scale.set(maxNameW / usernameText.width);
  }

  rootContainer.addChild(usernameText);

  // ── 5. Coin sub-panel ─────────────────────────────────────────────────────
  const coinBox = new PIXI.Graphics();
  drawPanel(coinBox, innerX, innerCoinY, innerW, innerCoinH, INNER_CORNER,
    COLOR.innerBg, 0.85, COLOR.accentAlt, 0.7);
  rootContainer.addChild(coinBox);

  // Gold left-edge accent bar on coin panel
  const coinAccent = new PIXI.Graphics();
  coinAccent.beginFill(COLOR.accentAlt, 0.95);
  coinAccent.drawRoundedRect(innerX + 1, innerCoinY + 6, 3, innerCoinH - 12, 2);
  coinAccent.endFill();
  rootContainer.addChild(coinAccent);

  const coinRowY = innerCoinY + innerCoinH / 2;

  const coinIconSprite = new PIXI.Sprite(coinIconTexture);
  coinIconSprite.anchor.set(0, 0.5);
  coinIconSprite.width  = coinIconSize;
  coinIconSprite.height = coinIconSize;
  coinIconSprite.position.set(innerX + 10, coinRowY);
  rootContainer.addChild(coinIconSprite);

  const coinText = new PIXI.Text(
    (options?.initialCoins ?? 0).toLocaleString("en-US"),
    {
      fontFamily: '"Trebuchet MS", "Segoe UI", sans-serif',
      fontSize: coinFontSize,
      fontWeight: "bold",
      fill: COLOR.textCoin,
      dropShadow: true,
      dropShadowColor: 0xffaa00,
      dropShadowBlur: 8,
      dropShadowDistance: 0,
      dropShadowAlpha: 0.6,
    },
  );
  coinText.anchor.set(0, 0.5);
  coinText.position.set(innerX + coinIconSize + 16, coinRowY);

  const coinTextMaxW = innerW - coinIconSize - 20 - 8;
  if (coinText.width > coinTextMaxW) {
    coinText.scale.set(coinTextMaxW / coinText.width);
  }

  rootContainer.addChild(coinText);

  // ── 6. Avatar hit area ────────────────────────────────────────────────────
  const avatarHitArea = new PIXI.Graphics();
  avatarHitArea.beginFill(0xffffff, 0.001);
  avatarHitArea.drawCircle(avatarCX, avatarCY, avatarR + (isTouchLike ? 8 : 4));
  avatarHitArea.endFill();
  avatarHitArea.eventMode = "static";
  avatarHitArea.cursor    = "pointer";

  avatarHitArea.on("pointerdown", (e: FederatedPointerEvent) => {
    e.stopPropagation();
    const origSX = avatarSprite.scale.x;
    const origSY = avatarSprite.scale.y;
    gsap.fromTo(
      avatarSprite.scale,
      { x: origSX * 0.85, y: origSY * 0.85 },
      { x: origSX, y: origSY, duration: 0.22, ease: "back.out(2.5)" },
    );
    // Pulse the glow ring on tap
    gsap.fromTo(ringGlow, { alpha: 1 }, { alpha: 0.3, duration: 0.3, yoyo: true, repeat: 1 });
    avatarClickCb?.();
  });

  avatarHitArea.on("pointerover", () => {
    if (ring.destroyed) return;
    gsap.to(ring, { alpha: 0.5, duration: 0.15 });
    gsap.to(ringGlow, { alpha: 0.7, duration: 0.15 });
  });

  avatarHitArea.on("pointerout", () => {
    if (ring.destroyed) return;
    gsap.to(ring, { alpha: 1, duration: 0.2 });
    gsap.to(ringGlow, { alpha: 1, duration: 0.2 });
  });

  rootContainer.addChild(avatarHitArea);

  // ── Coin change effects ───────────────────────────────────────────────────
  let currentCoins = options?.initialCoins ?? 0;
  let coinTween: gsap.core.Tween | null = null;

  function _refreshCoinText(value: number) {
    coinText.text = Math.round(value).toLocaleString("en-US");
    coinText.scale.set(1);
    const maxW = innerW - coinIconSize - 20 - 8;
    if (coinText.width > maxW) coinText.scale.set(maxW / coinText.width);
  }

  // ── Public API ────────────────────────────────────────────────────────────
  function setAvatar(path: string) {
    const tex = resolveAvatarTexture(path);
    avatarSprite.texture = tex;
    avatarPlaceholder.visible = !isTextureUsable(tex);
  }

  function setUsername(name: string) {
    usernameText.text = name;
    usernameText.scale.set(1);
    const maxW = innerW - 16;
    if (usernameText.width > maxW) usernameText.scale.set(maxW / usernameText.width);
  }

  function setCoins(amount: number) {
    const previous = currentCoins;
    const delta    = amount - previous;
    if (delta === 0) return;
    currentCoins = amount;

    const isGain = delta > 0;

    // ── 1. Count-up / count-down tween ──────────────────────────────────────
    coinTween?.kill();
    const counter = { value: previous };
    coinTween = gsap.to(counter, {
      value: amount,
      duration: 0.7,
      ease: "power2.out",
      onUpdate: () => _refreshCoinText(counter.value),
    });

    // ── 2. Scale bounce on coinText ──────────────────────────────────────────
    gsap.fromTo(
      coinText.scale,
      { x: isGain ? 1.35 : 0.85, y: isGain ? 1.35 : 0.85 },
      { x: 1, y: 1, duration: 0.45, ease: "elastic.out(1, 0.5)" },
    );

    // ── 3. Panel border flash (always gold) ──────────────────────────────────
    const flashObj = { v: 1 };
    gsap.to(flashObj, {
      v: 0,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: () => {
        coinBox.clear();
        drawPanel(
          coinBox,
          innerX, innerCoinY, innerW, innerCoinH, INNER_CORNER,
          COLOR.innerBg, 0.85,
          COLOR.accentAlt, 0.7 + flashObj.v * 2,
        );
      },
    });

    // ── 4. Coin icon spin ────────────────────────────────────────────────────
    gsap.fromTo(
      coinIconSprite,
      { rotation: 0 },
      { rotation: Math.PI * 2, duration: 0.5, ease: "power2.inOut" },
    );

  }

  function destroy() {
    coinTween?.kill();

    avatarHitArea.off("pointerdown");
    avatarHitArea.off("pointerover");
    avatarHitArea.off("pointerout");
    rootContainer.destroy({ children: true });
  }

  // Slightly larger overall scale on touch so the whole panel doesn't
  // shrink to the same footprint as desktop after the base sizes above
  // were already bumped up.
  const SCALE = isTouchLike ? 0.85 : 0.75;
  rootContainer.scale.set(SCALE);

  return { container: rootContainer, setAvatar, setUsername, setCoins, destroy };
}