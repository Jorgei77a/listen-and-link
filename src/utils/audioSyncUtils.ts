
/**
 * Utility functions for audio and transcript synchronization
 */

// Configuration settings for synchronization behavior
export const SYNC_CONFIG = {
  // How much extra time (in seconds) to play past a segment's end time
  // before pausing (useful for natural-sounding pauses)
  segmentEndBuffer: 2,
  
  // Minimum segment duration (in seconds) to prevent very short segments
  minSegmentDuration: 2,
  
  // Debounce time for scroll operations (in milliseconds)
  scrollDebounce: 200,
  
  // How close to the segment boundary (in seconds) we should be before preparing for transition
  transitionThreshold: 1.5
};

/**
 * Interface for a transcript segment with timing information
 */
export interface TranscriptSegment {
  start: number; // Start time in seconds
  end: number;   // End time in seconds
  text: string;  // Transcript text
}

/**
 * Check if a specific time is within a segment, accounting for buffer
 * 
 * @param time - Current playback time in seconds
 * @param segment - Segment to check against
 * @param useBuffer - Whether to apply end buffer (default: true)
 * @returns boolean indicating if time is within the segment
 */
export const isTimeInSegment = (
  time: number, 
  segment: TranscriptSegment, 
  useBuffer = true
): boolean => {
  const endTime = useBuffer 
    ? segment.end + SYNC_CONFIG.segmentEndBuffer 
    : segment.end;
    
  return time >= segment.start && time <= endTime;
};

/**
 * Check if a time has reached or exceeded a segment's end time
 * 
 * @param time - Current playback time in seconds
 * @param segment - Segment to check against
 * @returns boolean indicating if time has reached/passed the segment end
 */
export const hasReachedSegmentEnd = (
  time: number,
  segment: TranscriptSegment
): boolean => {
  return time >= segment.end;
};

/**
 * Find the segment that contains the current playback time
 * 
 * @param time - Current playback time in seconds
 * @param segments - Array of transcript segments
 * @param useBuffer - Whether to apply end buffer (default: true)
 * @returns The segment containing the time, or undefined if none found
 */
export const findSegmentAtTime = (
  time: number,
  segments: TranscriptSegment[],
  useBuffer = true
): TranscriptSegment | undefined => {
  if (!segments || segments.length === 0) return undefined;
  
  // Check each segment to see if it contains the current time
  return segments.find(segment => isTimeInSegment(time, segment, useBuffer));
};

/**
 * Get segment index by time
 * 
 * @param time - Current playback time in seconds
 * @param segments - Array of transcript segments
 * @returns The index of the segment containing the time, or -1 if none found
 */
export const getSegmentIndexByTime = (
  time: number,
  segments: TranscriptSegment[]
): number => {
  if (!segments || segments.length === 0) return -1;
  
  return segments.findIndex(segment => 
    time >= segment.start && time <= (segment.end + SYNC_CONFIG.segmentEndBuffer)
  );
};

/**
 * Format timestamp in seconds to a human-readable string (MM:SS)
 * 
 * @param timeInSeconds - Time to format in seconds
 * @returns Formatted time string (e.g., "01:23")
 */
export const formatTimestamp = (timeInSeconds: number): string => {
  if (isNaN(timeInSeconds)) return "00:00";
  
  const minutes = Math.floor(timeInSeconds / 60);
  const seconds = Math.floor(timeInSeconds % 60);
  
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
};

/**
 * Normalize segments by ensuring minimum durations and handling overlaps
 * 
 * @param segments - Raw segments that may have inconsistencies
 * @returns Normalized segments with consistent boundaries
 */
export const normalizeSegments = (segments: TranscriptSegment[]): TranscriptSegment[] => {
  if (!segments || segments.length === 0) return [];
  
  return segments.map((segment, index) => {
    // Ensure minimum segment duration
    const normalizedEnd = Math.max(
      segment.end, 
      segment.start + SYNC_CONFIG.minSegmentDuration
    );
    
    return {
      ...segment,
      end: normalizedEnd
    };
  });
};

/**
 * Create fallback segments when timestamps are not available
 * 
 * @param transcript - Full transcript text
 * @param audioDuration - Total audio duration in seconds
 * @returns Generated segments based on text
 */
export const createFallbackSegments = (
  transcript: string, 
  audioDuration: number
): TranscriptSegment[] => {
  if (!transcript || audioDuration <= 0) return [];
  
  // Simple sentence splitting for segments when no timestamp data is available
  const sentences = transcript.split(/(?<=[.!?])\s+/).filter(Boolean);
  const avgTimePerSentence = Math.max(1, audioDuration / sentences.length);
  
  let currentTime = 0;
  return sentences.map((sentence) => {
    const segmentStart = currentTime;
    currentTime += avgTimePerSentence;
    
    return {
      start: segmentStart,
      end: currentTime,
      text: sentence.trim()
    };
  });
};

/**
 * Safely attempt an operation with the audio element
 * 
 * @param audioRef - Reference to audio element
 * @param operation - Function to execute with the audio element
 * @returns Result of the operation or undefined if it fails
 */
export const safeAudioOperation = <T>(
  audioRef: React.RefObject<HTMLAudioElement>,
  operation: (audio: HTMLAudioElement) => T
): T | undefined => {
  if (!audioRef.current) return undefined;
  
  try {
    return operation(audioRef.current);
  } catch (error) {
    console.error("Audio operation failed:", error);
    return undefined;
  }
};

/**
 * Check if the audio is in a playable state
 */
export const isAudioPlayable = (
  audioRef: React.RefObject<HTMLAudioElement>
): boolean => {
  return safeAudioOperation(audioRef, (audio) => {
    // Check if the audio is in a state where it can be played
    const readyState = audio.readyState;
    // HAVE_ENOUGH_DATA = 4
    return readyState >= 3 && !audio.error;
  }) || false;
};
