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
    <Handle
      type={type}
      position={position}
      id={id}
      style={{
        width: 14,
        height: 14,
        borderRadius: 9999,
        background: color,
        border: `2px solid ${color}80`,
        boxShadow: `0 0 8px ${color}50`,
        ...style,
      }}
    />
  );
}
