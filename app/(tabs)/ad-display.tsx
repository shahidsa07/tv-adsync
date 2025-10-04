import { useVideoPlayer, VideoView } from "expo-video";
import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { WebView } from "react-native-webview";

import { ThemedText } from "@/components/themed-text";
import { Ad, PriorityStream } from "@/hooks/use-tv-group";
import { recordAdPlayback } from "@/lib/analytics";

export default function AdDisplayScreen({
  ads,
  priorityStream,
  tvId,
}: {
  ads: Ad[];
  priorityStream: PriorityStream | null;
  tvId: string;
}) {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [adPlayCount, setAdPlayCount] = useState(0);

  const currentAd = ads.length > 0 ? ads[currentAdIndex] : null;
  // Initialize the player with a null source. We will control it imperatively.
  const player = useVideoPlayer(null);

  const handleAdEnd = () => {
    if (ads.length > 0) {
      if (ads.length === 1) {
        // Increment adPlayCount to re-trigger effects for the same ad
        setAdPlayCount((prev) => prev + 1);
      } else {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      }
    }
  };

  // Imperatively control the video player's source and state.
  useEffect(() => {
    const isPriorityVideo = priorityStream && priorityStream.type !== "youtube";
    const isAdVideo = !priorityStream && currentAd?.type === "video";

    const source = isPriorityVideo
      ? { uri: priorityStream.url }
      : isAdVideo
      ? { uri: currentAd.localUri ?? currentAd.url }
      : null;

    if (source) {
      player.replace(source);
      player.loop = isPriorityVideo || (isAdVideo && ads.length === 1);
      player.play();
    } else {
      player.replace(null); // Unload video if no source
    }
    // This effect re-runs whenever the ad, priority stream, or play count changes.
  }, [player, currentAd, priorityStream, ads.length, adPlayCount]);

  useEffect(() => {
    // If the currently displayed ad is removed from the playlist, reset to the first ad.
    if (currentAdIndex >= ads.length) {
      setCurrentAdIndex(0);
    }
  }, [ads, currentAdIndex]);

  // Effect for handling video ad completion
  useEffect(() => {
    if (!currentAd || currentAd.type !== "video" || priorityStream) return;

    const subscription = player.addListener("statusChange", (status) => {
      // For non-looping videos, advance to the next ad when finished.
      if (status.isFinished && !player.loop) {
        const duration = player.duration ?? 0;
        recordAdPlayback({ adId: currentAd.id, tvId, duration });
        handleAdEnd();
      }
    });

    return () => {
      subscription.remove();
    };
    // This effect should only depend on values that define the current ad context
  }, [player, currentAd, tvId, priorityStream]);

  // Effect for handling image ad duration
  useEffect(() => {
    if (priorityStream || !currentAd || currentAd.type !== "image") {
      return;
    }

    const duration = currentAd.duration ?? 10;
    const timeoutId = setTimeout(() => {
      recordAdPlayback({ adId: currentAd.id, tvId, duration });
      handleAdEnd();
    }, duration * 1000);

    return () => clearTimeout(timeoutId);
  }, [priorityStream, currentAd, tvId, adPlayCount]); // re-run if the same image ad plays again

  // --- RENDER LOGIC ---

  const isVideoPlaying = (priorityStream && priorityStream.type !== "youtube") || (currentAd && currentAd.type === "video");

  if (priorityStream?.type === "youtube") {
    return (
      <WebView
        source={{ uri: priorityStream.url }}
        style={styles.fill}
      />
    );
  }

  if (isVideoPlaying) {
    return (
      <VideoView
        style={styles.fill}
        player={player}
        nativeControls={false}
        contentFit="contain"
      />
    );
  }

  if (currentAd?.type === "image") {
    return (
      <Image
        key={`${currentAd.id}-${adPlayCount}`}
        style={styles.fill}
        source={{ uri: currentAd.localUri ?? currentAd.url }}
        resizeMode="contain"
      />
    );
  }

  if (currentAd?.caching) {
    return (
      <View style={styles.container}>
        <ThemedText>Caching...</ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ThemedText>Waiting for an ad to be scheduled...</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
  },
  fill: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
});
