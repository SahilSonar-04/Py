"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  Search, Crop, Sparkles, X, ChevronRight, Clock,
  Image as ImageIcon, Video, Mic, Layers, LogIn, Wrench, Brain,
} from "lucide-react";
import { nanoid } from "nanoid";
import { useReactFlow } from "reactflow";
import { useCanvasStore } from "@/store/canvas-store";
import type { CropImageData, GeminiData } from "@/types/workflow";

type Category = "Image" | "Video" | "Audio" | "Others";

interface PickerItem {
  id: string;
  label: string;
  description: string;
  category: Category;
  icon: React.ReactNode;
  enabled: boolean;

  children?: PickerItem[];
  create?: () => { type: "crop_image" | "gemini"; data: CropImageData | GeminiData };
}

const CATEGORY_ICON: Record<Category, React.ReactNode> = {
  Image: <ImageIcon className="h-3.5 w-3.5" />,
  Video: <Video className="h-3.5 w-3.5" />,
  Audio: <Mic className="h-3.5 w-3.5" />,
  Others: <Layers className="h-3.5 w-3.5" />,
};

function makeCropImageItem(): PickerItem {
  return {
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
  };
}

function makeGeminiItem(): PickerItem {
  return {
    id: "gemini-2.5-flash",
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
  };
}

