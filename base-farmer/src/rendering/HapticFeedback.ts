import { GAME_CONFIG } from "../config/gameConfig";
import type { MatchState, PlayerState } from "../core/MatchState";
import type { BaseOwner } from "../core/types";

/**
 * Short vibrations on touch devices: when the local player is hit, and when their team captures
 * a base. Silently does nothing where the Vibration API is missing or blocked.
 */
export class HapticFeedback {
  private lastHp: number;
  private readonly lastOwners: BaseOwner[];
  private readonly vibrate: ((pattern: readonly number[]) => void) | null;

  constructor(
    enabled: boolean,
    private readonly player: PlayerState,
    state: MatchState,
  ) {
    this.lastHp = player.hp;
    this.lastOwners = state.bases.map((b) => b.owner);
    const nav = typeof navigator === "undefined" ? undefined : navigator;
    this.vibrate =
      enabled && nav && typeof nav.vibrate === "function"
        ? (pattern) => {
            try {
              nav.vibrate([...pattern]);
            } catch {
              // Blocked by the browser (no user gesture yet, iframe policy): not critical.
            }
          }
        : null;
  }

  update(state: MatchState): void {
    const { vibrateOnHit, vibrateOnCapture } = GAME_CONFIG.feedback;
    if (this.player.hp < this.lastHp) this.vibrate?.(vibrateOnHit);
    this.lastHp = this.player.hp;

    for (let i = 0; i < state.bases.length; i++) {
      const owner = state.bases[i]?.owner;
      if (owner === undefined || owner === this.lastOwners[i]) continue;
      if (owner === this.player.teamId) this.vibrate?.(vibrateOnCapture);
      this.lastOwners[i] = owner;
    }
  }
}
