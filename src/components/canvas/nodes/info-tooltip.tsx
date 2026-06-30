"use client";

import { Info } from "lucide-react";

export function InfoTooltip({
  text,
  side = "right",
}: {
  text: string;
  side?: "right" | "bottom";
}) {
  const positionClasses =
    side === "right"
      ? "left-full top-1/2 ml-2 -translate-y-1/2"
      : "right-0 top-full mt-1.5";

  return (
    <span className="group/tip relative inline-flex shrink-0">
      <Info className="h-3.5 w-3.5 cursor-default text-gray-400" />
      <span
        className={`pointer-events-none absolute z-50 hidden w-max max-w-[220px] rounded-lg border border-gray-200 bg-white px-3 py-2 text-[11px] leading-snug text-gray-700 shadow-lg group-hover/tip:block ${positionClasses}`}
      >
        {text}
      </span>
    </span>
  );
}