function buildSections(): { category: Category; items: PickerItem[] }[] {
  const cropImage = makeCropImageItem();
  const gemini = makeGeminiItem();

  return [
    {
      category: "Image",
      items: [
        cropImage,
        { id: "generate-image", label: "Generate Image", description: "Coming soon", category: "Image", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "edit-image", label: "Edit Image", description: "Coming soon", category: "Image", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "3d", label: "3D", description: "Coming soon", category: "Image", icon: <Sparkles className="h-4 w-4" />, enabled: false },
      ],
    },
    {
      category: "Video",
      items: [
        { id: "generate-video", label: "Generate Video", description: "Coming soon", category: "Video", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "enhance-video", label: "Enhance Video", description: "Coming soon", category: "Video", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "bg-remover", label: "BG Remover", description: "Coming soon", category: "Video", icon: <Sparkles className="h-4 w-4" />, enabled: false },
      ],
    },
    {
      category: "Audio",
      items: [
        { id: "text-to-speech", label: "Text to Speech", description: "Coming soon", category: "Audio", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "music-generation", label: "Music Generation", description: "Coming soon", category: "Audio", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "sound-effects", label: "Sound Effects", description: "Coming soon", category: "Audio", icon: <Sparkles className="h-4 w-4" />, enabled: false },
        { id: "other-audio", label: "Other Audio Tools", description: "Coming soon", category: "Audio", icon: <Sparkles className="h-4 w-4" />, enabled: false },
      ],
    },
    {
      category: "Others",
      items: [
        { id: "input", label: "Input", description: "Coming soon", category: "Others", icon: <LogIn className="h-4 w-4" />, enabled: false },
        { id: "utility", label: "Utility", description: "Coming soon", category: "Others", icon: <Wrench className="h-4 w-4" />, enabled: false },
        {
          id: "llm-call",
          label: "LLM Call",
          description: "Choose a model",
          category: "Others",
          icon: <Brain className="h-4 w-4" />,
          enabled: true,
          children: [
            { id: "gpt-5.4-nano", label: "GPT 5.4 Nano", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "gpt-5.4-mini", label: "GPT 5.4 Mini", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "gpt-5.4", label: "GPT 5.4", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "gpt-5.5", label: "GPT 5.5", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "gpt-5.5-pro", label: "GPT 5.5 Pro", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "gemini-3.1-pro-placeholder", label: "Gemini 3.1 Pro", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            gemini,
            { id: "claude-sonnet-4.6", label: "Claude Sonnet 4.6", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "claude-sonnet-5", label: "Claude Sonnet 5", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "claude-opus-4.6", label: "Claude Opus 4.6", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
            { id: "claude-opus-4.7", label: "Claude Opus 4.7", description: "Coming soon", category: "Others", icon: <Sparkles className="h-4 w-4" />, enabled: false },
          ],
        },
      ],
    },
  ];
}

function flattenItems(sections: { category: Category; items: PickerItem[] }[]): PickerItem[] {
  const out: PickerItem[] = [];
  for (const section of sections) {
    for (const item of section.items) {
      out.push(item);
      if (item.children) out.push(...item.children);
    }
  }
  return out;
}

function isTextEditable(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable;
}

export function NodePicker({
  onClose,
  anchor,
  spawnAt,
}: {
  onClose: () => void;

  anchor?: { x: number; y: number };

  spawnAt?: { x: number; y: number };
}) {
  const [query, setQuery] = useState("");
  const [activeItemId, setActiveItemId] = useState<string | null>(null);
  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);
  const { screenToFlowPosition } = useReactFlow();

  const [pos, setPos] = useState<{
    anchor: { x: number; y: number } | null;
    spawnAt: { x: number; y: number } | null;
  }>({ anchor: anchor ?? null, spawnAt: spawnAt ?? null });

  const sections = useMemo(() => buildSections(), []);
  const allItems = useMemo(() => flattenItems(sections), [sections]);
  const recent = useMemo(() => allItems.filter((i) => i.enabled && !i.children), [allItems]);

  const searching = query.trim().length > 0;
  const searchResults = allItems.filter((i) =>
    !i.children && i.label.toLowerCase().includes(query.toLowerCase())
  );
  const activeItem = allItems.find((i) => i.id === activeItemId) ?? null;

  useEffect(() => {
    if (searching) setActiveItemId(null);
  }, [searching]);

  function handleSelect(item: PickerItem) {
    if (item.children) {
      setActiveItemId(item.id);
      return;
    }
    if (!item.enabled || !item.create) return;
    const { type, data } = item.create();
    const id = `${type}_${nanoid(8)}`;
    const center = pos.spawnAt ?? screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
    addNode({
      id,
      type,
      position: { x: center.x - 100 + (nodes.length % 4) * 30, y: center.y - 80 + (nodes.length % 5) * 30 },
      data,
    });
    onClose();
  }

  function handleOverlayContextMenu(e: React.MouseEvent) {
    if (isTextEditable(e.target)) return;
    e.preventDefault();
    const nextAnchor = { x: e.clientX, y: e.clientY };
    setPos({ anchor: nextAnchor, spawnAt: screenToFlowPosition(nextAnchor) });
    setQuery("");
    setActiveItemId(null);
  }

  const clampedAnchor = useMemo(() => {
    if (!pos.anchor || typeof window === "undefined") return pos.anchor;
    const panelWidth = 280;
    const gap = 8;
    const maxWidth = panelWidth * 2 + gap;
    const maxHeight = 440;
    return {
      x: Math.max(8, Math.min(pos.anchor.x, window.innerWidth - maxWidth - 8)),
      y: Math.max(8, Math.min(pos.anchor.y, window.innerHeight - maxHeight - 8)),
    };
  }, [pos.anchor]);

  const panelStyle: React.CSSProperties = clampedAnchor
    ? { position: "fixed", left: clampedAnchor.x, top: clampedAnchor.y }
    : {};

  const content = (
    <div
      className="fixed inset-0 z-[100] cursor-grab"
      onClick={onClose}
      onContextMenu={handleOverlayContextMenu}
    >
      <div
        className={`cursor-auto ${pos.anchor ? "flex items-start gap-2" : "absolute bottom-20 left-1/2 flex -translate-x-1/2 items-start gap-2"}`}
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
        onContextMenu={(e) => {

          if (isTextEditable(e.target)) return;
          e.preventDefault();
          e.stopPropagation();
        }}
      >
        {/* Left panel: search + recent + sections, each listing its items directly */}
        <div className="w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur">
          <div className="p-2.5">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  autoFocus
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search nodes or models..."
                  className="w-full rounded-xl border border-transparent bg-transparent py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 outline-none"
                />
              </div>
              <button onClick={onClose} title="Close" className="shrink-0 rounded-lg p-2 text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900">
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div className="max-h-[370px] overflow-y-auto px-2 pb-2">
            {searching ? (
              <>
                {searchResults.length === 0 && (
                  <p className="px-3 py-6 text-center text-xs text-gray-400">No nodes found.</p>
                )}
                {searchResults.map((item) => (
                  <ItemRow key={item.id} item={item} active={activeItemId === item.id} onClick={() => handleSelect(item)} />
                ))}
              </>
            ) : (
              <>
                <div className="pt-1">
                  <SectionLabel icon={<Clock className="h-3.5 w-3.5" />} text="Recent" />
                  {recent.map((item) => (
                    <ItemRow key={item.id} item={item} active={activeItemId === item.id} onClick={() => handleSelect(item)} />
                  ))}
                </div>

                {sections.map((section) => (
                  <div key={section.category} className="pt-1.5">
                    <SectionLabel icon={CATEGORY_ICON[section.category]} text={section.category.toUpperCase()} />
                    <div className="flex flex-col gap-0">
                      {section.items.map((item) => (
                        <ItemRow key={item.id} item={item} active={activeItemId === item.id} onClick={() => handleSelect(item)} />
                      ))}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        {}
        {!searching && activeItem?.children && (
          <div className="w-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-2xl backdrop-blur">
            <div className="border-b border-gray-100 px-4 py-3 text-sm font-medium text-gray-900">
              {activeItem.label}
            </div>
            <div className="max-h-[420px] overflow-y-auto p-2">
              {activeItem.children.map((child) => (
                <ItemRow key={child.id} item={child} active={false} onClick={() => handleSelect(child)} />
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
    <div className="flex items-center gap-1.5 px-2 py-1 text-[11px] font-medium uppercase tracking-wide text-gray-500">
      {icon}
      {text}
    </div>
  );
}

function ItemRow({
  item,
  active,
  onClick,
}: {
  item: PickerItem;
  active: boolean;
  onClick: () => void;
}) {

  const hasFlyout = Boolean(item.children);
  return (
    <button
      onClick={onClick}
      disabled={!item.enabled}
      title={item.enabled ? undefined : "Coming soon"}
      className={`flex select-none items-center gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors ${
        item.enabled ? "cursor-pointer hover:bg-gray-50" : "cursor-default opacity-40"
      } ${active ? "bg-gray-100" : ""}`}
    >
      <span className="min-w-0 flex-1 text-[13px] leading-snug text-gray-700">{item.label}</span>
      {hasFlyout && <ChevronRight className="h-4 w-4 shrink-0 text-gray-400" />}
    </button>
  );
}