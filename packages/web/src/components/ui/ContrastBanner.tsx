import * as Toast from '@radix-ui/react-toast';
import { useContrastAudit } from '@/hooks/useContrastAudit'; // Use path alias
import { AlertTriangle } from 'lucide-react';
import { useState, useEffect } from 'react';

/**
 * Displays a toast notification if the current gradient has contrast issues.
 */
export function ContrastBanner() {
  const { isFailing } = useContrastAudit();
  // Use local state to control toast visibility based on audit result
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Open the toast when isFailing becomes true
    // Keep it open until manually dismissed or duration ends
    if (isFailing) {
        setOpen(true);
    } else {
        // Optionally close immediately if contrast is fixed
        // setOpen(false); 
    }
  }, [isFailing]);

  return (
    <Toast.Provider swipeDirection="right" duration={10000}> // Longer duration
      <Toast.Root 
        open={open} 
        onOpenChange={setOpen} 
        className="bg-amber-50 border border-amber-300 rounded-md shadow-lg p-4 grid gap-x-4 items-center data-[state=open]:animate-slideIn data-[state=closed]:animate-hide data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[swipe=end]:animate-swipeOut"
        // Radix recommends adding custom animation keyframes for slideIn, hide, swipeOut
      >
        <div className="flex gap-3 items-start">
            <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" aria-hidden="true" />
            <div className="flex-1">
                <Toast.Title className="text-sm font-medium text-amber-800">
                    Low Contrast Warning
                </Toast.Title>
                <Toast.Description className="mt-1 text-sm text-amber-700">
                    Some adjacent color stops may not meet WCAG AA contrast minimums (4.5:1).
                </Toast.Description>
            </div>
        </div>
        {/* Optional Close button */}
        {/* <Toast.Close className="absolute top-2 right-2 text-amber-500 hover:text-amber-700">
            <X size={16} />
        </Toast.Close> */}
      </Toast.Root>

      {/* Position the viewport */}
      <Toast.Viewport className="fixed bottom-0 right-0 flex flex-col p-6 gap-3 w-[390px] max-w-[100vw] m-0 list-none z-[2147483647] outline-none" />
    </Toast.Provider>
  );
} 