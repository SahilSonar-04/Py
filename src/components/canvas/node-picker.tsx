"use client";

import { useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Crop, Sparkles, X, ChevronRight, Clock,
  Image as ImageIcon, Video, Mic, Layers,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useReactFlow } from "reactflow";
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

const CATEGORY_ICON: Record<PickerItem["category"], React.ReactNode> = {
  Image: <ImageIcon className="h-3.5 w-3.5" />,
  Video: <Video className="h-3.5 w-3.5" />,
  Audio: <Mic className="h-3.5 w-3.5" />,
  Others: <Layers className="h-3.5 w-3.5" />,
};

function buildItems(): PickerItem[] {
  return [
    {
      id: "crop_image",
      label: "Crop Image",
      description: "Crop an image by percentage-based bounding box",
      category: "Image",
      icon: <Crop className="h-4 w-4" />,
      enabled: true,
      create: () => ({
        type: "crop_image",
        data: {
          label: "Crop Image", inputImageUrl: "", x: 0, y: 0, width: 100, height: 100, status: "idle",
        } as CropImageData,
      }),
    },
    {
      id: "gemini",
      label: "Gemini 2.5 Flash",
      description: "Generate text - supports vision, video, audio, file inputs",
      category: "Others",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: true,
      create: () => ({
        type: "gemini",
        data: {
          label: "Gemini 2.5 Flash", model: "gemini-2.5-flash", prompt: "", systemPrompt: "",
          imageUrls: [], videoUrl: "", audioUrl: "", fileUrl: "", status: "idle", settingsOpen: false,
        } as GeminiData,
      }),
    },
    {
      id: "generate-image",
      label: "Generate Image",
      description: "Coming soon",
      category: "Image",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: false,
      create: () => ({ type: "gemini", data: {} as GeminiData }),
    },
    {
      id: "video-gen",
      label: "Generate Video",
      description: "Coming soon",
      category: "Video",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: false,
      create: () => ({ type: "gemini", data: {} as GeminiData }),
    },
    {
      id: "audio-gen",
      label: "Text to Speech",
      description: "Coming soon",
      category: "Audio",
      icon: <Sparkles className="h-4 w-4" />,
      enabled: false,
      create: () => ({ type: "gemini", data: {} as GeminiData }),
    },
  ];
}

const CATEGORIES: PickerItem["category"][] = ["Image", "Video", "Audio", "Others"];

export function NodePicker({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<PickerItem["category"] | null>(null);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const { screenToFlowPosition } = useReactFlow();

  const items = useMemo(() => buildItems(), []);
  const recent = items.filter((i) => i.enabled);

  const searching = query.trim().length > 0;
  const searchResults = items.filter((i) =>
    i.label.toLowerCase().includes(query.toLowerCase())
  );
  const categoryItems = activeCategory ? items.filter((i) => i.category === activeCategory) : [];

  function handleSelect(item: PickerItem) {
    if (!item.enabled) return;
    const { type, data } = item.create();
    const id = `${type}_${nanoid(8)}`;
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    addNode({
      id,
      type,
      position: { x: center.x - 100 + (nodes.length % 4) * 30, y: center.y - 80 + (nodes.length % 5) * 30 },
      data,
    });
    onClose();
  }

  const content = (
    <div className="fixed inset-0 z-[100]" onClick={onClose}>
      <div
        className="absolute bottom-20 left-1/2 flex -translate-x-1/2 items-start gap-2"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Left panel: search + recent + categories */}
        <div className="w-[300px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
          <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
            <Search className="h-4 w-4 text-gray-400" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search nodes or models..."
              className="flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2">
            {searching ? (
              <>
                {searchResults.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-gray-400">No nodes found.</p>
                )}
                {searchResults.map((item) => (
                  <ItemRow key={item.id} item={item} onClick={() => handleSelect(item)} />
                ))}
              </>
            ) : (
              <>
                <SectionLabel icon={<Clock className="h-3 w-3" />} text="Recent" />
                {recent.map((item) => (
                  <ItemRow key={item.id} item={item} onClick={() => handleSelect(item)} />
                ))}

                <div className="my-2 h-px bg-gray-100" />

                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onMouseEnter={() => setActiveCategory(cat)}
                    onClick={() => setActiveCategory(cat)}
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left text-sm ${
                      activeCategory === cat ? "bg-gray-100 text-gray-900" : "text-gray-700 hover:bg-gray-50"
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      {CATEGORY_ICON[cat]}
                      {cat}
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-gray-400" />
                  </button>
                ))}
              </>
            )}
          </div>
        </div>

        {/* Right flyout: items in the hovered/selected category */}
        {!searching && activeCategory && (
          <div className="w-[300px] overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
              {activeCategory}
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {categoryItems.map((item) => (
                <ItemRow key={item.id} item={item} onClick={() => handleSelect(item)} />
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document === "undefined") return null;
  return createPortal(content, document.body);
}

function SectionLabel({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-gray-400">
      {icon}
      {text}
    </div>
  );
}

function ItemRow({ item, onClick }: { item: PickerItem; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
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
  );
}