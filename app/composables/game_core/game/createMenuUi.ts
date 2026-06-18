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

    const frameData =
      atlasData.frames?.[frameName] 
      // atlasData.frames?.[frameName.replace(/\.png$/, ".webp")] ??
      // atlasData.frames?.[frameName.replace(/\.webp$/, ".png")] ??
      // atlasData.frames?.[`${frameName}.webp`] ??
      // atlasData.frames?.[`${frameName}.png`];

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
  // ─────────────────────────────────────────────────────────────
  const MENU_BTN_SIZE = 64;

  const ICON_SIZE = 56;

  const ICON_GAP = 12;

  const PADDING_X = 20;

  const PADDING_Y = 20;

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

  menuIcon.width = MENU_BTN_SIZE - 20;

  menuIcon.height = MENU_BTN_SIZE - 20;

  menuBtnContainer.addChild(menuIcon);

  rootContainer.addChild(menuBtnContainer);

  // ─────────────────────────────────────────────────────────────
  // Panel
  // ─────────────────────────────────────────────────────────────
  const panel = new PIXI.Container();

  panel.alpha = 0;

  panel.visible = false;

  panel.zIndex = 1;

  panel.position.set(
    MENU_BTN_SIZE + 10,
    -(panelH / 2) + MENU_BTN_SIZE / 2,
  );

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

    iconSprite.width = ICON_SIZE - 14;

    iconSprite.height = ICON_SIZE - 14;

    btnContainer.addChild(iconSprite);

    // hover
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
