
import { WEBSOCKET_URL } from "@/constants/api";
import { Ad, PriorityStream, fetchTvState } from "@/lib/api";
import * as FileSystem from "expo-file-system";
import { useEffect, useState } from "react";

const adCacheDir = FileSystem.cacheDirectory + "ad-cache/";

const getCacheFilename = (url: string) => {
  return url.substring(url.lastIndexOf("/") + 1);
};

// Function to ensure the cache directory exists
const ensureDirExists = async () => {
  // Using makeDirectoryAsync with intermediates: true ensures the directory exists
  // and doesn't throw an error if it already exists.
  await FileSystem.makeDirectoryAsync(adCacheDir, { intermediates: true });
};

// Function to clean up old ad files from the cache
const cleanupCache = async (activeAds: Ad[]) => {
  try {
    await ensureDirExists();
    const activeFilenames = new Set(activeAds.map((ad) => getCacheFilename(ad.url)));
    const cachedFiles = await FileSystem.readDirectoryAsync(adCacheDir);

    for (const filename of cachedFiles) {
      if (!activeFilenames.has(filename)) {
        console.log("deleting", filename);
        await FileSystem.deleteAsync(adCacheDir + filename, { idempotent: true });
      }
    }
  } catch (error) {
    console.error("Failed to clean up cache:", error);
  }
};

const processAds = async (
  ads: Ad[],
  setAds: React.Dispatch<React.SetStateAction<Ad[]>>
) => {
  await ensureDirExists();

  // Using a sequential for...of loop to process ads one by one.
  // This avoids race conditions from parallel state updates and fixes the timer bug.
  for (const ad of ads) {
    const filename = getCacheFilename(ad.url);
    const localUri = adCacheDir + filename;

    let fileExists = false;
    try {
      // Check for file existence by trying to access its content URI.
      // This will throw an error if the file doesn't exist.
      await FileSystem.getContentUriAsync(localUri);
      fileExists = true;
    } catch (e) {
      fileExists = false;
    }

    if (fileExists) {
      setAds((prev) =>
        prev.map((prevAd) =>
          prevAd.id === ad.id ? { ...prevAd, localUri, caching: false } : prevAd
        )
      );
    } else {
      setAds((prev) =>
        prev.map((prevAd) =>
          prevAd.id === ad.id ? { ...prevAd, caching: true } : prevAd
        )
      );
      try {
        console.log("downloading", ad.url);
        const { uri } = await FileSystem.downloadAsync(ad.url, localUri);
        setAds((prev) =>
          prev.map((prevAd) =>
            prevAd.id === ad.id ? { ...prevAd, localUri: uri, caching: false } : prevAd
          )
        );
      } catch (error) {
        console.error("Failed to download ad:", ad.url, error);
        // If download fails, just mark caching as false
        setAds((prev) =>
          prev.map((prevAd) =>
            prevAd.id === ad.id ? { ...prevAd, caching: false } : prevAd
          )
        );
      }
    }
  }
};

export function useTvData(tvId: string | null) {
  const [isLoading, setIsLoading] = useState(true);
  const [isInGroup, setIsInGroup] = useState(false);
  const [ads, setAds] = useState<Ad[]>([]);
  const [priorityStream, setPriorityStream] = useState<PriorityStream | null>(
    null
  );

  const fetchAndSetState = async (currentTvId: string) => {
    try {
      const state = await fetchTvState(currentTvId);
      setIsInGroup(!!state.group);
      setAds(state.playlist?.ads ?? []);
      setPriorityStream(state.group?.priorityStream ?? null);
      if (state.playlist?.ads) {
        await cleanupCache(state.playlist.ads);
        await processAds(state.playlist.ads, setAds);
      }
    } catch (error) { 
      console.error(error);
      setIsInGroup(false);
      setAds([]);
      setPriorityStream(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!tvId) return;

    fetchAndSetState(tvId);

    const ws = new WebSocket(WEBSOCKET_URL);

    ws.onopen = () => {
      console.log("connected");
      ws.send(JSON.stringify({ type: "register", payload: { tvId } }));
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log(message);
      if (message.type === "REFRESH_STATE") {
        fetchAndSetState(tvId);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket Error:", error);
    };

    return () => {
      ws.close();
    };
  }, [tvId]);

  return { isLoading, isInGroup, ads, priorityStream };
}
