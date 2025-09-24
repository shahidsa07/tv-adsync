
import { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { useVideoPlayer, VideoView, useEvent } from 'expo-video';
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

// --- Video Player Components (using the new expo-video API) ---

// This component handles a single video ad, using the new hooks.
const VideoAd = ({ uri, onEnd }: { uri: string; onEnd: () => void }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  // Listen for the 'ended' event to trigger the next ad
  useEvent(player, 'ended', onEnd);

  return <VideoView style={styles.video} player={player} />;
};

// This component handles the looping priority stream.
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

// --- Main Ad Playlist Logic ---

const AdPlaylist = ({ ads = [] }: { ads?: Ad[] }) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const imageAdTimer = useRef<NodeJS.Timeout | null>(null);

  // Guard clause for undefined or empty ads
  if (ads.length === 0) {
    return <ThemedText>Waiting for ad to be scheduled</ThemedText>;
  }

  const playNextAd = () => {
    setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
  };

  // Effect to handle image ad timers
  useEffect(() => {
    if (imageAdTimer.current) {
      clearTimeout(imageAdTimer.current);
    }

    const currentAd = ads[currentAdIndex];
    if (currentAd?.type === 'image') {
      const duration = (currentAd.duration || 10) * 1000;
      imageAdTimer.current = setTimeout(playNextAd, duration);
    }

    return () => {
      if (imageAdTimer.current) {
        clearTimeout(imageAdTimer.current);
      }
    };
  }, [currentAdIndex, ads]);

  const currentAd = ads[currentAdIndex];
  if (!currentAd) {
    return <ThemedText>Loading ad...</ThemedText>;
  }

  const uri = currentAd.localUri || currentAd.url;

  if (currentAd.caching) {
    return <ActivityIndicator size="large" color="#fff" />;
  }

  // Render the correct component based on ad type
  return (
    <View style={styles.container}>
      {currentAd.type === 'image' ? (
        <Image key={uri} source={{ uri }} style={styles.adImage} />
      ) : (
        <VideoAd key={uri} uri={uri} onEnd={playNextAd} />
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
