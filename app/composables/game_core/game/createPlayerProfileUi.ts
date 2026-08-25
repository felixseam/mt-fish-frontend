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
  panelBg: 0x0d1b2a,   // deep navy
  panelStroke: 0x1e3a5f,   // subtle blue border
  innerBg: 0x112233,   // slightly lighter inner panels
  innerStroke: 0x1a4a7a,   // neon-blue tint border
  accentGlow: 0x00d4ff,   // cyan neon accent
  accentAlt: 0xffc857,   // warm gold for balance
  textPrimary: 0xe8f4fd,   // near-white
  textCoin: 0xffc857,   // gold (kept name for minimal diff elsewhere)
  ringInner: 0x00d4ff,
  ringOuter: 0x0066aa,
  avatarShadow: 0x00d4ff,
};

const CORNER_RADIUS = 16;
const INNER_CORNER = 10;

export interface ProfileBalanceItem {
  currencyId: number;
  code: string;
  symbol: string;
  amount: number;
}

export async function createPlayerProfileUi(
  initialAvatarPath: string = "/avatar/Avatar6.png",
  allAvatarPaths: string[] = [...DEFAULT_AVATAR_URLS],
  initialUsername: string = "Player",
  avatarClickCb?: () => void,
  options?: {
    initialBalances?: ProfileBalanceItem[];
    initialCurrencyId?: number;
    getAtlasTexture?: (atlasUrl: string, frame: string) => PIXI.Texture;
  },
) {
  // Touch detection
  const isTouchLike =
    typeof window !== "undefined" &&
    ((window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ?? false) ||
      window.innerWidth < 900);

  // Dimensions
  const panelX = 0;
  const panelY = 0;
  const panelW = isTouchLike ? 300 : 260;
  const panelH = isTouchLike ? 130 : 110;

  const avatarD = isTouchLike ? 88 : 72;
  const avatarR = avatarD / 2;
  const avatarCX = avatarR + (isTouchLike ? 22 : 20);
  const avatarCY = panelH / 2;

  const innerX = avatarCX + avatarR + 12;
  const innerW = panelW - innerX - 14;
  const innerGap = isTouchLike ? 8 : 6;
  const innerNameH = isTouchLike ? 42 : 36;
  const innerCoinH = isTouchLike ? 38 : 32;
  const totalInnerH = innerNameH + innerGap + innerCoinH;
  const innerNameY = panelY + Math.floor((panelH - totalInnerH) / 2);
  const innerCoinY = innerNameY + innerNameH + innerGap;

  const usernameFontSize = isTouchLike ? 20 : 17;
  const coinFontSize = isTouchLike ? 21 : 18;
  const symbolFontSize = isTouchLike ? 21 : 22;

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

  // ── Root container 
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

  // ── 1. Outer panel — no border, no fill
  const panelBg = new PIXI.Graphics();
  rootContainer.addChild(panelBg);

  // ── 2. Avatar glow ring (drawn, not atlas) 
  const ringGlow = new PIXI.Graphics();
  ringGlow.lineStyle(3, COLOR.accentGlow, 0.35);
  ringGlow.drawCircle(avatarCX, avatarCY, avatarR + 6);
  rootContainer.addChild(ringGlow);

  const ring = new PIXI.Graphics();
  ring.lineStyle(2.5, COLOR.accentGlow, 0.9);
  ring.drawCircle(avatarCX, avatarCY, avatarR + 2);
  rootContainer.addChild(ring);

  // ── 3. Avatar mask + sprite 
  const avatarMask = new PIXI.Graphics();
  avatarMask.beginFill(0xffffff);
  avatarMask.drawCircle(avatarCX, avatarCY, avatarR - 1);
  avatarMask.endFill();
  rootContainer.addChild(avatarMask);

  const avatarPlaceholder = new PIXI.Graphics();
  avatarPlaceholder.beginFill(0x274a6b, 1);
  avatarPlaceholder.drawCircle(avatarCX, avatarCY, avatarR - 1);
  avatarPlaceholder.endFill();
  rootContainer.addChild(avatarPlaceholder);

  function isTextureUsable(tex: PIXI.Texture | null | undefined): boolean {
    return !!tex && tex.valid && tex.width > 0 && tex.height > 0;
  }

  function resolveAvatarTexture(path: string): PIXI.Texture {
    const normalized = normalizeAvatarPath(path);
    const tex = getTexture(normalized);

    if (isTextureUsable(tex)) {
      return tex;
    }

    // console.warn(
    //   `[ProfileUI] avatar texture not usable for "${normalized}" ` +
    //   `(requested as "${path}"). Falling back to default avatar. ` +
    //   `Check that this path was preloaded via useFishAssetPreload ` +
    //   `BEFORE createPlayerProfileUi runs, and that the path/casing ` +
    //   `matches exactly what was preloaded.`,
    // );

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
  avatarSprite.width = avatarD - 2;
  avatarSprite.height = avatarD - 2;
  avatarSprite.mask = avatarMask;
  avatarPlaceholder.visible = !isTextureUsable(avatarSprite.texture);
  rootContainer.addChild(avatarSprite);

  // 4. Username sub-panel 
  const usernameBg = new PIXI.Graphics();
  drawPanel(usernameBg, innerX, innerNameY, innerW, innerNameH, INNER_CORNER,
    COLOR.innerBg, 0.85, COLOR.innerStroke, 1);
  rootContainer.addChild(usernameBg);

  const nameAccent = new PIXI.Graphics();
  nameAccent.beginFill(COLOR.accentGlow, 0.9);
  nameAccent.drawRoundedRect(innerX + 1, innerNameY + 7, 3, innerNameH - 14, 2);
  nameAccent.endFill();
  rootContainer.addChild(nameAccent);

  const usernameText = new PIXI.Text(initialUsername || "Player", {
    fontFamily: '"Trebuchet MS", "Segoe UI", Poppins',
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

  const maxNameW = innerW - 16;
  if (usernameText.width > maxNameW) {
    usernameText.scale.set(maxNameW / usernameText.width);
  }

  rootContainer.addChild(usernameText);

  // ── 5. Balance dropdown panel ─────────────────────────────────────────────
  const balanceBox = new PIXI.Graphics();
  drawPanel(balanceBox, innerX, innerCoinY, innerW, innerCoinH, INNER_CORNER,
    COLOR.innerBg, 0.85, COLOR.accentAlt, 0.7);
  rootContainer.addChild(balanceBox);

  const balanceAccent = new PIXI.Graphics();
  balanceAccent.beginFill(COLOR.accentAlt, 0.95);
  balanceAccent.drawRoundedRect(innerX + 1, innerCoinY + 6, 3, innerCoinH - 12, 2);
  balanceAccent.endFill();
  rootContainer.addChild(balanceAccent);

  const balanceRowY = innerCoinY + innerCoinH / 2;

  // Main balance amount (large)
  const balanceAmountText = new PIXI.Text("0", {
    fontFamily: '"Trebuchet MS", "Segoe UI", Poppins',
    fontSize: coinFontSize,
    fontWeight: "bold",
    fill: COLOR.textCoin,
    dropShadow: true,
    dropShadowColor: 0xffaa00,
    dropShadowBlur: 8,
    dropShadowDistance: 0,
    dropShadowAlpha: 0.6,
  });
  balanceAmountText.anchor.set(0, 0.5);
  balanceAmountText.position.set(innerX + 10, balanceRowY);
  rootContainer.addChild(balanceAmountText);

  // Currency symbol — smaller, placed right after the amount.
  const balanceSymbolText = new PIXI.Text("", {
    fontFamily: '"Trebuchet MS", "Segoe UI", Poppins',
    fontSize: symbolFontSize,
    fontWeight: "bold",
    fill: COLOR.textCoin,
  });
  balanceSymbolText.alpha = 0.85;
  balanceSymbolText.anchor.set(0, 0.5);
  rootContainer.addChild(balanceSymbolText);

  // Dropdown caret, right edge of the panel
  const dropdownCaret = new PIXI.Graphics();
  dropdownCaret.beginFill(0xffffff, 0.7);
  dropdownCaret.moveTo(0, 0).lineTo(8, 0).lineTo(4, 5).closePath();
  dropdownCaret.endFill();
  dropdownCaret.pivot.set(4, 2.5);
  dropdownCaret.position.set(innerX + innerW - 14, balanceRowY);
  rootContainer.addChild(dropdownCaret);

  // Hit area covering the whole balance panel — tap toggles the dropdown.
  const balanceHitArea = new PIXI.Graphics();
  balanceHitArea.beginFill(0xffffff, 0.001);
  balanceHitArea.drawRoundedRect(innerX, innerCoinY, innerW, innerCoinH, INNER_CORNER);
  balanceHitArea.endFill();
  balanceHitArea.eventMode = "static";
  balanceHitArea.cursor = "pointer";
  rootContainer.addChild(balanceHitArea);

  // ── Dropdown list (positioned just under the balance panel) ────────────────
  const dropdownList = new PIXI.Container();
  dropdownList.visible = false;
  dropdownList.alpha = 0;
  dropdownList.position.set(innerX, innerCoinY + innerCoinH + 4);
  rootContainer.addChild(dropdownList);

  const ROW_H = isTouchLike ? 34 : 28;
  let balances: ProfileBalanceItem[] = options?.initialBalances ?? [];
  let selectedCurrencyId: number | null =
    options?.initialCurrencyId ?? balances[0]?.currencyId ?? null;
  let dropdownOpen = false;
  let onCurrencyChangeCb: ((currencyId: number) => void) | null = null;

  function formatAmount(amount: number, currencyId?: number | null): string {
    if (currencyId === KHR_CURRENCY_ID) {
      return Math.round(amount).toLocaleString("en-US");
    }
    return amount.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  }

  function currentBalance(): ProfileBalanceItem | null {
    return balances.find(b => b.currencyId === selectedCurrencyId) ?? balances[0] ?? null;
  }

  // Amount (large) on the left, symbol (small) placed right after it.
  // Both texts are scaled together to fit the panel if the combined
  // width would overflow.
  const BALANCE_GAP = 4;
  const KHR_CURRENCY_ID = 1;

  function refreshBalanceDisplay() {
    const b = currentBalance();
    const amountStr = b ? formatAmount(b.amount, b.currencyId) : "0";
    const symbolStr = b ? (b.symbol || b.code || "") : "";

    balanceAmountText.text = amountStr;
    balanceAmountText.scale.set(1);
    balanceSymbolText.text = symbolStr;
    balanceSymbolText.scale.set(1);

    const maxW = innerW - 28;
    const rawTotalW =
      balanceAmountText.width + (symbolStr ? BALANCE_GAP + balanceSymbolText.width : 0);

    if (rawTotalW > maxW) {
      const scale = maxW / rawTotalW;
      balanceAmountText.scale.set(scale);
      balanceSymbolText.scale.set(scale);
    }

    balanceAmountText.position.set(innerX + 10, balanceRowY);
    balanceSymbolText.position.set(
      innerX + 10 + balanceAmountText.width + BALANCE_GAP,
      balanceRowY + 1, // nudge down slightly so baselines feel aligned
    );

    dropdownCaret.visible = balances.length > 1;
  }

  function buildDropdownRows() {
    dropdownList.removeChildren();
    if (!balances.length) return;

    const listW = innerW;
    const listH = balances.length * ROW_H;

    const bg = new PIXI.Graphics();
    drawPanel(bg, 0, 0, listW, listH, INNER_CORNER, COLOR.innerBg, 0.97, COLOR.innerStroke, 1);
    dropdownList.addChild(bg);

    balances.forEach((b, i) => {
      const rowY = i * ROW_H;
      const isSelected = b.currencyId === selectedCurrencyId;

      const rowHit = new PIXI.Graphics();
      rowHit.beginFill(isSelected ? COLOR.accentAlt : 0xffffff, isSelected ? 0.1 : 0.001);
      rowHit.drawRect(0, rowY, listW, ROW_H);
      rowHit.endFill();
      rowHit.eventMode = "static";
      rowHit.cursor = "pointer";
      rowHit.on("pointertap", (e: FederatedPointerEvent) => {
        e.stopPropagation();
        selectedCurrencyId = b.currencyId;
        refreshBalanceDisplay();
        closeDropdown();
        onCurrencyChangeCb?.(b.currencyId);
      });
      dropdownList.addChild(rowHit);

      // Amount on the left (main value)
      const rowAmount = new PIXI.Text(formatAmount(b.amount, b.currencyId), {
        fontFamily: '"Trebuchet MS", "Segoe UI", Poppins',
        fontSize: Math.round(coinFontSize * 0.8),   // was 0.55
        fontWeight: "bold",
        fill: isSelected ? COLOR.textCoin : COLOR.textPrimary,
      });
      rowAmount.anchor.set(0, 0.5);
      rowAmount.position.set(10, rowY + ROW_H / 2);
      dropdownList.addChild(rowAmount);

      // Symbol — smaller, right after the amount
      const rowSymbol = new PIXI.Text(b.symbol || b.code, {
        fontFamily: '"Trebuchet MS", "Segoe UI", Poppins',
        fontSize: Math.round(coinFontSize * 0.62),   // was 0.42
        fontWeight: "bold",
        fill: isSelected ? COLOR.textCoin : COLOR.textPrimary,
      });
      rowSymbol.alpha = 0.85;
      rowSymbol.anchor.set(0, 0.5);
      rowSymbol.position.set(10 + rowAmount.width + 4, rowY + ROW_H / 2 + 1);
      dropdownList.addChild(rowSymbol);

      if (i > 0) {
        const sep = new PIXI.Graphics();
        sep.lineStyle(1, COLOR.innerStroke, 0.6);
        sep.moveTo(8, rowY).lineTo(listW - 8, rowY);
        dropdownList.addChild(sep);
      }
    });
  }
  function closeDropdown() {
    if (!dropdownOpen) return;
    dropdownOpen = false;
    gsap.to(dropdownList, {
      alpha: 0,
      duration: 0.15,
      onComplete: () => { dropdownList.visible = false; },
    });
    gsap.to(dropdownCaret, { rotation: 0, duration: 0.15 });
  }

  function openDropdown() {
    if (dropdownOpen || balances.length <= 1) return;
    dropdownOpen = true;
    buildDropdownRows();
    dropdownList.visible = true;
    dropdownList.alpha = 0;
    gsap.to(dropdownList, { alpha: 1, duration: 0.15 });
    gsap.to(dropdownCaret, { rotation: Math.PI, duration: 0.15 });
  }

  function toggleDropdown() {
    if (dropdownOpen) closeDropdown();
    else openDropdown();
  }

  balanceHitArea.on("pointertap", (e: FederatedPointerEvent) => {
    e.stopPropagation();
    toggleDropdown();
  });

  balanceHitArea.on("pointerover", () => {
    gsap.to(balanceBox, { alpha: 1, duration: 0.15 });
  });

  // Initial paint
  refreshBalanceDisplay();

  // ── 6. Avatar hit area ────────────────────────────────────────────────────
  const avatarHitArea = new PIXI.Graphics();
  avatarHitArea.beginFill(0xffffff, 0.001);
  avatarHitArea.drawCircle(avatarCX, avatarCY, avatarR + (isTouchLike ? 8 : 4));
  avatarHitArea.endFill();
  avatarHitArea.eventMode = "static";
  avatarHitArea.cursor = "pointer";

  avatarHitArea.on("pointerdown", (e: FederatedPointerEvent) => {
    e.stopPropagation();
    closeDropdown();
    const origSX = avatarSprite.scale.x;
    const origSY = avatarSprite.scale.y;
    gsap.fromTo(
      avatarSprite.scale,
      { x: origSX * 0.85, y: origSY * 0.85 },
      { x: origSX, y: origSY, duration: 0.22, ease: "back.out(2.5)" },
    );
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

  function setBalances(next: ProfileBalanceItem[], activeCurrencyId?: number) {
    balances = next;

    if (activeCurrencyId != null && balances.some(b => b.currencyId === activeCurrencyId)) {
      selectedCurrencyId = activeCurrencyId;
    } else if (selectedCurrencyId == null || !balances.some(b => b.currencyId === selectedCurrencyId)) {
      selectedCurrencyId = balances[0]?.currencyId ?? null;
    }

    refreshBalanceDisplay();

    const flashObj = { v: 1 };
    gsap.to(flashObj, {
      v: 0,
      duration: 0.5,
      ease: "power2.out",
      onUpdate: () => {
        balanceBox.clear();
        drawPanel(
          balanceBox,
          innerX, innerCoinY, innerW, innerCoinH, INNER_CORNER,
          COLOR.innerBg, 0.85,
          COLOR.accentAlt, 0.7 + flashObj.v * 2,
        );
      },
    });

    if (dropdownOpen) buildDropdownRows();
  }

  function updateBalanceAmount(currencyId: number, amount: number) {
    const existing = balances.find(b => b.currencyId === currencyId);
    if (existing) {
      existing.amount = amount;
    } else {
      balances = [...balances, { currencyId, code: String(currencyId), symbol: "", amount }];
    }
    refreshBalanceDisplay();
    if (dropdownOpen) buildDropdownRows();
  }

  function getSelectedCurrencyId(): number | null {
    return selectedCurrencyId;
  }

  function getSelectedBalance(): ProfileBalanceItem | null {
    return currentBalance();
  }

  function onSelectCurrency(cb: (currencyId: number) => void) {
    onCurrencyChangeCb = cb;
  }

  function destroy() {
    avatarHitArea.off("pointerdown");
    avatarHitArea.off("pointerover");
    avatarHitArea.off("pointerout");
    balanceHitArea.off("pointertap");
    balanceHitArea.off("pointerover");
    rootContainer.destroy({ children: true });
  }

  const SCALE = isTouchLike ? 0.85 : 0.75;
  rootContainer.scale.set(SCALE);

  return {
    container: rootContainer,
    setAvatar,
    setUsername,
    setBalances,
    updateBalanceAmount,
    getSelectedCurrencyId,
    getSelectedBalance,
    onSelectCurrency,
    closeDropdown,
    destroy,
  };
}