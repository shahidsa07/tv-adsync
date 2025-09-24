
import { useState, useEffect, useCallback } from 'react';
import { WEBSOCKET_URL } from '@/constants/api';
import { fetchTvState, Ad, PriorityStream } from '@/lib/api';
import * as FileSystem from 'expo-file-system/legacy';

const adCacheDir = FileSystem.cacheDirectory + 'ad-cache/';

const getCacheFilename = (url: string) => {
  return url.substring(url.lastIndexOf('/') + 1).replace(/[^a-zA-Z0-9.-]/g, '_');
};

const ensureDirExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(adCacheDir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(adCacheDir, { intermediates: true });
  }
};

const cleanupCache = async (activeAds: Ad[]) => {
  try {
    await ensureDirExists();
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

// --- Rewritten processAds for efficiency ---
// This function now only calls setAds twice: once at the beginning to set the
// initial caching state, and once at the end with the fully processed ads.
// This prevents the constant re-renders that were breaking the ad timer.
const processAds = async (ads: Ad[], setAds: React.Dispatch<React.SetStateAction<Ad[]>>) => {
  const initialAds = ads.map(ad => ({ ...ad, caching: true, localUri: undefined }));
  setAds(initialAds);

  const processedAds = await Promise.all(
    ads.map(async (ad) => {
      const filename = getCacheFilename(ad.url);
      const localUri = adCacheDir + filename;
      const fileInfo = await FileSystem.getInfoAsync(localUri);

      if (fileInfo.exists) {
        return { ...ad, localUri, caching: false };
      } else {
        try {
          const { uri } = await FileSystem.downloadAsync(ad.url, localUri);
          return { ...ad, localUri: uri, caching: false };
        } catch (error) {
          console.error('Failed to download ad:', ad.url, error);
          return { ...ad, caching: false }; // Mark as not caching to avoid infinite loading
        }
      }
    })
  );

  setAds(processedAds);
};

export function useTvData(tvId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInGroup, setIsInGroup] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [priorityStream, setPriorityStream] = useState<PriorityStream | null>(null);
  // State to hold the raw ad data for comparison
  const [rawAds, setRawAds] = useState<Ad[]>([]);

  const fetchAndSetState = useCallback(async (currentTvId: string) => {
    try {
      const state = await fetchTvState(currentTvId);
      const newAds = state.playlist?.ads || [];

      // --- Optimization ---
      // If the new ad data is the same as the old data, do nothing.
      // This prevents the playlist from being needlessly reset.
      if (JSON.stringify(rawAds) === JSON.stringify(newAds)) {
        setIsLoading(false);
        return;
      }

      setRawAds(newAds);
      setIsInGroup(!!state.group);
      setPriorityStream(state.group?.priorityStream || null);
      
      await cleanupCache(newAds);
      await processAds(newAds, setAds);

    } catch (error) {
      console.error("Failed to fetch and set state:", error);
      setIsInGroup(false);
      setAds([]);
      setPriorityStream(null);
    } finally {
      setIsLoading(false);
    }
  }, [rawAds]); // Dependency on rawAds is key for the comparison

  useEffect(() => {
    if (!tvId) return;

    fetchAndSetState(tvId);

    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'register', payload: { tvId } }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      if (message.type === 'REFRESH_STATE') {
        fetchAndSetState(tvId);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket Error:', error);
    };

    return () => {
      ws.close();
    };
  }, [tvId, fetchAndSetState]);

  return { isLoading, isInGroup, ads, priorityStream };
}
