import { useEffect, useMemo, useState } from "react";
import type { RoomPublic } from "@kittypoly/game";
import { Home } from "./screens/Home";
import { Lobby } from "./screens/Lobby";
import { Match } from "./screens/Match";
import { Results } from "./screens/Results";
import { clearSession, loadSession } from "./state/session";
import { KittyPolyClient } from "./ws/client";
import type { ServerMessage } from "./ws/client";

type SocketStatus = "connecting" | "open" | "closed";

export function App() {
  const client = useMemo(() => new KittyPolyClient(), []);
  const [status, setStatus] = useState<SocketStatus>("connecting");
  const [room, setRoom] = useState<RoomPublic | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => loadSession()?.playerId ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribeMessage = client.subscribe((message) => handleMessage(message));
    const unsubscribeStatus = client.subscribeStatus(setStatus);
    client.connect();

    return () => {
      unsubscribeMessage();
      unsubscribeStatus();
    };
  }, [client]);

  function handleMessage(message: ServerMessage): void {
    if (message.type === "error") {
      setError(message.message);
      if (message.code === "kicked") {
        clearSession();
        setRoom(null);
        setPlayerId(null);
      }
      return;
    }

    setError(null);
    setRoom(message.room);
    if (message.type === "welcome") setPlayerId(message.playerId);
  }

  function handleClearSession(): void {
    clearSession();
    setRoom(null);
    setPlayerId(null);
    setError(null);
  }

  if (!room || !playerId) {
    return (
      <Home
        status={status}
        error={error}
        onCreate={(nickname, avatar) => client.send({ type: "createRoom", nickname, avatar })}
        onJoin={(code, nickname, avatar) => client.send({ type: "joinRoom", code, nickname, avatar })}
      />
    );
  }

  if (room.match.phase === "lobby") {
    return (
      <Lobby
        room={room}
        playerId={playerId}
        error={error}
        onStart={() => client.send({ type: "startGame" })}
        onKick={(targetPlayerId) => client.send({ type: "kick", playerId: targetPlayerId })}
      />
    );
  }

  if (room.match.phase === "finished") {
    return <Results room={room} onClearSession={handleClearSession} />;
  }

  return (
    <Match
      room={room}
      playerId={playerId}
      error={error}
      onIntent={(intent, spaceId) => client.send({ type: "intent", intent, spaceId })}
    />
  );
}
