import * as Slider from '@radix-ui/react-slider';
import * as Popover from '@radix-ui/react-popover';
import type { GradientStop } from '@gradient-tool/core';
import { oklabToHex, hexToOKLab } from '@gradient-tool/core';
import { useGradientStore } from '@/state/useGradientStore';
import { motion } from 'framer-motion';
import { Trash2 } from 'lucide-react';
import { HexColorPicker } from 'react-colorful';
import { useState } from 'react';

export function StopHandle({ stop }: { stop: GradientStop }) {
  const updateStopPosition = useGradientStore((s) => s.updateStopPosition);
  const updateStopColor = useGradientStore((s) => s.updateStopColor);
  const removeStop = useGradientStore((s) => s.removeStop);
  const gradientStops = useGradientStore((s) => s.gradient.stops);
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  const canRemove = gradientStops.length > 2;
  const hexColor = oklabToHex(stop.color);

  const handleColorChange = (newHexColor: string) => {
    try {
      const newOklabColor = hexToOKLab(newHexColor);
      updateStopColor(stop.id, newOklabColor);
    } catch (error) {
      console.error("Error converting hex to OKLab:", error);
    }
  };

  return (
    <motion.div 
      layout 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className="flex items-center gap-3 p-2 rounded-md hover:bg-neutral-50"
    >
      <Popover.Root open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
        <Popover.Trigger asChild>
          <button 
            className="h-6 w-6 rounded-full border border-neutral-300 shadow-sm cursor-pointer flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2" 
            style={{ background: hexColor }}
            aria-label={`Change color for stop at ${Math.round(stop.position * 100)}%`}
          />
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Content 
             sideOffset={5} 
             align="start"
             className="z-50 bg-white p-3 rounded-lg shadow-xl border border-neutral-200"
          >
             <HexColorPicker color={hexColor} onChange={handleColorChange} />
             <Popover.Arrow className="fill-white stroke-neutral-200" />
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
      <Slider.Root
        value={[stop.position * 100]}
        max={100}
        step={0.1}
        className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
        onValueChange={([v]) => updateStopPosition(stop.id, v! / 100)}
        aria-label="Gradient stop position"
      >
        <Slider.Track className="bg-neutral-200 relative grow rounded-full h-[3px]">
          <Slider.Range className="absolute bg-blue-500 rounded-full h-full" />
        </Slider.Track>
        <Slider.Thumb 
           className="block w-4 h-4 bg-white rounded-full shadow-md border border-neutral-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        />
      </Slider.Root>
      <span className="text-xs text-neutral-500 w-10 text-right tabular-nums">
        {Math.round(stop.position * 100)}%
      </span>
      <button 
        onClick={() => removeStop(stop.id)}
        disabled={!canRemove}
        className={`text-neutral-400 hover:text-red-500 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors duration-150 p-1 rounded ${!canRemove ? 'opacity-50' : ''}`}
        aria-label="Remove stop"
      >
         <Trash2 size={14} />
      </button>
    </motion.div>
  );
} 