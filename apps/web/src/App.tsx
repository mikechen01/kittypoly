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

    if (message.type === "roomEnded") {
      clearSession();
      setRoom(null);
      setPlayerId(null);
      setError("房主已解散房間");
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

  function handleEndRoom(): void {
    if (!window.confirm("確定解散房間？所有人都會回到首頁。")) return;
    client.send({ type: "endRoom" });
  }

  if (!room || !playerId) {
    return (
      <Home
        status={status}
        error={error}
        onCreate={(nickname) => client.send({ type: "createRoom", nickname })}
        onJoin={(code, nickname) => client.send({ type: "joinRoom", code, nickname })}
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
        onSetAvatar={(avatar) => client.send({ type: "setAvatar", avatar })}
        onEndRoom={handleEndRoom}
      />
    );
  }

  if (room.match.phase === "finished") {
    return (
      <Results
        room={room}
        playerId={playerId}
        onClearSession={handleClearSession}
        onEndRoom={handleEndRoom}
      />
    );
  }

  return (
    <Match
      room={room}
      playerId={playerId}
      error={error}
      onIntent={(intent, spaceId) => client.send({ type: "intent", intent, spaceId })}
      onEndRoom={handleEndRoom}
    />
  );
}
