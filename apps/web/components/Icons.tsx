/** Small stroke icons (24px grid), sized and coloured by the caller via className. */
type IconProps = { className?: string };

function Icon({ className = "h-5 w-5", children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      {children}
    </svg>
  );
}

export const PencilIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19l-4 1z" />
    <path d="M14.5 6.5l3 3" />
  </Icon>
);

export const EraserIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M7 21h13" />
    <path d="M4.6 15.4l9.8-9.8a2 2 0 012.8 0l2.2 2.2a2 2 0 010 2.8L11 19H8.2a2 2 0 01-1.4-.6l-2.2-2.2a2 2 0 010-2.8z" />
    <path d="M9 11l5 5" />
  </Icon>
);

export const UndoIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M9 14L4 9l5-5" />
    <path d="M4 9h10.5a5.5 5.5 0 010 11H11" />
  </Icon>
);

export const TrashIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M4 7h16" />
    <path d="M10 11v6M14 11v6" />
    <path d="M6 7l1 12a2 2 0 002 2h6a2 2 0 002-2l1-12" />
    <path d="M9 7V4h6v3" />
  </Icon>
);

export const CrownIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 8l4 4 5-7 5 7 4-4-2 11H5L3 8z" />
  </Icon>
);

export const CheckIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12.5l4.5 4.5L19 7" />
  </Icon>
);

export const LinkIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M10 14a4.5 4.5 0 006.4 0l3-3a4.5 4.5 0 00-6.4-6.4l-1 1" />
    <path d="M14 10a4.5 4.5 0 00-6.4 0l-3 3a4.5 4.5 0 006.4 6.4l1-1" />
  </Icon>
);

export const SendIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M5 12h14" />
    <path d="M13 6l6 6-6 6" />
  </Icon>
);

export const ArrowIcon = SendIcon;

export const OfflineIcon = (p: IconProps) => (
  <Icon {...p}>
    <path d="M3 3l18 18" />
    <path d="M8.5 16.5a5 5 0 017 0M5 12.5a10 10 0 014.2-2.4M19 12.5a10 10 0 00-3.2-2M2 8.8a15 15 0 014.4-2.6M22 8.8A15 15 0 0011.5 5" />
    <path d="M12 20h.01" />
  </Icon>
);
