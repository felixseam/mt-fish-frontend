import * as PIXI from "pixi.js";
import { useFishAssetPreload } from "~/composables/game_core/assets/useFishAssetPreload";

const TOP_FRAME = "bossfont_01.png";
const ODD_FONT_URL = "/fish/fish-all-star/resources/fnt/fnt_odd/fnt_odd.fnt";
const ODD_FONT_NAME = "fnt_odd";

export type LocalizedTextureGetter = (
  lang: "en" | "km",
  frame: string,
) => PIXI.Texture;

export async function installBossOddFont(): Promise<void> {
  if (PIXI.BitmapFont.available[ODD_FONT_NAME]) return;

  const { preloadBitmapFont } = useFishAssetPreload();
  await preloadBitmapFont(ODD_FONT_URL);
}

export const installPhoenixOddFont = installBossOddFont;

export interface BossBannerConfig {
  nameFrame: string; // atlas frame for boss name image
  oddText: string; // multiplier text e.g. "20X~800X"
  glowColor: number; // glow tint e.g. 0xffa14a
}

export const BOSS_BANNER_CONFIGS: Record<string, BossBannerConfig> = {
  phoenix: {
    nameFrame: "bossname_07.png",
    oddText: "20X~800X",
    glowColor: 0xff6600, // orange-red for phoenix
  },
  naga: {
    nameFrame: "bossname_08.png",
    oddText: "10X~500X",
    glowColor: 0x00ffaa, // teal-green for naga
  },
  crocodileBoss: {
    nameFrame: "bossname_03.png",
    oddText: "15X~600X",
    glowColor: 0x44aaff, // blue for crocodile
  },
} as const satisfies Record<string, BossBannerConfig>;

function createBannerBackground(
  width: number,
  glowColor: number,
): {
  container: PIXI.Container;
  setFullWidth: (screenWidth: number, childScaleX: number) => void;
} {
  const container = new PIXI.Container();

  const bandHeight = 330;

  const r = (glowColor >> 16) & 0xff;
  const g = (glowColor >> 8) & 0xff;
  const b = glowColor & 0xff;

  const canvas = document.createElement("canvas");
  canvas.width = 8;
  canvas.height = bandHeight;
  const ctx = canvas.getContext("2d")!;

  // ── Top half: high opacity at top edge → fades to transparent at center ───
  const topGrad = ctx.createLinearGradient(0, 0, 0, bandHeight * 0.5);
  topGrad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.95)`);
  topGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, 8, bandHeight * 0.5);

  // ── Bottom half: high opacity at bottom edge → fades to transparent at center
  const botGrad = ctx.createLinearGradient(0, bandHeight * 0.5, 0, bandHeight);
  botGrad.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
  botGrad.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.95)`);
  ctx.fillStyle = botGrad;
  ctx.fillRect(0, bandHeight * 0.5, 8, bandHeight * 0.5);

  // ── Top shine: white glow at the top edge (peak of top gradient) ──────────
  const topShine = ctx.createLinearGradient(0, 0, 0, bandHeight * 0.12);
  topShine.addColorStop(0.0, "rgba(255,255,255,0.7)");
  topShine.addColorStop(1.0, "rgba(255,255,255,0.0)");
  ctx.fillStyle = topShine;
  ctx.fillRect(0, 0, 8, bandHeight * 0.12);

  // ── Bottom shine: white glow at the bottom edge (peak of bottom gradient) ─
  const botShine = ctx.createLinearGradient(
    0,
    bandHeight * 0.88,
    0,
    bandHeight,
  );
  botShine.addColorStop(0.0, "rgba(255,255,255,0.0)");
  botShine.addColorStop(1.0, "rgba(255,255,255,0.7)");
  ctx.fillStyle = botShine;
  ctx.fillRect(0, bandHeight * 0.88, 8, bandHeight * 0.12);

  const bandTexture = PIXI.Texture.from(canvas);
  const band = new PIXI.Sprite(bandTexture);
  band.anchor.set(0, 0.5);
  band.position.set(-width / 2, 0);
  band.width = width;
  band.height = bandHeight;
  // band.anchor.set(0.5);
  // band.position.set(0, 0);

  // // ── Outer bloom ───────────────────────────────────────────────────────────
  // const bloomCanvas = document.createElement("canvas");
  // bloomCanvas.width = 8;
  // bloomCanvas.height = bandHeight + 80;
  // const bctx = bloomCanvas.getContext("2d")!;

  // // Top bloom
  // const bloomTop = bctx.createLinearGradient(0, 0, 0, (bandHeight + 80) * 0.5);
  // bloomTop.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.3)`);
  // bloomTop.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
  // bctx.fillStyle = bloomTop;
  // bctx.fillRect(0, 0, 8, (bandHeight + 80) * 0.5);

  // // Bottom bloom
  // const bloomBot = bctx.createLinearGradient(
  //   0,
  //   (bandHeight + 80) * 0.5,
  //   0,
  //   bandHeight + 80,
  // );
  // bloomBot.addColorStop(0.0, `rgba(${r}, ${g}, ${b}, 0.0)`);
  // bloomBot.addColorStop(1.0, `rgba(${r}, ${g}, ${b}, 0.3)`);
  // bctx.fillStyle = bloomBot;
  // bctx.fillRect(0, (bandHeight + 80) * 0.5, 8, (bandHeight + 80) * 0.5);

  // const bloomTexture = PIXI.Texture.from(bloomCanvas);
  // const bloom = new PIXI.Sprite(bloomTexture);
  // bloom.width = width;
  // bloom.height = bandHeight + 80;
  // bloom.anchor.set(0.5);
  // bloom.blendMode = PIXI.BLEND_MODES.ADD;
  // bloom.filters = [new PIXI.BlurFilter(12)]; // Shift bloom up so it extends more above the banner
  container.addChild(band);
  console.log("setFullWidth called with 88888", width);
  return {
    container,
    setFullWidth: (gameWidth: number, childScaleX: number) => {
      band.width = gameWidth / childScaleX;
      console.log("setFullWidth called with", gameWidth / childScaleX);

      band.position.set(-(gameWidth / childScaleX) / 2, 0);
    },
  };
}

