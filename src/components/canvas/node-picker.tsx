"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Search, Crop, Sparkles, X } from "lucide-react";
import { nanoid } from "nanoid";
import { useCanvasStore } from "@/store/canvas-store";
import type { CropImageData, GeminiData } from "@/types/workflow";

interface PickerItem {
  id: string;
  label: string;
  description: string;
  category: "Image" | "Video" | "Audio" | "Others";
  icon: React.ReactNode;
  enabled: boolean;
  create: () => { type: "crop_image" | "gemini"; data: CropImageData | GeminiData };
}

function buildItems(): PickerItem[] {
  return [
    {
      id: "crop_image",
      label: "Crop Image",
      description: "Crop an image by percentage-based bounding box (FFmpeg via Trigger.dev)",
      category: "Image",
      icon: <Crop className="h-4 w-4" />,
      enabled: true,
      create: () => ({
        type: "crop_image",
        data: {
          label: "Crop Image",
          inputImageUrl: "",
          x: 0,
          y: 0,
          width: 100,
          height: 100,
          status: "idle",
        } as CropImageData,
      }),
    },
    {
      id: "gemini",
      label: "Gemini 3.1 Pro",
      description: "Generate text with Gemini 3.1 Pro - supports vision, video, audio, file inputs",
      category: "Others",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: true,
      create: () => ({
        type: "gemini",
        data: {
          label: "Gemini 3.1 Pro",
          model: "gemini-3.1-pro",
          prompt: "",
          systemPrompt: "",
          imageUrls: [],
          videoUrl: "",
          audioUrl: "",
          fileUrl: "",
          status: "idle",
          settingsOpen: false,
        } as GeminiData,
      }),
    },
    {
      id: "video-gen",
      label: "Video Generation",
      description: "Coming soon",
      category: "Video",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: false,
      create: () => ({ type: "gemini", data: {} as GeminiData }),
    },
    {
      id: "audio-gen",
      label: "Audio Generation",
      description: "Coming soon",
      category: "Audio",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: false,
      create: () => ({ type: "gemini", data: {} as GeminiData }),
    },
  ];
}

const CATEGORIES = ["Recent", "Image", "Video", "Audio", "Others"] as const;

export function NodePicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<(typeof CATEGORIES)[number]>("Recent");
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);

  const items = useMemo(() => buildItems(), []);

  const filtered = items.filter((item) => {
    const matchesQuery = item.label.toLowerCase().includes(query.toLowerCase());
    const matchesCategory = activeCategory === "Recent" ? true : item.category === activeCategory;
    return matchesQuery && matchesCategory;
  });

  function handleSelect(item: PickerItem) {
    if (!item.enabled) return;
    const { type, data } = item.create();
    const id = `${type}_${nanoid(8)}`;
    const offsetX = 480 + (nodes.length % 4) * 60;
    const offsetY = -200 + (nodes.length % 5) * 120;
    addNode({ id, type, position: { x: offsetX, y: offsetY }, data });
    onClose();
  }

  const content = (
    <div
      className="fixed inset-0 z-[100] flex items-end justify-center bg-black/20 sm:items-center"
      onClick={onClose}
    >
      <div
        className="mb-20 w-[420px] max-w-[90vw] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl sm:mb-0"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
          <Search className="h-4 w-4 text-gray-400" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search nodes..."
            className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex gap-1 border-b border-gray-100 px-3 py-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                activeCategory === cat ? "bg-gray-900 text-white" : "text-gray-500 hover:bg-gray-100"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="max-h-80 overflow-y-auto p-2">
          {filtered.length === 0 && (
            <p className="px-3 py-6 text-center text-xs text-gray-400">No nodes found.</p>
          )}
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={() => handleSelect(item)}
              disabled={!item.enabled}
              className="flex w-full items-start gap-3 rounded-lg px-3 py-2.5 text-left hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-600">
                {item.icon}
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-sm font-medium text-gray-900">{item.label}</div>
                <div className="truncate text-xs text-gray-400">{item.description}</div>
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}