
import { ResizeMode, Video } from "expo-av";
import { useEffect, useRef, useState } from "react";
import { Image, StyleSheet, View } from "react-native";

import { ThemedText } from "@/components/themed-text";
import { Ad, PriorityStream } from "@/hooks/use-tv-group";
import { WebView } from "react-native-webview";

const AdPlayer = ({
  ad,
  onAdEnd,
}: {
  ad: Ad;
  onAdEnd: (ad: Ad) => void;
}) => {
  const videoRef = useRef<Video>(null);

  useEffect(() => {
    let adEndTimeout: NodeJS.Timeout;

    if (ad.type === "image") {
      adEndTimeout = setTimeout(() => {
        onAdEnd(ad);
      }, (ad.duration ?? 10) * 1000);
    }

    return () => {
      clearTimeout(adEndTimeout);
    };
  }, [ad, onAdEnd]);

  if (ad.caching) {
    return <ThemedText>Caching...</ThemedText>;
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
}: {
  ads: Ad[];
  priorityStream: PriorityStream | null;
}) {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);

  const handleAdEnd = () => {
    setCurrentAdIndex((prev) => (prev + 1) % ads.length);
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
      <View>
        <ThemedText>Waiting for an ad to be scheduled...</ThemedText>
      </View>
    );
  }

  return (
    <AdPlayer
      key={ads[currentAdIndex].id}
      ad={ads[currentAdIndex]}
      onAdEnd={handleAdEnd}
    />
  );
}

const styles = StyleSheet.create({});
