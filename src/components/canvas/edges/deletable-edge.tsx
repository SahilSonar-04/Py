"use client";

import { memo } from "react";
import {
  BaseEdge,
  EdgeLabelRenderer,
  getBezierPath,
  type EdgeProps,
} from "reactflow";
import { X } from "lucide-react";
import { useCanvasStore } from "@/store/canvas-store";

/**
 * Static (non-animated) bezier edge with a hover-revealed delete (×) button
 * at the midpoint. Hovering anywhere along the curve counts, since BaseEdge
 * renders a wide invisible interaction stroke under the visible line.
 */
function DeletableEdgeInner({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
  markerEnd,
}: EdgeProps) {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isHovered = useCanvasStore((s) => s.hoveredEdgeId === id);
  const setEdges = useCanvasStore((s) => s.setEdges);

  function handleDelete(e: React.MouseEvent) {
    e.stopPropagation();
    const currentEdges = useCanvasStore.getState().edges;
    setEdges(currentEdges.filter((edge) => edge.id !== id));
  }

  return (
    <>
      <BaseEdge
        id={id}
        path={edgePath}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={20}
      />
      {isHovered && (
        <EdgeLabelRenderer>
          <div
            style={{
              position: "absolute",
              transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
              pointerEvents: "all",
            }}
            className="nodrag nopan"
          >
            <button
              onClick={handleDelete}
              title="Remove connection"
              className="flex h-5 w-5 items-center justify-center rounded-full border border-red-300 bg-white text-red-500 shadow-md transition-colors hover:bg-red-500 hover:text-white"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
}

export const DeletableEdge = memo(DeletableEdgeInner);