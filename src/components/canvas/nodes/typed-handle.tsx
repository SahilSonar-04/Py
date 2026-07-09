import { Handle, Position } from "reactflow";
import type { HandleDataType } from "@/types/workflow";

const COLOR_MAP: Record<HandleDataType, string> = {
  text: "#f59e0b",
  image: "#3b82f6",
  video: "#8b5cf6",
  audio: "#06b6d4",
  file: "#64748b",
  number: "#ec4899",
  boolean: "#6366f1",
  any: "#22c55e",
};

export function TypedHandle({
  type,
  position,
  id,
  dataType,
  style,
}: {
  type: "source" | "target";
  position: Position;
  id: string;
  dataType: HandleDataType;
  style?: React.CSSProperties;
}) {
  const color = COLOR_MAP[dataType];
  return (
    <span className="relative inline-flex h-3.5 w-3.5 items-center justify-center">
      {}
      <span
        className="handle-halo"
        style={{ backgroundColor: `${color}2e`, boxShadow: `0 0 0 1px ${color}33` }}
      />
      <Handle
        type={type}
        position={position}
        id={id}
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          right: "auto",
          bottom: "auto",
          transform: "translate(-50%, -50%)",
          width: 14,
          height: 14,
          borderRadius: 9999,
          background: color,
          border: `2px solid ${color}80`,
          boxShadow: `0 0 8px ${color}50`,
          ...style,
        }}
      />
    </span>
  );
}