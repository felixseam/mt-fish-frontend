<template>
    <div style="display: flex; height: 100vh; background: #0d0d1a; color: #fff; font-family: sans-serif">
        <!-- Canvas -->
        <div style="flex: 1; position: relative">
            <canvas ref="canvasRef" style="display: block" />
            <!-- Crosshair -->
            <div style="
          position: absolute;
          pointer-events: none;
          transform: translate(-50%, -50%);
          width: 16px;
          height: 16px;
        " :style="{ left: spawnX + 'px', top: spawnY + 'px' }">
                <div
                    style="position: absolute; top: 50%; left: 0; width: 100%; height: 1px; background: rgba(255,200,50,0.6)" />
                <div
                    style="position: absolute; left: 50%; top: 0; height: 100%; width: 1px; background: rgba(255,200,50,0.6)" />
            </div>
        </div>

        <!-- Sidebar -->
        <div style="
        width: 280px;
        background: #12122a;
        border-left: 1px solid #2a2a4a;
        display: flex;
        flex-direction: column;
        overflow-y: auto;
      ">
            <!-- Spawn point -->
            <section style="padding: 14px 16px; border-bottom: 1px solid #2a2a4a">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Spawn point
                </div>
                <div style="display: flex; gap: 8px; margin-bottom: 8px">
                    <label style="flex: 1">
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">X</div>
                        <input v-model.number="spawnX" type="number"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                    <label style="flex: 1">
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Y</div>
                        <input v-model.number="spawnY" type="number"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                </div>
                <div style="font-size: 11px; color: #666; margin-bottom: 6px">Click canvas to move spawn point</div>
                <label
                    style="display: flex; align-items: center; gap: 6px; font-size: 12px; color: #aaa; cursor: pointer">
                    <input v-model="useBoxTarget" type="checkbox" />
                    Box target
                    <span style="font-size: 11px; color: #666">({{ boxTargetX }}, {{ boxTargetY }})</span>
                </label>
            </section>

            <!-- Amount -->
            <section style="padding: 14px 16px; border-bottom: 1px solid #2a2a4a">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Amount
                </div>
                <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px">
                    <input v-model.number="amount" type="range" min="1" max="9999"
                        style="flex: 1; accent-color: #f9a825" />
                    <input v-model.number="amount" type="number"
                        style="width: 70px; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                </div>
                <div style="display: flex; gap: 6px; flex-wrap: wrap">
                    <button v-for="preset in amountPresets" :key="preset"
                        style="padding: 3px 10px; border-radius: 20px; border: 1px solid #3a3a5a; background: #1e1e3a; color: #ccc; font-size: 12px; cursor: pointer"
                        :style="amount === preset ? { borderColor: '#f9a825', color: '#f9a825' } : {}"
                        @click="amount = preset">
                        {{ preset }}
                    </button>
                </div>
            </section>

            <!-- Normal reward patterns -->
            <section style="padding: 14px 16px; border-bottom: 1px solid #2a2a4a">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Normal reward
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px">
                    <button v-for="p in normalPatterns" :key="p.pattern" style="
              padding: 8px 12px;
              border-radius: 8px;
              border: 1px solid #3a3a5a;
              background: #1e1e3a;
              color: #ddd;
              font-size: 13px;
              cursor: pointer;
              text-align: left;
              display: flex;
              justify-content: space-between;
              align-items: center;
              transition: border-color 0.15s;
            " :style="lastFired === p.pattern ? { borderColor: '#f9a825' } : {}" @click="fireNormal(p.pattern)">
                        <span>{{ p.label }}</span>
                        <span style="font-size: 11px; color: #666">{{ p.coins }}</span>
                    </button>
                </div>
            </section>

            <!-- New geometric patterns -->
            <section style="padding: 14px 16px; border-bottom: 1px solid #2a2a4a">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Geometric patterns
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px">
                    <button v-for="p in geoPatterns" :key="p.pattern" style="
              padding: 8px 12px;
              border-radius: 8px;
              border: 1px solid #3a3a5a;
              background: #1e1e3a;
              color: #ddd;
              font-size: 13px;
              cursor: pointer;
              text-align: left;
              display: flex;
              justify-content: space-between;
              align-items: center;
            " :style="lastFired === p.pattern ? { borderColor: '#f9a825' } : {}" @click="fireNormal(p.pattern)">
                        <span>{{ p.label }}</span>
                        <span style="font-size: 11px; color: #666">{{ p.coins }}</span>
                    </button>
                </div>
            </section>

            <!-- Special effects -->
            <section style="padding: 14px 16px; border-bottom: 1px solid #2a2a4a">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Special effects
                </div>
                <div style="display: flex; flex-direction: column; gap: 6px">
                    <button
                        style="padding: 8px 12px; border-radius: 8px; border: 1px solid #3a3a5a; background: #1e1e3a; color: #ddd; font-size: 13px; cursor: pointer; text-align: left"
                        :style="lastFired === 'large' ? { borderColor: '#f9a825' } : {}" @click="fireLarge">
                        Big reward
                    </button>
                    <button
                        style="padding: 8px 12px; border-radius: 8px; border: 1px solid #3a3a5a; background: #1e1e3a; color: #ddd; font-size: 13px; cursor: pointer; text-align: left"
                        :style="lastFired === 'miss' ? { borderColor: '#f9a825' } : {}" @click="fireMiss">
                        Miss reward
                    </button>
                    <button
                        style="padding: 8px 12px; border-radius: 8px; border: 1px solid #3a3a5a; background: #1e1e3a; color: #ddd; font-size: 13px; cursor: pointer; text-align: left"
                        :style="lastFired === 'boss' ? { borderColor: '#f9a825' } : {}" @click="fireBoss">
                        Boss catch
                    </button>
                </div>
            </section>

            <!-- Boss catch config -->
            <section style="padding: 14px 16px; border-bottom: 1px solid #2a2a4a">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Boss config
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px">
                    <label>
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Fish ID</div>
                        <input v-model.number="bossConfig.fishId" type="number"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                    <label>
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Win odd</div>
                        <input v-model.number="bossConfig.winOdd" type="number"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                    <label>
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Max kill odd</div>
                        <input v-model.number="bossConfig.maxKillOdd" type="number"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                    <label>
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Lang</div>
                        <select v-model="bossConfig.lang"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px">
                            <option value="en">en</option>
                            <option value="km">km</option>
                            <option value="zh">zh</option>
                        </select>
                    </label>
                </div>
            </section>

            <!-- Miss config -->
            <section style="padding: 14px 16px">
                <div
                    style="font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 10px">
                    Miss config
                </div>
                <div style="display: flex; flex-direction: column; gap: 8px">
                    <label>
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Fish name</div>
                        <input v-model="missConfig.fishName" type="text"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                    <label>
                        <div style="font-size: 11px; color: #aaa; margin-bottom: 4px">Fish ID</div>
                        <input v-model.number="missConfig.fishId" type="number"
                            style="width: 100%; background: #1e1e3a; border: 1px solid #3a3a5a; color: #fff; border-radius: 6px; padding: 5px 8px; font-size: 13px" />
                    </label>
                </div>
            </section>
        </div>
    </div>
