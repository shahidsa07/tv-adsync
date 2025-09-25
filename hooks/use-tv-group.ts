
import { WEBSOCKET_URL } from "@/constants/api";
import { Ad, PriorityStream, fetchTvState } from "@/lib/api";
import { Directory, File } from "expo-file-system";
import { useEffect, useState } from "react";

const adCacheDir = new Directory("cache://ad-cache");

// Generate a local filename from URL
const getCacheFilename = (url: string) => {
  return url.substring(url.lastIndexOf("/") + 1);
};

// ✅ Ensure the directory exists
const ensureDirExists = async () => {
  if (!(await adCacheDir.exists())) {
    await adCacheDir.create({ intermediates: true });
  }
};

// ✅ Cleanup unused files
const cleanupCache = async (activeAds: Ad[]) => {
  try {
    await ensureDirExists();
    const activeFilenames = new Set(activeAds.map((ad) => getCacheFilename(ad.url)));

    const cachedFiles = await adCacheDir.read();

    for (const filename of cachedFiles) {
      if (!activeFilenames.has(filename)) {
        console.log("deleting", filename);
        const fileUri = `${adCacheDir.uri}/${filename}`;
        const fileToDelete = new File(fileUri);
        if (await fileToDelete.exists()) {
          await fileToDelete.delete();
        }
      }
    }
  } catch (error) {
    console.error("Failed to clean up cache:", error);
  }
};

// ✅ Process ads: check cache, download if needed
const processAds = async (
  ads: Ad[],
  setAds: React.Dispatch<React.SetStateAction<Ad[]>>
) => {
  await ensureDirExists();

  for (const ad of ads) {
    const filename = getCacheFilename(ad.url);
    const fileUri = `${adCacheDir.uri}/${filename}`;
    const adFile = new File(fileUri);

    if (await adFile.exists()) {
      // Already cached
      setAds((prev) =>
        prev.map((prevAd) =>
          prevAd.id === ad.id ? { ...prevAd, localUri: adFile.uri, caching: false } : prevAd
        )
      );
    } else {
      // Download
      setAds((prev) =>
        prev.map((prevAd) =>
          prevAd.id === ad.id ? { ...prevAd, caching: true } : prevAd
        )
      );
      try {
        console.log("downloading", ad.url);
        const { uri } = await adFile.download(ad.url);
        setAds((prev) =>
          prev.map((prevAd) =>
            prevAd.id === ad.id ? { ...prevAd, localUri: uri, caching: false } : prevAd
          )
        );
      } catch (error) {
        console.error("Failed to download ad:", ad.url, error);
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
