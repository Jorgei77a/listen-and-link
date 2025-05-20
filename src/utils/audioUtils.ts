
/**
 * Utility functions for audio file analysis and processing
 */

/**
 * Get the precise duration of an audio file using Web Audio API
 * This returns a promise that resolves with the duration in seconds
 */
export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve, reject) => {
    // Create audio context
    const AudioContext = window.AudioContext || window.webkitAudioContext;
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
