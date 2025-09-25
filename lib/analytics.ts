
import { getBaseUrl } from "@/lib/get-base-url";

export async function recordAdPlayback({
  adId,
  tvId,
  duration,
}: {
  adId: string;
  tvId: string;
  duration: number;
}) {
  const baseUrl = getBaseUrl();
  const url = `${baseUrl}/api/analytics/record-play`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ adId, tvId, duration }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error("Failed to record ad playback:", error);
    // Depending on the app's requirements, you might want to handle this error
    // more gracefully, e.g., by queueing the analytics data to be sent later.
    return { success: false, message: "Failed to send analytics data." };
  }
}
