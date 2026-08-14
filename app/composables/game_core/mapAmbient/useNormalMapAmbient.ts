import * as PIXI from "pixi.js";

type TextureGetter = (url: string) => PIXI.Texture;
type EffectTextureGetter = (frame: string) => PIXI.Texture;
type BackgroundSource = PIXI.Texture | PIXI.Sprite | null;

type NormalAmbientTuning = {
  waveStrength?: number;
  scrollSpeed?: number;
  bubbleAlpha?: number;
  bubbleScale?: number;
  bubbleSpeed?: number;
};

export type WaterOverlayOptions = {
  app: PIXI.Application;
  getTexture: TextureGetter;
  width?: number;
  height?: number;
  waveStrength?: number;
  scrollSpeed?: number;
};

const NORMAL_MAP_URL = "/fish/fish-all-star/resources/shader/normap.png";
const BUBBLE_FRAME = "particle/bubble.png";

// ─── Shader ───────────────────────────────────────────────────────────────────
//
// Goal: match the reference video — the background keeps its ORIGINAL colors
// completely. The effect only adds:
//   1. A very faint dark-teal vignette toward the screen edges (depth feeling)
//   2. Tiny moving caustic shimmer lines (NOT a color-grade blob)
//   3. Gentle UV warp so the scene breathes slightly like water
//
// The old mistake was using uAlpha ~0.72 to draw the scene texture ON TOP of
// itself with heavy color shifts, creating a yellow-green glow. Here uAlpha
// is kept very low (0.08) so the overlay barely tints — original art shows
// through unchanged.
//
const WAVE_FRAG = `
  precision mediump float;

  varying vec2 vTextureCoord;

  uniform sampler2D uSampler;
  uniform sampler2D uNormalMap;
  uniform vec2 uOffset;
  uniform vec2 uOffset2;
  uniform float uStrength;
  uniform float uTime;

  void main(void) {
    // ── Dual normal-map samples scrolling in different directions ────────────
    vec2 uv1 = fract(vTextureCoord * vec2(3.1, 1.8) + uOffset);
    vec3 n1   = texture2D(uNormalMap, uv1).xyz * 2.0 - 1.0;

    vec2 uv2 = fract(vTextureCoord * vec2(1.6, 2.4) + uOffset2);
    vec3 n2   = texture2D(uNormalMap, uv2).xyz * 2.0 - 1.0;

    vec3 n = normalize(n1 * 0.6 + n2 * 0.4);

    // ── Very subtle UV warp so the scene "breathes" ──────────────────────────
    vec2 warpedUv = clamp(vTextureCoord + n.xz * uStrength, 0.001, 0.999);
    vec4 scene = texture2D(uSampler, warpedUv);

    // ── Soft caustic shimmer: bright lines where wave normals align ──────────
    // Kept very faint so it reads as underwater light, not a color grade
    float caustic = pow(max(dot(n1.xy, n2.xy), 0.0), 5.0) * 0.10;

    // Add as a barely visible cool highlight — doesn't shift base colors
    scene.rgb += vec3(caustic * 0.3, caustic * 0.55, caustic * 0.7);

    // ── Edge vignette: darken toward corners/edges only ──────────────────────
    // This gives the "deep water" feeling without touching the center colors
    vec2 vigUv  = vTextureCoord * 2.0 - 1.0;
    float vignette = 1.0 - dot(vigUv * vec2(0.38, 0.48), vigUv * vec2(0.38, 0.48));
    vignette = clamp(vignette, 0.0, 1.0);
    // Only darken edges, never affect center (multiply stays near 1.0 in center)
    vignette = 0.70 + vignette * 0.30;
    scene.rgb *= vignette;

    gl_FragColor = vec4(scene.rgb, scene.a);
  }
`;

// ─── Filter ───────────────────────────────────────────────────────────────────
class WaveOverlayFilter extends PIXI.Filter {
  constructor(normalTexture: PIXI.Texture) {
    normalTexture.baseTexture.wrapMode = PIXI.WRAP_MODES.REPEAT;
    super(undefined, WAVE_FRAG, {
      uOffset: new Float32Array([0, 0]),
      uOffset2: new Float32Array([0.5, 0.3]),
      uStrength: 0.004,
      uTime: 0,
      uNormalMap: normalTexture,
    });
  }

  setOffset(x: number, y: number, x2: number, y2: number) {
    (this.uniforms.uOffset as Float32Array)[0] = x;
    (this.uniforms.uOffset as Float32Array)[1] = y;
    (this.uniforms.uOffset2 as Float32Array)[0] = x2;
    (this.uniforms.uOffset2 as Float32Array)[1] = y2;
  }

  setStrength(strength: number) {
    this.uniforms.uStrength = strength;
  }
}

// ─── Bubble particle ──────────────────────────────────────────────────────────
type BubbleParticle = {
  sprite: PIXI.Sprite;
  originX: number;
  originY: number;
  dirX: number;
  dirY: number;
  speed: number;
  drift: number;
  scaleBase: number;
  life: number;
  maxLife: number;
};

