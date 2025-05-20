
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward, Loader2 } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (callback: (time: number) => void) => void;
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
  
  // Refs to prevent infinite loops
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekQueueRef = useRef<number | null>(null);
  const playAfterSeekRef = useRef(false);
  const seekOperationInProgressRef = useRef(false);
  const lastTimeUpdateRef = useRef(0);
  const timeUpdateThrottleRef = useRef(false);
  const prevTimeRef = useRef(0);
  const srcRef = useRef(src);
  const onTimeUpdateRef = useRef(onTimeUpdate);
  const lastReportedTimeRef = useRef(-1);
  
  // Update refs when props change
  useEffect(() => {
    srcRef.current = src;
    onTimeUpdateRef.current = onTimeUpdate;
  }, [src, onTimeUpdate]);

  // Memoized toggle play/pause to prevent recreating on every render
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      playAudio();
    }
  }, [isPlaying]);

  // Separated play logic
  const playAudio = useCallback(() => {
    if (!audioRef.current) return;
    
    // Handle buffering state
    if (audioRef.current.readyState < 3) {
      setIsBuffering(true);
    }
    
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(error => {
          if (error.name !== 'AbortError') {
            setIsPlaying(false);
            setIsBuffering(false);
          }
        });
    }
  }, []);

  // Memoized skip functions
  const skipForward = useCallback(() => {
    if (audioRef.current) {
      const newTime = Math.min(audioRef.current.currentTime + 5, duration);
      jumpToTime(newTime);
    }
  }, [duration]);

  const skipBackward = useCallback(() => {
    if (audioRef.current) {
      const newTime = Math.max(audioRef.current.currentTime - 5, 0);
      jumpToTime(newTime);
    }
  }, []);

  // Revised jumpToTime function with better state management
  const jumpToTime = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    // Prevent triggering time updates while seeking
    if (Math.abs(time - prevTimeRef.current) < 0.1) return;
    prevTimeRef.current = time;
    
    // If seeking in progress, queue this request
    if (seekOperationInProgressRef.current) {
      seekQueueRef.current = time;
      return;
    }
    
    // Set seeking flags
    seekOperationInProgressRef.current = true;
    setIsSeeking(true);
    
    // Update UI
    setCurrentTime(time);
    
    // Store play state
    playAfterSeekRef.current = isPlaying || audioRef.current.paused === false;
    
    // Pause first to avoid race conditions
    if (!audioRef.current.paused) {
      audioRef.current.pause();
    }
    
    // Set time without triggering unnecessary callbacks
    audioRef.current.currentTime = time;
    
    // Only call external updates if the time has changed enough
    if (onTimeUpdateRef.current && Math.abs(time - lastReportedTimeRef.current) > 0.1) {
      lastReportedTimeRef.current = time;
      onTimeUpdateRef.current(time);
    }
  }, [isPlaying]);

  // Throttled time update handling
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || timeUpdateThrottleRef.current) return;
    
    const newTime = audioRef.current.currentTime;
    
    // Debounce frequent updates
    if (Date.now() - lastTimeUpdateRef.current < 100) {
      if (!timeUpdateThrottleRef.current) {
        timeUpdateThrottleRef.current = true;
        setTimeout(() => {
          timeUpdateThrottleRef.current = false;
          if (audioRef.current) handleTimeUpdate();
        }, 100);
      }
      return;
    }
    
    lastTimeUpdateRef.current = Date.now();
    
    // Only update if time changed significantly (prevents loops)
    if (Math.abs(newTime - currentTime) > 0.1) {
      setCurrentTime(newTime);
      
      // Only call external updates if seeking is not in progress
      if (onTimeUpdateRef.current && !seekOperationInProgressRef.current && 
          Math.abs(newTime - lastReportedTimeRef.current) > 0.1) {
        lastReportedTimeRef.current = newTime;
        onTimeUpdateRef.current(newTime);
      }
    }
  }, [currentTime]);

  // Handlers with better loop prevention
  const handleLoadedMetadata = useCallback(() => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      setDuration(audioDuration);
      setIsLoading(false);
    }
  }, []);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    jumpToTime(time);
  }, [jumpToTime]);

  // Memoized formatting function
  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Optimized event handlers
  const handleCanPlay = useCallback(() => {
    setIsLoading(false);
    setIsBuffering(false);
  }, []);

  const handleWaiting = useCallback(() => {
    setIsBuffering(true);
  }, []);

  const handlePlay = useCallback(() => {
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    if (!seekOperationInProgressRef.current) {
      setIsPlaying(false);
    }
  }, []);

  const handleSeeking = useCallback(() => {
    setIsSeeking(true);
    setIsBuffering(true);
  }, []);

  const handleSeeked = useCallback(() => {
    if (!audioRef.current) return;
    
    const currentSeekTime = audioRef.current.currentTime;
    
    // Clear seeking states
    setIsSeeking(false);
    setIsBuffering(false);
    
    // Resume playback if needed
    if (playAfterSeekRef.current) {
      // Delayed resume to let browser catch up
      setTimeout(() => {
        if (audioRef.current) {
          // Check for time drift
          if (Math.abs(audioRef.current.currentTime - currentSeekTime) > 0.5) {
            audioRef.current.currentTime = currentSeekTime;
          }
          
          playAudio();
          playAfterSeekRef.current = false;
        }
      }, 50);
    }
    
    // Process queued seeks
    setTimeout(() => {
      seekOperationInProgressRef.current = false;
      
      if (seekQueueRef.current !== null) {
        const nextSeekTime = seekQueueRef.current;
        seekQueueRef.current = null;
        jumpToTime(nextSeekTime);
      }
    }, 100);
  }, [playAudio]);

  const handleEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const handleError = useCallback(() => {
    setIsLoading(false);
    setIsPlaying(false);
    setIsBuffering(false);
    seekOperationInProgressRef.current = false;
  }, []);

  // Jump to time registration with proper cleanup
  useEffect(() => {
    if (onJumpToTime && audioRef.current) {
      onJumpToTime(jumpToTime);
    }
    
    return () => {
      // Cleanup to prevent memory leaks
      lastTimeUpdateRef.current = 0;
      timeUpdateThrottleRef.current = false;
      seekOperationInProgressRef.current = false;
      seekQueueRef.current = null;
    };
  }, [jumpToTime, onJumpToTime]);

  // Handle src changes with proper cleanup
  useEffect(() => {
    if (src && src !== srcRef.current) {
      // Reset all state and refs
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsBuffering(false);
      seekOperationInProgressRef.current = false;
      seekQueueRef.current = null;
      playAfterSeekRef.current = false;
      lastReportedTimeRef.current = -1;
      lastTimeUpdateRef.current = 0;
      
      // Reset and reload audio
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
        audioRef.current.load();
      }
      
      srcRef.current = src;
    }
  }, [src]);

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
          disabled={isLoading || currentTime === 0}
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
          disabled={isLoading || !src}
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
          disabled={isLoading || currentTime >= duration}
        >
          <SkipForward className="h-4 w-4" />
        </Button>
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
            isSeeking && "opacity-80"
          )}
          disabled={isLoading || !src}
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>

      {/* Visual indicators - simplified to reduce DOM updates */}
      <div className="text-xs text-center text-muted-foreground">
        {(isSeeking || isBuffering || isLoading) && (
          <span className="animate-pulse">
            {isSeeking ? "Seeking" : isBuffering ? "Buffering" : "Loading"}...{" "}
          </span>
        )}
        <span className={isPlaying ? "text-green-600 font-medium" : ""}>
          {isPlaying ? "Playing" : "Paused"}
        </span>
      </div>
    </div>
  );
}
