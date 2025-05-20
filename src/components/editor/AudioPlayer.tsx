
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Volume, Volume1, Volume2, VolumeOff } from "lucide-react";
import { Slider } from "@/components/ui/slider";
import { 
  isAudioPlayable, 
  safeAudioOperation, 
  formatTimestamp, 
  SYNC_CONFIG 
} from "@/utils/audioSyncUtils";
import { toast } from "sonner";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (jumpFunction: (time: number) => void) => void;
  onPlaybackStateChange?: (isPlaying: boolean) => void;
  initialVolume?: number;
}

type PlaybackState = 'idle' | 'loading' | 'playing' | 'paused' | 'seeking' | 'error';

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onJumpToTime,
  onPlaybackStateChange,
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
  const stateCheckIntervalRef = useRef<number | null>(null);
  const lastTimeUpdateRef = useRef<number>(0);
  const playRequestPendingRef = useRef(false);
  const lastKnownTimeRef = useRef(0);
  const userInteractingRef = useRef(false);
  
  // Clean up function for all timeouts and intervals
  const clearAllTimeouts = useCallback(() => {
    if (playAttemptTimeoutRef.current) {
      window.clearTimeout(playAttemptTimeoutRef.current);
      playAttemptTimeoutRef.current = null;
    }
    
    if (stateCheckIntervalRef.current) {
      window.clearInterval(stateCheckIntervalRef.current);
      stateCheckIntervalRef.current = null;
    }
  }, []);
  
  // Function to check for and recover from common playback issues
  const checkAndRecoverPlayback = useCallback(() => {
    if (!audioRef.current) return;
    
    const now = Date.now();
    const timeSinceLastUpdate = now - lastTimeUpdateRef.current;
    const audio = audioRef.current;
    
    // Check if we think we're playing but haven't had timeupdate events
    if (isPlaying && !seekingRef.current && timeSinceLastUpdate > 1000) {
      // Check if audio is actually playing or if it's stalled
      if (!audio.paused && audio.currentTime > 0 && audio.readyState >= 3) {
        // Audio should be playing, but no time updates - might be stalled
        console.log('Potential stall detected - time updates stopped while playing');
        
        // Don't reset to 0 - preserve last known position
        if (Math.abs(audio.currentTime - lastKnownTimeRef.current) > 2) {
          // Only update if the difference is significant to avoid constant resets
          audio.currentTime = Math.max(currentTime, lastKnownTimeRef.current);
        }
        
        // Force a time update to at least show the correct position
        setCurrentTime(audio.currentTime);
        lastKnownTimeRef.current = audio.currentTime;
        lastTimeUpdateRef.current = now;
      } else if (audio.paused && playbackState === 'playing') {
        // We think we're playing but the audio is paused - try to recover
        console.log('State mismatch: UI shows playing but audio is paused');
        
        // If user isn't interacting, try to recover by toggling state
        if (!userInteractingRef.current && !seekingRef.current && !playRequestPendingRef.current) {
          setPlaybackState('paused');
          setIsPlaying(false);
        }
      }
    } else if (!isPlaying && !audio.paused && playbackState !== 'seeking') {
      // We think we're paused but the audio is playing
      console.log('State mismatch: UI shows paused but audio is playing');
      
      // If user isn't interacting, recover by updating the UI state
      if (!userInteractingRef.current && !seekingRef.current) {
        setPlaybackState('playing');
        setIsPlaying(true);
      }
    }
    
    // Handle the case where time got reset to 0 incorrectly
    if (audio.currentTime === 0 && lastKnownTimeRef.current > 0 && !userInteractingRef.current) {
      // Only restore if this wasn't due to reaching the end or user interaction
      if (!audio.ended && playbackState !== 'seeking' && !seekingRef.current && !userInteractingRef.current) {
        console.log('Restoring position from last known time:', lastKnownTimeRef.current);
        audio.currentTime = lastKnownTimeRef.current;
        setCurrentTime(lastKnownTimeRef.current);
      }
    }
  }, [isPlaying, playbackState, currentTime]);

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
        // Don't reset current time when playing - keep the current position
        lastKnownTimeRef.current = audioRef.current.currentTime;
        
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
          console.log("Audio not playable yet, showing loading state");
          setPlaybackState('loading');
          
          // Clear any existing timeout and set a new one
          if (playAttemptTimeoutRef.current) {
            window.clearTimeout(playAttemptTimeoutRef.current);
          }
          
          // Try again after a delay
          playAttemptTimeoutRef.current = window.setTimeout(() => {
            playRequestPendingRef.current = false;
            
            if (audioRef.current && audioRef.current.readyState >= 2) {
              console.log("Retrying play after delay");
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
  }, [isPlaying]);

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

  // Update time handler with lock to prevent feedback loops
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || timeUpdateLockRef.current) return;
    
    const audio = audioRef.current;
    const currentTimeValue = audio.currentTime;
    
    // Update last known good time
    lastTimeUpdateRef.current = Date.now();
    lastKnownTimeRef.current = currentTimeValue;
    
    // Update the UI display
    setCurrentTime(currentTimeValue);
    
    // Notify external components if needed
    if (onTimeUpdate && !seekingRef.current && !userInteractingRef.current) {
      onTimeUpdate(currentTimeValue);
    }
  }, [onTimeUpdate]);

  // Handle metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    
    const audioDuration = audioRef.current.duration;
    setDuration(isNaN(audioDuration) ? 0 : audioDuration);
    setPlaybackState('paused');
    
    // Apply initial volume
    audioRef.current.volume = volume;
    audioRef.current.muted = muted;
    
    console.log(`Audio metadata loaded. Duration: ${audioDuration}s`);
  }, [volume, muted]);

  // Handler for when audio can be played
  const handleCanPlay = useCallback(() => {
    console.log('Audio can play now');
    
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
  }, [isPlaying]);

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
      
      // Update the playback state based on whether we were playing before
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
    }, 200);
  }, [isPlaying, onTimeUpdate]);

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
    
    console.log(`Jumping to time: ${time}s`);
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
    
    // If we were playing, continue playing
    const wasPlaying = isPlaying;
    
    setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      userInteractingRef.current = false;
      
      // Update playback state based on previous state
      setPlaybackState(wasPlaying ? 'playing' : 'paused');
      
      if (wasPlaying && audioRef.current && audioRef.current.paused) {
        const playPromise = audioRef.current.play();
        
        if (playPromise !== undefined) {
          playPromise.catch(error => {
            console.error("Play after jump failed:", error);
            setIsPlaying(false);
            setPlaybackState('paused');
          });
        }
      }
    }, 300);
  }, [isPlaying]);

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
    onJumpToTime(jumpToTime);
    
    return () => {}; 
  }, [onJumpToTime, jumpToTime]);

  // Effect to set up continuous state checking for reliability
  useEffect(() => {
    // Start a periodic check for state consistency
    stateCheckIntervalRef.current = window.setInterval(() => {
      checkAndRecoverPlayback();
    }, 1000);
    
    return () => {
      if (stateCheckIntervalRef.current) {
        window.clearInterval(stateCheckIntervalRef.current);
        stateCheckIntervalRef.current = null;
      }
    };
  }, [checkAndRecoverPlayback]);

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
      // We want to preserve this, not reset to 0
      lastKnownTimeRef.current = audioEl.duration || 0;
    };
    
    const handleWaiting = () => {
      // Only show loading if we're currently playing
      if (isPlaying) {
        setPlaybackState('loading');
      }
    };
    
    const handleStalled = () => {
      console.log("Audio stalled");
      
      // Check if we think we're playing but audio is actually stalled
      if (isPlaying) {
        // Don't stop playback yet, but update state
        setPlaybackState('loading');
        
        // Try to recover after a timeout if still stalled
        setTimeout(() => {
          if (audioEl && audioEl.paused && isPlaying) {
            console.log("Attempting to recover from stall");
            
            // Try to resume from last known position
            audioEl.currentTime = lastKnownTimeRef.current;
            
            const playPromise = audioEl.play();
            if (playPromise !== undefined) {
              playPromise.catch(error => {
                console.error("Recovery from stall failed:", error);
                setIsPlaying(false);
                setPlaybackState('paused');
              });
            }
          }
        }, 2000);
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
    audioEl.addEventListener('stalled', handleStalled);
    audioEl.addEventListener('canplay', handleCanPlay);
    audioEl.addEventListener('error', handleError);
    
    // Cleanup
    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('playing', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('waiting', handleWaiting);
      audioEl.removeEventListener('stalled', handleStalled);
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
