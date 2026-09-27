"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Check, Flame, Lock, Trophy, X } from "lucide-react";
import { BADGES, LEVELS, MISSION_BONUS_XP, levelOf, type GameEvent, type GameState } from "@/lib/gamification";

interface Celebration {
  title: string;
  subtitle: string;
  emoji: string;
}

/** Studio game state + track(event). Events are sent to the server, which applies the rules. */
export function useGame(enabled: boolean) {
  const [state, setState] = useState<GameState | null>(null);
  const [gain, setGain] = useState<{ xp: number; key: number } | null>(null);
  const [celebration, setCelebration] = useState<Celebration | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const track = useCallback(
    (event: GameEvent, meta?: string) => {
      if (!enabled) return;
      queue.current = queue.current.then(async () => {
        try {
          const res = await fetch("/api/gamification", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ event, meta }) });
          if (!res.ok) return;
          const json = await res.json();
          setState(json.state);
          if (json.gained > 0) setGain({ xp: json.gained, key: Date.now() });
          if (json.levelUp) {
            setCelebration({ emoji: "🎉", title: `Niveau ${json.levelUp.level} : ${json.levelUp.name}`, subtitle: "Bravo ! Vous progressez comme un vrai designer." });
          } else if (json.newBadges?.length) {
            const b = BADGES.find((x) => x.id === json.newBadges[0]);
            if (b) setCelebration({ emoji: b.emoji, title: `Badge débloqué : ${b.name}`, subtitle: b.hint });
          }
        } catch {
          // the game never blocks the studio
        }
      });
    },
    [enabled]
  );

  useEffect(() => {
    if (!enabled) return;
    track("visit");
  }, [enabled, track]);

  useEffect(() => {
    if (!gain) return;
    const t = setTimeout(() => setGain(null), 1800);
    return () => clearTimeout(t);
  }, [gain]);

  return { state, gain, celebration, dismissCelebration: () => setCelebration(null), track };
}

/** Level chip for the studio header: ring = progress to the next level, flame = daily streak. */
export function GameChip({ state, gain, onOpen }: { state: GameState | null; gain: { xp: number; key: number } | null; onOpen: () => void }) {
  if (!state) return null;
  const lv = levelOf(state.xp);
  const deg = Math.round(lv.progress * 360);
  return (
    <button type="button" className="st-game-chip" onClick={onOpen} title={`Niveau ${lv.level} · ${lv.name} — ${state.xp} XP`}>
      <span className="st-game-ring" style={{ background: `conic-gradient(var(--m) ${deg}deg, var(--line) ${deg}deg)` }}>
        <span>{lv.level}</span>
      </span>
      <span className="st-game-streak">
        <Flame className="w-4 h-4" /> {state.streak}
      </span>
      {gain && (
        <span key={gain.key} className="st-game-gain">
          +{gain.xp} XP
        </span>
      )}
    </button>
  );
}

export function GamePanel({ open, state, onClose }: { open: boolean; state: GameState | null; onClose: () => void }) {
  if (!open || !state) return null;
  const lv = levelOf(state.xp);
  const done = state.missions.filter((m) => m.done).length;
  return (
    <div className="edify-modal-backdrop" onClick={onClose}>
      <div className="edify-modal-content st-game-panel" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Ma progression">
        <button type="button" className="st-reveal-close" onClick={onClose} aria-label="Fermer">
          <X className="w-5 h-5" />
        </button>
        <p className="st-reveal-kicker"><Trophy className="w-4 h-4" /> Ma progression</p>
        <div className="st-game-head">
          <span className="st-game-ring is-big" style={{ background: `conic-gradient(var(--m) ${Math.round(lv.progress * 360)}deg, var(--line) 0deg)` }}>
            <span>{lv.level}</span>
          </span>
          <div>
            <h2>{lv.name}</h2>
            <p>
              {state.xp} XP{lv.nextName ? ` · encore ${lv.xpForNext - lv.xpInLevel} XP pour devenir « ${lv.nextName} »` : " · niveau maximum atteint"}
            </p>
            <div className="st-game-bar"><i style={{ width: `${Math.round(lv.progress * 100)}%` }} /></div>
          </div>
          <div className="st-game-flame">
            <Flame className="w-6 h-6" />
            <strong>{state.streak}</strong>
            <small>jour{state.streak > 1 ? "s" : ""} d&apos;affilée</small>
          </div>
        </div>

        <h3>Missions du jour · {done}/3</h3>
        <ul className="st-game-missions">
          {state.missions.map((m) => (
            <li key={m.id} className={m.done ? "is-done" : ""}>
              <span>{m.done ? <Check className="w-4 h-4" /> : null}</span>
              {m.label}
            </li>
          ))}
        </ul>
        <p className="st-game-note">{state.missionsBonus ? "✓ Bonus du jour gagné !" : `Terminez les 3 missions pour gagner ${MISSION_BONUS_XP} XP de bonus.`}</p>

        <h3>Badges · {state.badges.length}/{BADGES.length}</h3>
        <ul className="st-game-badges">
          {BADGES.map((b) => {
            const got = state.badges.includes(b.id);
            return (
              <li key={b.id} className={got ? "is-got" : ""} title={b.hint}>
                <span className="st-game-badge-icon">{got ? b.emoji : <Lock className="w-4 h-4" />}</span>
                <strong>{b.name}</strong>
                <small>{b.hint}</small>
              </li>
            );
          })}
        </ul>
        <p className="st-game-note">Niveaux : {LEVELS.map((l, i) => `${i + 1}. ${l.name}`).join(" · ")}</p>
      </div>
    </div>
  );
}

/** Full-screen celebration (level up, badge) with a light confetti burst. */
export function GameCelebration({ celebration, onClose }: { celebration: Celebration | null; onClose: () => void }) {
  useEffect(() => {
    if (!celebration) return;
    const t = setTimeout(onClose, 4200);
    return () => clearTimeout(t);
  }, [celebration, onClose]);
  if (!celebration) return null;
  const colors = ["#e6007e", "#00a0e3", "#ffe500", "#141414"];
  return (
    <div className="st-celebrate" onClick={onClose} role="status" aria-live="polite">
      <div className="st-confetti" aria-hidden="true">
        {Array.from({ length: 36 }, (_, i) => (
          <i key={i} style={{ left: `${(i * 97) % 100}%`, background: colors[i % 4], animationDelay: `${(i % 9) * 0.07}s`, transform: `rotate(${i * 37}deg)` }} />
        ))}
      </div>
      <div className="st-celebrate-card">
        <span>{celebration.emoji}</span>
        <strong>{celebration.title}</strong>
        <small>{celebration.subtitle}</small>
      </div>
    </div>
  );
}
