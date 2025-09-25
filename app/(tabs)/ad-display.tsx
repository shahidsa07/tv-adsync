
import { ResizeMode, Video } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Ad, PriorityStream } from "@/hooks/use-tv-group";
import { recordAdPlayback } from "@/lib/analytics";
import { WebView } from "react-native-webview";

const AdPlayer = ({
  ad,
  tvId,
  onAdEnd,
}: {
  ad: Ad;
  tvId: string;
  onAdEnd: (ad: Ad) => void;
}) => {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    let adEndTimeout: NodeJS.Timeout;

    if (ad.type === "image") {
      const duration = ad.duration ?? 10;
      adEndTimeout = setTimeout(() => {
        recordAdPlayback({ adId: ad.id, tvId, duration });
        onAdEnd(ad);
      }, duration * 1000);
    }

    return () => {
      clearTimeout(adEndTimeout);
    };
  }, [ad, tvId, onAdEnd]);

  if (ad.caching) {
    return (
      <View style={styles.container}>
        <ThemedText>Caching...</ThemedText>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, width: "100%", height: "100%" }}>
      {ad.type === "video" ? (
        <Video
          ref={videoRef}
          style={{ flex: 1 }}
          source={{
            uri: ad.localUri ?? ad.url,
          }}
          useNativeControls={false}
          resizeMode={ResizeMode.CONTAIN}
          isLooping={false}
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.didJustFinish) {
              const duration = (status.durationMillis ?? 0) / 1000;
              recordAdPlayback({ adId: ad.id, tvId, duration });
              onAdEnd(ad);
            }
          }}
          shouldPlay
        />
      ) : (
        <Image
          style={{ flex: 1 }}
          source={{ uri: ad.localUri ?? ad.url }}
          resizeMode="contain"
        />
      )}
    </View>
  );
};

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

  useEffect(() => {
    // If the currently displayed ad is removed from the playlist, reset to the first ad.
    if (currentAdIndex >= ads.length) {
      setCurrentAdIndex(0);
    }
  }, [ads]);

  const handleAdEnd = () => {
    if (ads.length > 0) {
      if (ads.length === 1) {
        setAdPlayCount((prev) => prev + 1);
      } else {
        setCurrentAdIndex((prev) => (prev + 1) % ads.length);
      }
    }
  };

  if (priorityStream) {
    if (priorityStream.type === "youtube") {
      return (
        <WebView
          source={{ uri: priorityStream.url }}
          style={{ flex: 1, width: "100%", height: "100%" }}
        />
      );
    }
    return (
      <Video
        style={{ flex: 1, width: "100%", height: "100%" }}
        source={{
          uri: priorityStream.url,
        }}
        useNativeControls={false}
        resizeMode={ResizeMode.CONTAIN}
        isLooping
        shouldPlay
      />
    );
  }

  if (!ads.length) {
    return (
      <View style={styles.container}>
        <ThemedText>Waiting for an ad to be scheduled...</ThemedText>
      </View>
    );
  }

  // This check prevents a crash if the currentAdIndex is out of bounds
  // before the useEffect has a chance to run.
  if (currentAdIndex >= ads.length) {
    return (
      <View style={styles.container}>
        <ThemedText>Loading...</ThemedText>
      </View>
    );
  }

  return (
    <AdPlayer
      key={`${ads[currentAdIndex].id}-${adPlayCount}`}
      ad={ads[currentAdIndex]}
      tvId={tvId}
      onAdEnd={handleAdEnd}
    />
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#000",
    width: "100%",
    height: "100%",
  },
});
