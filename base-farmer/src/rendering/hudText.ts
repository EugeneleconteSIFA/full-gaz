import type Phaser from "phaser";
import { UI } from "./ui/uiKit";
import { THEME } from "./theme";

export function hexColor(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}

/** Bold outlined HUD text, readable over the map. */
export function hudText(
  scene: Phaser.Scene,
  fontPx: number,
  color: string = THEME.hud.respawnText,
): Phaser.GameObjects.Text {
  return scene.add
    .text(0, 0, "", {
      fontFamily: UI.displayFont,
      fontSize: `${fontPx}px`,
      color,
      stroke: UI.inkCss,
      strokeThickness: Math.max(4, Math.round(fontPx / 6)),
      align: "center",
    })
    .setOrigin(0.5);
}
