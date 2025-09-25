
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

// --- Player Components ---

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

// --- Main Ad Playlist Logic (Definitive Conditional Rendering Fix) ---

const AdPlaylist = ({ ads = [] }: { ads?: Ad[] }) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const [tick, setTick] = useState(0);

  // The single, persistent player. Its lifecycle is managed here and it is
  // passed to the VideoView only when a video is being rendered.
  const player = useVideoPlayer(null, p => {
    p.muted = true;
    p.play();
  });

  const playNextAd = useCallback(() => {
    if (ads.length > 0) {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
      setTick(t => t + 1);
    }
  }, [ads.length]);

  useEvent(player, 'ended', playNextAd);

  const currentAd = ads.length > 0 ? ads[currentAdIndex] : null;

  useEffect(() => {
    if (!currentAd) return;

    let imageTimer: NodeJS.Timeout | null = null;
    const uri = currentAd.localUri || currentAd.url;

    if (currentAd.type === 'image') {
      player.replace(null);
      const duration = (currentAd.duration || 10) * 1000;
      imageTimer = setTimeout(playNextAd, duration);
    } else if (currentAd.type === 'video') {
      if (player.source?.uri !== uri) {
        player.replace(uri);
      }
      player.play();
    }

    return () => {
      if (imageTimer) {
        clearTimeout(imageTimer);
      }
    };
  }, [currentAd, tick, player, playNextAd]);

  // --- Render Logic ---

  if (ads.length === 0) {
    return <ThemedText>Waiting for an ad to be scheduled...</ThemedText>;
  }

  if (!currentAd) {
    return <ThemedText>Loading ad...</ThemedText>;
  }

  if (currentAd.caching) {
    return <ActivityIndicator size="large" color="#fff" />;
  }

  const uri = currentAd.localUri || currentAd.url;

  // This is the definitive fix: We conditionally render the component for the
  // current ad type. This is the cleanest and most reliable way.
  return (
    <View style={styles.container}>
      {currentAd.type === 'video' && (
        <VideoView player={player} style={styles.video} />
      )}
      {currentAd.type === 'image' && uri && (
        <Image
          key={`${currentAd.id}-${tick}`}
          source={{ uri }}
          style={styles.adImage}
        />
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
