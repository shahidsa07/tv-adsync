
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

// This player is for the priority stream, which is a simple, single-source loop.
// It does not have the complexity of the main ad playlist.
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

// --- Main Ad Playlist Logic (Definitive Crash Fix) ---

const AdPlaylist = ({ ads = [] }: { ads?: Ad[] }) => {
  const [currentAdIndex, setCurrentAdIndex] = useState(0);
  // 'tick' state still helps ensure image timers are correctly reset.
  const [tick, setTick] = useState(0);

  // A single, persistent player that is never unmounted. This is the core of the fix.
  const player = useVideoPlayer(null, p => {
    p.muted = true; // Mute audio by default, can be changed if needed.
    p.play();
  });

  const playNextAd = useCallback(() => {
    if (ads.length > 0) {
      setCurrentAdIndex((prevIndex) => (prevIndex + 1) % ads.length);
      setTick(t => t + 1);
    }
  }, [ads.length]);

  // This event listener handles when a video ad finishes playing.
  useEvent(player, 'ended', playNextAd);

  const currentAd = ads.length > 0 ? ads[currentAdIndex] : null;

  // This effect is the main orchestrator for the playlist.
  useEffect(() => {
    if (!currentAd) return;

    let imageTimer: NodeJS.Timeout | null = null;
    const uri = currentAd.localUri || currentAd.url;

    if (currentAd.type === 'image') {
      // For images, we ensure the video player is paused.
      if (player.isPlaying) {
        player.pause();
      }
      // And we set a timer to advance to the next ad.
      const duration = (currentAd.duration || 10) * 1000;
      imageTimer = setTimeout(playNextAd, duration);
    } else if (currentAd.type === 'video') {
      // For videos, we check if the player's source is different.
      // If it is, we replace it. This is more efficient than creating a new player.
      if (player.source?.uri !== uri) {
        player.replace(uri);
      }
      // Ensure the player is playing.
      player.play();
    }

    // The cleanup function clears the timer to prevent memory leaks.
    return () => {
      if (imageTimer) {
        clearTimeout(imageTimer);
      }
    };
  }, [currentAd, tick, player, playNextAd]); // Depends on the current ad and the tick.

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

  const isVideo = currentAd.type === 'video';
  const isImage = currentAd.type === 'image';
  const uri = currentAd.localUri || currentAd.url;

  return (
    <View style={styles.container}>
      {/*
        The VideoView is now *always* rendered, preventing the unmount/remount cycle.
        Its visibility is controlled by the 'display' style property.
        This prevents the "shared object was already released" native crash.
      */}
      <VideoView
        player={player}
        style={[styles.video, { display: isVideo ? 'flex' : 'none' }]}
      />
      {isImage && uri && (
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
