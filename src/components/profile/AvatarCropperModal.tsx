'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCcw, Check, Loader2, Move, Maximize2, Minimize2 } from 'lucide-react';

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
  const [naturalSize, setNaturalSize] = useState({ w: 1, h: 1 });
  const [isReady, setIsReady] = useState(false);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef = useRef(false);
  const lastTouchRef = useRef({ x: 0, y: 0 });
  const mouseStartRef = useRef({ x: 0, y: 0 });

  // 1. Nonaktifkan pull-to-refresh Android saat modal cropper dibuka
  useEffect(() => {
    try {
      if (typeof window !== 'undefined' && (window as any).AndroidApp?.setSwipeRefreshEnabled) {
        (window as any).AndroidApp.setSwipeRefreshEnabled(false);
      }
    } catch {}

    return () => {
      try {
        if (typeof window !== 'undefined' && (window as any).AndroidApp?.setSwipeRefreshEnabled) {
          (window as any).AndroidApp.setSwipeRefreshEnabled(true);
        }
      } catch {}
    };
  }, []);

  // 2. Load dimensi asli gambar dan sesuaikan skala awal agar WAJAH TIDAK TERPOTONG
  useEffect(() => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = imageSrc;
    img.onload = () => {
      const nw = img.naturalWidth || 1;
      const nh = img.naturalHeight || 1;
      setNaturalSize({ w: nw, h: nh });

      // Skala awal disetel agar seluruh wajah & foto muat di dalam lingkaran frame tanpa terpotong
      setZoom(1);
      setOffset({ x: 0, y: 0 });
      setIsReady(true);
    };
  }, [imageSrc]);

  // Hitung base scale:
  // "fitScale": memastikan seluruh foto (termasuk wajah) pas di dalam frame lingkaran tanpa terpotong
  const fitScale = (CROP_SIZE * 0.95) / Math.max(naturalSize.w, naturalSize.h);
  // "coverScale": memenuhi lingkaran jika pengguna ingin zoom penuh
  const coverScale = Math.max(CROP_SIZE / naturalSize.w, CROP_SIZE / naturalSize.h);

  // Ukuran display foto saat ini
  const currentScale = fitScale * zoom;
  const displayW = naturalSize.w * currentScale;
  const displayH = naturalSize.h * currentScale;

  // Posisi tengah foto di dalam viewport
  const imgLeft = VP_SIZE / 2 - displayW / 2 + offset.x;
  const imgTop = VP_SIZE / 2 - displayH / 2 + offset.y;

  // 3. Touch handler non-passive untuk mencegah refresh halaman Android & pergerakan mulus
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isUploading) return;
      if (e.touches.length === 1) {
        isDraggingRef.current = true;
        lastTouchRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      // PENTING: Mencegah Android WebView pull-to-refresh & scroll layar!
      e.preventDefault();
      e.stopPropagation();

      if (!isDraggingRef.current || isUploading || e.touches.length !== 1) return;

      const deltaX = e.touches[0].clientX - lastTouchRef.current.x;
      const deltaY = e.touches[0].clientY - lastTouchRef.current.y;

      lastTouchRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
      };

      setOffset((prev) => ({
        x: prev.x + deltaX,
        y: prev.y + deltaY,
      }));
    };

    const onTouchEnd = () => {
      isDraggingRef.current = false;
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd);
    el.addEventListener('touchcancel', onTouchEnd);

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [isUploading]);

  // 4. Mouse handler untuk Desktop
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isUploading) return;
    isDraggingRef.current = true;
    mouseStartRef.current = {
      x: e.clientX - offset.x,
      y: e.clientY - offset.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || isUploading) return;
    setOffset({
      x: e.clientX - mouseStartRef.current.x,
      y: e.clientY - mouseStartRef.current.y,
    });
  };

  const handleMouseUp = () => {
    isDraggingRef.current = false;
  };

  // 5. Render Canvas beresolusi tinggi (480x480) dengan koordinat yang 100% persis
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

    // Background gelap netral
    ctx.fillStyle = '#090d16';
    ctx.fillRect(0, 0, OUT_SIZE, OUT_SIZE);

    // Rasio konversi dari viewport screen ke canvas export
    const factor = OUT_SIZE / CROP_SIZE;
    const canvasImgW = displayW * factor;
    const canvasImgH = displayH * factor;
    const canvasCenterX = OUT_SIZE / 2 + offset.x * factor;
    const canvasCenterY = OUT_SIZE / 2 + offset.y * factor;
    const dx = canvasCenterX - canvasImgW / 2;
    const dy = canvasCenterY - canvasImgH / 2;

    ctx.drawImage(img, dx, dy, canvasImgW, canvasImgH);

    const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
    await onCropComplete(croppedDataUrl);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none overscroll-none"
      onClick={(e) => {
        if (!isUploading && e.target === e.currentTarget) onClose();
      }}
    >
      <div className="relative max-w-sm w-full bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-6 shadow-2xl flex flex-col items-center animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="w-full flex items-center justify-between mb-3">
          <div>
            <h3 className="text-sm font-bold text-white">Atur Foto Profil</h3>
            <p className="text-[11px] text-slate-400 mt-0.5 flex items-center gap-1">
              <Move className="w-3 h-3 text-orange-400" />
              <span>Geser & atur zoom agar wajah pas di tengah</span>
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
          ref={containerRef}
          className="relative rounded-2xl overflow-hidden bg-slate-950 border border-slate-800 shadow-inner cursor-grab active:cursor-grabbing touch-none select-none"
          style={{ width: VP_SIZE, height: VP_SIZE }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          {/* Gambar dengan posisi absolut murni (100% presisi & tidak melompat ke pinggir) */}
          {isReady && (
            <img
              src={imageSrc}
              alt="Preview"
              style={{
                position: 'absolute',
                left: `${imgLeft}px`,
                top: `${imgTop}px`,
                width: `${displayW}px`,
                height: `${displayH}px`,
                pointerEvents: 'none',
                userSelect: 'none',
              }}
              draggable={false}
            />
          )}

          {/* Masking Gelap di luar Lingkaran Avatar */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
            {/* Lingkaran Transparan dengan Border Oranye Menyala */}
            <div
              className="rounded-full border-2 border-orange-500 shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
              style={{ width: CROP_SIZE, height: CROP_SIZE }}
            />
          </div>
        </div>

        {/* Preset Cepat & Tombol Reset */}
        <div className="w-full mt-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              disabled={isUploading}
              onClick={() => {
                setZoom(1);
                setOffset({ x: 0, y: 0 });
              }}
              className="px-2.5 py-1 rounded-lg bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 border border-orange-500/30 text-[10px] font-bold transition flex items-center gap-1 cursor-pointer"
              title="Paskan wajah di tengah agar tidak terpotong"
            >
              <Minimize2 className="w-3 h-3" />
              <span>Wajah Pas Tengah</span>
            </button>

            <button
              type="button"
              disabled={isUploading}
              onClick={() => {
                const coverZoom = +(coverScale / fitScale).toFixed(2);
                setZoom(coverZoom);
                setOffset({ x: 0, y: 0 });
              }}
              className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition flex items-center gap-1 cursor-pointer"
              title="Isi penuh frame lingkaran"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Penuh Frame</span>
            </button>
          </div>

          <button
            type="button"
            disabled={isUploading}
            onClick={() => {
              setZoom(1);
              setOffset({ x: 0, y: 0 });
            }}
            className="text-[10px] text-slate-400 hover:text-white font-semibold flex items-center gap-1 cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>Reset</span>
          </button>
        </div>

        {/* Zoom Slider & Controls */}
        <div className="w-full mt-3 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <span className="text-[11px] font-semibold flex items-center gap-1">
              <ZoomIn className="w-3.5 h-3.5 text-orange-400" />
              <span>Zoom ({zoom.toFixed(1)}x)</span>
            </span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              disabled={isUploading || zoom <= 0.6}
              onClick={() => setZoom((prev) => Math.max(0.6, +(prev - 0.15).toFixed(2)))}
              className="p-1.5 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 transition cursor-pointer disabled:opacity-40"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>

            <input
              type="range"
              min={0.6}
              max={3.0}
              step={0.05}
              value={zoom}
              disabled={isUploading}
              onChange={(e) => setZoom(parseFloat(e.target.value))}
              className="flex-1 accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
            />

            <button
              type="button"
              disabled={isUploading || zoom >= 3.0}
              onClick={() => setZoom((prev) => Math.min(3.0, +(prev + 0.15).toFixed(2)))}
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
