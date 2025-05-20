/**
 * Utility functions for audio file analysis and processing
 */

// Add a declaration for the WebKit AudioContext
interface Window {
  webkitAudioContext: typeof AudioContext;
}

/**
 * Get the precise duration of an audio file using Web Audio API
 * This returns a promise that resolves with the duration in seconds
 */
export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    // Create audio context
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) {
      // Fallback to estimation if Web Audio API is not available
      const estimatedDuration = estimateAudioDuration(file);
      console.log('Web Audio API not available, using estimation:', estimatedDuration);
      resolve(estimatedDuration);
      return;
    }
    
    // Create a new context for each file to avoid issues with suspended contexts
    let audioContext: AudioContext | null = new AudioContext();
    
    // Create file reader to read the file as ArrayBuffer
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result || !audioContext) {
        reject(new Error('Failed to read file'));
        return;
      }
      
      // Decode the audio data
      audioContext.decodeAudioData(
        event.target.result as ArrayBuffer,
        (audioBuffer) => {
          // Get the duration in seconds
          const duration = audioBuffer.duration;
          console.log('Actual audio duration detected:', duration);
          resolve(duration);
          
          // Close the audio context to free resources
          if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
          }
        },
        (error) => {
          console.error('Error decoding audio data:', error);
          // Fallback to estimation on decode error
          const estimatedDuration = estimateAudioDuration(file);
          console.log('Using estimated duration due to decode error:', estimatedDuration);
          resolve(estimatedDuration);
          
          if (audioContext && audioContext.state !== 'closed') {
            audioContext.close();
            audioContext = null;
          }
        }
      );
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      // Fallback to estimation on read error
      const estimatedDuration = estimateAudioDuration(file);
      resolve(estimatedDuration);
      
      // Clean up the context
      if (audioContext && audioContext.state !== 'closed') {
        audioContext.close();
        audioContext = null;
      }
    };
    
    // Read the file as an ArrayBuffer
    reader.readAsArrayBuffer(file);
  });
};

/**
 * Estimate audio duration based on file size and format
 * This is a fallback method when Web Audio API is not available
 */
export const estimateAudioDuration = (file: File): number => {
  // Format-specific bitrate estimates in bits per second
  const bitrates: {[key: string]: number} = {
    'mp3': 128000,    // 128 kbps
    'mp4': 192000,    // 192 kbps
    'm4a': 192000,    // 192 kbps
    'wav': 1411000,   // CD quality, 1411 kbps
    'webm': 128000,   // Varies widely, using 128 kbps as estimate
    'mpeg': 128000,   // 128 kbps
    'mpga': 128000,   // 128 kbps
  };
  
  const fileExt = file.name.split('.').pop()?.toLowerCase() || 'mp3';
  const bitrate = bitrates[fileExt] || 128000;
  
  // Calculate duration in seconds (file size in bits / bitrate)
  const durationSeconds = Math.round((file.size * 8) / bitrate);
  
  return durationSeconds;
};

/**
 * Segment playback timing configuration
 * These values control how segment highlighting works with audio playback
 */
export const SEGMENT_TIMING = {
  // Buffer time (in seconds) to add at the end of each segment 
  // to prevent playback from stopping abruptly
  END_BUFFER: 1.5,
  
  // Time (in seconds) to start highlighting the next segment before its actual start
  LOOKAHEAD: 0.5,
  
  // Minimum segment duration (in seconds) to ensure very short segments are still playable
  MIN_SEGMENT_DURATION: 1.0,
  
  // When more than one segment could be active due to buffers, prioritize:
  // "current" = prefer the segment that contains the exact current time
  // "next" = prefer the upcoming segment if we're in a lookahead period
  OVERLAP_PRIORITY: "current" as "current" | "next",
  
  // Debug mode to log segment timing information
  DEBUG: false,
};

/**
 * Determines if a segment should be considered active based on the current playback time
 * Includes buffer times and lookahead for smoother transitions
 */
export const isSegmentActive = (
  currentTime: number, 
  segmentStart: number, 
  segmentEnd: number
): boolean => {
  // Basic case: current time falls within the segment's actual time range
  const isWithinActualSegment = segmentStart <= currentTime && currentTime <= segmentEnd;
  
  // Extended case: current time is within the buffer zone after the segment
  const isWithinEndBuffer = 
    currentTime > segmentEnd && 
    currentTime <= segmentEnd + SEGMENT_TIMING.END_BUFFER;
    
  // Lookahead case: we're approaching this segment and should start highlighting it
  const isWithinLookahead = 
    currentTime >= segmentStart - SEGMENT_TIMING.LOOKAHEAD && 
    currentTime < segmentStart;
  
  return isWithinActualSegment || isWithinEndBuffer || isWithinLookahead;
};

/**
 * Finds the most appropriate active segment based on current time and all segments
 * Handles overlapping active segments based on priority settings
 */
export const findActiveSegment = (
  currentTime: number, 
  segments: Array<{ start: number, end: number, text: string }>
): number | null => {
  if (!segments.length) return null;
  
  // Find all potentially active segments
  const activeSegments = segments
    .map((segment, index) => ({
      index,
      start: segment.start,
      end: segment.end,
      isActive: isSegmentActive(currentTime, segment.start, segment.end),
      isExactlyWithin: segment.start <= currentTime && currentTime <= segment.end,
      isLookahead: currentTime >= segment.start - SEGMENT_TIMING.LOOKAHEAD && currentTime < segment.start,
      isEndBuffer: currentTime > segment.end && currentTime <= segment.end + SEGMENT_TIMING.END_BUFFER
    }))
    .filter(segment => segment.isActive);
  
  if (SEGMENT_TIMING.DEBUG) {
    console.log('Current time:', currentTime, 'Active segments:', activeSegments);
  }
  
  if (activeSegments.length === 0) return null;
  if (activeSegments.length === 1) return activeSegments[0].index;
  
  // Handle the case where we have multiple active segments due to buffers/lookahead
  if (SEGMENT_TIMING.OVERLAP_PRIORITY === "current") {
    // Prefer segments where the current time is exactly within the segment
    const exactSegment = activeSegments.find(s => s.isExactlyWithin);
    if (exactSegment) return exactSegment.index;
    
    // Otherwise, prefer segments that are in the buffer zone rather than lookahead
    const bufferSegment = activeSegments.find(s => s.isEndBuffer);
    if (bufferSegment) return bufferSegment.index;
  } else {
    // "next" priority - prefer upcoming segments if we're in a lookahead period
    const lookaheadSegment = activeSegments.find(s => s.isLookahead);
    if (lookaheadSegment) return lookaheadSegment.index;
  }
  
  // If we still can't decide, return the segment that's closest to the current time
  return activeSegments.sort((a, b) => {
    const distanceA = Math.min(
      Math.abs(currentTime - a.start),
      Math.abs(currentTime - a.end)
    );
    const distanceB = Math.min(
      Math.abs(currentTime - b.start),
      Math.abs(currentTime - b.end)
    );
    return distanceA - distanceB;
  })[0].index;
};
