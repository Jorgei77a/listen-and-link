
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
  return segments.find(
    (segment) => currentTime >= segment.start && currentTime <= segment.end
  ) || null;
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
