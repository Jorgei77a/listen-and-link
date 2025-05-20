
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
 * Buffer time configuration in seconds
 * - segmentEndBuffer: Extra time to add after a segment's end time (prevents cutting off)
 * - segmentLookaheadBuffer: Time to start highlighting the next segment before its start time
 * - recoveryCheckInterval: How often to check for frozen state (ms)
 * - debugMode: Whether to show buffer timing information visually
 */
export const DEFAULT_SEGMENT_BUFFERS = {
  segmentEndBuffer: 5.0,      // 5.0 seconds additional playback after segment end (increased from 1.5)
  segmentLookaheadBuffer: 0.5, // Start highlighting next segment 0.5s before its start (increased from 0.3)
  recoveryCheckInterval: 5000, // Check for frozen state every 5 seconds
  debugMode: false            // Set to true to enable visual buffer indicators
};

/**
 * Check if a time is within a segment's bounds, accounting for buffer time
 * IMPORTANT: This function is for UI highlighting ONLY and should not affect playback
 */
export const isTimeInSegment = (
  time: number, 
  segmentStart: number, 
  segmentEnd: number, 
  bufferTime: number = DEFAULT_SEGMENT_BUFFERS.segmentEndBuffer
): boolean => {
  return segmentStart <= time && time <= (segmentEnd + bufferTime);
};

/**
 * Find the active segment given the current time and a list of segments
 * IMPORTANT: This function is for UI highlighting ONLY and should not affect playback
 */
export const findActiveSegment = (
  currentTime: number,
  segments: Array<{ start: number; end: number }>,
  options = DEFAULT_SEGMENT_BUFFERS
): number | null => {
  // First check if any segment is directly active (including buffer time)
  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i];
    if (isTimeInSegment(currentTime, segment.start, segment.end, options.segmentEndBuffer)) {
      return i;
    }
  }
  
  // If no direct active segment, check for lookahead to next segment
  for (let i = 0; i < segments.length - 1; i++) {
    const currentSegment = segments[i];
    const nextSegment = segments[i + 1];
    
    // If we're between current segment (plus buffer) and next segment's start
    // but within the lookahead window of the next segment
    if (
      currentTime > (currentSegment.end + options.segmentEndBuffer) && 
      currentTime < nextSegment.start &&
      currentTime >= (nextSegment.start - options.segmentLookaheadBuffer)
    ) {
      return i + 1; // Return the next segment
    }
  }
  
  return null; // No active segment found
};

/**
 * Check if audio player is in frozen state by comparing timestamps
 * @param lastUpdateTime Time of last observed time update
 * @param isPlaying Whether player reports it's playing
 * @returns boolean indicating if player might be frozen
 */
export const detectFrozenState = (
  lastUpdateTime: number,
  isPlaying: boolean
): boolean => {
  // If not playing, player isn't frozen
  if (!isPlaying) return false;
  
  // If we haven't received a time update in 3 seconds while playing, 
  // consider the player frozen
  const timeSinceLastUpdate = Date.now() - lastUpdateTime;
  return timeSinceLastUpdate > 3000;
};

/**
 * Reset audio player to recover from frozen state
 * @param audioElement HTML Audio element reference
 * @returns Promise that resolves when reset is complete
 */
export const resetAudioPlayer = async (audioElement: HTMLAudioElement): Promise<void> => {
  // Store current position and playing state
  const currentTime = audioElement.currentTime;
  const wasPlaying = !audioElement.paused;
  
  // Pause and reset element
  try {
    await audioElement.pause();
    
    // Small delay to allow browser to process
    await new Promise(resolve => setTimeout(resolve, 100));
    
    // Set time to slightly before where we were
    const safeTime = Math.max(0, currentTime - 0.5);
    audioElement.currentTime = safeTime;
    
    // If it was playing, resume
    if (wasPlaying) {
      await audioElement.play().catch(error => {
        console.error("Error resuming after reset:", error);
      });
    }
    
    console.log("Audio player successfully reset");
  } catch (error) {
    console.error("Error during audio player reset:", error);
    throw error;
  }
};
