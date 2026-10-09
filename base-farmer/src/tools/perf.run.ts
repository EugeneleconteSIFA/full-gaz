import { it } from "vitest";
import type { GameCommand } from "../core/commands";
import { createMatchState, stepMatch } from "../core/Simulation";
import { MAPS } from "../data/maps";
import { BotController } from "../gameplay/bots/BotController";
import { createBotNavigation } from "../gameplay/bots/BotNavigation";

// Not part of `npm test`: run with `npm run perf`. Headless costs of the simulation and bots.
it("performance report", () => {
  const lines: string[] = [];
  for (const map of MAPS) {
    const setup = {
      seed: 7,
      mapId: map.id,
      players: [
        { id: "a", teamId: "teamA" as const, characterId: "fighter" },
        { id: "b", teamId: "teamB" as const, characterId: "scout" },
      ],
    };

    // Navigation build (once per match, at start).
    let t = performance.now();
    const state = createMatchState(setup);
    const createMs = performance.now() - t;
    t = performance.now();
    const nav = createBotNavigation(state.layout);
    const navMs = performance.now() - t;

    // Bots + simulation for a whole match, timed separately.
    const bots = [new BotController("a", "hard", 7, nav), new BotController("b", "hard", 7, nav)];
    const commands: GameCommand[] = [];
    let botMs = 0;
    let simMs = 0;
    let worstTickMs = 0;
    let ticks = 0;
    while (state.result === null) {
      commands.length = 0;
      t = performance.now();
      for (const bot of bots) commands.push(...bot.think(state));
      const t1 = performance.now();
      stepMatch(state, commands);
      const t2 = performance.now();
      botMs += t1 - t;
      simMs += t2 - t1;
      worstTickMs = Math.max(worstTickMs, t2 - t);
      ticks++;
    }
    lines.push(
      `${map.id.padEnd(8)} match setup ${createMs.toFixed(2)} ms · bot navigation ${navMs.toFixed(1)} ms · ` +
        `per tick: simulation ${((simMs / ticks) * 1000).toFixed(1)} µs, 2 bots ${((botMs / ticks) * 1000).toFixed(1)} µs, worst tick ${worstTickMs.toFixed(2)} ms`,
    );
  }
  console.log(lines.join("\n"));
}, 120_000);
