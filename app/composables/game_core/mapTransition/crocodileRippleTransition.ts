import * as PIXI from "pixi.js";
import type { StageTransitionRunner } from "./types";
import { runBossBannerSequence } from "./bossBannerRunner";
import {
  createCrocodileBossBanner,
  installBossOddFont,
  type LocalizedTextureGetter,
} from "./bossBanner";

const RIPPLE_VERT = `
  attribute vec2 aVertexPosition;
  attribute vec2 aTextureCoord;
  uniform mat3 projectionMatrix;
  varying vec2 vTextureCoord;
  varying vec2 vUV;
  uniform vec2 uScreenSize;

  void main(void) {
    vec3 pos = projectionMatrix * vec3(aVertexPosition, 1.0);
    gl_Position = vec4(pos.xy, 0.0, 1.0);
    vTextureCoord = aTextureCoord;
    // convert clip space (-1..1) to UV (0..1)
    vUV = vec2(pos.x * 0.5 + 0.5, -pos.y * 0.5 + 0.5);
  }
`;

const RIPPLE_FRAG = `
  precision mediump float;
  varying vec2 vTextureCoord;
  varying vec2 vUV;

  uniform sampler2D uSampler;
  uniform float uProgress;
  uniform float uTime;
  uniform float uRippleStr;
  uniform float uWaveFreq;
  uniform float uFeather;
  uniform vec2  uCentre;
  uniform float uAspect;

  void main(void) {
    vec2 delta = vUV - uCentre;
    delta.x *= uAspect;
    float dist = length(delta);

    vec2 farCorner = vec2(
      max(uCentre.x, 1.0 - uCentre.x) * uAspect,
      max(uCentre.y, 1.0 - uCentre.y)
    );
    float maxR = length(farCorner);
    float wipeR = uProgress * maxR * 1.06;
    float featherR = uFeather * maxR;

    if (dist < wipeR - featherR) {
      gl_FragColor = vec4(0.0);
      return;
    }

    float distN      = dist / maxR;
    float frontDistN = (dist - wipeR) / maxR;
    float phase      = distN * uWaveFreq - uTime * 5.0;

    float envCentre = smoothstep(0.0, 0.05, distN);
    float envFront  = exp(-frontDistN * frontDistN * 300.0);
    float envTrail  = exp(-max(0.0, frontDistN - 0.004) * 200.0) * 0.4;
    float envelope  = (envFront + envTrail) * envCentre;
    float wave      = sin(phase) * envelope * uRippleStr;

    vec2 dir = normalize(delta + 0.00001);
    dir.x /= uAspect;
    vec2 distortedUV = clamp(vTextureCoord + dir * wave, 0.001, 0.999);

    vec4 scene = texture2D(uSampler, distortedUV);

    float alpha = smoothstep(wipeR - featherR, wipeR + featherR * 0.3, dist);
    float crest = envFront * max(0.0, sin(phase)) * 0.3;
    scene.rgb += crest;

    gl_FragColor = vec4(scene.rgb, scene.a * alpha);
  }
`;

class CrocodileRippleWipeFilter extends PIXI.Filter {
  private _startTime: number = performance.now();

  constructor(aspect: number) {
    super(RIPPLE_VERT, RIPPLE_FRAG, {
      uProgress: 0,
      uTime: 0,
      uCentre: [0.5, 0.5],
      uAspect: aspect,
      uRippleStr: 0.028,
      uWaveFreq: 22.0,
      uFeather: 0.012,
    });
  }

  get progress(): number {
    return this.uniforms.uProgress;
  }
  set progress(v: number) {
    this.uniforms.uProgress = v;
  }
  updateTime(): void {
    this.uniforms.uTime = (performance.now() - this._startTime) / 1000;
  }
}

export interface CrocodileRippleTransitionOptions {
  app: PIXI.Application;
  currentScene: PIXI.DisplayObject;
  targetLayer: PIXI.Container;
  nextScene: PIXI.DisplayObject;
  durationMs?: number;
  onComplete?: () => void;
}

