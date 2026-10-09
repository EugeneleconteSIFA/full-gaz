import type { MatchState } from "../core/MatchState";
import type { BotDifficulty } from "../data/bots";
import type { PlayerId } from "../core/types";
import type { TouchState } from "../input/TouchInput";
import type { UiInputState } from "../input/UiInputState";

/**
 * Everything the match and UI scenes share. Built outside Phaser so the simulation state is
 * never owned by a scene, and both scenes can start together at boot.
 */
export interface MatchContext {
  readonly state: MatchState;
  readonly localPlayerId: PlayerId;
  /** Players driven by a bot. Players listed nowhere (the dev dummy) receive no commands. */
  readonly bots: readonly { readonly playerId: PlayerId; readonly difficulty: BotDifficulty }[];
  /** Written by UiScene (touch controls), read by MatchScene (input sampling). */
  readonly touch: TouchState;
  /** Written by UiScene (upgrade buttons), read by MatchScene. */
  readonly uiInput: UiInputState;
  /** New match, same character, new seed. Called from the result screen. */
  readonly rematch: () => void;
  /** Back to character selection. Called from the result screen. */
  readonly changeCharacter: () => void;
}
