import type { CSSProperties } from "react";
import { CAT_AVATARS, type CatAvatarId, type RoomPublic } from "@kittypoly/game";

interface LobbyProps {
  room: RoomPublic;
  playerId: string;
  error: string | null;
  onStart: () => void;
  onKick: (playerId: string) => void;
  onSetAvatar: (avatar: CatAvatarId) => void;
}

export function Lobby({ room, playerId, error, onStart, onKick, onSetAvatar }: LobbyProps) {
  const isHost = room.hostId === playerId;
  const me = room.players.find((player) => player.id === playerId);
  const takenByOthers = new Set(
    room.players.filter((player) => player.id !== playerId).map((player) => player.avatar),
  );

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>{isHost ? "You are hosting" : "Waiting for host"}</p>
        <h1 style={styles.code}>{room.code}</h1>
        <p>Share this room code with 2-4 players.</p>

        <div>
          <p style={styles.labelText}>Your cat</p>
          <div style={styles.avatarRow}>
            {CAT_AVATARS.map((candidate) => {
              const taken = takenByOthers.has(candidate);
              const selected = me?.avatar === candidate;
              return (
                <button
                  key={candidate}
                  type="button"
                  disabled={taken}
                  onClick={() => onSetAvatar(candidate)}
                  style={{
                    ...styles.avatarButton,
                    ...(selected ? styles.avatarSelected : {}),
                    ...(taken ? styles.avatarTaken : {}),
                  }}
                >
                  {candidate}
                  {taken ? " · 已選" : ""}
                </button>
              );
            })}
          </div>
        </div>

        <div style={styles.players}>
          {room.players.map((player) => (
            <article key={player.id} style={styles.player}>
              <div>
                <strong>
                  {player.nickname} {player.id === room.hostId ? "(host)" : ""}
                </strong>
                <p style={styles.meta}>
                  {player.avatar} cat · {player.connected ? "online" : "offline"}
                </p>
              </div>
              {isHost && player.id !== playerId ? (
                <button type="button" onClick={() => onKick(player.id)}>
                  Kick
                </button>
              ) : null}
            </article>
          ))}
        </div>

        {isHost ? (
          <button type="button" disabled={room.players.length < 2} onClick={onStart}>
            Start Game
          </button>
        ) : (
          <p style={styles.wait}>The host will start when every cat is ready.</p>
        )}
        {error ? <p style={styles.error}>{error}</p> : null}
      </section>
    </main>
  );
}

const styles = {
  shell: {
    minHeight: "100vh",
    display: "grid",
    placeItems: "center",
    padding: "2rem",
  },
  card: {
    border: "var(--border)",
    boxShadow: "8px 8px 0 var(--ink)",
    background: "white",
    width: "min(760px, 100%)",
    padding: "2rem",
  },
  eyebrow: {
    color: "var(--info)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  code: {
    background: "var(--accent-2)",
    border: "var(--border)",
    display: "inline-block",
    fontSize: "clamp(3rem, 14vw, 7rem)",
    letterSpacing: "0.08em",
    lineHeight: 1,
    margin: "0.5rem 0 1rem",
    padding: "0.5rem 1rem",
  },
  labelText: {
    fontWeight: 800,
    margin: "0 0 0.5rem",
  },
  avatarRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.7rem",
    marginBottom: "0.5rem",
  },
  avatarButton: {
    textTransform: "capitalize",
  },
  avatarSelected: {
    outline: "4px solid var(--accent)",
  },
  avatarTaken: {
    opacity: 0.45,
    cursor: "not-allowed",
  },
  players: {
    display: "grid",
    gap: "0.8rem",
    margin: "1.5rem 0",
  },
  player: {
    alignItems: "center",
    border: "var(--border)",
    display: "flex",
    justifyContent: "space-between",
    gap: "1rem",
    padding: "0.9rem",
  },
  meta: {
    margin: "0.25rem 0 0",
    textTransform: "capitalize",
  },
  wait: {
    color: "var(--info)",
    fontWeight: 800,
  },
  error: {
    color: "var(--accent)",
    fontWeight: 800,
  },
} satisfies Record<string, CSSProperties>;
