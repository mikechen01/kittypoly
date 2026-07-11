import { type CSSProperties, type ReactNode } from "react";
import { BOARD, type GameEvent, type RoomPublic } from "@kittypoly/game";
import { ActionPanel } from "../components/ActionPanel";
import { Board } from "../components/Board";
import type { ClientMessage } from "../ws/client";

type Intent = Extract<ClientMessage, { type: "intent" }>["intent"];

interface MatchProps {
  room: RoomPublic;
  playerId: string;
  error: string | null;
  onIntent: (intent: Intent, spaceId?: string) => void;
}

export function Match({ room, playerId, error, onIntent }: MatchProps) {
  const me = room.players.find((player) => player.id === playerId);
  const others = room.players.filter((player) => player.id !== playerId);
  const mySpace = me ? BOARD[me.position] : undefined;
  const mySpaceName = mySpace?.name ?? (me ? `第 ${me.position} 格` : "—");
  const myEvents = filterMyEvents(room.match.events, me?.nickname ?? "");

  return (
    <main style={styles.shell}>
      <div style={styles.top}>
        <Board room={room} />
        <div style={styles.side}>
          <section style={styles.selfCard} aria-label="我的資訊">
            <p style={styles.eyebrow}>我的狀態</p>
            <h2 style={styles.selfTitle}>{me?.nickname ?? "玩家"}</h2>
            {me ? (
              <>
                <p style={styles.location}>
                  現在位置：{me.inCage ? `貓籠（原格：${mySpaceName}）` : mySpaceName}
                </p>
                <p style={styles.meta}>
                  {avatarLabel(me.avatar)} · {me.food} 貓糧
                  {me.bankrupt ? " · 已破產" : ""}
                </p>
              </>
            ) : null}

            <div style={styles.divider} />

            <h3 style={styles.subheading}>與我有關的事件</h3>
            {myEvents.length ? (
              <ol style={styles.eventList}>
                {myEvents.map((event) => (
                  <li key={event.id} style={styles.eventItem}>
                    <time style={styles.time}>{new Date(event.at).toLocaleTimeString()}</time>
                    <span>{renderEventMessage(event.message, me?.nickname ?? "")}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p style={styles.empty}>還沒有與你有關的事件。</p>
            )}

            <div style={styles.divider} />

            <ActionPanel room={room} playerId={playerId} error={error} onIntent={onIntent} embedded />
          </section>

          <section style={styles.othersCard} aria-label="其他玩家">
            <h2 style={styles.heading}>其他玩家</h2>
            <div style={styles.players}>
              {others.length ? (
                others.map((player) => {
                  const space = BOARD[player.position];
                  const spaceName = space?.name ?? `第 ${player.position} 格`;
                  return (
                    <article
                      key={player.id}
                      style={{
                        ...styles.player,
                        ...(player.id === room.match.currentPlayerId ? styles.activePlayer : {}),
                        ...(player.bankrupt ? styles.bankruptPlayer : {}),
                      }}
                    >
                      <strong>{player.nickname}</strong>
                      <span style={styles.location}>
                        現在位置：{player.inCage ? `貓籠（原格：${spaceName}）` : spaceName}
                      </span>
                      <span style={styles.meta}>
                        {avatarLabel(player.avatar)} · {player.food} 貓糧
                        {player.bankrupt ? " · 已破產" : ""}
                        {player.id === room.match.currentPlayerId ? " · 行動中" : ""}
                      </span>
                    </article>
                  );
                })
              ) : (
                <p style={styles.empty}>目前沒有其他玩家。</p>
              )}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}

function filterMyEvents(events: GameEvent[], nickname: string): GameEvent[] {
  if (!nickname) return [];
  return events.filter((event) => event.message.includes(nickname)).slice(-12).reverse();
}

/** 收入金額藍色、支出金額紅色；收到租金對自己算收入。 */
function renderEventMessage(message: string, nickname: string): ReactNode {
  const amountPattern = /(獲得|支付|賠償|損失|無法支付)\s*(\d+)/g;
  const nodes: ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = amountPattern.exec(message)) !== null) {
    const [full, verb, amount] = match;
    nodes.push(message.slice(lastIndex, match.index));
    nodes.push(`${verb} `);

    const polarity = amountPolarity(message, nickname, verb);
    nodes.push(
      <span
        key={key++}
        style={{
          color: polarity === "income" ? "#1d4ed8" : "#dc2626",
          fontWeight: 900,
        }}
      >
        {amount}
      </span>,
    );
    lastIndex = match.index + full.length;
  }

  nodes.push(message.slice(lastIndex));
  return nodes;
}

function amountPolarity(
  message: string,
  nickname: string,
  verb: string,
): "income" | "expense" {
  if (verb === "獲得") return "income";
  if (verb === "支付" && nickname && message.includes(`給 ${nickname}`) && !message.startsWith(nickname)) {
    return "income";
  }
  return "expense";
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
    gridTemplateColumns: "minmax(0, 1fr) minmax(18rem, 26rem)",
  },
  side: {
    alignSelf: "start",
    display: "grid",
    gap: "1rem",
    position: "sticky",
    top: "1rem",
  },
  selfCard: {
    background: "white",
    border: "var(--border)",
    boxShadow: "6px 6px 0 var(--ink)",
    display: "grid",
    gap: "0.75rem",
    padding: "1rem",
  },
  othersCard: {
    background: "white",
    border: "var(--border)",
    boxShadow: "6px 6px 0 var(--ink)",
    padding: "1rem",
  },
  eyebrow: {
    color: "var(--accent)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    margin: 0,
    textTransform: "uppercase",
  },
  selfTitle: {
    margin: 0,
  },
  heading: {
    margin: "0 0 0.75rem",
  },
  subheading: {
    fontSize: "1rem",
    margin: 0,
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
    margin: 0,
  },
  divider: {
    borderTop: "2px dashed var(--ink)",
    margin: "0.15rem 0",
  },
  eventList: {
    display: "grid",
    gap: "0.5rem",
    listStyle: "none",
    margin: 0,
    maxHeight: "12rem",
    overflow: "auto",
    padding: 0,
  },
  eventItem: {
    borderBottom: "1px dashed #ccc",
    display: "grid",
    gap: "0.15rem",
    fontSize: "0.9rem",
    paddingBottom: "0.4rem",
  },
  time: {
    color: "var(--info)",
    fontSize: "0.75rem",
    fontWeight: 900,
  },
  empty: {
    color: "var(--info)",
    fontWeight: 800,
    margin: 0,
  },
} satisfies Record<string, CSSProperties>;
