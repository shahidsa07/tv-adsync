
import { useState, useEffect, useRef } from 'react';
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

// Correctly handles a single video ad with the new API
const VideoAd = ({ uri, onEnd }: { uri: string; onEnd: () => void }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.play();
  });

  useEvent(player, 'ended', onEnd);

  return <VideoView style={styles.video} player={player} />;
};

// Correctly handles looping priority video streams
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

// --- Main Ad Playlist Logic (Rewritten for correctness) ---

const AdPlaylist = ({ ads = [] }: { ads?: Ad[] }) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const imageAdTimer = useRef<NodeJS.Timeout | null>(null);

  const playNextAd = () => {
    if (ads.length > 0) {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
    }
  };

  // This effect now correctly handles the timer for image-based ads.
  useEffect(() => {
    const currentAd = ads[currentAdIndex];
    if (currentAd?.type === 'image') {
      const duration = (currentAd.duration || 10) * 1000;
      imageAdTimer.current = setTimeout(playNextAd, duration);
    } else {
      // If it's not an image, clear any existing timer.
      if (imageAdTimer.current) {
        clearTimeout(imageAdTimer.current);
      }
    }

    return () => {
      if (imageAdTimer.current) {
        clearTimeout(imageAdTimer.current);
      }
    };
  }, [currentAdIndex, ads]);

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

  // This logic correctly renders either an Image or a Video ad.
  return (
    <View style={styles.container}>
      {currentAd.type === 'image' ? (
        <Image source={{ uri }} style={styles.adImage} />
      ) : (
        <VideoAd uri={uri} onEnd={playNextAd} />
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
