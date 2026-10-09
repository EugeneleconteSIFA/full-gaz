import type {
  AimCommand,
  AttackCommand,
  BuyUpgradeCommand,
  GameCommand,
  MoveCommand,
  UseAbilityCommand,
} from "../core/commands";
import { EPSILON, length, setVec2, vec2 } from "../core/math";
import { UPGRADE_IDS, type PlayerId, type UpgradeId } from "../core/types";
import type { InputState } from "./InputState";

/**
 * Turns one player's InputState into simulation commands for a tick.
 * Command objects are reused every tick to avoid allocation; the simulation copies values out
 * of them. A future replay/network layer must clone them before storing.
 */
export class CommandWriter {
  private readonly move: MoveCommand;
  private readonly aim: AimCommand;
  private readonly attack: AttackCommand;
  private readonly ability: UseAbilityCommand;
  private readonly buys: Readonly<Record<UpgradeId, BuyUpgradeCommand>>;
  private readonly buffer: GameCommand[] = [];

  constructor(playerId: PlayerId) {
    this.move = { type: "move", playerId, vector: vec2() };
    this.aim = { type: "aim", playerId, direction: vec2() };
    this.attack = { type: "attack", playerId, active: false };
    this.ability = { type: "ability", playerId, active: false };
    const buy = (upgradeId: UpgradeId): BuyUpgradeCommand => ({
      type: "buyUpgrade",
      playerId,
      upgradeId,
    });
    this.buys = Object.fromEntries(UPGRADE_IDS.map((id) => [id, buy(id)])) as Record<
      UpgradeId,
      BuyUpgradeCommand
    >;
  }

  write(input: InputState): readonly GameCommand[] {
    this.buffer.length = 0;

    setVec2(this.move.vector, input.moveVector.x, input.moveVector.y);
    this.buffer.push(this.move);

    if (length(input.aimVector.x, input.aimVector.y) > EPSILON) {
      setVec2(this.aim.direction, input.aimVector.x, input.aimVector.y);
      if (input.aimDistance === null) delete this.aim.distance;
      else this.aim.distance = input.aimDistance;
      this.buffer.push(this.aim);
    }

    this.attack.active = input.attackPressed;
    this.buffer.push(this.attack);

    this.ability.active = input.abilityPressed;
    this.buffer.push(this.ability);

    for (const upgradeId of input.buyRequests) this.buffer.push(this.buys[upgradeId]);

    return this.buffer;
  }
}
