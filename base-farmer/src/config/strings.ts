import type { PhaseId } from "../core/types";
import type { MatchResult } from "../core/MatchState";
import type { TeamId } from "../core/types";
import { GAME_CONFIG } from "./gameConfig";

/** All player-facing text, in one place so wording or language can change without touching code. */

function productionLine(phase: PhaseId): string {
  const interval = GAME_CONFIG.match.phases.find((p) => p.id === phase)?.productionIntervalSeconds;
  return interval ? `Production toutes les ${interval} s` : "";
}

const capture = GAME_CONFIG.capture;
const phases = GAME_CONFIG.match.phases;
const firstProduction = phases.find((p) => p.productionIntervalSeconds !== null);
const endgame = phases.find((p) => p.id === "endgame");
const minutes = (seconds: number) => `${Math.round(seconds / 60)} min`;
/** French decimal comma: 1.5 -> "1,5". */
const fr = (n: number) => String(n).replace(".", ",");

export const STRINGS = {
  /** "Comment jouer" panel of the selection screen; numbers come from the game's tuning. */
  rules: {
    button: "Comment jouer",
    title: "COMMENT JOUER",
    close: "C'EST PARTI !",
    sections: [
      {
        heading: "Gagner",
        text: `Possède le plus de bases quand le chrono arrive à 0:00 (${minutes(GAME_CONFIG.match.durationSeconds)}).`,
      },
      {
        heading: "Prendre une base",
        text: `Reste dans son cercle : ${fr(capture.captureSeconds)} s pour une base neutre, ${fr(capture.neutralizeSeconds + capture.captureSeconds)} s pour une base adverse. Si un ennemi est aussi dans le cercle, la base est contestée et rien n'avance.`,
      },
      {
        heading: "Récolter",
        text: `À partir de ${minutes(firstProduction?.startsAtSeconds ?? 60)}, chaque base que tu possèdes te rapporte sa ressource toutes les ${firstProduction?.productionIntervalSeconds ?? 60} s (${endgame?.productionIntervalSeconds ?? 30} s en fin de partie). La ressource annoncée rapporte ×${GAME_CONFIG.production.featuredMultiplier}.`,
      },
      {
        heading: "Améliorer",
        text: "Dépense tes ressources quand tu veux : Vie, Vitesse, Portée, Dégâts et Cadence, 3 niveaux chacune.",
      },
      {
        heading: "Se battre",
        text: `Chaque perso a une capacité spéciale avec sa recharge. KO ? Tu reviens ${GAME_CONFIG.combat.respawnDelaySeconds} s plus tard, et tu gardes tes ressources.`,
      },
    ],
    controlsDesktop:
      "ZQSD / WASD : bouger · Espace : attaquer devant soi · F : capacité · 1–5 : améliorer",
    controlsTouch:
      "Pouce gauche : bouger · pouce droit : viser et attaquer · bouton rond : capacité · colonne de droite : améliorer",
  },
  phases: {
    opening: { title: "CONQUÊTE", subtitle: "Prenez les bases !" },
    development: { title: "DÉVELOPPEMENT", subtitle: productionLine("development") },
    endgame: { title: "FIN DE PARTIE", subtitle: `${productionLine("endgame")} — attaquez !` },
  } satisfies Record<PhaseId, { title: string; subtitle: string }>,
  respawn: (seconds: number) => `KO\nRetour dans ${seconds}`,
  production: {
    /** The featured ("maxée") resource of the next event, which pays ×N. */
    next: (resource: string, multiplier: number, clock: string) =>
      `Prochaine : ${resource} ×${multiplier} — ${clock}`,
    /** Gains as "label, amount" pairs, featured resource first. */
    received: (gains: readonly (readonly [string, number])[]) =>
      gains.length > 0
        ? `Production : ${gains.map(([label, n]) => `+${n} ${label}`).join(" · ")}`
        : "Production : vous n'avez aucune base",
    /** Compact HUD (phones): the clock alone next to the icon, and a short gain message. */
    nextShort: (multiplier: number, clock: string) => `×${multiplier} ${clock}`,
    receivedShort: (gains: readonly (readonly [string, number])[]) =>
      gains.length > 0 ? gains.map(([label, n]) => `+${n} ${label}`).join(" ") : "Rien reçu",
  },
  result: {
    victory: "VICTOIRE",
    defeat: "DÉFAITE",
    draw: "ÉGALITÉ",
    replay: "Rejouer",
    changeCharacter: "Changer de perso",
  },
  upgrades: {
    max: "MAX",
  },
  select: {
    title: "Choisis ton personnage",
    play: "Jouer",
    hint: "1–4 ou ← → : personnage · M : carte · D : difficulté · Entrée : jouer",
    map: "Carte",
    opponent: "Adversaire",
    randomMap: "Aléatoire",
    viewerHint3d:
      "← → : tourner · ↑ ↓ : courir · Espace : attaquer · E : expression · V : victoire · Échap : fermer",
    ability: (label: string) => `Capacité : ${label}`,
    stats: { hp: "Vie", speed: "Vitesse", range: "Portée", damage: "Dégâts" },
  },
} as const;

/** French plural: 0 and 1 are singular. */
function bases(count: number): string {
  return `${count} base${count > 1 ? "s" : ""}`;
}

/** One line explaining why the match ended this way, from the local team's point of view. */
export function resultReason(result: MatchResult, localTeam: TeamId): string {
  const enemy: TeamId = localTeam === "teamA" ? "teamB" : "teamA";
  const mine = result.bases[localTeam];
  const theirs = result.bases[enemy];
  switch (result.decidedBy) {
    case "bases":
      return `${bases(mine)} contre ${theirs}`;
    case "captureProgress":
      return `Égalité ${mine}–${theirs} en bases, départagée par la capture en cours`;
    case "draw":
      return `Égalité ${mine}–${theirs}, même capture en cours`;
  }
}
