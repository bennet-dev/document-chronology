interface EventTypeBadgeProps {
  type: string;
}

const typeColors: Record<string, { bg: string; text: string }> = {
  visit: { bg: "bg-blue-100 dark:bg-blue-900/30", text: "text-blue-700 dark:text-blue-300" },
  lab: { bg: "bg-green-100 dark:bg-green-900/30", text: "text-green-700 dark:text-green-300" },
  imaging: { bg: "bg-purple-100 dark:bg-purple-900/30", text: "text-purple-700 dark:text-purple-300" },
  procedure: { bg: "bg-red-100 dark:bg-red-900/30", text: "text-red-700 dark:text-red-300" },
  medication: { bg: "bg-orange-100 dark:bg-orange-900/30", text: "text-orange-700 dark:text-orange-300" },
  note: { bg: "bg-zinc-100 dark:bg-zinc-700/50", text: "text-zinc-700 dark:text-zinc-300" },
  other: { bg: "bg-zinc-100 dark:bg-zinc-700/50", text: "text-zinc-600 dark:text-zinc-400" },
};

export function EventTypeBadge({ type }: EventTypeBadgeProps) {
  const colors = typeColors[type] || typeColors.other;

  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text}`}
    >
      {type}
    </span>
  );
}
