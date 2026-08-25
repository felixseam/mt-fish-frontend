import * as PIXI from "pixi.js";

export interface BossBannerRunnerOptions {
  app: PIXI.Application;
  bannerLayer: PIXI.Container;
  banner: PIXI.Container;
  holdMs?: number;
  fadeInMs?: number;
  burnDurationMs?: number;
  onHoldComplete: () => void;
  onComplete: () => void;
  applyChildScale?: (child: PIXI.DisplayObject) => void;
  gameWidth?: number;
}

export function runBossBannerSequence(options: BossBannerRunnerOptions): void {
  const {
    app,
    bannerLayer,
    banner,
    holdMs = 2000,
    fadeInMs = 300,
    burnDurationMs = 2000,
    onHoldComplete,
    onComplete,
    
  } = options;

  bannerLayer.removeChildren();
  bannerLayer.addChild(banner);
  const bg = banner.children[0] as PIXI.Container;
  const content = banner.children[1] as PIXI.Container;

  if (options.applyChildScale) {
    options.applyChildScale(bg);
    options.applyChildScale(content);
    const childScaleX = (content as PIXI.Container).scale.x;
    console.log("banner width:===============", bannerLayer.width);
    (banner as any).__setFullWidth?.(options.gameWidth, childScaleX);
  }

  banner.alpha = 0;

  let elapsed = 0;
  let transitionStarted = false;
  let burnElapsed = 0;
  let bannerFadeTick: (() => void) | null = null;

  const bannerTick = () => {
    elapsed += app.ticker.elapsedMS;
    banner.alpha = Math.min(1, elapsed / fadeInMs);

    if (elapsed >= holdMs && !transitionStarted) {
      transitionStarted = true;
      app.ticker.remove(bannerTick);

      onHoldComplete();
      bannerFadeTick = () => {
        burnElapsed += app.ticker.elapsedMS;
        const t = Math.min(burnElapsed / burnDurationMs, 1);
        const holdFade = t < 0.18 ? 1 : Math.max(0, 1 - (t - 0.18) / 0.34);
        banner.alpha = holdFade;

        if (t >= 1) {
          app.ticker.remove(bannerFadeTick!);
          cleanup();
          onComplete();
        }
      };
      app.ticker.add(bannerFadeTick);
    }
  };

  app.ticker.add(bannerTick);

  function cleanup() {
    if (bannerFadeTick) {
      app.ticker.remove(bannerFadeTick);
      bannerFadeTick = null;
    }
    if (banner.parent) banner.parent.removeChild(banner);
    if (!banner.destroyed) banner.destroy({ children: true });
  }
}
