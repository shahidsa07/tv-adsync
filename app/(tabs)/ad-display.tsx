
import { useState, useEffect, useRef } from 'react';
import { View, Image, StyleSheet, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { Video } from 'expo-av';

interface Ad {
  type: 'image' | 'video';
  url: string;
  order: number;
  duration?: number; // in seconds
  localUri?: string;
  caching?: boolean;
}

interface AdDisplayScreenProps {
  ads: Ad[];
}

export default function AdDisplayScreen({ ads }: AdDisplayScreenProps) {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  const adTimer = useRef<NodeJS.Timeout | null>(null);
  const videoRef = useRef<Video>(null);

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
      // Don't set a timer if the ad is still downloading.
      return;
    }

    if (currentAd.type === 'image') {
      const duration = (currentAd.duration || 10) * 1000;
      adTimer.current = setTimeout(playNextAd, duration);
    } else {
      // For video, the onPlaybackStatusUpdate handles the next ad
      videoRef.current?.replayAsync();
    }

    return () => {
      if (adTimer.current) {
        clearTimeout(adTimer.current);
      }
    };
  }, [currentAdIndex, ads]);

  if (ads.length === 0) {
    return (
      <View style={styles.container}>
        <ThemedText>Waiting for ad to be scheduled</ThemedText>
      </View>
    );
  }

  const currentAd = ads[currentAdIndex];

  // Determine the correct URI to use (local cache or remote)
  const uri = currentAd.localUri || currentAd.url;

  return (
    <View style={styles.container}>
      {currentAd.caching ? (
        <ActivityIndicator size="large" color="#fff" />
      ) : (
        <>
          {currentAd.type === 'image' ? (
            <Image key={uri} source={{ uri }} style={styles.adImage} />
          ) : (
            <Video
              ref={videoRef}
              key={uri}
              source={{ uri }}
              style={styles.adVideo}
              shouldPlay
              resizeMode="contain"
              onPlaybackStatusUpdate={(status) => {
                if (status.isLoaded && status.didJustFinish) {
                  playNextAd();
                }
              }}
            />
          )}
        </>
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
});