</template>

<script setup lang="ts">
import * as PIXI from "pixi.js";
import { onMounted, onUnmounted, ref } from "vue";
import { showBigRewardEffect } from "~/composables/game_core/reward/big-reward";
import { showBossCatchEffect } from "~/composables/game_core/reward/boss-kill-reward";
import { showFishMissRewardEffect } from "~/composables/game_core/reward/miss-reward";
import { showRewardEffect, type SpawnPattern } from "~/composables/game_core/reward/normal";

// ── Canvas / PIXI ─────────────────────────────────────────────────────────────
const canvasRef = ref<HTMLCanvasElement>();
let app: PIXI.Application;
let layer: PIXI.Container;

onMounted(async () => {
    app = new PIXI.Application({
        view: canvasRef.value,
        width: 800,
        height: 600,
        backgroundColor: 0x1a1a2e,
    });
    layer = new PIXI.Container();
    app.stage.addChild(layer);
});

onUnmounted(() => {
    app?.destroy(false, { children: true });
});

// ── Spawn config ──────────────────────────────────────────────────────────────
const spawnX = ref(400);
const spawnY = ref(300);
const amount = ref(25);
const useBoxTarget = ref(true);
const boxTargetX = ref(720);
const boxTargetY = ref(40);
const lastFired = ref<string>("");
const amountPresets = [1, 25, 50, 100, 500, 1000, 9999];

// Click canvas → move spawn point
onMounted(() => {
    canvasRef.value?.addEventListener("click", (e) => {
        const rect = canvasRef.value!.getBoundingClientRect();
        spawnX.value = Math.round(e.clientX - rect.left);
        spawnY.value = Math.round(e.clientY - rect.top);
    });
});

// ── Pattern lists ─────────────────────────────────────────────────────────────
const normalPatterns = [
    { pattern: "single", label: "Single", coins: "1 coin" },
    { pattern: "ring", label: "Ring", coins: "4 coins" },
    { pattern: "filled_circle", label: "Filled circle", coins: "19 coins" },
    { pattern: "star", label: "Star", coins: "10 coins" },
] as const;

const geoPatterns = [
    { pattern: "triangle", label: "Triangle", coins: "10 coins" },
    { pattern: "hexagon", label: "Hexagon", coins: "19 coins" },
    { pattern: "diamond", label: "Diamond", coins: "13 coins" },
    { pattern: "cross", label: "Cross", coins: "13 coins" },
] as const;

// ── Boss / miss config ────────────────────────────────────────────────────────
const bossConfig = ref<{ fishId: number; winOdd: number; maxKillOdd: number; lang: "en" | "km" | undefined }>({
    fishId: 20,
    winOdd: 705,
    maxKillOdd: 1000,
    lang: "en",
});
const missConfig = ref({ fishName: "Pufferfish", fishId: 19 });

// ── Fire helpers ──────────────────────────────────────────────────────────────
function boxTarget() {
    return useBoxTarget.value ? { x: boxTargetX.value, y: boxTargetY.value } : undefined;
}

function fireNormal(pattern: SpawnPattern) {
    lastFired.value = pattern;
    showRewardEffect({
        layer,
        x: spawnX.value,
        y: spawnY.value,
        amount: amount.value,
        pattern,
        boxTarget: boxTarget(),
    });
}

function fireLarge() {
    lastFired.value = "large";
    showBigRewardEffect({
        layer,
        x: spawnX.value,
        y: spawnY.value,
        amount: amount.value,
        boxTarget: boxTarget(),
    });
}

function fireMiss() {
    lastFired.value = "miss";
    showFishMissRewardEffect({
        layer,
        x: spawnX.value,
        y: spawnY.value,
        rewardX: spawnX.value,
        rewardY: spawnY.value - 80,
        amount: amount.value,
        fishName: missConfig.value.fishName,
        fishId: missConfig.value.fishId,
    });
}

function fireBoss() {
    lastFired.value = "boss";
    showBossCatchEffect({
        layer,
        x: spawnX.value,
        y: spawnY.value,
        fishId: bossConfig.value.fishId,
        winOdd: bossConfig.value.winOdd,
        maxKillOdd: bossConfig.value.maxKillOdd,
        lang: `en`,
        onComplete: () => { },
    });
}
</script>