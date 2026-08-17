"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FilePlus2, Upload, X, ImageOff } from "lucide-react";

export function ImageUploadFlyout({
  uploading,
  onUploadFile,
  onSelectAsset,
  onClose,
}: {
  uploading: boolean;
  onUploadFile: (file: File) => void;
  onSelectAsset: (url: string) => void;
  onClose: () => void;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [assetPickerOpen, setAssetPickerOpen] = useState(false);

  return (
    <>
      <div className="nodrag absolute left-0 top-full z-40 mt-1.5 w-[260px] rounded-xl border border-gray-200 bg-white p-3 text-xs text-gray-600 shadow-xl">
        <p className="mb-2.5 leading-relaxed">
          Add a file from your device or select one from your library
        </p>
        <button
          onClick={() => setAssetPickerOpen(true)}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium text-gray-700 hover:bg-gray-50"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
          Select Asset
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-500 px-3 py-2 text-xs font-medium text-white hover:bg-indigo-600 disabled:opacity-60"
        >
          <Upload className="h-3.5 w-3.5" />
          {uploading ? "Uploading..." : "Upload"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/jpg,image/png,image/webp,image/gif"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUploadFile(file);
          }}
        />
      </div>

      {assetPickerOpen && (
        <AssetPickerModal
          onSelect={(url) => {
            onSelectAsset(url);
            setAssetPickerOpen(false);
            onClose();
          }}
          onClose={() => setAssetPickerOpen(false)}
        />
      )}
    </>
  );
}

function AssetPickerModal({
  onSelect,
  onClose,
}: {
  onSelect: (url: string) => void;
  onClose: () => void;
}) {
  const [urls, setUrls] = useState<string[] | null>(null);

  useEffect(() => {
    fetch("/api/upload")
      .then((r) => r.json())
      .then((json) => setUrls(json.urls ?? []))
      .catch(() => setUrls([]));
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-6"
      onClick={onClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Select Image</h3>
            <p className="text-xs text-gray-400">{urls?.length ?? 0} files</p>
          </div>
          <button onClick={onClose} className="rounded p-1 text-gray-400 hover:bg-gray-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {urls === null && (
            <p className="py-10 text-center text-xs text-gray-400">Loading...</p>
          )}
          {urls?.length === 0 && (
            <div className="flex flex-col items-center py-14 text-center">
              <ImageOff className="mb-3 h-8 w-8 text-gray-300" />
              <p className="text-sm font-medium text-gray-600">No images found</p>
              <p className="text-xs text-gray-400">Uploads you&apos;ve made will show up here.</p>
            </div>
          )}
          {urls && urls.length > 0 && (
            <div className="grid grid-cols-4 gap-3">
              {urls.map((url) => (
                <button
                  key={url}
                  onClick={() => onSelect(url)}
                  className="aspect-square overflow-hidden rounded-lg border border-gray-200 hover:ring-2 hover:ring-indigo-500"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}