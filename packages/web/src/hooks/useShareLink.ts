import { useState, useCallback } from 'react';
import type { Gradient } from '@gradient-tool/core';

interface ShareLinkState {
  shareUrl: string | null;
  isSharing: boolean;
  isShareCopied: boolean;
  error: string | null;
  generateShareLink: (gradient: Gradient) => Promise<void>;
}

export function useShareLink(): ShareLinkState {
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isShareCopied, setIsShareCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateShareLink = useCallback(async (gradient: Gradient) => {
    setIsSharing(true);
    setError(null);
    setShareUrl(null);
    setIsShareCopied(false);

    try {
      // Use relative path, assuming deployed alongside the app
      const response = await fetch('/api/share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(gradient),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to share gradient' }));
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const { slug } = await response.json();
      if (!slug) {
        throw new Error('No slug returned from API');
      }

      const newShareUrl = `${window.location.origin}/g/${slug}`;
      setShareUrl(newShareUrl);

      // Copy to clipboard immediately
      await navigator.clipboard.writeText(newShareUrl);
      setIsShareCopied(true);
      setTimeout(() => setIsShareCopied(false), 1500); // Reset copied state

    } catch (err: unknown) {
      console.error("Failed to generate share link:", err);
      const message = (err instanceof Error) ? err.message : 'An unknown error occurred';
      setError(message);
      setShareUrl(null);
    } finally {
      setIsSharing(false);
    }
  }, []);

  return { 
      shareUrl, 
      isSharing, 
      isShareCopied, 
      error, 
      generateShareLink 
  };
} 