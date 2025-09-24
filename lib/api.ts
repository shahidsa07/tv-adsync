
import { API_BASE_URL } from '@/constants/api';

export interface Ad {
  id: string;
  name: string;
  type: 'image' | 'video';
  url: string;
  duration?: number;
  // Client-side properties
  localUri?: string; 
  caching?: boolean; 
}

export interface PriorityStream {
  type: 'video' | 'youtube';
  url: string;
}

export interface TvState {
  tvId: string;
  name: string;
  group: {
    id: string;
    name: string;
    priorityStream: PriorityStream | null;
  } | null;
  playlist: {
    id: string;
    name: string;
    ads: Ad[];
  } | null;
}

export async function fetchTvState(tvId: string): Promise<TvState> {
  const response = await fetch(`${API_BASE_URL}/tv-state/${tvId}`);
  
  if (!response.ok) {
    // For a new TV, the server will return 404. We'll treat this as a valid, unassigned state.
    if (response.status === 404) {
      return {
        tvId,
        name: 'New TV',
        group: null,
        playlist: null,
      };
    }
    throw new Error('Failed to fetch TV state. Status: ' + response.status);
  }
  
  return response.json();
}
