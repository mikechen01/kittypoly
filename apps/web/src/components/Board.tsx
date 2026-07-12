import type { CSSProperties } from "react";
import { BOARD } from "@kittypoly/game";
import type { RoomPublic, SpaceKind } from "@kittypoly/game";
import { CatAvatar } from "./CatAvatar";

interface BoardProps {
  room: RoomPublic;
}

const KIND_LABELS: Record<SpaceKind, string> = {
  go: "GO",
  territory: "地盤",
  catTree: "貓樹",
  scratch: "抓板",
  teaser: "逗貓",
  cage: "貓籠",
  goToCage: "進籠",
  rest: "休息",
};

const GROUP_COLORS = {
  brown: "#8d5524",
  lightBlue: "#8ecae6",
  pink: "#ff8fab",
  orange: "#fb8500",
  red: "#e63946",
  yellow: "#ffd166",
  green: "#06d6a0",
  darkBlue: "#26547c",
};

export function Board({ room }: BoardProps) {
  const currentPosition = room.players.find((player) => player.id === room.match.currentPlayerId)?.position;

  return (
    <section aria-label="Game board" style={styles.board}>
      {BOARD.map((space) => {
        const playersHere = room.players.filter((player) => player.position === space.index && !player.bankrupt);
        const owner = room.match.ownership[space.id];
        const isCurrent = currentPosition === space.index;

        return (
          <article
            key={space.id}
            style={{
              ...styles.cell,
              ...cellPosition(space.index),
              ...(isCurrent ? styles.currentCell : {}),
            }}
          >
            {"group" in space ? (
              <span style={{ ...styles.colorBar, background: GROUP_COLORS[space.group] }} aria-hidden="true" />
            ) : null}
            <div style={styles.cellHeader}>
              <span style={styles.index}>{space.index}</span>
              <span style={styles.kind}>{KIND_LABELS[space.kind]}</span>
            </div>
            <strong style={styles.name}>{space.name}</strong>
            {"price" in space ? <span style={styles.price}>{space.price} food</span> : null}
            {owner ? (
              <span style={styles.owner}>
                {room.players.find((player) => player.id === owner.ownerId)?.nickname ?? "Owned"}
                {owner.buildings ? ` +${owner.buildings}` : ""}
              </span>
            ) : null}
            {playersHere.length ? (
              <div style={styles.tokens}>
                {playersHere.map((player) => (
                  <span key={player.id} title={player.nickname} style={styles.token}>
                    <CatAvatar id={player.avatar} size={22} />
                  </span>
                ))}
              </div>
            ) : null}
          </article>
        );
      })}
      <div style={styles.center}>
        <p style={styles.eyebrow}>Room {room.code}</p>
        <h2 style={styles.title}>KittyPoly</h2>
        <p style={styles.subtitle}>40 comic spaces, one hungry winner.</p>
      </div>
    </section>
  );
}

function cellPosition(index: number): CSSProperties {
  if (index === 0) return { gridColumn: 11, gridRow: 11 };
  if (index < 10) return { gridColumn: 11 - index, gridRow: 11 };
  if (index === 10) return { gridColumn: 1, gridRow: 11 };
  if (index < 20) return { gridColumn: 1, gridRow: 21 - index };
  if (index === 20) return { gridColumn: 1, gridRow: 1 };
  if (index < 30) return { gridColumn: index - 19, gridRow: 1 };
  if (index === 30) return { gridColumn: 11, gridRow: 1 };
  return { gridColumn: 11, gridRow: index - 29 };
}

const styles = {
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(11, minmax(4.8rem, 1fr))",
    gridTemplateRows: "repeat(11, minmax(4.8rem, 1fr))",
    gap: "0.35rem",
    minWidth: "min(100%, 62rem)",
  },
  cell: {
    background: "white",
    border: "var(--border)",
    boxShadow: "4px 4px 0 var(--ink)",
    display: "grid",
    gap: "0.2rem",
    minHeight: "4.8rem",
    overflow: "hidden",
    padding: "0.35rem",
    position: "relative",
  },
  currentCell: {
    outline: "4px solid var(--accent)",
    transform: "rotate(-1deg)",
  },
  colorBar: {
    borderBottom: "var(--border)",
    display: "block",
    height: "0.45rem",
    margin: "-0.35rem -0.35rem 0",
  },
  cellHeader: {
    alignItems: "center",
    display: "flex",
    justifyContent: "space-between",
    gap: "0.25rem",
  },
  index: {
    fontSize: "0.72rem",
    fontWeight: 900,
  },
  kind: {
    background: "var(--accent-2)",
    border: "1px solid var(--ink)",
    fontSize: "0.62rem",
    fontWeight: 900,
    padding: "0 0.2rem",
  },
  name: {
    fontSize: "0.78rem",
    lineHeight: 1.05,
  },
  price: {
    fontSize: "0.68rem",
    fontWeight: 800,
  },
  owner: {
    color: "var(--info)",
    fontSize: "0.68rem",
    fontWeight: 900,
  },
  tokens: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.2rem",
  },
  token: {
    background: "white",
    border: "2px solid var(--ink)",
    borderRadius: "999px",
    display: "grid",
    lineHeight: 1,
    overflow: "hidden",
    padding: "1px",
    placeItems: "center",
  },
  center: {
    alignSelf: "stretch",
    background: "var(--accent-2)",
    border: "var(--border)",
    boxShadow: "8px 8px 0 var(--ink)",
    display: "grid",
    gridColumn: "3 / 10",
    gridRow: "3 / 10",
    placeItems: "center",
    padding: "2rem",
    textAlign: "center",
  },
  eyebrow: {
    color: "var(--accent)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(2.5rem, 8vw, 5rem)",
    lineHeight: 1,
    margin: "0.4rem 0",
  },
  subtitle: {
    fontWeight: 800,
    margin: 0,
  },
} satisfies Record<string, CSSProperties>;
