import { useMemo } from 'react';
import { useGradientStore } from '@/state/useGradientStore'; // Use path alias
import { contrastAudit } from '@gradient-tool/core'; // Use direct import

/**
 * Hook to check the current gradient for WCAG contrast issues.
 * @returns An object containing the list of failing stop pairs and a boolean indicating if any failures exist.
 */
export function useContrastAudit() {
  const gradient = useGradientStore((s) => s.gradient);

  // Use useMemo to avoid re-calculating on every render unless gradient changes
  const { fails, isFailing } = useMemo(() => {
      // Run the audit function from the core package
      const failingPairs = contrastAudit(gradient); // Uses default threshold 4.5
      return {
          fails: failingPairs, 
          isFailing: failingPairs.length > 0
      };
  }, [gradient]); // Re-run only when the gradient object changes

  return { fails, isFailing };
} 