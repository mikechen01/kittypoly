import type { CSSProperties } from "react";
import type { GameEvent } from "@kittypoly/game";

interface EventLogProps {
  events: GameEvent[];
}

export function EventLog({ events }: EventLogProps) {
  const visibleEvents = events.slice(-30).reverse();

  return (
    <section style={styles.card} aria-label="Event log">
      <h2 style={styles.title}>Event Log</h2>
      {visibleEvents.length ? (
        <ol style={styles.list}>
          {visibleEvents.map((event) => (
            <li key={event.id} style={styles.item}>
              <time style={styles.time}>{new Date(event.at).toLocaleTimeString()}</time>
              <span>{event.message}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p style={styles.empty}>No events yet.</p>
      )}
    </section>
  );
}

const styles = {
  card: {
    background: "white",
    border: "var(--border)",
    boxShadow: "6px 6px 0 var(--ink)",
    padding: "1rem",
  },
  title: {
    margin: "0 0 0.75rem",
  },
  list: {
    display: "grid",
    gap: "0.6rem",
    listStyle: "none",
    margin: 0,
    maxHeight: "28rem",
    overflow: "auto",
    padding: 0,
  },
  item: {
    borderBottom: "2px dashed var(--ink)",
    display: "grid",
    gap: "0.2rem",
    paddingBottom: "0.5rem",
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
