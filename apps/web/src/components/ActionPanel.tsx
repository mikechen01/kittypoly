import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import type { RoomPublic } from "@kittypoly/game";
import type { ClientMessage } from "../ws/client";

type Intent = Extract<ClientMessage, { type: "intent" }>["intent"];

interface ActionPanelProps {
  room: RoomPublic;
  playerId: string;
  error: string | null;
  onIntent: (intent: Intent, spaceId?: string) => void;
}

export function ActionPanel({ room, playerId, error, onIntent }: ActionPanelProps) {
  const [spaceId, setSpaceId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const match = room.match;
  const player = room.players.find((candidate) => candidate.id === playerId);
  const currentPlayer = room.players.find((candidate) => candidate.id === match.currentPlayerId);
  const isMyTurn = playerId === match.currentPlayerId;
  const secondsLeft =
    match.turnDeadlineMs === null ? null : Math.max(0, Math.ceil((match.turnDeadlineMs - now) / 1_000));

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <aside style={styles.panel}>
      <p style={styles.eyebrow}>{isMyTurn ? "Your turn" : "Waiting"}</p>
      <h2 style={styles.title}>{currentPlayer?.nickname ?? "No active player"}</h2>
      <p style={styles.meta}>
        Awaiting: <strong>{match.awaiting}</strong>
        {secondsLeft === null ? "" : ` · ${secondsLeft}s left`}
      </p>

      {player?.inCage && isMyTurn ? (
        <button type="button" onClick={() => onIntent("payCageFine")} style={styles.fullButton}>
          Pay Fine
        </button>
      ) : null}

      <div style={styles.actions}>
        {isMyTurn ? (
          <>
            {match.awaiting === "roll" ? (
              <button type="button" onClick={() => onIntent("rollDice")}>
                Roll
              </button>
            ) : null}

            {match.awaiting === "buyOrSkip" ? (
              <>
                <button type="button" onClick={() => onIntent("buyTerritory")}>
                  Buy
                </button>
                <button type="button" onClick={() => onIntent("skipBuy")} style={styles.secondaryButton}>
                  Skip
                </button>
              </>
            ) : null}

            {match.awaiting === "buildOrEnd" ? (
              <>
                <label style={styles.label}>
                  Build spaceId
                  <input
                    style={styles.input}
                    value={spaceId}
                    onChange={(event) => setSpaceId(event.target.value)}
                    placeholder="sunny-window"
                  />
                </label>
                <button type="button" disabled={!spaceId.trim()} onClick={() => onIntent("buildHouse", spaceId.trim())}>
                  Build
                </button>
                <button type="button" onClick={() => onIntent("endTurn")} style={styles.secondaryButton}>
                  End Turn
                </button>
              </>
            ) : null}

            {match.awaiting === "end" ? (
              <button type="button" onClick={() => onIntent("endTurn")}>
                End Turn
              </button>
            ) : null}
          </>
        ) : (
          <p style={styles.wait}>Actions unlock on your turn.</p>
        )}
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
    </aside>
  );
}

const styles = {
  panel: {
    alignSelf: "start",
    background: "white",
    border: "var(--border)",
    boxShadow: "6px 6px 0 var(--ink)",
    display: "grid",
    gap: "0.8rem",
    padding: "1rem",
    position: "sticky",
    top: "1rem",
  },
  eyebrow: {
    color: "var(--accent)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  title: {
    margin: 0,
  },
  meta: {
    color: "var(--info)",
    fontWeight: 800,
    margin: 0,
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.6rem",
  },
  fullButton: {
    justifySelf: "start",
  },
  secondaryButton: {
    background: "white",
  },
  label: {
    display: "grid",
    flex: "1 1 12rem",
    gap: "0.25rem",
    fontWeight: 800,
  },
  input: {
    border: "var(--border)",
    font: "inherit",
    padding: "0.55rem",
  },
  wait: {
    color: "var(--info)",
    fontWeight: 800,
    margin: 0,
  },
  error: {
    color: "var(--accent)",
    fontWeight: 800,
    margin: 0,
  },
} satisfies Record<string, CSSProperties>;