export function createBossBanner(
  width: number,
  height: number,
  config: BossBannerConfig,
  getLocalizedTexture: LocalizedTextureGetter,
  lang: "en" | "km" = "km",
): PIXI.Container {
  // ✅ outer wrapper — this is what bannerLayer receives and scales
  const wrapper = new PIXI.Container();

  const { container: bgContainer, setFullWidth } = createBannerBackground(
    width,
    config.glowColor,
  );
  bgContainer.position.set(width / 2, height / 2);
  wrapper.addChild(bgContainer);
  (wrapper as any).__setFullWidth = setFullWidth;

  // ── Content: centered container, will receive childScale compensation ─────
  const content = new PIXI.Container();
  content.position.set(width / 2, height / 2);

  const topSprite = new PIXI.Sprite(getLocalizedTexture(lang, TOP_FRAME));
  topSprite.anchor.set(0.5);
  const topScale = Math.min(1, 420 / Math.max(1, topSprite.texture.width));
  topSprite.scale.set(topScale);

  const nameSprite = new PIXI.Sprite(
    getLocalizedTexture(lang, config.nameFrame),
  );
  nameSprite.anchor.set(0.5);
  const nameScale = Math.min(
    2,
    520 / Math.max(1, nameSprite.texture.width),
    110 / Math.max(1, nameSprite.texture.height),
  );
  nameSprite.scale.set(nameScale);

  const oddText = new PIXI.BitmapText(config.oddText, {
    fontName: ODD_FONT_NAME,
    fontSize: 32,
    align: "center",
  });
  oddText.anchor.set(0.5);
  oddText.updateText();

  const spacing = 4;
  const topH = topSprite.texture.height * topScale;
  const nameH = nameSprite.texture.height * nameScale;

  const totalH = topH + spacing + nameH + spacing + oddText.textHeight;
  const startY = -totalH / 2 + 10;

  topSprite.position.set(0, startY);
  nameSprite.position.set(0, startY + topH + spacing);
  oddText.position.set(0, startY + topH + spacing * 2 + nameH / 2);

  content.addChild(topSprite, nameSprite, oddText);
  wrapper.addChild(content);

  wrapper.alpha = 0;

  // ── Animate oddText scale ─────────────────────────────────────────────────
  const SCALE_MIN = 0.9;
  const SCALE_MAX = 1.0;
  const SCALE_SPEED = 0.0005;
  let scaleDir = 1;
  let oddScale = SCALE_MIN;
  let lastTime = performance.now();

  const animateTick = () => {
    const now = performance.now();
    const dt = now - lastTime;
    lastTime = now;
    oddScale += SCALE_SPEED * dt * scaleDir;
    if (oddScale >= SCALE_MAX) {
      oddScale = SCALE_MAX;
      scaleDir = -1;
    } else if (oddScale <= SCALE_MIN) {
      oddScale = SCALE_MIN;
      scaleDir = 1;
    }
    oddText.scale.set(oddScale);
  };

  (wrapper as any)._oddAnimateTick = animateTick;
  PIXI.Ticker.shared.add(animateTick);
  wrapper.on("destroyed", () => {
    PIXI.Ticker.shared.remove(animateTick);
  });

  return wrapper;
}

// ✅ Convenience per-boss functions
export function createPhoenixBossBanner(
  width: number,
  height: number,
  getLocalizedTexture: LocalizedTextureGetter,
  lang: "en" | "km" = "km",
): PIXI.Container {
  return createBossBanner(
    width,
    height,
    BOSS_BANNER_CONFIGS.phoenix!,
    getLocalizedTexture,
    lang,
  );
}

export function createNagaBossBanner(
  width: number,
  height: number,
  getLocalizedTexture: LocalizedTextureGetter,
  lang: "en" | "km" = "km",
): PIXI.Container {
  return createBossBanner(
    width,
    height,
    BOSS_BANNER_CONFIGS.naga!,
    getLocalizedTexture,
    lang,
  );
}

export function createCrocodileBossBanner(
  width: number,
  height: number,
  getLocalizedTexture: LocalizedTextureGetter,
  lang: "en" | "km" = "km",
): PIXI.Container {
  return createBossBanner(
    width,
    height,
    BOSS_BANNER_CONFIGS.crocodileBoss!,
    getLocalizedTexture,
    lang,
  );
}
