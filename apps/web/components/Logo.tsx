export function Logo({ small = false }: { small?: boolean }) {
  return (
    <span
      className={`font-black tracking-tight text-white drop-shadow-[0_3px_0_rgba(30,27,75,0.5)] ${
        small ? "text-2xl" : "text-5xl sm:text-6xl"
      }`}
    >
      Krabbel<span className="text-amber-300">!</span>
    </span>
  );
}
