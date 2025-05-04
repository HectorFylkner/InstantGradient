/**
 * Main gradient editor interface.
 */
import { useState, useCallback } from 'react';
import { GradientCanvas, GradientCanvasHandle } from '@/components/GradientCanvas';
import { StopHandle } from '@/components/StopHandle';
import { useGradientStore } from '@/state/useGradientStore';
import { toCss, toSvgFile } from '@gradient-tool/core';
import { Check, Copy, Share2, ImageDown, Code2 } from 'lucide-react';
import { useShareLink } from '@/hooks/useShareLink';
import { ContrastBanner } from '@/components/ui/ContrastBanner';
import { triggerDownload } from '@/utils/export';
import { useRef } from 'react';
import { throttle } from '@/utils/throttle';

export default function GradientEditor() {
  const gradient = useGradientStore((s) => s.gradient);
  const isLoading = useGradientStore((s) => s.isLoading);
  const addStop = useGradientStore((s) => s.addStop);
  const [isCssCopied, setIsCssCopied] = useState(false);
  const { shareUrl, generateShareLink, isSharing, isShareCopied } = useShareLink();
  const canvasRef = useRef<GradientCanvasHandle>(null);

  const handleCopyCss = useCallback(async () => {
    const cssString = toCss(gradient);
    try {
      await navigator.clipboard.writeText(cssString);
      setIsCssCopied(true);
      setTimeout(() => setIsCssCopied(false), 1500);
    } catch (err) {
      console.error('Failed to copy CSS:', err);
    }
  }, [gradient]);

  const handleShare = () => {
      generateShareLink(gradient);
  };

  const handleExportPng = useCallback(async () => {
    const blob = await canvasRef.current?.exportToPng();
    if (blob) {
        triggerDownload('gradient.png', blob);
    } else {
        console.error('Failed to get PNG blob from canvas');
        // TODO: Show error toast
    }
  }, []);

  const handleExportSvg = useCallback(() => {
      const svgString = toSvgFile(gradient);
      triggerDownload('gradient.svg', svgString, 'image/svg+xml');
  }, [gradient]);

  const throttledExportPng = useCallback(throttle(handleExportPng, 1000), [handleExportPng]);
  const throttledExportSvg = useCallback(throttle(handleExportSvg, 1000), [handleExportSvg]);

  if (isLoading) {
      return <div className="h-screen w-screen flex items-center justify-center">Loading gradient...</div>;
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-neutral-100 text-neutral-900 font-sans">
      <header className="p-3 border-b border-neutral-200 bg-white shadow-sm flex justify-between items-center">
        <h1 className="text-lg font-semibold">Gradient Tool</h1>
        <button 
            onClick={handleShare}
            disabled={isSharing || !!shareUrl}
            className="bg-green-500 hover:bg-green-600 text-white font-medium py-1.5 px-3 rounded-md transition-colors duration-150 flex items-center justify-center gap-2 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isSharing ? 'Sharing...' : (isShareCopied ? <><Check size={14}/> Copied Link</> : <><Share2 size={14}/> Share</>)}
        </button>
      </header>
      <main className="flex-grow flex flex-col md:flex-row gap-6 p-4 overflow-auto">
        <section className="flex-grow flex items-center justify-center">
           <GradientCanvas ref={canvasRef} gradient={gradient} />
        </section>
        <aside className="w-full md:w-72 flex-shrink-0 bg-white p-4 rounded-lg shadow-md border border-neutral-200 flex flex-col gap-4">
          <h2 className="text-md font-medium mb-2">Gradient Stops</h2>
          <div className="flex flex-col gap-3 overflow-y-auto pr-1 flex-grow min-h-[100px]">
            {gradient.stops.map((stop) => (
              <StopHandle key={stop.id} stop={stop} />
            ))}
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-100">
             <button 
               onClick={addStop} 
               className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 flex items-center justify-center gap-2"
             >
               Add Stop
             </button>
             <button
               onClick={handleCopyCss}
               className="w-full bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 px-4 rounded-md transition-colors duration-150 flex items-center justify-center gap-2 disabled:opacity-50"
               disabled={isCssCopied}
             >
              {isCssCopied ? (
                  <><Check size={16} /> Copied!</>
              ) : (
                  <><Copy size={16} /> Copy CSS</>
              )}
             </button>
             <div className="flex gap-2">
                 <button
                   onClick={throttledExportPng}
                   className="flex-1 bg-indigo-500 hover:bg-indigo-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-150 flex items-center justify-center gap-1.5 text-sm"
                 >
                   <ImageDown size={16} /> PNG
                 </button>
                 <button
                   onClick={throttledExportSvg}
                   className="flex-1 bg-purple-500 hover:bg-purple-600 text-white font-medium py-2 px-3 rounded-md transition-colors duration-150 flex items-center justify-center gap-1.5 text-sm"
                 >
                   <Code2 size={16} /> SVG
                 </button>
             </div>
          </div>
        </aside>
      </main>
      <ContrastBanner />
    </div>
  );
} 