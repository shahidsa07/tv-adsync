import { useVideoPlayer, VideoView } from "expo-video";
import { useEventListener } from "expo";
import { useEffect, useState, useMemo } from "react";
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

  // 1. Determine the current ad based on the index
  const currentAd = useMemo(() => {
    if (!priorityStream && ads.length > 0 && currentAdIndex < ads.length) {
      return ads[currentAdIndex];
    }
    return null;
  }, [priorityStream, ads, currentAdIndex]);

  // 2. Determine the correct video source for the player
  const videoSource = useMemo(() => {
    if (priorityStream?.type === "video") {
      return { uri: priorityStream.url };
    }
    if (currentAd?.type === "video") {
      return { uri: currentAd.localUri ?? currentAd.url };
    }
    return null;
  }, [priorityStream, currentAd]);

  // 3. Initialize the video player
  const player = useVideoPlayer(videoSource, (p) => {
    if (videoSource) {
      p.play();
    }
  });

  // 4. This effect keeps the player's loop status in sync with app state
  useEffect(() => {
    const isSingleVideoAd =
      !priorityStream && ads.length === 1 && currentAd?.type === "video";
    const isPriorityVideo = priorityStream?.type === "video";

    player.loop = isPriorityVideo || isSingleVideoAd;
  }, [priorityStream, ads, currentAd, player]);

  // 5. This listener handles video completion for multi-ad playlists
  useEventListener(player, "playToEnd", () => {
    // This event only fires if player.loop is false (i.e., for multi-ad playlists)
    if (!priorityStream && currentAd?.type === "video" && ads.length > 1) {
      recordAdPlayback({
        adId: currentAd.id,
        tvId,
        duration: player.duration ?? 0,
      });

      const nextIndex = (currentAdIndex + 1) % ads.length;
      setCurrentAdIndex(nextIndex);
    }
  });

  // 6. This effect handles the timer for image ads
  useEffect(() => {
    if (currentAd?.type === "image") {
      const duration = currentAd.duration ?? 10;
      const timeoutId = setTimeout(() => {
        recordAdPlayback({ adId: currentAd.id, tvId, duration });

        if (ads.length === 1) {
          setAdPlayCount((p) => p + 1); // Re-trigger effect for single image
        } else {
          setCurrentAdIndex((p) => (p + 1) % ads.length);
        }
      }, duration * 1000);

      return () => clearTimeout(timeoutId);
    }
  }, [currentAd, adPlayCount, ads.length, tvId]);

  // 7. This crucial effect syncs the player source with the current ad index
  useEffect(() => {
    if (videoSource) {
      if (player.source?.uri !== videoSource.uri) {
        player.replace(videoSource);
        player.play();
      }
    } else {
      player.replace(null); // Unload video if not needed
    }
  }, [player, videoSource]);

  // 8. Effect to handle dynamic changes in the playlist (e.g., ad removal)
  useEffect(() => {
    if (currentAdIndex >= ads.length) {
      setCurrentAdIndex(0);
    }
  }, [ads]);

  // --- RENDER LOGIC ---

  if (priorityStream) {
    if (priorityStream.type === "youtube") {
      return (
        <WebView
          source={{ uri: priorityStream.url }}
          style={styles.fill}
        />
      );
    }
    // It's a priority video, handled by the main player
    return (
      <VideoView
        style={styles.fill}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />
    );
  }

  if (!currentAd) {
    return (
      <View style={styles.container}>
        <ThemedText>Waiting for an ad to be scheduled...</ThemedText>
      </View>
    );
  }

  if (currentAd.caching) {
    return (
      <View style={styles.container}>
        <ThemedText>Caching...</ThemedText>
      </View>
    );
  }

  if (currentAd.type === "video") {
    return (
      <VideoView
        key={`${currentAd.id}-${adPlayCount}`}
        style={styles.fill}
        player={player}
        contentFit="contain"
        nativeControls={false}
      />
    );
  }

  if (currentAd.type === "image") {
    return (
      <Image
        key={`${currentAd.id}-${adPlayCount}`}
        style={styles.fill}
        source={{ uri: currentAd.localUri ?? currentAd.url }}
        resizeMode="contain"
      />
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