function wrapUnit(v: number) {
  if (v >= 1) return v - 1;
  if (v <= -1) return v + 1;
  return v;
}

export function createWaterOverlayLayer(options: WaterOverlayOptions) {
  const {
    app,
    getTexture,
    width = 1280,
    height = 720,
    waveStrength = 0.004,
    scrollSpeed = 1,
  } = options;

  const container = new PIXI.Container();
  const overlaySprite = new PIXI.Sprite(PIXI.Texture.WHITE);
  overlaySprite.anchor.set(0.5);
  overlaySprite.position.set(width / 2, height / 2);
  overlaySprite.visible = false;
  container.addChild(overlaySprite);

  const waveFilter = new WaveOverlayFilter(getTexture(NORMAL_MAP_URL));
  waveFilter.setStrength(waveStrength);
  overlaySprite.filters = [waveFilter];
  overlaySprite.filterArea = new PIXI.Rectangle(0, 0, width, height);

  let currentBackgroundTexture: PIXI.Texture | null = null;
  let currentBackgroundSprite: PIXI.Sprite | null = null;
  let snapshotTexture: PIXI.RenderTexture | null = null;
  let offsetX = 0;
  let offsetY = 0;
  let offset2X = 0.5;
  let offset2Y = 0.3;

  function destroySnapshotTexture() {
    if (!snapshotTexture) return;
    snapshotTexture.destroy(true);
    snapshotTexture = null;
  }

  function renderSourceToSnapshot(source: Exclude<BackgroundSource, null>) {
    destroySnapshotTexture();

    snapshotTexture = PIXI.RenderTexture.create({
      width,
      height,
      resolution: app.renderer.resolution,
    });

    let renderTarget: PIXI.DisplayObject;
    let tempSprite: PIXI.Sprite | null = null;

    if (source instanceof PIXI.Sprite) {
      renderTarget = source;
    } else {
      tempSprite = new PIXI.Sprite(source);
      const texW = source.width || width;
      const texH = source.height || height;
      const scale = Math.max(width / texW, height / texH);
      tempSprite.anchor.set(0.5);
      tempSprite.position.set(width / 2, height / 2);
      tempSprite.scale.set(scale);
      renderTarget = tempSprite;
    }

    app.renderer.render(renderTarget, {
      renderTexture: snapshotTexture,
      clear: true,
    });

    tempSprite?.destroy();
    return snapshotTexture;
  }

  function fitOverlayTexture(source: Exclude<BackgroundSource, null>) {
    if (source instanceof PIXI.Sprite) {
      currentBackgroundSprite = source;
      currentBackgroundSprite.filters = [waveFilter];
      currentBackgroundSprite.filterArea = currentBackgroundSprite.getBounds();
      overlaySprite.visible = false;
      return;
    }

    const texture = renderSourceToSnapshot(source);
    if (!texture) {
      overlaySprite.visible = false;
      return;
    }

    overlaySprite.texture = texture;
    overlaySprite.anchor.set(0);
    overlaySprite.position.set(0, 0);
    overlaySprite.scale.set(1);
    overlaySprite.rotation = 0;
    overlaySprite.skew.set(0, 0);
    overlaySprite.visible = true;
  }

  const tick = () => {
    if (!currentBackgroundTexture) return;
    const dt = app.ticker.deltaMS / 1000;

    if (currentBackgroundSprite) {
      currentBackgroundSprite.filterArea = currentBackgroundSprite.getBounds();
    }

    offsetX = wrapUnit(offsetX - 0.1 * scrollSpeed * dt);
    offsetY = wrapUnit(offsetY - 0.07 * scrollSpeed * dt);
    offset2X = wrapUnit(offset2X + 0.07 * scrollSpeed * dt);
    offset2Y = wrapUnit(offset2Y - 0.09 * scrollSpeed * dt);
    waveFilter.setOffset(offsetX, offsetY, offset2X, offset2Y);
  };

  app.ticker.add(tick);

  return {
    container,
    setBackgroundTexture(source: BackgroundSource) {
      if (currentBackgroundSprite) {
        currentBackgroundSprite.filters = null;
        currentBackgroundSprite = null;
      }
      currentBackgroundTexture = source instanceof PIXI.Sprite ? source.texture : source;
      if (!source) {
        overlaySprite.visible = false;
        return;
      }
      fitOverlayTexture(source);
    },
    destroy() {
      app.ticker.remove(tick);
      if (currentBackgroundSprite) {
        currentBackgroundSprite.filters = null;
        currentBackgroundSprite = null;
      }
      destroySnapshotTexture();
      container.destroy({ children: true });
    },
  };
}

