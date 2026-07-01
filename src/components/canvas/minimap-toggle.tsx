"use client";

import { useState } from "react";
import { MiniMap } from "reactflow";
import { Map as MapIcon, Minimize2 } from "lucide-react";

const NODE_COLORS: Record<string, string> = {
  request: "#22c55e",
  crop_image: "#3b82f6",
  gemini: "#f59e0b",
  response: "#22c55e",
  sticky_note: "#a78bfa",
};

/**
 * Bottom-right minimap. Collapsed by default (a single map-icon button);
 * clicking it expands into a dark minimap panel with a small collapse
 * button. React Flow's own maskColor keeps the currently-visible viewport
 * clear while dulling everything outside it.
 *
 * Slides left in sync with the history panel opening, same as the bottom
 * toolbar, so it never gets covered.
 */
export function MinimapToggle({ historyOpen }: { historyOpen?: boolean }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="absolute bottom-4 right-4 z-20 transition-transform duration-300 ease-in-out"
      style={{ transform: historyOpen ? "translateX(-380px)" : "translateX(0)" }}
    >
      {!expanded ? (
        <button
          suppressHydrationWarning
          onClick={() => setExpanded(true)}
          title="Show minimap"
          className="flex h-11 w-11 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 shadow-md transition-colors hover:bg-gray-50 hover:text-gray-800"
        >
          <MapIcon className="h-4 w-4" />
        </button>
      ) : (
        <div className="relative overflow-hidden rounded-2xl border border-gray-800 bg-[#0b0b10] shadow-2xl">
          <button
            suppressHydrationWarning
            onClick={() => setExpanded(false)}
            title="Hide minimap"
            className="absolute right-1.5 top-1.5 z-10 flex h-6 w-6 items-center justify-center rounded-md bg-black/40 text-gray-300 transition-colors hover:bg-black/60 hover:text-white"
          >
            <Minimize2 className="h-3 w-3" />
          </button>
          <MiniMap
            pannable
            zoomable
            position="bottom-right"
            nodeColor={(n) => NODE_COLORS[n.type ?? ""] ?? "#6b7280"}
            nodeStrokeWidth={0}
            maskColor="rgba(0,0,0,0.75)"
            className="!static !m-0 !bg-transparent"
            style={{ width: 200, height: 140 }}
          />
        </div>
      )}
    </div>
  );
}