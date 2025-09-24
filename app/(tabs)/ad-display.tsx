
import { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import Video from 'expo-video';
import { WebView } from 'react-native-webview';

// ... (interfaces remain the same)
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


const AdPlaylist = ({ ads }: { ads?: Ad[] }) => {
  // Diagnostic logging
  console.log('[AdPlaylist] Rendering - ads:', ads ? `Array[${ads.length}]` : ads);

  // Definitive guard against undefined prop
  if (!ads) {
    // This state should not be hit if the parent component is correctly implemented,
    // but it is the last line of defense against the crash.
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#fff" />
        <ThemedText>Error: Ad data is missing.</ThemedText>
      </View>
    );
  }
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const adTimer = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    setCurrentAdIndex(0);
  }, [ads]);

  const playNextAd = () => {
    if (ads.length > 0) {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
    }
  };

  useEffect(() => {
    if (adTimer.current) {
      clearTimeout(adTimer.current);
    }

    if (ads.length === 0 || !ads[currentAdIndex]) {
      return;
    }

    const currentAd = ads[currentAdIndex];
    if (currentAd.caching) {
      return;
    }

    if (currentAd.type === 'image') {
      const duration = (currentAd.duration || 10) * 1000;
      adTimer.current = setTimeout(playNextAd, duration);
    }

    return () => {
      if (adTimer.current) {
        clearTimeout(adTimer.current);
      }
    };
  }, [currentAdIndex, ads]);

  if (ads.length === 0) {
    return <ThemedText>Waiting for ad to be scheduled</ThemedText>;
  }

  const currentAd = ads[currentAdIndex];
  if (!currentAd) {
    return <ThemedText>Loading ad...</ThemedText>;
  }

  const uri = currentAd.localUri || currentAd.url;

  if (currentAd.caching) {
    return <ActivityIndicator size="large" color="#fff" />;
  }

  return (
    <>
      {currentAd.type === 'image' ? (
        <Image key={uri} source={{ uri }} style={styles.adImage} />
      ) : (
        <Video
          key={uri}
          source={{ uri }}
          style={styles.adVideo}
          shouldPlay
          onPlaybackStatusUpdate={(status) => {
            if (status.isLoaded && status.didJustFinish) {
              playNextAd();
            }
          }}
        />
      )}
    </>
  );
};

const PriorityStreamPlayer = ({ stream }: { stream: PriorityStream }) => {
  if (stream.type === 'youtube') {
    return <WebView source={{ uri: stream.url }} style={styles.webView} />;
  } else {
    return (
      <Video
        source={{ uri: stream.url }}
        style={styles.adVideo}
        shouldPlay
        isLooping
      />
    );
  }
};

export default function AdDisplayScreen({ ads, priorityStream }: AdDisplayScreenProps) {
  // Diagnostic logging
  console.log('[AdDisplayScreen] Rendering - ads:', ads ? `Array[${ads.length}]` : ads);

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
  adVideo: {
    width: '100%',
    height: '100%',
  },
  webView: {
    flex: 1,
    width: '100%',
    height: '100%',
  },
});
