import type { CSSProperties } from "react";
import type { RoomPublic } from "@kittypoly/game";
import { ActionPanel } from "../components/ActionPanel";
import { Board } from "../components/Board";
import { EventLog } from "../components/EventLog";
import type { ClientMessage } from "../ws/client";

type Intent = Extract<ClientMessage, { type: "intent" }>["intent"];

interface MatchProps {
  room: RoomPublic;
  playerId: string;
  error: string | null;
  onIntent: (intent: Intent, spaceId?: string) => void;
}

export function Match({ room, playerId, error, onIntent }: MatchProps) {
  return (
    <main style={styles.shell}>
      <div style={styles.top}>
        <Board room={room} />
        <div style={styles.side}>
          <ActionPanel room={room} playerId={playerId} error={error} onIntent={onIntent} />
          <section style={styles.card}>
            <h2 style={styles.heading}>Players</h2>
            <div style={styles.players}>
              {room.players.map((player) => (
                <article
                  key={player.id}
                  style={{
                    ...styles.player,
                    ...(player.id === room.match.currentPlayerId ? styles.activePlayer : {}),
                    ...(player.bankrupt ? styles.bankruptPlayer : {}),
                  }}
                >
                  <strong>
                    {player.nickname} {player.id === playerId ? "(you)" : ""}
                  </strong>
                  <span style={styles.meta}>
                    {player.avatar} · {player.food} food · space {player.position}
                    {player.inCage ? " · in cage" : ""}
                  </span>
                </article>
              ))}
            </div>
          </section>
        </div>
      </div>
      <EventLog events={room.match.events} />
    </main>
  );
}

const styles = {
  shell: {
    display: "grid",
    gap: "1.25rem",
    minHeight: "100vh",
    padding: "1rem",
  },
  top: {
    alignItems: "start",
    display: "grid",
    gap: "1.25rem",
    gridTemplateColumns: "minmax(0, 1fr) minmax(18rem, 24rem)",
  },
  side: {
    display: "grid",
    gap: "1rem",
  },
  card: {
    background: "white",
    border: "var(--border)",
    boxShadow: "6px 6px 0 var(--ink)",
    padding: "1rem",
  },
  heading: {
    margin: "0 0 0.75rem",
  },
  players: {
    display: "grid",
    gap: "0.6rem",
  },
  player: {
    border: "var(--border)",
    display: "grid",
    gap: "0.25rem",
    padding: "0.65rem",
  },
  activePlayer: {
    background: "var(--accent-2)",
  },
  bankruptPlayer: {
    opacity: 0.45,
    textDecoration: "line-through",
  },
  meta: {
    color: "var(--info)",
    fontSize: "0.9rem",
    fontWeight: 800,
    textTransform: "capitalize",
  },
} satisfies Record<string, CSSProperties>;