// crocodileRippleTransition.ts
export function runCrocodileRippleRevealTransition(
  options: CrocodileRippleTransitionOptions,
): void {
  const {
    app,
    currentScene,
    targetLayer,
    nextScene,
    durationMs = 1200,
    onComplete,
  } = options;
  const { renderer, ticker } = app;

  const W = Math.max(1, Math.round(renderer.width));
  const H = Math.max(1, Math.round(renderer.height));

  const sceneRoot = targetLayer.parent as PIXI.Container;

  const rt = PIXI.RenderTexture.create({
    width: W,
    height: H,
    resolution: renderer.resolution,
  });

  const siblingVisibility = new Map<PIXI.DisplayObject, boolean>();
  for (const child of sceneRoot.children) {
    siblingVisibility.set(child, child.visible);
    child.visible = child === targetLayer;
  }

  const stageParent = sceneRoot.parent as PIXI.Container;
  const stageVisibility = new Map<PIXI.DisplayObject, boolean>();
  for (const child of stageParent.children) {
    stageVisibility.set(child, child.visible);
    child.visible = child === sceneRoot;
  }

  renderer.render(app.stage, { renderTexture: rt, clear: true });

  for (const [child, wasVisible] of siblingVisibility) {
    child.visible = wasVisible;
  }
  for (const [child, wasVisible] of stageVisibility) {
    child.visible = wasVisible;
  }

  if (nextScene.parent) {
    nextScene.parent.removeChild(nextScene);
  }
  nextScene.visible = true;
  nextScene.alpha = 1;
  targetLayer.addChildAt(nextScene, 0);

  currentScene.visible = false;

  const wipeSprite = new PIXI.Sprite(rt);
  wipeSprite.position.set(0, 0);
  wipeSprite.width = W;
  wipeSprite.height = H;

  const rippleFilter = new CrocodileRippleWipeFilter(W / H);
  wipeSprite.filters = [rippleFilter];


  const bgIndex = sceneRoot.getChildIndex(targetLayer);
  sceneRoot.addChildAt(wipeSprite, bgIndex + 1);

  const startTime = performance.now();

  const tick = () => {
    const t = Math.min((performance.now() - startTime) / durationMs, 1);
    rippleFilter.progress = t;
    rippleFilter.updateTime();

    if (t > 0.9) wipeSprite.alpha = Math.max(0, 1 - (t - 0.9) / 0.1);

    if (t >= 1) {
      ticker.remove(tick);

      if (wipeSprite.parent) {
        wipeSprite.parent.removeChild(wipeSprite);
      }
      wipeSprite.filters = null;
      wipeSprite.destroy();
      rt.destroy(true);

      currentScene.visible = false;
      nextScene.alpha = 1;
      onComplete?.();
    }
  };

  ticker.add(tick);
}

export function makeCrocodileRippleTransitionRunner(
  app: PIXI.Application,
  backgroundLayer: PIXI.Container,
  bannerLayer: PIXI.Container,
  width: number,
  height: number,
  getLocalizedTexture: LocalizedTextureGetter,
  lang: "en" | "km" = "km",
  applyChildScale?: (child: PIXI.DisplayObject) => void,
): StageTransitionRunner {
  return ({ currentScene, nextScene, onComplete }) => {
    void (async () => {
      await installBossOddFont();

      const RIPPLE_DURATION = 1200;
      const banner = createCrocodileBossBanner(
        width,
        height,
        getLocalizedTexture,
        lang,
      );

      runBossBannerSequence({
        app,
        bannerLayer,
        banner,
        holdMs: 2000,
        fadeInMs: 300,
        burnDurationMs: RIPPLE_DURATION,
        onHoldComplete: () => {
          runCrocodileRippleRevealTransition({
            app,
            currentScene,
            targetLayer: backgroundLayer,
            nextScene,
            durationMs: RIPPLE_DURATION,
            onComplete,
          });
        },
        onComplete: () => {},
        applyChildScale,
        gameWidth: width,
      });
    })().catch((error) => {
      console.error("[transition] failed to install boss odd font", error);
      onComplete?.();
    });
  };
}
