import * as PIXI from "pixi.js";
import gsap from "gsap";

import {
  ICON_BUTTON_ATLAS_URL,
  ICON_BUTTON_IMAGE_URL,
  useFishAssetPreload,
} from "~/composables/game_core/assets/useFishAssetPreload";

type MenuItem = {
  frame: string;
  label: string;
  onClick: () => void;
};

type MenuUiOptions = {
  items?: MenuItem[];
};

export async function createMenuUi(options?: MenuUiOptions) {
  const { getJsonAsset, preloadJsonAsset } = useFishAssetPreload();
  const isTouchLike =
    typeof window !== "undefined" &&
    ((window.matchMedia?.("(hover: none), (pointer: coarse)")?.matches ?? false) ||
      window.innerWidth < 900);

  const rootContainer = new PIXI.Container();
  rootContainer.sortableChildren = true;

  // ─────────────────────────────────────────────────────────────
  // Load atlas + texture
  // ─────────────────────────────────────────────────────────────
  let atlasData: any = null;
  let atlasTexture: PIXI.Texture | null = null;

  try {
    atlasData =
      getJsonAsset<any>(ICON_BUTTON_ATLAS_URL) ??
      (await preloadJsonAsset<any>(ICON_BUTTON_ATLAS_URL));

    // ✅ Properly load WEBP texture
    await PIXI.Assets.load(ICON_BUTTON_IMAGE_URL);

    const baseTexture = PIXI.BaseTexture.from(ICON_BUTTON_IMAGE_URL);

    // wait until resource fully loaded
    // @ts-ignore
    await baseTexture.resource?.load?.();

    atlasTexture = new PIXI.Texture(baseTexture);

    console.log(
      "[MenuUi] atlas loaded:",
      atlasTexture.baseTexture.width,
      "x",
      atlasTexture.baseTexture.height,
    );

    console.log(
      "[MenuUi] available frames:",
      Object.keys(atlasData?.frames ?? {}),
    );
  } catch (err) {
    console.warn("[MenuUi] failed loading atlas", err);
  }

  // ─────────────────────────────────────────────────────────────
  // Get frame texture
  // ─────────────────────────────────────────────────────────────
  function getFrameTexture(frameName: string): PIXI.Texture {
    if (!atlasData || !atlasTexture) {
      console.warn("[MenuUi] atlas missing");
      return PIXI.Texture.EMPTY;
    }

    const frameData = atlasData.frames?.[frameName];

    if (!frameData) {
      console.warn(`[MenuUi] frame not found: ${frameName}`);
      return PIXI.Texture.EMPTY;
    }

    const { x, y, w, h } = frameData.frame;

    const bw = atlasTexture.baseTexture.width;
    const bh = atlasTexture.baseTexture.height;

    // safety check
    if (x + w > bw || y + h > bh) {
      console.warn(
        `[MenuUi] frame out of bounds: ${frameName}`,
        { x, y, w, h, bw, bh },
      );

      return PIXI.Texture.EMPTY;
    }

    return new PIXI.Texture(
      atlasTexture.baseTexture,
      new PIXI.Rectangle(x, y, w, h),
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Default menu items
  // MUST MATCH ATLAS JSON EXACTLY
  // ─────────────────────────────────────────────────────────────
  const defaultItems: MenuItem[] = [
    {
      frame: "notification.webp",
      label: "Notification",
      onClick: () => console.log("notification"),
    },

    {
      frame: "statement.webp",
      label: "Statement",
      onClick: () => console.log("statement"),
    },

    {
      frame: "transition.webp",
      label: "Transition",
      onClick: () => console.log("transition"),
    },

    {
      frame: "setting.webp",
      label: "Setting",
      onClick: () => console.log("setting"),
    },

    {
      frame: "logout.webp",
      label: "Logout",
      onClick: () => console.log("logout"),
    },
  ];

  const menuItems = options?.items ?? defaultItems;

  // ─────────────────────────────────────────────────────────────
  // Sizes
  // Touch sizes bumped up + icon fill now scales proportionally
  // to the button size instead of subtracting a fixed pixel amount,
  // so bigger buttons actually show bigger icons.
  // ─────────────────────────────────────────────────────────────
  const MENU_BTN_SIZE = isTouchLike ? 88 : 64;

  const ICON_SIZE = isTouchLike ? 72 : 56;

  const ICON_GAP = isTouchLike ? 16 : 12;

  const PADDING_X = isTouchLike ? 24 : 20;

  const PADDING_Y = isTouchLike ? 24 : 20;

  // Fill ratio: icon glyph fills ~78% of its circle, leaving ~22%
  // padding on each side. Keeps things proportional at any size.
  const MENU_ICON_FILL_RATIO = 0.78;
  const ITEM_ICON_FILL_RATIO = 0.8;

  const panelW = ICON_SIZE + PADDING_X * 2;

  const panelH =
    menuItems.length * (ICON_SIZE + ICON_GAP) -
    ICON_GAP +
    PADDING_Y * 2;

  // ─────────────────────────────────────────────────────────────
  // Overlay
  // ─────────────────────────────────────────────────────────────
  const overlay = new PIXI.Graphics();

  overlay.beginFill(0x000000, 0.01);

  overlay.drawRect(-5000, -5000, 10000, 10000);

  overlay.endFill();

  overlay.eventMode = "static";

  overlay.visible = false;

  overlay.zIndex = 0;

  overlay.on("pointerdown", (e) => {
    e.stopPropagation();
    closePanel();
  });

  rootContainer.addChild(overlay);

  // ─────────────────────────────────────────────────────────────
  // Menu button
  // ─────────────────────────────────────────────────────────────
  const menuBtnContainer = new PIXI.Container();

  menuBtnContainer.eventMode = "static";

  menuBtnContainer.cursor = "pointer";

  menuBtnContainer.zIndex = 2;

  // Slightly larger hit area than the visual circle so mis-taps
  // near the edge on phone still register.
  const MENU_BTN_HIT_PADDING = isTouchLike ? 8 : 0;
  menuBtnContainer.hitArea = new PIXI.Rectangle(
    -MENU_BTN_HIT_PADDING,
    -MENU_BTN_HIT_PADDING,
    MENU_BTN_SIZE + MENU_BTN_HIT_PADDING * 2,
    MENU_BTN_SIZE + MENU_BTN_HIT_PADDING * 2,
  );

  const menuBtnBg = new PIXI.Graphics();

  menuBtnBg.lineStyle(2, 0x3aa8e8, 0.6);

  menuBtnBg.beginFill(0x0a2240, 0.85);

  menuBtnBg.drawCircle(
    MENU_BTN_SIZE / 2,
    MENU_BTN_SIZE / 2,
    MENU_BTN_SIZE / 2,
  );

  menuBtnBg.endFill();

  menuBtnContainer.addChild(menuBtnBg);

  // ✅ WEBP frame
  const menuIconTex = getFrameTexture("menu.webp");
  const menuBackIconTex = getFrameTexture("arrow_back.webp");

  const menuIcon = new PIXI.Sprite(menuIconTex);

  menuIcon.anchor.set(0.5);

  menuIcon.position.set(
    MENU_BTN_SIZE / 2,
    MENU_BTN_SIZE / 2,
  );

  const menuIconSize = MENU_BTN_SIZE * MENU_ICON_FILL_RATIO;

  menuIcon.width = menuIconSize;

  menuIcon.height = menuIconSize;

  menuBtnContainer.addChild(menuIcon);

  rootContainer.addChild(menuBtnContainer);

  // ─────────────────────────────────────────────────────────────
  // Panel
  // ─────────────────────────────────────────────────────────────
  const panel = new PIXI.Container();

  panel.alpha = 0;

  panel.visible = false;

  panel.zIndex = 1;

  // Positive offset pushes the panel further down from the button's
  // vertical center. Increase this to move it down more, decrease
  // (or make negative) to move it back up.
  // Only used in the desktop (right-opening) layout below.
  const PANEL_VERTICAL_OFFSET = isTouchLike ? 60 : 40;

  if (isTouchLike) {
    // ── Top-right anchor (iPhone) ──
    // The button itself will be placed at the top-right of the
    // screen by whoever positions rootContainer. From there, the
    // panel must open DOWN and to the LEFT of the button, or it
    // will run off the right edge of the viewport.
    panel.position.set(
      -panelW - 10, // left of the button
      0,            // top-aligned with the button
    );
  } else {
    // ── Default desktop layout ──
    // Panel opens to the right of the button, vertically centered
    // (with an offset to nudge it down a bit).
    panel.position.set(
      MENU_BTN_SIZE + 10,
      -(panelH / 2) + MENU_BTN_SIZE / 2 + PANEL_VERTICAL_OFFSET,
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Background
  // ─────────────────────────────────────────────────────────────
  const bgTex = getFrameTexture("Background.webp");

  if (bgTex !== PIXI.Texture.EMPTY) {
    const bgSprite = new PIXI.Sprite(bgTex);

    bgSprite.width = panelW;

    bgSprite.height = panelH;

    bgSprite.eventMode = "static";

    bgSprite.on("pointerdown", (e) => e.stopPropagation());

    panel.addChild(bgSprite);
  } else {
    const fallback = new PIXI.Graphics();

    fallback.lineStyle(2, 0x3aa8e8, 0.7);

    fallback.beginFill(0x051928, 0.92);

    fallback.drawRoundedRect(0, 0, panelW, panelH, 20);

    fallback.endFill();

    fallback.eventMode = "static";

    fallback.on("pointerdown", (e) => e.stopPropagation());

    panel.addChild(fallback);
  }

  // ─────────────────────────────────────────────────────────────
  // Glow line
  // ─────────────────────────────────────────────────────────────
  const panelGlow = new PIXI.Graphics();

  panelGlow.lineStyle(1.5, 0x3aa8e8, 0.35);

  panelGlow.moveTo(18, 1);

  panelGlow.lineTo(panelW - 18, 1);

  panel.addChild(panelGlow);

  // ─────────────────────────────────────────────────────────────
  // Icon buttons
  // ─────────────────────────────────────────────────────────────
  menuItems.forEach((item, i) => {
    const btnContainer = new PIXI.Container();

    btnContainer.eventMode = "static";

    btnContainer.cursor = "pointer";

    // Larger hit area than the visual circle for touch, same trick
    // as the main menu button.
    const ITEM_HIT_PADDING = isTouchLike ? 6 : 0;
    btnContainer.hitArea = new PIXI.Rectangle(
      -ITEM_HIT_PADDING,
      -ITEM_HIT_PADDING,
      ICON_SIZE + ITEM_HIT_PADDING * 2,
      ICON_SIZE + ITEM_HIT_PADDING * 2,
    );

    btnContainer.position.set(
      PADDING_X,
      PADDING_Y + i * (ICON_SIZE + ICON_GAP),
    );

    // circle bg
    const circleBg = new PIXI.Graphics();

    circleBg.lineStyle(1.5, 0x3aa8e8, 0.45);

    circleBg.beginFill(0x0a2240, 0.75);

    circleBg.drawCircle(
      ICON_SIZE / 2,
      ICON_SIZE / 2,
      ICON_SIZE / 2,
    );

    circleBg.endFill();

    btnContainer.addChild(circleBg);

    // icon
    const iconTex = getFrameTexture(item.frame);

    const iconSprite = new PIXI.Sprite(iconTex);

    iconSprite.anchor.set(0.5);

    iconSprite.position.set(
      ICON_SIZE / 2,
      ICON_SIZE / 2,
    );

    const itemIconSize = ICON_SIZE * ITEM_ICON_FILL_RATIO;

    iconSprite.width = itemIconSize;

    iconSprite.height = itemIconSize;

    btnContainer.addChild(iconSprite);

    if (!isTouchLike) {
      btnContainer.on("pointerover", () => {
        gsap.to(btnContainer.scale, {
          x: 1.1,
          y: 1.1,
          duration: 0.12,
        });
      });

      btnContainer.on("pointerout", () => {
        gsap.to(btnContainer.scale, {
          x: 1,
          y: 1,
          duration: 0.12,
        });
      });
    }

    // click
    btnContainer.on("pointerdown", (e) => {
      e.stopPropagation();

      gsap.fromTo(
        btnContainer.scale,
        {
          x: 0.85,
          y: 0.85,
        },
        {
          x: 1,
          y: 1,
          duration: 0.2,
          ease: "back.out(2)",
        },
      );

      closePanel();

      item.onClick();
    });

    panel.addChild(btnContainer);
  });

  rootContainer.addChild(panel);

  // ─────────────────────────────────────────────────────────────
  // Toggle logic
  // ─────────────────────────────────────────────────────────────
  let isOpen = false;

  function setMenuButtonIcon(open: boolean) {
    menuIcon.texture = open ? menuBackIconTex : menuIconTex;
  }

  function openPanel() {
    isOpen = true;
    setMenuButtonIcon(true);

    overlay.visible = true;

    panel.visible = true;

    panel.scale.set(0.8);

    gsap.to(panel, {
      alpha: 1,
      duration: 0.2,
    });

    gsap.to(panel.scale, {
      x: 1,
      y: 1,
      duration: 0.22,
      ease: "back.out(1.5)",
    });
  }

  function closePanel() {
    isOpen = false;
    setMenuButtonIcon(false);

    overlay.visible = false;

    gsap.to(panel, {
      alpha: 0,
      duration: 0.15,
      onComplete: () => {
        if (!panel.destroyed) {
          panel.visible = false;
        }
      },
    });

    gsap.to(panel.scale, {
      x: 0.8,
      y: 0.8,
      duration: 0.15,
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Menu button events
  // ─────────────────────────────────────────────────────────────
  menuBtnContainer.on("pointerdown", (e) => {
    e.stopPropagation();

    gsap.fromTo(
      menuBtnContainer.scale,
      {
        x: 0.88,
        y: 0.88,
      },
      {
        x: 1,
        y: 1,
        duration: 0.18,
        ease: "back.out(2)",
      },
    );

    isOpen ? closePanel() : openPanel();
  });

  if (!isTouchLike) {
    menuBtnContainer.on("pointerover", () => {
      gsap.to(menuBtnContainer.scale, {
        x: 1.1,
        y: 1.1,
        duration: 0.15,
      });
    });

    menuBtnContainer.on("pointerout", () => {
      gsap.to(menuBtnContainer.scale, {
        x: 1,
        y: 1,
        duration: 0.15,
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Destroy
  // ─────────────────────────────────────────────────────────────
  function destroy() {
    overlay.removeAllListeners();

    menuBtnContainer.removeAllListeners();

    gsap.killTweensOf(panel);

    gsap.killTweensOf(panel.scale);

    gsap.killTweensOf(menuBtnContainer.scale);

    rootContainer.destroy({
      children: true,
    });
  }

  return {
    container: rootContainer,
    openPanel,
    closePanel,
    destroy,
  };
}