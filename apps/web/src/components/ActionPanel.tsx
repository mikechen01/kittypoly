import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { getBuildableTerritories, type RoomPublic } from "@kittypoly/game";
import type { ClientMessage } from "../ws/client";

type Intent = Extract<ClientMessage, { type: "intent" }>["intent"];

interface ActionPanelProps {
  room: RoomPublic;
  playerId: string;
  error: string | null;
  onIntent: (intent: Intent, spaceId?: string) => void;
  embedded?: boolean;
}

export function ActionPanel({ room, playerId, error, onIntent, embedded = false }: ActionPanelProps) {
  const [selectedSpaceId, setSelectedSpaceId] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const match = room.match;
  const player = room.players.find((candidate) => candidate.id === playerId);
  const currentPlayer = room.players.find((candidate) => candidate.id === match.currentPlayerId);
  const isMyTurn = playerId === match.currentPlayerId;
  const secondsLeft =
    match.turnDeadlineMs === null ? null : Math.max(0, Math.ceil((match.turnDeadlineMs - now) / 1_000));

  const buildables = useMemo(() => {
    if (!player) return [];
    return getBuildableTerritories({
      playerId: player.id,
      food: player.food,
      position: player.position,
      ownership: match.ownership,
    });
  }, [player, match.ownership]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!buildables.some((space) => space.id === selectedSpaceId)) {
      setSelectedSpaceId(buildables[0]?.id ?? "");
    }
  }, [buildables, selectedSpaceId]);

  const showDice = isMyTurn && match.lastDice !== null;
  const diceLabel = showDice
    ? `骰子：${match.lastDice![0]} + ${match.lastDice![1]} = ${match.lastDice![0] + match.lastDice![1]}`
    : null;

  return (
    <div style={embedded ? styles.embedded : styles.panel}>
      <h3 style={styles.subheading}>操作</h3>
      <p style={styles.meta}>
        {isMyTurn ? (
          <>
            輪到你 · <strong>{awaitingLabel(match.awaiting)}</strong>
            {secondsLeft === null ? "" : ` · 剩餘 ${secondsLeft} 秒`}
          </>
        ) : (
          <>等待 {currentPlayer?.nickname ?? "其他玩家"} 行動中</>
        )}
      </p>
      {diceLabel ? <p style={styles.dice}>{diceLabel}</p> : null}

      {player?.inCage && isMyTurn ? (
        <button type="button" onClick={() => onIntent("payCageFine")} style={styles.fullButton}>
          付罰金離開貓籠
        </button>
      ) : null}

      <div style={styles.actions}>
        {isMyTurn ? (
          <>
            {match.awaiting === "roll" ? (
              <button type="button" onClick={() => onIntent("rollDice")}>
                擲骰子
              </button>
            ) : null}

            {match.awaiting === "buyOrSkip" ? (
              <>
                <button type="button" onClick={() => onIntent("buyTerritory")}>
                  購買
                </button>
                <button type="button" onClick={() => onIntent("skipBuy")} style={styles.secondaryButton}>
                  略過
                </button>
              </>
            ) : null}

            {match.awaiting === "buildOrEnd" ? (
              <>
                <p style={styles.hint}>
                  第一次買地當回合不能蓋房；之後再走到自己的領地，才能蓋 1 間貓屋／升級。
                </p>
                {buildables.length > 0 ? (
                  <label style={styles.label}>
                    蓋貓屋／貓別墅
                    <select
                      style={styles.input}
                      value={selectedSpaceId}
                      onChange={(event) => setSelectedSpaceId(event.target.value)}
                    >
                      {buildables.map((space) => (
                        <option key={space.id} value={space.id}>
                          {space.name}（目前 {space.buildings} → {space.nextLabel}，{space.houseCost} 貓糧）
                        </option>
                      ))}
                    </select>
                  </label>
                ) : (
                  <p style={styles.wait}>
                    目前不能建造：要再次停在自己擁有的領地上才可以蓋 1 間。
                  </p>
                )}
                <button
                  type="button"
                  disabled={!selectedSpaceId}
                  onClick={() => onIntent("buildHouse", selectedSpaceId)}
                >
                  建造
                </button>
                <button type="button" onClick={() => onIntent("endTurn")} style={styles.secondaryButton}>
                  結束回合
                </button>
              </>
            ) : null}

            {match.awaiting === "end" ? (
              <button type="button" onClick={() => onIntent("endTurn")}>
                結束回合
              </button>
            ) : null}
          </>
        ) : (
          <p style={styles.wait}>輪到你時才能操作。</p>
        )}
      </div>

      {error ? <p style={styles.error}>{error}</p> : null}
    </div>
  );
}

function awaitingLabel(awaiting: RoomPublic["match"]["awaiting"]): string {
  switch (awaiting) {
    case "roll":
      return "等待擲骰";
    case "buyOrSkip":
      return "購買或略過";
    case "buildOrEnd":
      return "建造或結束";
    case "end":
      return "結束回合";
  }
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
  },
  embedded: {
    display: "grid",
    gap: "0.7rem",
  },
  subheading: {
    fontSize: "1rem",
    margin: 0,
  },
  meta: {
    color: "var(--info)",
    fontWeight: 800,
    margin: 0,
  },
  dice: {
    background: "var(--accent-2)",
    border: "var(--border)",
    fontSize: "1.15rem",
    fontWeight: 900,
    margin: 0,
    padding: "0.55rem 0.75rem",
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
  hint: {
    color: "var(--ink)",
    fontSize: "0.92rem",
    fontWeight: 700,
    margin: 0,
  },
  error: {
    color: "var(--accent)",
    fontWeight: 800,
    margin: 0,
  },
} satisfies Record<string, CSSProperties>;
