import type Phaser from "phaser";
import { viewHeight, viewWidth } from "./viewport";
import { STRINGS } from "../config/strings";
import type { MatchState } from "../core/MatchState";
import type { PhaseId } from "../core/types";
import { formatClock, phaseAt, secondsRemaining } from "../gameplay/match/matchClock";
import { getMap } from "../data/registry";
import { hudText } from "./hudText";
import { THEME } from "./theme";
import { drawPanel, UI } from "./ui/uiKit";

/**
 * Countdown timer, a short banner when a phase starts, and a big 10…1 countdown at the end.
 * Text is only rebuilt when the displayed value changes. Nothing here blocks input.
 */
export class MatchHud {
  /** Timer pill and banner ribbon (kit panels), drawn under their texts. */
  private readonly timerPill: Phaser.GameObjects.Graphics;
  private readonly ribbon: Phaser.GameObjects.Graphics;
  private ribbonKey = "";
  private timerKey = "";
  private readonly timer: Phaser.GameObjects.Text;
  private readonly bannerTitle: Phaser.GameObjects.Text;
  private readonly bannerSubtitle: Phaser.GameObjects.Text;
  private readonly finalCountdown: Phaser.GameObjects.Text;
  private shownSeconds = -1;
  private shownPhase: PhaseId | null = null;
  private bannerUntilMs = 0;
  private bannerTitlePx = 0;

  constructor(private readonly scene: Phaser.Scene) {
    const hud = THEME.hud;
    this.timerPill = scene.add.graphics();
    this.ribbon = scene.add.graphics().setVisible(false);
    this.timer = hudText(scene, hud.timerFontPx).setOrigin(0.5, 0);
    this.bannerTitle = hudText(scene, hud.bannerTitleFontPx).setVisible(false);
    this.bannerSubtitle = hudText(scene, hud.bannerSubtitleFontPx).setVisible(false);
    this.finalCountdown = hudText(scene, hud.finalCountdownFontPx).setVisible(false);
  }

  update(state: MatchState): void {
    const hud = THEME.hud;
    const now = this.scene.time.now;
    const width = viewWidth(this.scene);
    const height = viewHeight(this.scene);
    const remaining = secondsRemaining(state.tick, state.durationTicks);

    if (remaining !== this.shownSeconds) {
      this.shownSeconds = remaining;
      this.timer.setText(formatClock(remaining));
      this.timer.setColor(
        remaining <= hud.finalCountdownSeconds
          ? hud.timerCriticalColor
          : remaining <= hud.timerWarningSeconds
            ? hud.timerWarningColor
            : hud.timerColor,
      );
      this.finalCountdown.setText(String(remaining));
    }
    this.timer.setPosition(width / 2, hud.timerTopPx);
    const timerKey = `${width}`;
    if (timerKey !== this.timerKey) {
      this.timerKey = timerKey;
      this.timerPill.clear();
      drawPanel(this.timerPill, width / 2, hud.timerTopPx + hud.timerFontPx * 0.62, 96, 36, {
        radius: 18,
      });
    }

    const phase = phaseAt(state.tick);
    if (phase.id !== this.shownPhase) {
      this.shownPhase = phase.id;
      this.bannerTitle.setText(STRINGS.phases[phase.id].title);
      const subtitle = STRINGS.phases[phase.id].subtitle;
      // The opening banner also names the map, since it changes every match.
      this.bannerSubtitle.setText(
        phase.id === "opening" ? `${getMap(state.mapId).label} — ${subtitle}` : subtitle,
      );
      this.bannerUntilMs = now + hud.bannerMs;
    }

    const counting =
      state.result === null && remaining > 0 && remaining <= hud.finalCountdownSeconds;
    this.finalCountdown
      .setVisible(counting)
      .setPosition(width / 2, height * 0.42)
      .setAlpha(0.85);

    const bannerAlpha =
      counting || state.result ? 0 : Math.min(1, (this.bannerUntilMs - now) / hud.bannerFadeMs);
    const showBanner = bannerAlpha > 0;
    const bannerY = height * hud.bannerYFraction;
    // Portrait phones: the upgrade column sits on the right edge, so center the banner in the
    // space left of it and use a smaller title.
    const portrait = height > width;
    const bannerX = portrait
      ? (width - THEME.upgradeBar.buttonWidthPx - THEME.upgradeBar.edgeMarginPx) / 2
      : width / 2;
    const titlePx =
      portrait && width < hud.compactWidthPx ? hud.compactBannerTitleFontPx : hud.bannerTitleFontPx;
    if (this.bannerTitlePx !== titlePx) {
      this.bannerTitlePx = titlePx;
      this.bannerTitle.setFontSize(`${titlePx}px`);
    }
    this.bannerTitle.setVisible(showBanner).setAlpha(bannerAlpha).setPosition(bannerX, bannerY);
    // Gold ribbon behind the phase title: redrawn only when its size or place changes.
    const ribbonW = Math.max(this.bannerTitle.width, this.bannerSubtitle.width) + 48;
    const ribbonKey = `${Math.round(ribbonW)}|${Math.round(bannerX)}|${Math.round(bannerY)}|${titlePx}`;
    if (ribbonKey !== this.ribbonKey) {
      this.ribbonKey = ribbonKey;
      this.ribbon.clear();
      drawPanel(this.ribbon, bannerX, bannerY + titlePx * 0.32, ribbonW, titlePx * 1.9, {
        fill: UI.panel,
        rim: UI.selected,
        rimPx: 3,
        outline: 5,
        radius: 16,
        alpha: 0.95,
      });
    }
    this.ribbon.setVisible(showBanner).setAlpha(bannerAlpha);
    this.bannerSubtitle
      .setVisible(showBanner && this.bannerSubtitle.text !== "")
      .setAlpha(bannerAlpha)
      .setPosition(bannerX, bannerY + titlePx * 0.9);
  }
}
