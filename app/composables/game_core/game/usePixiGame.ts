import * as PIXI from "pixi.js";

export function usePixiGame() {
  let app: PIXI.Application;

  const init = async (canvas: HTMLDivElement): Promise<PIXI.Application> => {
    app = new PIXI.Application({
      resizeTo: canvas,
      backgroundColor: 0x0a0a1a,
      antialias: true,
    });

    canvas.appendChild(app.view as HTMLCanvasElement);
    return app;
  };

  return { init };
}