import { GAME_CONFIG } from "../config/gameConfig";
import type Phaser from "phaser";
import { viewWidth } from "./viewport";
import { STRINGS } from "../config/strings";
import type { MatchState, PlayerState } from "../core/MatchState";
import { RESOURCE_IDS, type ResourceId } from "../core/types";
import { getResource } from "../data/registry";
import { formatClock, secondsRemaining } from "../gameplay/match/matchClock";
import { hudText } from "./hudText";
import { drawResourceIcon } from "./resourceIcon";
import { resourceIconKey } from "./ui/resourceIcons";

/** 3D icons are drawn this many times the flat icon's half-size (they carry their outline). */
const ICON_SCALE = 3.4;
import { THEME } from "./theme";
import { drawPanel } from "./ui/uiKit";

/**
 * The local player's wallet (icon + amount per resource), the next production event with its
 * countdown, and a short message after each production saying what was received and why.
 */
export class ResourceHud {
  /** Pills behind the wallet and the next-production line (drawn first: underneath). */
  private readonly backdrop: Phaser.GameObjects.Graphics;
  private readonly icons: Phaser.GameObjects.Graphics;
  private readonly amounts = new Map<ResourceId, Phaser.GameObjects.Text>();
  private readonly shownAmounts = new Map<ResourceId, number>();
  private readonly next: Phaser.GameObjects.Text;
  private readonly nextIcon: Phaser.GameObjects.Graphics;
  /** 3D icons (docs/13); the Graphics above are only the fallback if they could not render. */
  private readonly walletImages = new Map<ResourceId, Phaser.GameObjects.Image>();
  private readonly nextImage: Phaser.GameObjects.Image;
  private readonly toast: Phaser.GameObjects.Text;
  private shownNext = "";
  /** Encodes (event, second, format) of the label shown, to skip unchanged frames cheaply. */
  private shownNextKey = -2;
  private shownEventTick = -1;
  private toastUntilMs = 0;
  private compact = false;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: PlayerState,
  ) {
    const hud = THEME.hud;
    this.backdrop = scene.add.graphics();
    this.icons = scene.add.graphics();
    for (const id of RESOURCE_IDS) {
      this.amounts.set(id, hudText(scene, hud.walletFontPx).setOrigin(0, 0.5));
    }
    for (const id of RESOURCE_IDS) {
      const key = resourceIconKey(scene, id);
      if (key) this.walletImages.set(id, scene.add.image(0, 0, key));
    }
    this.nextIcon = scene.add.graphics();
    this.nextImage = scene.add.image(0, 0, "__DEFAULT").setVisible(false);
    this.next = hudText(scene, hud.nextProductionFontPx).setOrigin(0, 0.5);
    this.toast = hudText(scene, hud.productionToastFontPx).setVisible(false);
    this.layout();
  }

  update(state: MatchState): void {
    const hud = THEME.hud;

    for (const id of RESOURCE_IDS) {
      const amount = this.player.resources[id];
      if (this.shownAmounts.get(id) !== amount) {
        this.shownAmounts.set(id, amount);
        this.amounts.get(id)?.setText(String(amount));
      }
    }

    const upcoming =
      state.result === null ? state.productionPlan[state.nextProductionIndex] : undefined;
    // Rebuild the label only when what it shows changes (the second, the event, the format),
    // not every frame: string building here would allocate 60 times a second.
    const seconds = upcoming ? secondsRemaining(state.tick, upcoming.tick) : -1;
    const nextKey = upcoming
      ? state.nextProductionIndex * 100000 + seconds * 2 + (this.compact ? 1 : 0)
      : -1;
    if (nextKey === this.shownNextKey) return this.updateToast(state);
    this.shownNextKey = nextKey;
    const clock = upcoming ? formatClock(seconds) : "";
    const multiplier = GAME_CONFIG.production.featuredMultiplier;
    const nextLabel = !upcoming
      ? ""
      : this.compact
        ? STRINGS.production.nextShort(multiplier, clock)
        : STRINGS.production.next(getResource(upcoming.resourceId).label, multiplier, clock);
    if (nextLabel !== this.shownNext) {
      this.shownNext = nextLabel;
      this.next.setText(nextLabel);
      this.nextIcon.clear();
      const key = upcoming ? resourceIconKey(this.scene, upcoming.resourceId) : null;
      this.nextImage.setVisible(key !== null);
      if (key) {
        const px = hud.walletIconSizePx * ICON_SCALE;
        this.nextImage.setTexture(key).setDisplaySize(px, px);
      } else if (upcoming)
        drawResourceIcon(this.nextIcon, upcoming.resourceId, 0, 0, hud.walletIconSizePx);
      // Its width changed: re-center the line.
      this.layout();
    }

    this.updateToast(state);
  }

  private updateToast(state: MatchState): void {
    const hud = THEME.hud;
    const now = this.scene.time.now;
    const last = state.lastProduction;
    if (last && last.tick !== this.shownEventTick) {
      this.shownEventTick = last.tick;
      const gained = last.amountByTeam[this.player.teamId];
      const team = last.gainsByTeam[this.player.teamId];
      // Featured resource first, then the others in the usual order.
      const order = [last.resourceId, ...RESOURCE_IDS.filter((id) => id !== last.resourceId)];
      const gains = order
        .filter((id) => team[id] > 0)
        .map((id) => [getResource(id).label, team[id]] as const);
      const message = this.compact
        ? STRINGS.production.receivedShort(gains)
        : STRINGS.production.received(gains);
      this.toast.setText(message).setColor(gained > 0 ? hud.gainColor : hud.noGainColor);
      this.toastUntilMs = now + hud.productionToastMs;
    }
    const toastAlpha = Math.min(1, (this.toastUntilMs - now) / THEME.hud.bannerFadeMs);
    this.toast.setVisible(toastAlpha > 0).setAlpha(Math.max(0, toastAlpha));
  }

  /**
   * Positions everything for the current screen width. Call on resize. On narrow screens
   * (phones in portrait) the next production moves to the end of the wallet line, as icon + clock.
   */
  layout(): void {
    const hud = THEME.hud;
    const width = viewWidth(this.scene);
    const compact = width < hud.compactWidthPx;
    if (compact !== this.compact) {
      this.compact = compact;
      this.shownNext = ""; // rebuild the label in the new format on the next update
      this.shownNextKey = -2;
      const font = `${compact ? hud.compactWalletFontPx : hud.walletFontPx}px`;
      for (const text of this.amounts.values()) text.setFontSize(font);
      this.next.setFontSize(`${compact ? hud.compactWalletFontPx : hud.nextProductionFontPx}px`);
    }

    const cx = width / 2;
    const y = hud.walletTopPx;
    const slot = compact ? hud.compactWalletSlotPx : hud.walletSlotPx;
    const nextSlot = compact
      ? hud.walletIconSizePx * 2 + 6 + this.next.width + hud.compactNextGapPx
      : 0;
    const startX = cx - (RESOURCE_IDS.length * slot + nextSlot) / 2;

    const rowW = RESOURCE_IDS.length * slot + nextSlot + 10;
    const b = this.backdrop.clear();
    drawPanel(b, startX + rowW / 2 - 5, y, rowW, 30, { radius: 15, alpha: 0.92 });
    const g = this.icons.clear();
    RESOURCE_IDS.forEach((id, i) => {
      const iconX = startX + i * slot + hud.walletIconSizePx + 4;
      const image = this.walletImages.get(id);
      if (image) {
        const px = hud.walletIconSizePx * ICON_SCALE;
        image.setPosition(iconX, y).setDisplaySize(px, px);
      } else drawResourceIcon(g, id, iconX, y, hud.walletIconSizePx);
      this.amounts.get(id)?.setPosition(iconX + hud.walletIconSizePx + 6, y);
    });

    if (compact) {
      const nextX = startX + RESOURCE_IDS.length * slot + hud.compactNextGapPx;
      this.nextIcon.setPosition(nextX + hud.walletIconSizePx, y);
      this.nextImage.setPosition(nextX + hud.walletIconSizePx, y);
      this.next.setPosition(nextX + hud.walletIconSizePx * 2 + 6, y);
      this.toast.setPosition(cx, y + hud.compactWalletFontPx + 14);
      return;
    }

    const nextY = y + hud.walletFontPx + 10;
    const nextWidth = this.next.width + hud.walletIconSizePx * 2 + 8;
    const nextX = cx - nextWidth / 2;
    drawPanel(b, cx, nextY, nextWidth + 22, 26, { radius: 13, alpha: 0.85 });
    this.nextIcon.setPosition(nextX + hud.walletIconSizePx, nextY);
    this.nextImage.setPosition(nextX + hud.walletIconSizePx, nextY);
    this.next.setPosition(nextX + hud.walletIconSizePx * 2 + 8, nextY);
    this.toast.setPosition(cx, nextY + hud.productionToastFontPx + 12);
  }
}
