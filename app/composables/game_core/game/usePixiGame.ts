// import * as PIXI from "pixi.js";

// export function usePixiGame() {
//   let app: PIXI.Application | null = null;

//   const init = async (canvas: HTMLDivElement): Promise<PIXI.Application> => {
//     app = new PIXI.Application({
//       resizeTo: canvas,

//       backgroundColor: 0x0a0a1a,
//       backgroundAlpha: 1,

//       // Performance
//       antialias: false,
//       resolution: 1,
//       autoDensity: true,
//       powerPreference: "high-performance",

//       // Ticker
//       sharedTicker: true,
//     });

//     canvas.appendChild(app.view as HTMLCanvasElement);

//     return app;
//   };

//   return {
//     init,
//   };
// }

import * as PIXI from "pixi.js";

export function usePixiGame() {
  let app: PIXI.Application | null = null;
  let resizeObserver: ResizeObserver | null = null;
  let resizeRaf = 0;

  const init = async (canvas: HTMLDivElement): Promise<PIXI.Application> => {
    app = new PIXI.Application({
      // Fix the initial size explicitly instead of resizeTo — we'll drive
      // resize manually with debouncing (see below).
      width: canvas.clientWidth,
      height: canvas.clientHeight,

      backgroundColor: 0x0a0a1a,
      backgroundAlpha: 1,

      // Performance
      antialias: false,
      resolution: 2,
      autoDensity: true,
      powerPreference: "high-performance",

      // Ticker
      sharedTicker: true,
    });

    canvas.appendChild(app.view as HTMLCanvasElement);

    // ── Debounced resize (avoids backbuffer thrash from iOS address-bar animation) ──
    resizeObserver = new ResizeObserver(() => {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      resizeRaf = requestAnimationFrame(() => {
        if (!app) return;
        const w = canvas.clientWidth;
        const h = canvas.clientHeight;
        // Skip no-op resizes (fires constantly during iOS bar animation)
        if (app.renderer.width === w && app.renderer.height === h) return;
        app.renderer.resize(w, h);
      });
    });
    resizeObserver.observe(canvas);

    // ── WebGL context loss/restore ──
    const glView = app.view as HTMLCanvasElement;
    glView.addEventListener(
      "webglcontextlost",
      (e) => {
        e.preventDefault();
        console.warn("[pixi] WebGL context lost");
      },
      false,
    );
    glView.addEventListener(
      "webglcontextrestored",
      () => {
        console.warn("[pixi] WebGL context restored");
        // Textures/render state need rebuilding here if this fires in practice —
        // worth wiring to your asset-reload path if you see this in the wild.
      },
      false,
    );

    // ── Avoid a big catch-up burst right after backgrounding ──
    document.addEventListener("visibilitychange", () => {
      if (!app) return;
      if (document.hidden) {
        app.ticker.stop();
      } else {
        app.ticker.start();
      }
    });

    return app;
  };

  const destroy = () => {
    resizeObserver?.disconnect();
    resizeObserver = null;
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    app?.destroy(true, { children: true, texture: true, baseTexture: true });
    app = null;
  };

  return {
    init,
    destroy,
  };
}
