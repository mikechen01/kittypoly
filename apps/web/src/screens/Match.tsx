import type { CSSProperties } from "react";
import { BOARD, type RoomPublic } from "@kittypoly/game";
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
            <h2 style={styles.heading}>玩家</h2>
            <div style={styles.players}>
              {room.players.map((player) => {
                const space = BOARD[player.position];
                const spaceName = space?.name ?? `第 ${player.position} 格`;
                const isYou = player.id === playerId;
                return (
                  <article
                    key={player.id}
                    style={{
                      ...styles.player,
                      ...(player.id === room.match.currentPlayerId ? styles.activePlayer : {}),
                      ...(player.bankrupt ? styles.bankruptPlayer : {}),
                    }}
                  >
                    <strong>
                      {player.nickname} {isYou ? "（你）" : ""}
                    </strong>
                    <span style={styles.location}>
                      現在位置：{player.inCage ? `貓籠（原格：${spaceName}）` : spaceName}
                    </span>
                    <span style={styles.meta}>
                      {avatarLabel(player.avatar)} · {player.food} 貓糧
                      {player.bankrupt ? " · 已破產" : ""}
                    </span>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
      <EventLog events={room.match.events} />
    </main>
  );
}

function avatarLabel(avatar: RoomPublic["players"][number]["avatar"]): string {
  switch (avatar) {
    case "tabby":
      return "虎斑";
    case "calico":
      return "三花";
    case "black":
      return "黑貓";
    case "white":
      return "白貓";
  }
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
  location: {
    fontWeight: 900,
    margin: 0,
  },
  meta: {
    color: "var(--info)",
    fontSize: "0.9rem",
    fontWeight: 800,
  },
} satisfies Record<string, CSSProperties>;
