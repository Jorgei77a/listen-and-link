
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeOff } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { 
  isAudioPlayable, 
  safeAudioOperation, 
  formatTimestamp
} from "@/utils/audioSyncUtils";
import { toast } from "sonner";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (jumpFunction: (time: number) => void) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  initialVolume?: number;
  onSegmentBoundaryReached?: (time: number) => void;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'seeking' | 'error';

// Reduce log frequency
const LOG_THROTTLE_MS = 2000;

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onJumpToTime,
  onPlaybackStateChange,
  onSegmentBoundaryReached,
  initialVolume = 0.8
}: AudioPlayerProps) {
  // State management
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(initialVolume);
  const [playbackState, setPlaybackState] = useState<PlaybackState>('idle');
  const [muted, setMuted] = useState(false);
  
  // Refs for tracking internal state
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeUpdateLockRef = useRef(false);
  const seekingRef = useRef(false);
  const playAttemptTimeoutRef = useRef<number | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);
  const playRequestPendingRef = useRef(false);
  const lastKnownTimeRef = useRef(0);
  const userInteractingRef = useRef(false);
  
  // Use these to reduce console log frequency
  const lastLogTimeRef = useRef<Record<string, number>>({});
  
  // Throttled logging function to reduce console spam
  const throttledLog = useCallback((key: string, message: string) => {
    const now = Date.now();
    if (!lastLogTimeRef.current[key] || now - lastLogTimeRef.current[key] > LOG_THROTTLE_MS) {
      // Only log this message if we haven't logged it recently
      lastLogTimeRef.current[key] = now;
      // console.log(message);
    }
  }, []);
  
  // Clean up function for all timeouts
  const clearAllTimeouts = useCallback(() => {
    if (playAttemptTimeoutRef.current) {
      window.clearTimeout(playAttemptTimeoutRef.current);
      playAttemptTimeoutRef.current = null;
    }
  }, []);
  
  // Handle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    userInteractingRef.current = true;
    
    try {
      if (isPlaying) {
        // Pausing is usually reliable
        audioRef.current.pause();
        setPlaybackState('paused');
        setIsPlaying(false);
      } else {
        // Set a flag that we're trying to play
        playRequestPendingRef.current = true;
        
        // Only attempt to play if the audio is in a playable state
        if (isAudioPlayable(audioRef)) {
          setPlaybackState('loading');
          
          const playPromise = audioRef.current.play();
          
          if (playPromise !== undefined) {
            playPromise
              .then(() => {
                playRequestPendingRef.current = false;
                // Playback started successfully
                setIsPlaying(true);
                setPlaybackState('playing');
                
                // Update the last known time to the current position
                lastTimeUpdateRef.current = Date.now();
                lastKnownTimeRef.current = audioRef.current!.currentTime;
              })
              .catch(error => {
                playRequestPendingRef.current = false;
                console.error("Play failed:", error);
                setPlaybackState('error');
                setIsPlaying(false);
                toast.error("Playback failed. Please try again.");
              });
          } else {
            // For browsers where promise is not returned
            setIsPlaying(true);
            setPlaybackState('playing');
            playRequestPendingRef.current = false;
          }
        } else {
          setPlaybackState('loading');
          
          // Clear any existing timeout and set a new one
          if (playAttemptTimeoutRef.current) {
            window.clearTimeout(playAttemptTimeoutRef.current);
          }
          
          // Try again after a delay
          playAttemptTimeoutRef.current = window.setTimeout(() => {
            playRequestPendingRef.current = false;
            
            if (audioRef.current && audioRef.current.readyState >= 2) {
              throttledLog('retryPlay', "Retrying play after delay");
              togglePlayPause();
            } else {
              console.error("Audio still not ready after delay");
              setPlaybackState('error');
              toast.error("Audio failed to load. Please try again.");
            }
            
            playAttemptTimeoutRef.current = null;
          }, 1000);
        }
      }
    } finally {
      // Reset user interaction flag after a short delay
      setTimeout(() => {
        userInteractingRef.current = false;
      }, 300);
    }
  }, [isPlaying, throttledLog]);

  // Method to explicitly pause the audio
  const pauseAudio = useCallback(() => {
    if (!audioRef.current || !isPlaying) return;
    
    throttledLog('pauseAudio', "Explicitly pausing audio");
    audioRef.current.pause();
    setIsPlaying(false);
    setPlaybackState('paused');
    
    if (onPlaybackStateChange) {
      onPlaybackStateChange(false);
    }
  }, [isPlaying, onPlaybackStateChange, throttledLog]);

  // Skip forward/backward helpers
  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    
    userInteractingRef.current = true;
    
    const newTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 5);
    jumpToTime(newTime);
    
    setTimeout(() => {
      userInteractingRef.current = false;
    }, 300);
  }, []);

  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    
    userInteractingRef.current = true;
    
    const newTime = Math.max(0, audioRef.current.currentTime - 5);
    jumpToTime(newTime);
    
    setTimeout(() => {
      userInteractingRef.current = false;
    }, 300);
  }, []);

  // Update time handler - reduce frequency of updates
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || timeUpdateLockRef.current) return;
    
    const audio = audioRef.current;
    const currentTimeValue = audio.currentTime;
    
    // Update last known good time
    lastTimeUpdateRef.current = Date.now();
    lastKnownTimeRef.current = currentTimeValue;
    
    // Update the UI display only when time has changed significantly
    if (Math.abs(currentTime - currentTimeValue) > 0.2) {
      setCurrentTime(currentTimeValue);
    }
    
    // Notify external components but limit the frequency 
    // Don't send updates during user interactions or seeking
    if (onTimeUpdate && !seekingRef.current && !userInteractingRef.current) {
      onTimeUpdate(currentTimeValue);
    }
  }, [currentTime, onTimeUpdate]);

  // Handle metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    
    const audioDuration = audioRef.current.duration;
    setDuration(isNaN(audioDuration) ? 0 : audioDuration);
    setPlaybackState('paused');
    
    // Apply initial volume
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
    
    throttledLog('metadata', `Audio metadata loaded. Duration: ${audioDuration}s`);
  }, [volume, muted, throttledLog]);

  // Handler for when audio can be played
  const handleCanPlay = useCallback(() => {
    throttledLog('canPlay', 'Audio can play now');
    
    if (playRequestPendingRef.current) {
      // If we were waiting to play, try again now
      if (audioRef.current && isPlaying) {
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Play attempt on canplay failed:", error);
            playRequestPendingRef.current = false;
            setPlaybackState('error');
            setIsPlaying(false);
          });
        }
      }
    }
  }, [isPlaying, throttledLog]);

  // Handle user scrubbing the timeline
  const handleSeek = useCallback((value: number[]) => {
    const time = value[0];
    
    userInteractingRef.current = true;
    
    // Lock time updates to prevent feedback
    timeUpdateLockRef.current = true;
    seekingRef.current = true;
    setPlaybackState('seeking');
    
    // Update UI immediately to give feedback
    setCurrentTime(time);
    
    // Store this as our last known position
    lastKnownTimeRef.current = time;
    
    // Jump to the new time in the audio element
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    
    // Set a timeout to clear the seeking flags
    window.setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      userInteractingRef.current = false;
      
      // Update playback state based on whether we were playing before
      setPlaybackState(isPlaying ? 'playing' : 'paused');
      
      // If we were playing, make sure we're still playing
      if (isPlaying && audioRef.current && audioRef.current.paused) {
        // Try to resume playback
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Resume after seek failed:", error);
            setIsPlaying(false);
            setPlaybackState('paused');
          });
        }
      }
      
      // Also trigger the onTimeUpdate callback
      if (onTimeUpdate) {
        onTimeUpdate(time);
      }
      
      // Check if we need to notify about segment boundary
      if (onSegmentBoundaryReached) {
        onSegmentBoundaryReached(time);
      }
    }, 200);
  }, [isPlaying, onTimeUpdate, onSegmentBoundaryReached]);

  // Handle seeking events from the audio element
  const handleSeeking = useCallback(() => {
    if (!seekingRef.current && !userInteractingRef.current) {
      // This is a seeking event we didn't initiate (e.g. browser buffering)
      seekingRef.current = true;
      timeUpdateLockRef.current = true;
    }
    setPlaybackState('seeking');
  }, []);

  const handleSeeked = useCallback(() => {
    // Small delay to ensure the audio is ready
    setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      
      if (audioRef.current) {
        // Make sure our UI shows the correct time
        setCurrentTime(audioRef.current.currentTime);
        lastKnownTimeRef.current = audioRef.current.currentTime;
      }
      
      setPlaybackState(isPlaying ? 'playing' : 'paused');
      
      // If we were playing, make sure we're still playing
      if (isPlaying && audioRef.current && audioRef.current.paused) {
        audioRef.current.play().catch(error => {
          console.error("Resume after seeked failed:", error);
          setIsPlaying(false);
          setPlaybackState('paused');
        });
      }
    }, 100);
  }, [isPlaying]);

  // Jump to time (exposed for external control)
  const jumpToTime = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    throttledLog('jumpToTime', `Jumping to time: ${time}s`);
    userInteractingRef.current = true;
    
    // Lock time updates during the jump
    timeUpdateLockRef.current = true;
    seekingRef.current = true;
    setPlaybackState('seeking');
    
    // Update UI immediately for feedback
    setCurrentTime(time);
    lastKnownTimeRef.current = time;
    
    // Set the new time in the audio element
    const boundedTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    audioRef.current.currentTime = boundedTime;
    
    // Set a timeout to clear the seeking flags
    setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      userInteractingRef.current = false;
      
      // Update playback state based on previous state
      setPlaybackState(isPlaying ? 'playing' : 'paused');
      
      if (isPlaying && audioRef.current && audioRef.current.paused) {
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Play after jump failed:", error);
            setIsPlaying(false);
            setPlaybackState('paused');
          });
        }
      }
      
      // Notify about time update
      if (onTimeUpdate) {
        onTimeUpdate(boundedTime);
      }
      
      // Check if we need to notify about segment boundary
      if (onSegmentBoundaryReached) {
        onSegmentBoundaryReached(boundedTime);
      }
    }, 300);
  }, [isPlaying, onTimeUpdate, onSegmentBoundaryReached, throttledLog]);

  // Handle volume change
  const handleVolumeChange = useCallback((value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      
      // Update muted state based on volume
      if (newVolume === 0) {
        setMuted(true);
        audioRef.current.muted = true;
      } else if (muted) {
        setMuted(false);
        audioRef.current.muted = false;
      }
    }
  }, [muted]);

  // Toggle mute
  const toggleMute = useCallback(() => {
    if (!audioRef.current) return;
    
    const newMuted = !muted;
    setMuted(newMuted);
    audioRef.current.muted = newMuted;
  }, [muted]);

  // Effect to handle play/pause state changes
  useEffect(() => {
    if (onPlaybackStateChange) {
      onPlaybackStateChange(isPlaying);
    }
  }, [isPlaying, onPlaybackStateChange]);

  // Effect to respond to external time jump requests
  useEffect(() => {
    // Only set up the handler if onJumpToTime callback was provided
    if (!onJumpToTime) return;
    
    // Call the provided callback with our jump handler
    onJumpToTime((time: number) => {
      jumpToTime(time);
    });
    
    // We only want to set this up once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Effect to handle audio element events
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    
    // Handle play/pause events
    const handlePlay = () => {
      // Only update if needed to avoid unnecessary rerenders
      if (!isPlaying) {
        setIsPlaying(true);
        setPlaybackState('playing');
      }
      
      // Reset the play request pending flag
      playRequestPendingRef.current = false;
      
      // Update the last time update timestamp
      lastTimeUpdateRef.current = Date.now();
    };
    
    const handlePause = () => {
      // Only update if needed
      if (isPlaying && !seekingRef.current) {
        setIsPlaying(false);
        setPlaybackState('paused');
      }
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackState('paused');
      
      // When audio ends, the currentTime is at the end
      lastKnownTimeRef.current = audioEl.duration || 0;
    };
    
    const handleWaiting = () => {
      // Only show loading if we're currently playing
      if (isPlaying) {
        setPlaybackState('loading');
      }
    };
    
    const handleError = () => {
      console.error("Audio player error:", audioEl.error);
      setPlaybackState('error');
      setIsPlaying(false);
      
      // Show a user-friendly error message
      toast.error("Audio playback error: Please try again or reload the page.");
    };
    
    // Add event listeners
    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('playing', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('ended', handleEnded);
    audioEl.addEventListener('waiting', handleWaiting);
    audioEl.addEventListener('canplay', handleCanPlay);
    audioEl.addEventListener('error', handleError);
    
    // Cleanup
    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('playing', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('waiting', handleWaiting);
      audioEl.removeEventListener('canplay', handleCanPlay);
      audioEl.removeEventListener('error', handleError);
      clearAllTimeouts();
    };
  }, [isPlaying, clearAllTimeouts, handleCanPlay]);

  // Get the appropriate volume icon based on current volume
  const VolumeIcon = muted || volume === 0 
    ? VolumeOff 
    : volume < 0.5 
      ? Volume1 
      : Volume2;

  // Expose methods to parent component
  useEffect(() => {
    // Nothing to expose if there's no onSegmentBoundaryReached handler
    if (!onSegmentBoundaryReached) return;
    
    // We expose the pauseAudio method to the parent via a ref
    if (window) {
      // @ts-ignore - we're adding a custom property for easier access
      window.__audioPlayerControls = {
        pauseAudio,
        jumpToTime
      };
    }
    
    return () => {
      // Clean up
      if (window) {
        // @ts-ignore
        delete window.__audioPlayerControls;
      }
    };
  }, [pauseAudio, jumpToTime, onSegmentBoundaryReached]);

  // Render the audio player UI
  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        preload="metadata"
      />
      
      {/* Playback controls */}
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
          disabled={playbackState === 'loading' || playbackState === 'error'}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className={cn(
            "h-10 w-10 rounded-full transition-all",
            playbackState === 'loading' && "opacity-50"
          )}
          disabled={playbackState === 'error'}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <Pause className="h-5 w-5" />
          ) : (
            <Play className="h-5 w-5 ml-0.5" />
          )}
        </Button>
        
        <Button 
          onClick={skipForward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip forward 5 seconds"
          disabled={playbackState === 'loading' || playbackState === 'error'}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
      </div>

      {/* Timeline and timestamps */}
      <div className="flex items-center space-x-2">
        <span className="text-sm tabular-nums w-12 text-right">
          {formatTimestamp(currentTime)}
        </span>
        
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 100}
          step={0.1}
          onValueChange={handleSeek}
          disabled={playbackState === 'error'}
          aria-label="Audio position"
          className="flex-1"
        />
        
        <span className="text-sm tabular-nums w-12">
          {formatTimestamp(duration)}
        </span>
      </div>

      {/* Volume control */}
      <div className="flex items-center space-x-2">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleMute}
          className="h-8 w-8"
          title={muted ? "Unmute" : "Mute"}
        >
          <VolumeIcon className="h-4 w-4" />
        </Button>
        
        <Slider
          value={[muted ? 0 : volume]}
          min={0}
          max={1}
          step={0.01}
          onValueChange={handleVolumeChange}
          aria-label="Volume"
          className="w-24"
        />
        
        {/* Playback state indicator */}
        {playbackState === 'seeking' && (
          <span className="text-xs text-muted-foreground animate-pulse ml-auto">
            Seeking...
          </span>
        )}
        {playbackState === 'loading' && (
          <span className="text-xs text-muted-foreground animate-pulse ml-auto">
            Loading...
          </span>
        )}
        {playbackState === 'error' && (
          <span className="text-xs text-red-500 ml-auto">
            Error
          </span>
        )}
      </div>
    </div>
  );
}
