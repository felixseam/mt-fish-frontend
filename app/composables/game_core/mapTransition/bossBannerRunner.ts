import * as PIXI from "pixi.js";

export interface BossBannerRunnerOptions {
  app: PIXI.Application;
  bannerLayer: PIXI.Container;
  banner: PIXI.Container;
  holdMs?: number;
  fadeInMs?: number;
  burnDurationMs?: number;
  onHoldComplete: () => void; // called when hold is done → start transition
  onComplete: () => void; // called when banner fully faded out
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

  // clear any leftover banner
  bannerLayer.removeChildren();
  bannerLayer.addChild(banner);
  const bg = banner.children[0] as PIXI.Container;
  const content = banner.children[1] as PIXI.Container;

  if (options.applyChildScale) {
    // ✅ apply uniform scale to BOTH bg and content
    options.applyChildScale(bg);
    options.applyChildScale(content);

    // ✅ then expand bg band width to fill full screen
    // band.width * childScaleX * bannerLayer.scaleX = GAME_WIDTH * bannerLayer.scaleX
    // so band.width = GAME_WIDTH / childScaleX
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

      // ✅ Start transition
      onHoldComplete();

      // ✅ Fade banner out in sync with burn
      bannerFadeTick = () => {
        burnElapsed += app.ticker.elapsedMS;
        const t = Math.min(burnElapsed / burnDurationMs, 1);
        // const fadeIn = Math.min(1, t / 0.08);
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