// ─── Main export ──────────────────────────────────────────────────────────────
export function createNormalMapAmbient(options: {
  app: PIXI.Application;
  getTexture: TextureGetter;
  getEffectTexture: EffectTextureGetter;
  width?: number;
  height?: number;
  tuning?: NormalAmbientTuning;
}) {
  const {
    app,
    getTexture,
    getEffectTexture,
    width = 1280,
    height = 720,
    tuning = {},
  } = options;

  const waveStrength = tuning.waveStrength ?? 0.004;
  const scrollSpeed = tuning.scrollSpeed ?? 1;
  const bubbleAlphaScale = tuning.bubbleAlpha ?? 1;
  const bubbleScale = tuning.bubbleScale ?? 1;
  const bubbleSpeed = tuning.bubbleSpeed ?? 1;

  const container = new PIXI.Container();
  container.visible = false;
  container.alpha = 0;

  const waterOverlay = createWaterOverlayLayer({
    app,
    getTexture,
    width,
    height,
    waveStrength,
    scrollSpeed,
  });
  container.addChild(waterOverlay.container);

  const bubbleLayer = new PIXI.Container();
  container.addChild(bubbleLayer);

  // ── Bubbles ──────────────────────────────────────────────────────────────────
  // Reference video shows small, sparse bubbles drifting upward — not clusters.
  // We use many emitters but few bubbles each, spread across the full screen.
  const bubbleTexture = getEffectTexture(BUBBLE_FRAME);
  const bubbles: BubbleParticle[] = [];

  const emitters = [
    { x: width * 0.15, y: height * 0.85, dirX: 0.08, dirY: -1.0 },
    { x: width * 0.35, y: height * 0.9, dirX: -0.05, dirY: -1.0 },
    { x: width * 0.55, y: height * 0.8, dirX: 0.12, dirY: -1.0 },
    { x: width * 0.75, y: height * 0.88, dirX: -0.1, dirY: -1.0 },
    { x: width * 0.9, y: height * 0.7, dirX: 0.04, dirY: -1.0 },
    { x: width * 0.25, y: height * 0.55, dirX: 0.06, dirY: -1.0 },
    { x: width * 0.65, y: height * 0.6, dirX: -0.08, dirY: -1.0 },
  ];

  function resetBubble(p: BubbleParticle, immediate = false) {
    const jx = (Math.random() - 0.5) * 100;
    const jy = (Math.random() - 0.5) * 60;
    p.sprite.position.set(p.originX + jx, p.originY + jy);
    p.scaleBase = (0.05 + Math.random() * 0.1) * bubbleScale;
    p.sprite.scale.set(p.scaleBase);
    p.sprite.alpha = immediate ? Math.random() * 0.25 * bubbleAlphaScale : 0;
    p.speed = (18 + Math.random() * 22) * bubbleSpeed;
    p.drift = 4 + Math.random() * 8;
    p.maxLife = 3.5 + Math.random() * 3.0;
    p.life = immediate ? Math.random() * p.maxLife : 0;
  }

  function createBubble(ox: number, oy: number, dx: number, dy: number) {
    const sprite = new PIXI.Sprite(bubbleTexture);
    sprite.anchor.set(0.5);
    sprite.alpha = 0;
    sprite.blendMode = PIXI.BLEND_MODES.SCREEN;
    bubbleLayer.addChild(sprite);

    const p: BubbleParticle = {
      sprite,
      originX: ox,
      originY: oy,
      dirX: dx,
      dirY: dy,
      speed: 0,
      drift: 0,
      scaleBase: 0.08,
      life: 0,
      maxLife: 1,
    };
    resetBubble(p, true);
    bubbles.push(p);
  }

  for (const e of emitters) {
    // 4 bubbles per emitter = sparse, natural look matching the reference
    for (let i = 0; i < 4; i++) createBubble(e.x, e.y, e.dirX, e.dirY);
  }

  // ── State ─────────────────────────────────────────────────────────────────────
  let active = false;
  let fade = 0;

  // ── Tick ──────────────────────────────────────────────────────────────────────
  const tick = () => {
    const dt = app.ticker.deltaMS / 1000;

    const fadeTarget = active ? 1 : 0;
    fade += (fadeTarget - fade) * Math.min(1, dt * 4.5);
    container.alpha = fade;
    container.visible = fade > 0.01;

    if (fade <= 0.001) return;

    // Bubble tick
    for (const b of bubbles) {
      b.life += dt;

      if (b.life >= b.maxLife) {
        resetBubble(b);
        continue;
      }

      const progress = b.life / b.maxLife;
      const sway =
        Math.sin(progress * Math.PI * 2.6 + b.originX * 0.004) * b.drift;
      b.sprite.x += b.dirX * b.speed * dt + sway * dt;
      b.sprite.y += b.dirY * b.speed * dt;

      // Fade in early, hold, fade out near top — max alpha kept low (0.30)
      const alpha =
        progress < 0.2
          ? progress / 0.2
          : progress < 0.75
            ? 1.0
            : 1.0 - (progress - 0.75) / 0.25;
      b.sprite.alpha = alpha * 0.3 * bubbleAlphaScale;

      b.sprite.scale.set(b.scaleBase * (0.88 + progress * 0.28));
    }
  };

  app.ticker.add(tick);

  return {
    container,
    setBackgroundTexture(source: BackgroundSource) {
      waterOverlay.setBackgroundTexture(source);
    },
    setActive(nextActive: boolean) {
      active = nextActive;
    },
    destroy() {
      app.ticker.remove(tick);
      waterOverlay.destroy();
      container.destroy({ children: true });
    },
  };
}
