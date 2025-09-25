
import { useState, useEffect, useCallback } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useEvent } from 'expo';
import { WebView } from 'react-native-webview';

// --- Interfaces ---
interface Ad {
  id: string;
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number;
  localUri?: string;
  caching?: boolean;
}

interface PriorityStream {
  type: 'video' | 'youtube';
  url: string;
}

interface AdDisplayScreenProps {
  ads?: Ad[];
  priorityStream: PriorityStream | null;
}

// --- Player Components (Using expo-video) ---

const VideoAd = ({ uri, onEnd }: { uri: string; onEnd: () => void }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  useEvent(player, 'ended', onEnd);

  return <VideoView style={styles.video} player={player} />;
};

const PriorityStreamPlayer = ({ stream }: { stream: PriorityStream }) => {
  if (stream.type === 'youtube') {
    return <WebView source={{ uri: stream.url }} style={styles.webView} />;
  }

  const player = useVideoPlayer(stream.url, (p) => {
    p.play();
    p.loop = true;
  });

  return <VideoView style={styles.video} player={player} />;
};

// --- Main Ad Playlist Logic (Definitive and Robust) ---

const AdPlaylist = ({ ads = [] }: { ads?: Ad[] }) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  // 'tick' state forces the timer effect to re-run, fixing single-image loops.
  const [tick, setTick] = useState(0);

  const playNextAd = useCallback(() => {
    if (ads.length > 0) {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
      setTick(t => t + 1); // Guarantees the effect hook will re-run.
    }
  }, [ads.length]);

  // This is the definitive timer logic. It correctly handles image ad durations
  // and is guaranteed to re-run because it depends on the 'tick' state.
  useEffect(() => {
    const currentAd = ads[currentAdIndex];

    if (currentAd?.type !== 'image') {
      return; // Not an image, so no timer needed.
    }

    const duration = (currentAd.duration || 10) * 1000;
    const timerId = setTimeout(playNextAd, duration);

    return () => clearTimeout(timerId);
  }, [currentAdIndex, ads, tick, playNextAd]);

  if (ads.length === 0) {
    return <ThemedText>Waiting for an ad to be scheduled...</ThemedText>;
  }

  const currentAd = ads[currentAdIndex];

  if (!currentAd) {
    return <ThemedText>Loading ad...</ThemedText>;
  }

  if (currentAd.caching) {
    return <ActivityIndicator size="large" color="#fff" />;
  }

  const uri = currentAd.localUri || currentAd.url;

  // The unique key forces React to fully re-mount the component, ensuring
  // that the new image or video loads correctly every time.
  const key = `${currentAd.id}-${tick}`;

  return (
    <View style={styles.container}>
      {currentAd.type === 'image' ? (
        <Image key={key} source={{ uri }} style={styles.adImage} />
      ) : (
        <VideoAd key={key} uri={uri} onEnd={playNextAd} />
      )}
    </View>
  );
};

// --- Top-Level Screen Component ---

export default function AdDisplayScreen({ ads, priorityStream }: AdDisplayScreenProps) {
  return (
    <View style={styles.container}>
      {priorityStream ? (
        <PriorityStreamPlayer stream={priorityStream} />
      ) : (
        <AdPlaylist ads={ads} />
      )}
    </View>
  );
}

// --- Styles ---

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000',
  },
  adImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'contain',
  },
  video: {
    width: '100%',
    height: '100%',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
