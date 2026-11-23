'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  RotateCw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Check,
  X,
  Crop,
  Move,
  RefreshCcw,
} from 'lucide-react';

export type CropAspectRatio = 'receipt' | 'long' | 'square' | 'landscape';

interface ImageCropperModalProps {
  isOpen: boolean;
  imageSrc: string | null;
  fileName?: string;
  onCropComplete: (croppedFile: File, previewUrl: string) => void;
  onClose: () => void;
}

export default function ImageCropperModal({
  isOpen,
  imageSrc,
  fileName = 'nota-bukti.jpg',
  onCropComplete,
  onClose,
}: ImageCropperModalProps) {
  const [rotation, setRotation] = useState<number>(0);
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [aspectRatio, setAspectRatio] = useState<CropAspectRatio>('receipt');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [lastTouchDist, setLastTouchDist] = useState<number | null>(null);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);

  // Reset state when a new image is loaded
  useEffect(() => {
    if (isOpen && imageSrc) {
      setRotation(0);
      setZoom(1);
      setPan({ x: 0, y: 0 });
      setImageLoaded(false);
      setAspectRatio('receipt');
      if (imageRef.current && imageRef.current.complete && imageRef.current.naturalWidth > 0) {
        setNaturalSize({
          width: imageRef.current.naturalWidth,
          height: imageRef.current.naturalHeight,
        });
        setImageLoaded(true);
      } else {
        setNaturalSize(null);
      }
    }
  }, [isOpen, imageSrc]);

  // Calculate crop window dimensions based on aspect ratio
  const getCropBoxDimensions = () => {
    const isMobile = typeof window !== 'undefined' && window.innerWidth < 640;
    const maxW = isMobile ? window.innerWidth * 0.88 : 360;
    const maxH = isMobile ? window.innerHeight * 0.52 : 460;

    switch (aspectRatio) {
      case 'receipt': // 3:4 Struk Standar
        return { width: Math.min(maxW, maxH * 0.75), height: Math.min(maxH, maxW * 1.33) };
      case 'long': // 9:16 Struk Panjang
        return { width: Math.min(maxW, maxH * 0.5625), height: Math.min(maxH, maxW * 1.77) };
      case 'square': // 1:1 Persegi
        const sq = Math.min(maxW, maxH);
        return { width: sq, height: sq };
      case 'landscape': // 4:3 Lansekap / Kwitansi
        return { width: maxW, height: maxW * 0.75 };
      default:
        return { width: maxW, height: maxH };
    }
  };

  const cropBox = getCropBoxDimensions();

  // Reactive dimension calculation: Ensure image covers cropbox at zoom = 1 without whitespace gaps
  const isRotated90or270 = rotation === 90 || rotation === 270;
  const naturalW = naturalSize?.width || 1200;
  const naturalH = naturalSize?.height || 1600;
  const effectiveW = isRotated90or270 ? naturalH : naturalW;
  const effectiveH = isRotated90or270 ? naturalW : naturalH;

  const baseFitScale = naturalSize
    ? Math.max(cropBox.width / effectiveW, cropBox.height / effectiveH)
    : 1;
  const displayedW = naturalW * baseFitScale;
  const displayedH = naturalH * baseFitScale;

  // Clamp pan so the image CANNOT be dragged beyond the crop box edge, eliminating accidental whitespace
  const clampPan = useCallback(
    (newX: number, newY: number, curZoom: number = zoom, rot: number = rotation) => {
      const isRot = rot === 90 || rot === 270;
      const curW = (isRot ? displayedH : displayedW) * curZoom;
      const curH = (isRot ? displayedW : displayedH) * curZoom;
      const maxX = Math.max(0, (curW - cropBox.width) / 2);
      const maxY = Math.max(0, (curH - cropBox.height) / 2);
      return {
        x: Math.min(Math.max(newX, -maxX), maxX),
        y: Math.min(Math.max(newY, -maxY), maxY),
      };
    },
    [displayedW, displayedH, cropBox.width, cropBox.height, zoom, rotation]
  );

  // Handle Touch Controls (Pan & Pinch-to-zoom for Android / iOS)
  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1) {
      setIsDragging(true);
      setDragStart({
        x: e.touches[0].clientX - pan.x,
        y: e.touches[0].clientY - pan.y,
      });
    } else if (e.touches.length === 2) {
      setIsDragging(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      setLastTouchDist(dist);
    }
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 1 && isDragging) {
      const rawX = e.touches[0].clientX - dragStart.x;
      const rawY = e.touches[0].clientY - dragStart.y;
      setPan(clampPan(rawX, rawY));
    } else if (e.touches.length === 2 && lastTouchDist !== null) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const factor = dist / lastTouchDist;
      const targetZoom = Math.min(Math.max(zoom * factor, 1), 4);
      setZoom(targetZoom);
      setPan((prev) => clampPan(prev.x, prev.y, targetZoom));
      setLastTouchDist(dist);
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setLastTouchDist(null);
  };

  // Handle Mouse Controls (Pan & Wheel-zoom for Desktop)
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    setIsDragging(true);
    setDragStart({
      x: e.clientX - pan.x,
      y: e.clientY - pan.y,
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    const rawX = e.clientX - dragStart.x;
    const rawY = e.clientY - dragStart.y;
    setPan(clampPan(rawX, rawY));
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY * -0.0015;
    const targetZoom = Math.min(Math.max(zoom + delta, 1), 4);
    setZoom(targetZoom);
    setPan((prev) => clampPan(prev.x, prev.y, targetZoom));
  };

  // Rotate 90 degrees clockwise
  const handleRotate = () => {
    const nextRot = (rotation + 90) % 360;
    setRotation(nextRot);
    setPan({ x: 0, y: 0 }); // Recenter image after rotate
  };

  // Reset adjustments
  const handleReset = () => {
    setRotation(0);
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  // Export cropped & rotated image onto HTML5 Canvas
  const handleConfirmCrop = useCallback(() => {
    const img = imageRef.current;
    if (!img) return;

    // Output dimensions (high resolution for crisp receipt print & reading)
    const outputWidth = 1200;
    const outputHeight = Math.round(outputWidth * (cropBox.height / cropBox.width));

    const canvas = document.createElement('canvas');
    canvas.width = outputWidth;
    canvas.height = outputHeight;
    const ctx = canvas.getContext('2d');

    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outputWidth, outputHeight);

    // Scale from screen crop box to output canvas
    const screenToCanvas = outputWidth / cropBox.width;

    ctx.save();
    // 1. Move origin to center of output canvas
    ctx.translate(outputWidth / 2, outputHeight / 2);

    // 2. Apply user pan (clamped to prevent whitespace gaps)
    const safePan = clampPan(pan.x, pan.y);
    ctx.translate(safePan.x * screenToCanvas, safePan.y * screenToCanvas);

    // 3. Apply user rotation
    ctx.rotate((rotation * Math.PI) / 180);

    // 4. Apply zoom & scale
    const finalDrawW = displayedW * zoom * screenToCanvas;
    const finalDrawH = displayedH * zoom * screenToCanvas;

    // 5. Draw image centered
    ctx.drawImage(img, -finalDrawW / 2, -finalDrawH / 2, finalDrawW, finalDrawH);
    ctx.restore();

    // Convert canvas to Blob & File
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const cleanName = fileName.replace(/\.[^/.]+$/, '') + '-cropped.jpg';
        const croppedFile = new File([blob], cleanName, { type: 'image/jpeg' });
        const previewUrl = URL.createObjectURL(croppedFile);
        onCropComplete(croppedFile, previewUrl);
        onClose();
      },
      'image/jpeg',
      0.9
    );
  }, [cropBox, rotation, pan, zoom, displayedW, displayedH, clampPan, fileName, onCropComplete, onClose]);

  if (!isOpen || !imageSrc) return null;

  return (
    <div className="fixed inset-0 z-[120] bg-slate-950/95 backdrop-blur-md flex flex-col justify-between overflow-hidden select-none touch-none animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white shrink-0 z-20">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-orange-50 dark:bg-orange-500/20 text-orange-600 dark:text-orange-400 border border-orange-200 dark:border-orange-500/30 bg-clip-padding overflow-hidden">
            <Crop className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-xs sm:text-sm font-bold leading-tight">Atur & Potong Foto Nota</h3>
            <p className="text-[10px] text-slate-400">Geser untuk atur posisi, cubit/slider untuk zoom</p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer"
          title="Tutup / Batal"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Center Interactive Cropper Workspace */}
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onWheel={handleWheel}
        className="flex-1 relative flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing bg-black/60"
      >
        {/* Helper instruction badge */}
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 bg-slate-900/80 backdrop-blur-sm border border-slate-700/80 px-3 py-1 rounded-full text-[11px] text-slate-300 flex items-center gap-1.5 pointer-events-none shadow-md">
          <Move className="w-3 h-3 text-orange-400" />
          <span>Geser foto agar pas di dalam bingkai</span>
        </div>

        {/* The Image undergoing Pan, Zoom, Rotation */}
        <div
          style={{
            transform: `translate3d(${pan.x}px, ${pan.y}px, 0) rotate(${rotation}deg) scale(${zoom})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
          className="pointer-events-none will-change-transform flex items-center justify-center"
        >
          <img
            ref={imageRef}
            src={imageSrc}
            crossOrigin="anonymous"
            alt="Nota to crop"
            onLoad={(e) => {
              const el = e.currentTarget;
              setNaturalSize({ width: el.naturalWidth, height: el.naturalHeight });
              setImageLoaded(true);
            }}
            className="max-w-none pointer-events-none select-none block"
            style={{
              width: naturalSize ? `${displayedW}px` : 'auto',
              height: naturalSize ? `${displayedH}px` : 'auto',
              opacity: imageLoaded ? 1 : 0,
              transition: 'opacity 0.15s ease-in',
            }}
          />
        </div>

        {/* Dark Mask Vignette Outside Crop Box */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: `radial-gradient(ellipse at center, transparent 0%, transparent 40%, rgba(2, 6, 24, 0.75) 100%)`,
          }}
        />

        {/* Precise Crop Box Overlay with Rule-of-Thirds Grid */}
        <div
          style={{
            width: `${cropBox.width}px`,
            height: `${cropBox.height}px`,
          }}
          className="absolute pointer-events-none border-2 border-orange-500 rounded-2xl shadow-[0_0_0_9999px_rgba(2,6,24,0.68)] z-10 overflow-hidden"
        >
          {/* Rule-of-Thirds Grid Lines */}
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-r border-b border-white" />
            <div className="border-b border-white" />
            <div className="border-r border-white" />
            <div className="border-r border-white" />
            <div />
          </div>

          {/* Corner Guides */}
          <div className="absolute top-0 left-0 w-3.5 h-3.5 border-t-2 border-l-2 border-orange-400" />
          <div className="absolute top-0 right-0 w-3.5 h-3.5 border-t-2 border-r-2 border-orange-400" />
          <div className="absolute bottom-0 left-0 w-3.5 h-3.5 border-b-2 border-l-2 border-orange-400" />
          <div className="absolute bottom-0 right-0 w-3.5 h-3.5 border-b-2 border-r-2 border-orange-400" />
        </div>
      </div>

      {/* Bottom Control Toolbar */}
      <div className="bg-slate-900 border-t border-slate-800 p-3 sm:p-4 text-white space-y-3 shrink-0 z-20">
        {/* Row 1: Aspect Ratio Tabs */}
        <div className="flex items-center justify-center gap-1.5 overflow-x-auto py-0.5">
          <span className="text-[10px] font-bold text-slate-400 mr-1 hidden sm:inline">Format:</span>
          <button
            type="button"
            onClick={() => {
              setAspectRatio('receipt');
              setPan({ x: 0, y: 0 });
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              aspectRatio === 'receipt'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Struk (3:4)
          </button>
          <button
            type="button"
            onClick={() => {
              setAspectRatio('long');
              setPan({ x: 0, y: 0 });
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              aspectRatio === 'long'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Panjang (9:16)
          </button>
          <button
            type="button"
            onClick={() => {
              setAspectRatio('square');
              setPan({ x: 0, y: 0 });
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              aspectRatio === 'square'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Persegi (1:1)
          </button>
          <button
            type="button"
            onClick={() => {
              setAspectRatio('landscape');
              setPan({ x: 0, y: 0 });
            }}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
              aspectRatio === 'landscape'
                ? 'bg-orange-500 text-white shadow-sm'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Kwitansi (4:3)
          </button>
        </div>

        {/* Row 2: Zoom Slider & Rotation & Reset Buttons */}
        <div className="flex items-center justify-between gap-3 max-w-md mx-auto">
          {/* Rotate Button */}
          <button
            type="button"
            onClick={handleRotate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold transition cursor-pointer shrink-0 border border-slate-700"
            title="Putar foto 90 derajat"
          >
            <RotateCw className="w-3.5 h-3.5 text-orange-400" />
            <span>Putar 90°</span>
          </button>

          {/* Zoom Controls */}
          <div className="flex-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                const z = Math.max(zoom - 0.2, 1);
                setZoom(z);
                setPan((prev) => clampPan(prev.x, prev.y, z));
              }}
              className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              title="Perkecil"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <input
              type="range"
              min="1"
              max="3.5"
              step="0.05"
              value={zoom}
              onChange={(e) => {
                const z = parseFloat(e.target.value);
                setZoom(z);
                setPan((prev) => clampPan(prev.x, prev.y, z));
              }}
              className="w-full accent-orange-500 cursor-pointer h-1.5 bg-slate-800 rounded-lg"
              title="Zoom"
            />
            <button
              type="button"
              onClick={() => {
                const z = Math.min(zoom + 0.2, 3.5);
                setZoom(z);
                setPan((prev) => clampPan(prev.x, prev.y, z));
              }}
              className="p-1 rounded-lg bg-slate-800 text-slate-300 hover:text-white cursor-pointer"
              title="Perbesar"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Reset Position Button */}
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition cursor-pointer shrink-0 border border-slate-700"
            title="Kembalikan posisi & zoom awal"
          >
            <RefreshCcw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Row 3: Action Buttons */}
        <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800/80 max-w-md mx-auto">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold transition cursor-pointer text-center"
          >
            Batal
          </button>

          <button
            type="button"
            onClick={handleConfirmCrop}
            className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-orange-600 to-amber-600 hover:from-orange-500 hover:to-amber-500 text-white text-xs font-black shadow-lg shadow-orange-950/40 flex items-center justify-center gap-2 transition cursor-pointer"
          >
            <Check className="w-4 h-4 stroke-[3]" />
            <span>Gunakan Foto Ini</span>
          </button>
        </div>
      </div>
    </div>
  );
}
