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
    
    const audioContext = new AudioContext();
    
    // Create file reader to read the file as ArrayBuffer
    const reader = new FileReader();
    
    reader.onload = (event) => {
      if (!event.target?.result) {
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
          if (audioContext.state !== 'closed') {
            audioContext.close();
          }
        },
        (error) => {
          console.error('Error decoding audio data:', error);
          // Fallback to estimation on decode error
          const estimatedDuration = estimateAudioDuration(file);
          console.log('Using estimated duration due to decode error:', estimatedDuration);
          resolve(estimatedDuration);
          
          if (audioContext.state !== 'closed') {
            audioContext.close();
          }
        }
      );
    };
    
    reader.onerror = () => {
      console.error('Error reading file');
      // Fallback to estimation on read error
      const estimatedDuration = estimateAudioDuration(file);
      resolve(estimatedDuration);
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
 * Format audio duration into a human-readable string
 * @param seconds - Duration in seconds
 * @returns Formatted string like "8 mins 20 secs" or "45 secs"
 */
export const formatAudioDuration = (seconds: number | null): string => {
  if (seconds === null || seconds === undefined) return "";
  
  // Force conversion to number, then round to nearest integer to eliminate decimals
  const totalSeconds = Math.round(Number(seconds));
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  
  if (minutes === 0) {
    return `${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
  } else if (remainingSeconds === 0) {
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'}`;
  } else {
    return `${minutes} ${minutes === 1 ? 'min' : 'mins'} ${remainingSeconds} ${remainingSeconds === 1 ? 'sec' : 'secs'}`;
  }
};

/**
 * Format seconds into a human-readable time string (MM:SS)
 */
export const formatTime = (seconds: number): string => {
  if (isNaN(seconds) || !isFinite(seconds)) return '0:00';
  
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Extract timestamps from transcript text
 * Returns an array of objects with start times and text content
 */
export interface TranscriptSegment {
  startTime: number;
  endTime?: number;
  text: string;
}

export const extractTimestamps = (transcriptText: string): TranscriptSegment[] => {
  if (!transcriptText) return [];
  
  const segments: TranscriptSegment[] = [];
  // Match formats like [00:00] or [00:00:00]
  const timestampRegex = /\[(\d{1,2}:\d{2}(?::\d{2})?)\]/g;
  
  let lastIndex = 0;
  let match;
  
  while ((match = timestampRegex.exec(transcriptText)) !== null) {
    const timeStr = match[1];
    const startIndex = match.index;
    const endIndex = startIndex + match[0].length;
    
    // Convert timestamp to seconds
    const startTime = convertTimestampToSeconds(timeStr);
    
    // If we have a previous segment, add its text
    if (lastIndex < startIndex) {
      const lastSegment = segments[segments.length - 1];
      if (lastSegment) {
        lastSegment.text = transcriptText.substring(lastIndex, startIndex).trim();
      }
    }
    
    // Add this new timestamp as a segment
    segments.push({
      startTime,
      text: '' // Will be filled in the next iteration or at the end
    });
    
    lastIndex = endIndex;
  }
  
  // Fill in text for the last segment
  if (segments.length > 0 && lastIndex < transcriptText.length) {
    segments[segments.length - 1].text = transcriptText.substring(lastIndex).trim();
  }
  
  // Calculate end times based on next segment's start time
  for (let i = 0; i < segments.length - 1; i++) {
    segments[i].endTime = segments[i + 1].startTime;
  }
  
  return segments;
};

/**
 * Convert a timestamp string to seconds
 * Handles formats like "1:30" (1m30s) or "1:30:45" (1h30m45s)
 */
export const convertTimestampToSeconds = (timestamp: string): number => {
  const parts = timestamp.split(':').map(Number);
  
  if (parts.length === 3) {
    // Format: hours:minutes:seconds
    return parts[0] * 3600 + parts[1] * 60 + parts[2];
  } else if (parts.length === 2) {
    // Format: minutes:seconds
    return parts[0] * 60 + parts[1];
  } else {
    // Invalid format
    console.warn('Invalid timestamp format:', timestamp);
    return 0;
  }
};

/**
 * Find the segment containing a specific time
 */
export const findSegmentAtTime = (segments: TranscriptSegment[], time: number): TranscriptSegment | null => {
  return segments.find(seg => 
    time >= seg.startTime && (!seg.endTime || time < seg.endTime)
  ) || null;
};

/**
 * Find the segment containing a specific position in the text
 */
export const findSegmentAtPosition = (segments: TranscriptSegment[], position: number): TranscriptSegment | null => {
  if (!segments || segments.length === 0) return null;
  
  let currentPosition = 0;
  
  for (const segment of segments) {
    const segmentLength = segment.text.length;
    const segmentEnd = currentPosition + segmentLength;
    
    if (position >= currentPosition && position < segmentEnd) {
      return segment;
    }
    
    currentPosition = segmentEnd;
  }
  
  return null;
};
