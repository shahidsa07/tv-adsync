
import { useState, useEffect, useRef } from 'react';
import * as FileSystem from 'expo-file-system';
import { WEBSOCKET_URL } from '@/constants/api';

interface Ad {
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number; // in seconds
  localUri?: string; // The local file path for the cached ad
  caching?: boolean; // A flag to indicate if the ad is currently being downloaded
}

const adCacheDir = FileSystem.cacheDirectory + 'ad-cache/';

// Helper function to create a safe filename from a URL
const getCacheFilename = (url: string) => {
  // Use the last part of the URL and replace non-alphanumeric characters
  return url.substring(url.lastIndexOf('/') + 1).replace(/[^a-zA-Z0-9.-]/g, '_');
};

// Helper function to ensure the cache directory exists
const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(adCacheDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(adCacheDir, { intermediates: true });
  }
};

// Helper function to clean up old ad files
const cleanupCache = async (activeAds: Ad[]) => {
  try {
    const activeFilenames = new Set(activeAds.map(ad => getCacheFilename(ad.url)));
    const cachedFiles = await FileSystem.readDirectoryAsync(adCacheDir);

    for (const filename of cachedFiles) {
      if (!activeFilenames.has(filename)) {
        await FileSystem.deleteAsync(adCacheDir + filename);
      }
    }
  } catch (error) {
    console.error('Failed to clean up cache:', error);
  }
};

export function useTvData(tvId: string | null) {
  const [isInGroup, setIsInGroup] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const isProcessingAds = useRef(false);

  useEffect(() => {
    if (!tvId) {
      return;
    }

    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', payload: { tvId } }));
    };

    ws.onmessage = async (event) => {
      if (isProcessingAds.current) return; // Prevent processing multiple updates at once

      const message = JSON.parse(event.data);

      if (message.type === 'GROUP_UPDATE') {
        setIsInGroup(message.payload.isInGroup);
        if (!message.payload.isInGroup) {
          setAds([]);
          await cleanupCache([]); // Clean up all ads if not in a group
        }
      } else if (message.type === 'AD_UPDATE') {
        isProcessingAds.current = true;
        const receivedAds: Ad[] = message.payload.ads || [];
        receivedAds.sort((a, b) => a.order - b.order);

        await ensureDirExists();
        await cleanupCache(receivedAds);

        // Set initial state with caching flags
        const initialAds = receivedAds.map(ad => ({ ...ad, caching: true, localUri: undefined }));
        setAds(initialAds);

        // Process each ad for caching
        for (const ad of receivedAds) {
          const filename = getCacheFilename(ad.url);
          const localUri = adCacheDir + filename;
          const fileInfo = await FileSystem.getInfoAsync(localUri);

          if (fileInfo.exists) {
            // Already cached, update the state
            setAds(prevAds =>
              prevAds.map(prevAd =>
                prevAd.url === ad.url ? { ...prevAd, localUri, caching: false } : prevAd
              )
            );
          } else {
            // Not cached, download it
            try {
              const { uri } = await FileSystem.downloadAsync(ad.url, localUri);
              setAds(prevAds =>
                prevAds.map(prevAd =>
                  prevAd.url === ad.url ? { ...prevAd, localUri: uri, caching: false } : prevAd
                )
              );
            } catch (error) {
              console.error('Failed to download ad:', ad.url, error);
              // Mark as not caching, will fallback to remote URL
              setAds(prevAds =>
                prevAds.map(prevAd =>
                  prevAd.url === ad.url ? { ...prevAd, caching: false } : prevAd
                )
              );
            }
          }
        }
        isProcessingAds.current = false;
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    return () => {
      ws.close();
    };
  }, [tvId]);

  return { isInGroup, ads };
}
