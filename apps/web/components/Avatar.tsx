const PALETTE = [
  { bg: "#ff5a1f", fg: "#ffffff" },
  { bg: "#7c5cff", fg: "#ffffff" },
  { bg: "#12a66d", fg: "#ffffff" },
  { bg: "#ffd43b", fg: "#17140f" },
  { bg: "#ff7eb6", fg: "#17140f" },
  { bg: "#2f8cff", fg: "#ffffff" },
  { bg: "#00b5b8", fg: "#ffffff" },
  { bg: "#e8ecff", fg: "#05060a" },
];

/** Stable colour per player id, so everyone sees the same colour for the same player. */
export function playerColor(id: string) {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return PALETTE[Math.abs(h) % PALETTE.length]!;
}

export function Avatar({
  id,
  name,
  size = "md",
  ring = false,
}: {
  id: string;
  name: string;
  size?: "sm" | "md" | "lg";
  ring?: boolean;
}) {
  const { bg, fg } = playerColor(id);
  const sizes = { sm: "h-7 w-7 text-xs", md: "h-9 w-9 text-sm", lg: "h-12 w-12 text-lg" };
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full font-display font-bold ${sizes[size]} ${
        ring ? "ring-2 ring-accent ring-offset-2 ring-offset-bg" : ""
      }`}
      style={{ backgroundColor: bg, color: fg }}
    >
      {[...name.trim()][0]?.toUpperCase() ?? "?"}
    </span>
  );
}
