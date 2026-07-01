"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";

export function WorkflowHeader({ workflowId }: { workflowId: string }) {
  const workflowName = useCanvasStore((s) => s.workflowName);
  const setWorkflow = useCanvasStore((s) => s.setWorkflow);
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const [name, setName] = useState(workflowName);
  const [syncedName, setSyncedName] = useState(workflowName);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Adjust local state during render when the store's name changes externally
  // (e.g. after initial load), instead of setState-in-effect.
  if (workflowName !== syncedName) {
    setSyncedName(workflowName);
    setName(workflowName);
  }

  function handleChange(value: string) {
    setName(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setWorkflow(workflowId, value, nodes, edges);
      await fetch(`/api/workflows/${workflowId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: value }),
      });
    }, 600);
  }

  return (
    <div className="pointer-events-none absolute left-4 top-4 z-20 sm:left-4">
      <div className="pointer-events-auto inline-flex items-center gap-2 rounded-2xl border border-gray-200 bg-white/85 px-2 py-1.5 shadow-md backdrop-blur">
        <Link
          href="/dashboard"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-800 hover:bg-gray-50"
          title="Back to Dashboard"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <input
          suppressHydrationWarning
          value={name}
          onChange={(e) => handleChange(e.target.value)}
          maxLength={120}
          placeholder="Untitled"
          className="h-8 w-[160px] bg-transparent text-sm font-normal text-gray-900 outline-none placeholder:text-gray-400 sm:w-[200px]"
        />
      </div>
    </div>
  );
}