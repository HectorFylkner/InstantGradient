import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useGradientStore } from './state/useGradientStore';
import { Gradient } from '@gradient-tool/core';

/**
 * Component responsible for loading a gradient from a share slug 
 * and redirecting to the main editor.
 */
export default function GradientLoader() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const setGradient = useGradientStore((state) => state.setGradient);
  const [loadingState, setLoadingState] = useState<'loading' | 'error' | 'done'>('loading');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) {
      console.error('No slug provided in URL');
      setError('Invalid share link.');
      setLoadingState('error');
      // Optional: redirect to home after a delay?
      // setTimeout(() => navigate('/'), 3000);
      return;
    }

    const fetchGradient = async () => {
      setLoadingState('loading');
      setError(null);
      try {
        // Fetch gradient data using the GET part of our API stub
        // Adjust the path if your API route is different
        const response = await fetch(`/api/share?slug=${slug}`);
        
        if (!response.ok) {
            if (response.status === 404) {
                 throw new Error('Gradient not found.');
            } else {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed to fetch gradient (status: ${response.status})`);
            }
        }

        const data = await response.json();
        if (!data.gradient) {
          throw new Error('Invalid gradient data received from API');
        }

        // Update the Zustand store with the fetched gradient
        setGradient(data.gradient as Gradient);
        setLoadingState('done');
        // Navigate to the main editor page
        navigate('/', { replace: true }); 

      } catch (err: any) {
        console.error('Failed to load shared gradient:', err);
        setError(err.message || 'Could not load the shared gradient.');
        setLoadingState('error');
        // Optional: redirect to home after error display
        // setTimeout(() => navigate('/'), 3000);
      }
    };

    fetchGradient();

    // Dependency array includes slug and setGradient
  }, [slug, setGradient, navigate]);

  if (loadingState === 'loading') {
    return <div className="h-screen w-screen flex items-center justify-center">Loading shared gradient...</div>;
  }

  if (loadingState === 'error') {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center text-red-600">
        <p>Error loading gradient:</p>
        <p className="mt-2 font-mono text-sm bg-red-100 p-2 rounded">{error ?? 'Unknown error'}</p>
        <button onClick={() => navigate('/')} className="mt-4 text-blue-600 underline">Go to Editor</button>
      </div>
    );
  }

  // Should ideally not be reached as we navigate away on success
  return null; 
} 