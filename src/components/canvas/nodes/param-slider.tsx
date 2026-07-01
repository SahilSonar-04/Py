"use client";

import { RotateCcw, Plus } from "lucide-react";
import { InfoTooltip } from "./info-tooltip";

export function ParamSlider({
  label,
  value,
  min = 0,
  max = 100,
  defaultValue,
  disabled,
  info,
  connected,
  onChange,
  onAddToRequest,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  defaultValue: number;
  disabled?: boolean;
  info?: string;
  /** Hides the "Add to Request" button once this handle already has a connection. */
  connected?: boolean;
  onChange: (v: number) => void;
  onAddToRequest?: () => void;
}) {
  const pct = ((value - min) / (max - min)) * 100;

  return (
    <div className="flex items-center gap-2">
      <div className="flex w-[110px] shrink-0 items-center gap-1 text-xs text-gray-600">
        <span className="truncate">{label}</span>
        {info && <InfoTooltip text={info} side="right" />}
      </div>

      <div className="nodrag relative flex-1">
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(Number(e.target.value))}
          className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-gray-200 accent-indigo-500 disabled:cursor-not-allowed disabled:opacity-40"
          style={{
            background: `linear-gradient(to right, #6366f1 ${pct}%, #e5e7eb ${pct}%)`,
          }}
        />
      </div>

      <input
        type="number"
        min={min}
        max={max}
        value={value}
        disabled={disabled}
        onChange={(e) =>
          onChange(Math.max(min, Math.min(max, Number(e.target.value) || 0)))
        }
        className="nodrag h-7 w-12 shrink-0 rounded-md border border-gray-200 bg-white px-1.5 text-center text-xs text-gray-900 outline-none focus:border-indigo-500 disabled:opacity-40"
      />

      <button
        type="button"
        title="Reset"
        onClick={() => onChange(defaultValue)}
        className="nodrag shrink-0 rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
      >
        <RotateCcw className="h-3 w-3" />
      </button>

      {/* Once this handle is wired to anything (Request-Inputs or otherwise),
          there's nothing left to "add" — the button disappears for good. */}
      {!connected && (
        <span className="group/tip relative shrink-0">
          <button
            type="button"
            onClick={onAddToRequest}
            className="nodrag flex h-6 w-6 items-center justify-center rounded-md border border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100"
          >
            <Plus className="h-3 w-3" />
          </button>
          <span className="pointer-events-none absolute right-0 top-full z-50 mt-1.5 hidden whitespace-nowrap rounded-lg bg-gray-900 px-2 py-1 text-[10px] font-medium text-white group-hover/tip:block">
            Add to Request
          </span>
        </span>
      )}
    </div>
  );
}