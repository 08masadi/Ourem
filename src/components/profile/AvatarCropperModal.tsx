'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Loader2, Move } from 'lucide-react';

interface AvatarCropperModalProps {
  imageSrc: string;
  onClose: () => void;
  onCropComplete: (dataUrl: string) => Promise<void>;
  isUploading: boolean;
}

const VP_SIZE = 280; // Ukuran container viewport (px)
const CROP_SIZE = 240; // Diameter lingkaran avatar (px)
const OUT_SIZE = 480; // Resolusi hasil export canvas (px)

export default function AvatarCropperModal({
  imageSrc,
  onClose,
  onCropComplete,
  isUploading,
}: AvatarCropperModalProps) {
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const imageRef = useRef<HTMLImageElement | null>(null);
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });

  // Load natural image dimensions
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setNaturalSize({ w: img.naturalWidth || 1, h: img.naturalHeight || 1 });
      setZoom(1);
      setOffset({ x: 0, y: 0 });
    };
  }, [imageSrc]);

  // Hitung base scale agar foto selalu menutupi lingkaran crop
  const baseScale = Math.max(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h);
  const displayWidth = naturalSize.w * baseScale * zoom;
  const displayHeight = naturalSize.h * baseScale * zoom;

  // Pointer event handlers untuk drag/geser (mouse & touch)
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (isUploading) return;
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging || isUploading) return;
    const newX = e.clientX - dragStartRef.current.x;
    const newY = e.clientY - dragStartRef.current.y;

    // Batasi geser agar foto tidak keluar terlalu jauh dari lingkaran
    const maxBoundX = (displayWidth - CROP_SIZE) / 2 + 60;
    const maxBoundY = (displayHeight - CROP_SIZE) / 2 + 60;

    setOffset({
      x: Math.max(-maxBoundX, Math.min(maxBoundX, newX)),
      y: Math.max(-maxBoundY, Math.min(maxBoundY, newY)),
    });
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    try {
      (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {}
  };

  // Render crop ke Canvas resolusi tinggi (480x480)
  const handleApply = async () => {
    const canvas = document.createElement('canvas');
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    await new Promise((resolve) => {
      if (img.complete) resolve(null);
      else img.onload = () => resolve(null);
    });

    const factor = OUT_SIZE / CROP_SIZE;
    const canvasImgW = displayWidth * factor;
    const canvasImgH = displayHeight * factor;
    const canvasCenterX = OUT_SIZE / 2 + offset.x * factor;
    const canvasCenterY = OUT_SIZE / 2 + offset.y * factor;
    const dx = canvasCenterX - canvasImgW / 2;
    const dy = canvasCenterY - canvasImgH / 2;

    // Gambar ke canvas
    ctx.drawImage(img, dx, dy, canvasImgW, canvasImgH);

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    await onCropComplete(croppedDataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200"
      onClick={(e) => {
        if (!isUploading && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-4">
          <div>
            <h3 className="text-sm font-bold text-white">Atur Foto Profil</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Move className="w-3 h-3 text-orange-400" />
              <span>Geser foto & atur zoom sesuai keinginan</span>
            </p>
          </div>
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="p-1.5 rounded-full bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-50"
            title="Batal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Viewport Cropper Box */}
        <div
          className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: VP_SIZE, height: VP_SIZE }}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
        >
          {/* Gambar yang di-transform (translate + scale) */}
          <div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-75"
            style={{
              width: displayWidth,
              height: displayHeight,
              transform: `translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px))`,
            }}
          >
            <img
              ref={imageRef}
              src={imageSrc}
              alt="Crop"
              className="w-full h-full object-cover pointer-events-none select-none"
              draggable={false}
            />
          </div>

          {/* Masking Gelap di luar Lingkaran Avatar */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Lingkaran Transparan dengan Border Oranye Menyala */}
            <div
              className="rounded-full border-2 border-orange-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
            />
          </div>
        </div>

        {/* Zoom Slider & Controls */}
        <div className="w-full mt-4 space-y-2">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-orange-400" />
              <span>Zoom ({zoom.toFixed(1)}x)</span>
            </span>
            <button
              type="button"
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="text-[10px] text-orange-400 hover:text-orange-300 font-semibold flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={isUploading || zoom <= 1}
              onClick={() => setZoom((prev) => Math.max(1, +(prev - 0.2).toFixed(2)))}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={1}
              max={3}
              step={0.05}
              value={zoom}
              disabled={isUploading}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <button
              type="button"
              disabled={isUploading || zoom >= 3}
              onClick={() => setZoom((prev) => Math.min(3, +(prev + 0.2).toFixed(2)))}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="w-full mt-5 flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isUploading}
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold transition cursor-pointer disabled:opacity-50"
          >
            Batal
          </button>
          <button
            type="button"
            disabled={isUploading}
            onClick={handleApply}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-bold shadow-lg shadow-orange-950/40 transition flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Menyimpan Foto...</span>
              </>
            ) : (
              <>
                <Check className="w-3.5 h-3.5" />
                <span>Terapkan & Simpan</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
