import type { CSSProperties } from "react";
import type { CatAvatarId } from "@kittypoly/game";

const LABELS: Record<CatAvatarId, string> = {
  tabby: "虎斑",
  calico: "三花",
  black: "黑貓",
  white: "白貓",
};

const PALETTES: Record<
  CatAvatarId,
  { fur: string; fur2: string; ear: string; nose: string; eye: string }
> = {
  tabby: { fur: "#d4a017", fur2: "#8d5524", ear: "#f4a261", nose: "#e76f51", eye: "#1a1a1a" },
  calico: { fur: "#fff7e6", fur2: "#ff6b35", ear: "#ffb4a2", nose: "#e76f51", eye: "#1a1a1a" },
  black: { fur: "#2b2d42", fur2: "#4a4e69", ear: "#6c757d", nose: "#ffb4a2", eye: "#ffd166" },
  white: { fur: "#f8f9fa", fur2: "#e9ecef", ear: "#ffc8dd", nose: "#ff8fab", eye: "#1a1a1a" },
};

interface CatAvatarProps {
  id: CatAvatarId;
  size?: number;
  title?: string;
  style?: CSSProperties;
}

export function avatarLabel(id: CatAvatarId): string {
  return LABELS[id];
}

export function CatAvatar({ id, size = 48, title, style }: CatAvatarProps) {
  const palette = PALETTES[id];
  const label = title ?? avatarLabel(id);

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={label}
      style={{ display: "block", flexShrink: 0, ...style }}
    >
      <title>{label}</title>
      {/* ears */}
      <path d="M12 28 L22 8 L28 26 Z" fill={palette.fur} stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M52 28 L42 8 L36 26 Z" fill={palette.fur} stroke="#1a1a1a" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 24 L22 12 L25 24 Z" fill={palette.ear} />
      <path d="M48 24 L42 12 L39 24 Z" fill={palette.ear} />
      {/* head */}
      <circle cx="32" cy="36" r="20" fill={palette.fur} stroke="#1a1a1a" strokeWidth="2.5" />
      {/* markings */}
      {id === "tabby" ? (
        <>
          <path d="M32 18 v10" stroke={palette.fur2} strokeWidth="3" strokeLinecap="round" />
          <path d="M26 20 l4 8" stroke={palette.fur2} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M38 20 l-4 8" stroke={palette.fur2} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : null}
      {id === "calico" ? (
        <>
          <path d="M18 30 Q24 22 30 28 Q22 34 18 30 Z" fill={palette.fur2} />
          <path d="M40 24 Q48 28 46 36 Q40 32 40 24 Z" fill="#1a1a1a" />
        </>
      ) : null}
      {id === "black" ? <circle cx="32" cy="36" r="20" fill={palette.fur} /> : null}
      {/* eyes */}
      <ellipse cx="24" cy="34" rx="3.2" ry="4" fill={palette.eye} />
      <ellipse cx="40" cy="34" rx="3.2" ry="4" fill={palette.eye} />
      <circle cx="24.8" cy="32.8" r="1" fill="#fff" />
      <circle cx="40.8" cy="32.8" r="1" fill="#fff" />
      {/* nose + mouth */}
      <path d="M32 40 l-3 3 h6 Z" fill={palette.nose} stroke="#1a1a1a" strokeWidth="1.2" strokeLinejoin="round" />
      <path d="M32 43 v4 M32 47 q-5 3 -8 0 M32 47 q5 3 8 0" fill="none" stroke="#1a1a1a" strokeWidth="1.6" strokeLinecap="round" />
      {/* whiskers */}
      <path d="M14 38 h10 M14 42 h10 M40 38 h10 M40 42 h10" stroke="#1a1a1a" strokeWidth="1.2" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}
