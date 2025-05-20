
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Loader2, RefreshCw } from "lucide-react";
import { detectFrozenState, resetAudioPlayer } from "@/utils/audioUtils";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (callback: (time: number) => void) => void | (() => void);
}

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onJumpToTime
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSeeking, setIsSeeking] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isFrozen, setIsFrozen] = useState(false);
  
  // Refs to prevent infinite loops
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeUpdateIntervalRef = useRef<number | null>(null);
  const lastTimeUpdateRef = useRef(0);
  const prevTimeRef = useRef(0);
  
  // Stable references for tracking state
  const isPlayingRef = useRef(false);
  const srcRef = useRef(src);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const lastReportedTimeRef = useRef(-1);
  const updateLockRef = useRef(false);
  const audioLoadedRef = useRef(false);
  const continuousPlayRef = useRef<boolean>(true);
  const timeUpdateCallbackEnabledRef = useRef<boolean>(true);
  const frozenCheckIntervalRef = useRef<number | null>(null);
  const userInteractionInProgressRef = useRef<boolean>(false);
  const resetInProgressRef = useRef<boolean>(false);
  const timeoutIdsRef = useRef<number[]>([]);
  
  // Clear a timeout and remove it from tracking
  const clearTrackedTimeout = useCallback((id: number) => {
    window.clearTimeout(id);
    timeoutIdsRef.current = timeoutIdsRef.current.filter(t => t !== id);
  }, []);
  
  // Create a tracked timeout
  const createTrackedTimeout = useCallback((callback: () => void, delay: number): number => {
    const id = window.setTimeout(() => {
      callback();
      // Auto-remove from tracking after execution
      timeoutIdsRef.current = timeoutIdsRef.current.filter(t => t !== id);
    }, delay);
    
    // Add to tracked timeouts
    timeoutIdsRef.current.push(id);
    return id;
  }, []);
  
  // Clear all tracked timeouts
  const clearAllTrackedTimeouts = useCallback(() => {
    timeoutIdsRef.current.forEach(id => window.clearTimeout(id));
    timeoutIdsRef.current = [];
  }, []);

  // Stabilize references when props change
  useEffect(() => {
    onTimeUpdateRef.current = onTimeUpdate;
    isPlayingRef.current = isPlaying;
  }, [onTimeUpdate, isPlaying]);

  // Only update source ref if the actual source string changes
  useEffect(() => {
    if (src !== srcRef.current) {
      srcRef.current = src;
      audioLoadedRef.current = false;
    }
  }, [src]);

  // Set up frozen state detection
  useEffect(() => {
    if (!audioRef.current) return;
    
    const checkFrozenState = () => {
      if (!audioRef.current) return;
      
      const potentiallyFrozen = detectFrozenState(lastTimeUpdateRef.current, !audioRef.current.paused);
      
      if (potentiallyFrozen && !resetInProgressRef.current) {
        console.warn("Detected frozen audio player state, attempting recovery");
        setIsFrozen(true);
        
        // Don't attempt recovery if already in progress or user is interacting
        if (!resetInProgressRef.current && !userInteractionInProgressRef.current) {
          resetFrozenPlayer();
        }
      } else if (!potentiallyFrozen && isFrozen) {
        setIsFrozen(false);
      }
    };
    
    // Set up interval to check for frozen state
    frozenCheckIntervalRef.current = window.setInterval(checkFrozenState, 5000);
    
    return () => {
      if (frozenCheckIntervalRef.current) {
        window.clearInterval(frozenCheckIntervalRef.current);
      }
    };
  }, [isFrozen]);
  
  // Reset a frozen player
  const resetFrozenPlayer = useCallback(async () => {
    if (!audioRef.current || resetInProgressRef.current) return;
    
    resetInProgressRef.current = true;
    
    try {
      // Temporarily disable all time update handling
      timeUpdateCallbackEnabledRef.current = false;
      
      // Reset the audio player
      await resetAudioPlayer(audioRef.current);
      
      // Update state to match reality
      const newTime = audioRef.current.currentTime;
      setCurrentTime(newTime);
      prevTimeRef.current = newTime;
      
      // Clear frozen state
      setIsFrozen(false);
      
      // Re-enable time updates
      lastTimeUpdateRef.current = Date.now();
      timeUpdateCallbackEnabledRef.current = true;
      
      // Also update external listeners
      if (onTimeUpdateRef.current) {
        onTimeUpdateRef.current(newTime);
      }
    } catch (error) {
      console.error("Failed to reset frozen player:", error);
    } finally {
      resetInProgressRef.current = false;
    }
  }, []);

  // Manual reset button handler
  const handleManualReset = useCallback(() => {
    if (audioRef.current) {
      resetFrozenPlayer();
    }
  }, [resetFrozenPlayer]);

  // Toggle play/pause with safety mechanisms
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current || !audioLoadedRef.current || updateLockRef.current) return;
    
    userInteractionInProgressRef.current = true;
    
    // If we detected a frozen state, reset before toggling
    if (isFrozen) {
      resetFrozenPlayer().then(() => {
        // After reset, continue with toggle
        if (isPlaying) {
          audioRef.current?.pause();
        } else if (audioRef.current) {
          playAudio();
        }
        userInteractionInProgressRef.current = false;
      });
      return;
    }

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playAudio();
    }
    
    createTrackedTimeout(() => {
      userInteractionInProgressRef.current = false;
    }, 300);
  }, [isPlaying, isFrozen, resetFrozenPlayer, createTrackedTimeout]);

  // Reliable play audio function
  const playAudio = useCallback(() => {
    if (!audioRef.current || !audioLoadedRef.current) return;
    
    // Handle buffering state
    if (audioRef.current.readyState < 3) {
      setIsBuffering(true);
    }
    
    // Ensure continuous play
    continuousPlayRef.current = true;
    
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          isPlayingRef.current = true;
          setIsBuffering(false);
          
          // Update the last time update timestamp
          lastTimeUpdateRef.current = Date.now();
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            setIsPlaying(false);
            isPlayingRef.current = false;
            setIsBuffering(false);
            console.error("Audio play error:", error);
          }
        });
    }
  }, []);

  // Skip functions with additional safeguards
  const skipForward = useCallback(() => {
    if (audioRef.current && !updateLockRef.current && !userInteractionInProgressRef.current) {
      userInteractionInProgressRef.current = true;
      
      // First disable time update callbacks briefly to prevent feedback
      timeUpdateCallbackEnabledRef.current = false;
      
      const newTime = Math.min(audioRef.current.currentTime + 5, duration);
      jumpToTime(newTime);
      
      // Re-enable callbacks after a reasonable delay
      createTrackedTimeout(() => {
        timeUpdateCallbackEnabledRef.current = true;
        userInteractionInProgressRef.current = false;
      }, 500);
    }
  }, [duration, createTrackedTimeout]);

  const skipBackward = useCallback(() => {
    if (audioRef.current && !updateLockRef.current && !userInteractionInProgressRef.current) {
      userInteractionInProgressRef.current = true;
      
      // First disable time update callbacks briefly to prevent feedback
      timeUpdateCallbackEnabledRef.current = false;
      
      const newTime = Math.max(audioRef.current.currentTime - 5, 0);
      jumpToTime(newTime);
      
      // Re-enable callbacks after a reasonable delay
      createTrackedTimeout(() => {
        timeUpdateCallbackEnabledRef.current = true;
        userInteractionInProgressRef.current = false;
      }, 500);
    }
  }, [createTrackedTimeout]);

  // Completely revised jumpToTime function with better safety
  const jumpToTime = useCallback((time: number) => {
    if (!audioRef.current || !audioLoadedRef.current || updateLockRef.current) return;
    
    // Prevent jumps to 0 unless explicitly requested and significant
    if (time < 0.1 && audioRef.current.currentTime > 1) {
      console.warn("Prevented unexpected jump to position 0");
      return;
    }
    
    // Prevent small jumps that could cause feedback loops
    if (Math.abs(time - prevTimeRef.current) < 0.2) return;
    
    // Set seeking flags and lock updates
    updateLockRef.current = true;
    setIsSeeking(true);
    
    // Remember the target time
    prevTimeRef.current = time;
    
    // Update UI
    setCurrentTime(time);
    
    // Store play state
    const wasPlaying = !audioRef.current.paused;
    
    // Set time and handle any errors
    try {
      audioRef.current.currentTime = time;
    } catch (err) {
      console.warn("Could not set audio time, possibly not loaded yet:", err);
      updateLockRef.current = false;
      setIsSeeking(false);
      return;
    }
    
    // Mark that we updated the time
    lastTimeUpdateRef.current = Date.now();
    
    // Release lock after a short delay to allow browser to process the seek
    createTrackedTimeout(() => {
      updateLockRef.current = false;
      
      // Only call external updates if significant time has passed
      if (onTimeUpdateRef.current && Math.abs(time - lastReportedTimeRef.current) > 0.2) {
        lastReportedTimeRef.current = time;
        onTimeUpdateRef.current(time);
      }
      
      // If we were playing, ensure we continue playing
      if (wasPlaying && audioRef.current && audioRef.current.paused) {
        playAudio();
      }
    }, 250);
  }, [createTrackedTimeout, playAudio]);

  // Heavily optimized time update handling
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || updateLockRef.current || resetInProgressRef.current) return;
    
    // Update last time update timestamp
    lastTimeUpdateRef.current = Date.now();
    
    // Get new time
    const newTime = audioRef.current.currentTime;
    
    // Prevent audio reset to position 0 unless we've actually reached the end
    if (newTime < 0.1 && !audioRef.current.paused && 
        prevTimeRef.current > 1 && audioRef.current.duration - prevTimeRef.current > 1) {
      
      console.warn("Detected unexpected reset to position 0, restoring position");
      audioRef.current.currentTime = prevTimeRef.current;
      return;
    }
    
    prevTimeRef.current = newTime;
    
    // Only update UI state and call external callback if time changed significantly
    if (Math.abs(newTime - currentTime) > 0.2) {
      setCurrentTime(newTime);
      
      if (timeUpdateCallbackEnabledRef.current && onTimeUpdateRef.current && 
          !isSeeking && !isBuffering && Math.abs(newTime - lastReportedTimeRef.current) > 0.2) {
        lastReportedTimeRef.current = newTime;
        onTimeUpdateRef.current(newTime);
      }
    }
  }, [currentTime, isSeeking, isBuffering]);

  // Optimized audio event handlers
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      setDuration(audioDuration);
      setIsLoading(false);
      audioLoadedRef.current = true;
      lastTimeUpdateRef.current = Date.now();
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (updateLockRef.current || userInteractionInProgressRef.current) return;
    
    userInteractionInProgressRef.current = true;
    const time = parseFloat(e.target.value);
    
    // Temporarily disable time update callbacks
    timeUpdateCallbackEnabledRef.current = false;
    jumpToTime(time);
    
    // Re-enable callbacks after a delay
    createTrackedTimeout(() => {
      timeUpdateCallbackEnabledRef.current = true;
      userInteractionInProgressRef.current = false;
    }, 500);
  }, [jumpToTime, createTrackedTimeout]);

  // Memoized formatting function
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Optimized event handlers
  const handleCanPlay = useCallback(() => {
    audioLoadedRef.current = true;
    setIsLoading(false);
    setIsBuffering(false);
    lastTimeUpdateRef.current = Date.now();
  }, []);

  const handleWaiting = useCallback(() => {
    if (!audioLoadedRef.current) return;
    setIsBuffering(true);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
    isPlayingRef.current = true;
    lastTimeUpdateRef.current = Date.now();
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
  }, []);

  const handleSeeking = useCallback(() => {
    setIsSeeking(true);
    setIsBuffering(true);
  }, []);

  const handleSeeked = useCallback(() => {
    if (!audioRef.current) return;
    
    setIsSeeking(false);
    setIsBuffering(false);
    
    // Update the last time update timestamp
    lastTimeUpdateRef.current = Date.now();
    
    // If continuous play is enabled and audio is loaded, ensure we're playing
    if (continuousPlayRef.current && audioLoadedRef.current && !audioRef.current.paused) {
      // No need to call play if already playing
      return;
    } else if (continuousPlayRef.current && audioLoadedRef.current && audioRef.current.paused && isPlayingRef.current) {
      // Resume if we should be playing but aren't
      playAudio();
    }
  }, [playAudio]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
    isPlayingRef.current = false;
    
    // Only send time update when actually ended
    if (onTimeUpdateRef.current && audioRef.current) {
      const finalTime = audioRef.current.duration;
      lastReportedTimeRef.current = finalTime;
      onTimeUpdateRef.current(finalTime);
    }
  }, []);

  const handleError = useCallback((e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    console.error("Audio error:", (e.target as HTMLAudioElement).error);
    setIsLoading(false);
    setIsPlaying(false);
    isPlayingRef.current = false;
    setIsBuffering(false);
    audioLoadedRef.current = false;
  }, []);

  // Jump to time registration with proper cleanup
  useEffect(() => {
    if (onJumpToTime && audioRef.current) {
      // Improved stable callback with better error handling
      const stableJumpToTimeCallback = (time: number) => {
        // Skip if audio isn't loaded or already seeking
        if (!audioLoadedRef.current || isSeeking) return;
        
        userInteractionInProgressRef.current = true;
        
        // Temporarily disable time update callbacks
        timeUpdateCallbackEnabledRef.current = false;
        
        // Set the continuous play flag to ensure playback continues
        continuousPlayRef.current = true;
        
        // Jump to the requested time
        jumpToTime(time);
        
        // Re-enable callbacks after a delay
        createTrackedTimeout(() => {
          timeUpdateCallbackEnabledRef.current = true;
          userInteractionInProgressRef.current = false;
        }, 500);
      };
      
      // Register the callback
      const cleanupFunction = onJumpToTime(stableJumpToTimeCallback);
      
      // Return cleanup that properly handles the returned function
      return () => {
        // Only call the cleanup function if it exists and is callable
        if (typeof cleanupFunction === 'function') {
          cleanupFunction();
        }
      };
    }
    
    return undefined;
  }, [jumpToTime, onJumpToTime, isSeeking, createTrackedTimeout]);

  // Handle src changes with proper cleanup
  useEffect(() => {
    if (src && src !== srcRef.current) {
      // Reset all state and refs
      setIsLoading(true);
      setIsPlaying(false);
      isPlayingRef.current = false;
      setCurrentTime(0);
      setIsBuffering(false);
      setIsFrozen(false);
      
      // Reset all the refs to initial state
      prevTimeRef.current = 0;
      lastReportedTimeRef.current = -1;
      lastTimeUpdateRef.current = Date.now();
      updateLockRef.current = false;
      timeUpdateCallbackEnabledRef.current = true;
      audioLoadedRef.current = false;
      continuousPlayRef.current = true;
      userInteractionInProgressRef.current = false;
      resetInProgressRef.current = false;
      
      // Clear all pending timeouts
      clearAllTrackedTimeouts();
      
      // Reset and reload audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      }
      
      srcRef.current = src;
    }
    
    return () => {
      // Clean up all timeouts when component unmounts
      clearAllTrackedTimeouts();
      
      // Clear intervals
      if (timeUpdateIntervalRef.current) {
        window.clearInterval(timeUpdateIntervalRef.current);
      }
      if (frozenCheckIntervalRef.current) {
        window.clearInterval(frozenCheckIntervalRef.current);
      }
    };
  }, [src, clearAllTrackedTimeouts]);

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      <audio
        ref={audioRef}
        src={src}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onCanPlay={handleCanPlay}
        onWaiting={handleWaiting}
        onPlay={handlePlay}
        onPause={handlePause}
        onSeeking={handleSeeking}
        onSeeked={handleSeeked}
        onEnded={handleEnded}
        onError={handleError}
        preload="metadata"
        playsInline
      />
      
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
          disabled={isLoading || currentTime === 0 || updateLockRef.current || userInteractionInProgressRef.current}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
          disabled={isLoading || !src || updateLockRef.current || !audioLoadedRef.current || userInteractionInProgressRef.current}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : isPlaying ? (
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
          disabled={isLoading || currentTime >= duration || updateLockRef.current || userInteractionInProgressRef.current}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
        
        {/* Add reset button that only appears when frozen is detected */}
        {isFrozen && (
          <Button
            onClick={handleManualReset}
            variant="destructive"
            size="icon"
            className="h-8 w-8 ml-2"
            title="Reset player (if stuck)"
          >
            <RefreshCw className="h-4 w-4 animate-spin" />
          </Button>
        )}
      </div>

      <div className="flex items-center space-x-2">
        <span className="text-sm tabular-nums">
          {formatTime(currentTime)}
        </span>
        
        <input
          type="range"
          min="0"
          max={duration || 0}
          value={currentTime}
          onChange={handleSeek}
          className={cn(
            "flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer",
            (isSeeking || isBuffering) && "opacity-80",
            isFrozen && "opacity-50"
          )}
          disabled={isLoading || !src || updateLockRef.current || !audioLoadedRef.current || userInteractionInProgressRef.current}
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* Improved status indicators */}
      <div className="text-xs text-center text-muted-foreground">
        {(isSeeking || isBuffering || isLoading || isFrozen) && (
          <span className={cn(
            "animate-pulse",
            isFrozen && "text-red-500 font-medium"
          )}>
            {isFrozen ? "Player Stuck - Click Reset" : 
             isSeeking ? "Seeking" : 
             isBuffering ? "Buffering" : 
             "Loading"}...{" "}
          </span>
        )}
        <span className={cn(
          isPlaying ? "text-green-600 font-medium" : "",
          isFrozen && "line-through text-red-400"
        )}>
          {isPlaying ? "Playing" : "Paused"}
        </span>
      </div>
    </div>
  );
}
