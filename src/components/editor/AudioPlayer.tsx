
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

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (time: number) => void;
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
  
  // Refs
  const audioRef = useRef<HTMLAudioElement>(null);
  const timeUpdateLockRef = useRef(false);
  const seekingRef = useRef(false);
  const resetTimeoutRef = useRef<number | null>(null);
  
  // Clean up function for all timeouts
  const clearAllTimeouts = useCallback(() => {
    if (resetTimeoutRef.current) {
      window.clearTimeout(resetTimeoutRef.current);
      resetTimeoutRef.current = null;
    }
  }, []);

  // Reset player state if it gets stuck
  const resetPlayerIfStuck = useCallback(() => {
    clearAllTimeouts();
    
    // If player is in seeking state for too long, reset it
    if (playbackState === 'seeking' && seekingRef.current) {
      console.log('Audio player was stuck in seeking state, resetting');
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      setPlaybackState(isPlaying ? 'playing' : 'paused');
    }
  }, [playbackState, isPlaying]);
  
  // Handle play/pause
  const togglePlayPause = useCallback(() => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else if (isAudioPlayable(audioRef)) {
      // Only attempt to play if the audio is in a playable state
      const playPromise = audioRef.current.play();
      
      if (playPromise !== undefined) {
        playPromise
          .then(() => {
            // Playback started successfully
            setPlaybackState('playing');
          })
          .catch(error => {
            console.error("Play failed:", error);
            setPlaybackState('error');
            setIsPlaying(false);
          });
      }
    }
  }, [isPlaying]);

  // Skip forward/backward helpers
  const skipForward = useCallback(() => {
    if (!audioRef.current) return;
    
    const newTime = Math.min(audioRef.current.duration, audioRef.current.currentTime + 5);
    jumpToTime(newTime);
  }, []);

  const skipBackward = useCallback(() => {
    if (!audioRef.current) return;
    
    const newTime = Math.max(0, audioRef.current.currentTime - 5);
    jumpToTime(newTime);
  }, []);

  // Update time handler with lock to prevent feedback loops
  const handleTimeUpdate = useCallback(() => {
    if (!audioRef.current || timeUpdateLockRef.current) return;
    
    const currentTime = audioRef.current.currentTime;
    setCurrentTime(currentTime);
    
    if (onTimeUpdate && !seekingRef.current) {
      onTimeUpdate(currentTime);
    }
  }, [onTimeUpdate]);

  // Handle metadata loaded
  const handleLoadedMetadata = useCallback(() => {
    if (!audioRef.current) return;
    
    setDuration(audioRef.current.duration);
    setPlaybackState('paused');
    
    // Apply initial volume
    audioRef.current.volume = volume;
  }, [volume]);

  // Handle user scrubbing the timeline
  const handleSeek = useCallback((value: number[]) => {
    const time = value[0];
    
    // Lock time updates to prevent feedback
    timeUpdateLockRef.current = true;
    seekingRef.current = true;
    setPlaybackState('seeking');
    
    setCurrentTime(time);
    
    // Jump to the new time
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    
    // Set a timeout to clear the seeking flag
    window.setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      setPlaybackState(isPlaying ? 'playing' : 'paused');
    }, 200);
    
    // Also trigger the onTimeUpdate callback
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
  }, [isPlaying, onTimeUpdate]);

  // Handle seeking events
  const handleSeeking = useCallback(() => {
    seekingRef.current = true;
    setPlaybackState('seeking');
  }, []);

  const handleSeeked = useCallback(() => {
    // Small delay to ensure the audio is ready
    setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      setPlaybackState(isPlaying ? 'playing' : 'paused');
    }, 100);
  }, [isPlaying]);

  // Jump to time (exposed for external control)
  const jumpToTime = useCallback((time: number) => {
    if (!audioRef.current) return;
    
    // Lock time updates during the jump
    timeUpdateLockRef.current = true;
    seekingRef.current = true;
    setPlaybackState('seeking');
    
    // Set the new time
    audioRef.current.currentTime = Math.max(0, Math.min(time, audioRef.current.duration || 0));
    setCurrentTime(audioRef.current.currentTime);
    
    // If we were playing, continue playing
    if (isPlaying) {
      const playPromise = audioRef.current.play();
      if (playPromise !== undefined) {
        playPromise.catch(error => {
          console.error("Play after seek failed:", error);
          setIsPlaying(false);
          setPlaybackState('error');
        });
      }
    }
    
    // Schedule a reset of the lock flags
    resetTimeoutRef.current = window.setTimeout(() => {
      seekingRef.current = false;
      timeUpdateLockRef.current = false;
      setPlaybackState(isPlaying ? 'playing' : 'paused');
      resetTimeoutRef.current = null;
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
    if (onJumpToTime) {
      // We're just setting up the callback - not actively jumping
      return () => {}; 
    }
  }, [onJumpToTime]);

  // Effect to handle audio element events
  useEffect(() => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    
    // Handle play/pause events
    const handlePlay = () => {
      setIsPlaying(true);
      setPlaybackState('playing');
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      setPlaybackState('paused');
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      setPlaybackState('paused');
    };
    
    const handleWaiting = () => {
      setPlaybackState('loading');
    };
    
    const handleError = () => {
      console.error("Audio player error:", audioEl.error);
      setPlaybackState('error');
      setIsPlaying(false);
    };
    
    // Add event listeners
    audioEl.addEventListener('play', handlePlay);
    audioEl.addEventListener('playing', handlePlay);
    audioEl.addEventListener('pause', handlePause);
    audioEl.addEventListener('ended', handleEnded);
    audioEl.addEventListener('waiting', handleWaiting);
    audioEl.addEventListener('error', handleError);
    
    // Cleanup
    return () => {
      audioEl.removeEventListener('play', handlePlay);
      audioEl.removeEventListener('playing', handlePlay);
      audioEl.removeEventListener('pause', handlePause);
      audioEl.removeEventListener('ended', handleEnded);
      audioEl.removeEventListener('waiting', handleWaiting);
      audioEl.removeEventListener('error', handleError);
      clearAllTimeouts();
    };
  }, [clearAllTimeouts]);

  // Effect to periodically check if player is stuck
  useEffect(() => {
    if (playbackState === 'seeking') {
      // Set a timeout to check if seeking gets stuck
      const checkTimeout = window.setTimeout(resetPlayerIfStuck, 2000);
      return () => window.clearTimeout(checkTimeout);
    }
  }, [playbackState, resetPlayerIfStuck]);

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
