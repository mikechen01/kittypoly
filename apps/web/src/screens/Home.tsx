import { useState } from "react";
import type { CSSProperties } from "react";
import type { CatAvatarId } from "@kittypoly/game";

const AVATARS: CatAvatarId[] = ["tabby", "calico", "black", "white"];

interface HomeProps {
  status: string;
  error: string | null;
  onCreate: (nickname: string, avatar: CatAvatarId) => void;
  onJoin: (code: string, nickname: string, avatar: CatAvatarId) => void;
}

export function Home({ status, error, onCreate, onJoin }: HomeProps) {
  const [nickname, setNickname] = useState("");
  const [avatar, setAvatar] = useState<CatAvatarId>("tabby");
  const [code, setCode] = useState("");
  const trimmedNickname = nickname.trim();

  return (
    <main style={styles.shell}>
      <section style={styles.card}>
        <p style={styles.eyebrow}>comic cat monopoly</p>
        <h1 style={styles.title}>KittyPoly</h1>
        <p>Choose your cat, make a room, then invite the next troublemaker.</p>

        <label style={styles.label}>
          Nickname
          <input
            style={styles.input}
            value={nickname}
            maxLength={20}
            onChange={(event) => setNickname(event.target.value)}
            placeholder="Captain Whiskers"
          />
        </label>

        <div>
          <p style={styles.labelText}>Avatar</p>
          <div style={styles.avatarRow}>
            {AVATARS.map((candidate) => (
              <button
                key={candidate}
                type="button"
                onClick={() => setAvatar(candidate)}
                style={{
                  ...styles.avatarButton,
                  outline: candidate === avatar ? "4px solid var(--accent)" : "none",
                }}
              >
                {candidate}
              </button>
            ))}
          </div>
        </div>

        <div style={styles.actions}>
          <button type="button" disabled={!trimmedNickname} onClick={() => onCreate(trimmedNickname, avatar)}>
            Create Room
          </button>

          <label style={styles.joinLabel}>
            Room code
            <input
              style={styles.codeInput}
              value={code}
              maxLength={6}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              placeholder="ABC123"
            />
          </label>
          <button
            type="button"
            disabled={!trimmedNickname || !code.trim()}
            onClick={() => onJoin(code, trimmedNickname, avatar)}
          >
            Join
          </button>
        </div>

        <p style={styles.status}>Socket: {status}</p>
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
    width: "min(720px, 100%)",
    padding: "2rem",
  },
  eyebrow: {
    color: "var(--accent)",
    fontWeight: 900,
    letterSpacing: "0.08em",
    textTransform: "uppercase",
  },
  title: {
    fontSize: "clamp(3rem, 12vw, 6rem)",
    lineHeight: 1,
    margin: "0 0 1rem",
  },
  label: {
    display: "grid",
    gap: "0.4rem",
    fontWeight: 800,
    margin: "1.5rem 0",
  },
  labelText: {
    fontWeight: 800,
  },
  input: {
    border: "var(--border)",
    font: "inherit",
    padding: "0.7rem",
  },
  avatarRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.7rem",
  },
  avatarButton: {
    textTransform: "capitalize",
  },
  actions: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "end",
    gap: "0.8rem",
    marginTop: "1.5rem",
  },
  joinLabel: {
    display: "grid",
    gap: "0.25rem",
    fontWeight: 800,
  },
  codeInput: {
    border: "var(--border)",
    font: "inherit",
    padding: "0.55rem",
    textTransform: "uppercase",
    width: "8rem",
  },
  status: {
    marginTop: "1rem",
    color: "var(--info)",
    fontWeight: 800,
  },
  error: {
    color: "var(--accent)",
    fontWeight: 800,
  },
} satisfies Record<string, CSSProperties>;
