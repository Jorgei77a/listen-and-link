/**
 * Utility functions for synchronizing audio playback with transcript text
 */

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

/**
 * Finds the active segment based on the current playback time
 */
export const findActiveSegment = (
  currentTime: number,
  segments: TranscriptSegment[]
): TranscriptSegment | null => {
  if (!segments || segments.length === 0) return null;

  // Find the segment that contains the current time
  const activeSegment = segments.find(
    (segment) => currentTime >= segment.start && currentTime <= segment.end
  );
  
  // If no segment contains the exact time, find the closest one
  if (!activeSegment) {
    // If current time is before the first segment, return the first
    if (currentTime < segments[0].start) {
      return segments[0];
    }
    
    // If current time is after the last segment, return the last
    const lastSegment = segments[segments.length - 1];
    if (currentTime > lastSegment.end) {
      return lastSegment;
    }
    
    // Otherwise find the segment we're closest to starting
    return segments.reduce((closest, segment) => {
      const currentDiff = Math.abs(currentTime - segment.start);
      const closestDiff = Math.abs(currentTime - closest.start);
      return currentDiff < closestDiff ? segment : closest;
    }, segments[0]);
  }
  
  return activeSegment;
};

/**
 * Smoothly scrolls an element into view if needed
 */
export const scrollElementIntoView = (element: HTMLElement | null): void => {
  if (!element) return;

  const parentElement = element.parentElement;
  if (!parentElement) return;

  const elementRect = element.getBoundingClientRect();
  const containerRect = parentElement.getBoundingClientRect();

  // Only scroll if the element is not fully visible
  const isFullyVisible = 
    elementRect.top >= containerRect.top && 
    elementRect.bottom <= containerRect.bottom;

  if (!isFullyVisible) {
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  }
};

/**
 * Determines if two segments are the same by comparing start and end times
 */
export const isSameSegment = (
  segment1: TranscriptSegment | null, 
  segment2: TranscriptSegment | null
): boolean => {
  if (!segment1 && !segment2) return true;
  if (!segment1 || !segment2) return false;
  
  return segment1.start === segment2.start && segment1.end === segment2.end;
};

/**
 * Finds the next segment after the current time
 * Useful for preparing for transitions
 */
export const findNextSegment = (
  currentTime: number,
  segments: TranscriptSegment[]
): TranscriptSegment | null => {
  if (!segments || segments.length === 0) return null;
  
  // Sort segments by start time to ensure we find the correct next segment
  const sortedSegments = [...segments].sort((a, b) => a.start - b.start);
  
  // Find the first segment that starts after the current time
  return sortedSegments.find(segment => segment.start > currentTime) || null;
};

/**
 * Calculate an appropriate scroll position based on playback progress within a segment
 * This provides smoother scrolling that tracks with the audio
 */
export const calculateScrollProgress = (
  currentTime: number,
  segment: TranscriptSegment
): number => {
  if (!segment) return 0;
  
  // Calculate how far we are through the current segment (0 to 1)
  const segmentDuration = segment.end - segment.start;
  const timeIntoSegment = currentTime - segment.start;
  
  // Ensure we stay between 0 and 1
  return Math.max(0, Math.min(1, segmentDuration > 0 ? timeIntoSegment / segmentDuration : 0));
};
