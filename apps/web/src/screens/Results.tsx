import type { CSSProperties } from "react";
import type { PlayerPublic, RoomPublic } from "@kittypoly/game";
import { CatAvatar, avatarLabel } from "../components/CatAvatar";

interface ResultsProps {
  room: RoomPublic;
  playerId: string;
  onClearSession: () => void;
  onEndRoom: () => void;
}

export function Results({ room, playerId, onClearSession, onEndRoom }: ResultsProps) {
  const winner = resolveWinner(room);
  const isHost = room.hostId === playerId;

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>遊戲結束</p>
        {winner ? <CatAvatar id={winner.avatar} size={96} style={styles.winnerAvatar} /> : null}
        <h1 style={styles.title}>{winner?.nickname ?? "沒有勝者"}</h1>
        <p style={styles.copy}>
          {winner
            ? `${winner.nickname}（${avatarLabel(winner.avatar)}）獲勝！成為最後一隻還沒破產的貓咪。`
            : "對局結束，沒有勝者。"}
        </p>
        <div style={styles.actions}>
          <button type="button" onClick={onClearSession}>
            Clear Session
          </button>
          {isHost ? (
            <button type="button" onClick={onEndRoom} style={styles.danger}>
              解散房間
            </button>
          ) : null}
        </div>
      </section>
    </main>
  );
}

/** Prefer winnerId when that seat is still solvent; otherwise sole non-bankrupt survivor. */
export function resolveWinner(room: RoomPublic): PlayerPublic | null {
  const byId = room.players.find((player) => player.id === room.match.winnerId);
  if (byId && !byId.bankrupt) return byId;

  const survivors = room.players.filter((player) => !player.bankrupt);
  return survivors.length === 1 ? survivors[0]! : null;
}

const styles = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "2rem",
  },
  card: {
    background: "white",
    border: "var(--border)",
    boxShadow: "8px 8px 0 var(--ink)",
    padding: "2rem",
    textAlign: "center",
    width: "min(720px, 100%)",
  },
  eyebrow: {
    color: "var(--accent)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(3rem, 10vw, 6rem)",
    lineHeight: 1,
    margin: "0.5rem 0 1rem",
  },
  copy: {
    fontWeight: 800,
  },
  winnerAvatar: {
    margin: "0 auto 0.5rem",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    justifyContent: "center",
    marginTop: "1.25rem",
  },
  danger: {
    background: "white",
    color: "var(--accent)",
  },
} satisfies Record<string, CSSProperties>;
