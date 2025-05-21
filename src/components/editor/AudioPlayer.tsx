
import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (time: number) => void;
  onPlayStateChange?: (isPlaying: boolean) => void;
  audioRef?: React.RefObject<HTMLAudioElement>;
}

export function AudioPlayer({ 
  src, 
  className,
  onTimeUpdate,
  onJumpToTime,
  onPlayStateChange,
  audioRef: externalAudioRef
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  
  // Create a local audio ref if no external ref is provided
  const internalAudioRef = useRef<HTMLAudioElement>(null);
  // Use the external ref if provided, otherwise use the internal ref
  const audioRef = externalAudioRef || internalAudioRef;
  
  // Create a stable audio element
  const stableAudio = useMemo(() => {
    // Only create new audio element if we're using internal ref
    // and no audio element exists yet
    if (!externalAudioRef && !internalAudioRef.current) {
      const audio = new Audio();
      internalAudioRef.current = audio;
      return audio;
    }
    return audioRef.current;
  }, [externalAudioRef, audioRef]);
  
  // Memoize the audio source URL to prevent recreation
  const audioSrc = useMemo(() => src, [src]);
  
  // Handle audio source setting only when it changes
  useEffect(() => {
    const audio = stableAudio;
    if (!audio) return;
    
    // Only set the source if it's different from current
    if (audio.src !== audioSrc) {
      console.log("AudioPlayer: Setting audio source to", audioSrc);
      audio.src = audioSrc;
      
      // Reset state when source changes
      setCurrentTime(0);
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
      
      // Load the new source
      audio.load();
    }
    
    // No need to return cleanup function for src changes
  }, [audioSrc, stableAudio, onPlayStateChange]);
  
  // Set up event listeners on the stable audio element
  useEffect(() => {
    const audio = stableAudio;
    if (!audio) return;
    
    const handlePlay = () => {
      setIsPlaying(true);
      if (onPlayStateChange) onPlayStateChange(true);
    };
    
    const handlePause = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    };
    
    const handleTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(audio.currentTime);
      }
    };
    
    const handleLoadedMetadata = () => {
      setDuration(audio.duration);
      // Ensure currentTime is set correctly, accommodating cached values
      setCurrentTime(audio.currentTime);
    };
    
    const handleEnded = () => {
      setIsPlaying(false);
      if (onPlayStateChange) onPlayStateChange(false);
    };
    
    // Add event listeners
    audio.addEventListener('play', handlePlay);
    audio.addEventListener('pause', handlePause);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('loadedmetadata', handleLoadedMetadata);
    audio.addEventListener('ended', handleEnded);
    
    // Handle any jump requests
    if (onJumpToTime) {
      // Implementation would be at component usage level
    }
    
    // Cleanup listeners to prevent memory leaks
    return () => {
      audio.removeEventListener('play', handlePlay);
      audio.removeEventListener('pause', handlePause);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('loadedmetadata', handleLoadedMetadata);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [stableAudio, onTimeUpdate, onJumpToTime, onPlayStateChange]);

  const togglePlayPause = useCallback(() => {
    if (stableAudio) {
      if (isPlaying) {
        stableAudio.pause();
      } else {
        stableAudio.play().catch(error => {
          console.error('Error playing audio:', error);
        });
      }
    }
  }, [isPlaying, stableAudio]);

  const skipForward = useCallback(() => {
    if (stableAudio) {
      stableAudio.currentTime += 5;
    }
  }, [stableAudio]);

  const skipBackward = useCallback(() => {
    if (stableAudio) {
      stableAudio.currentTime -= 5;
    }
  }, [stableAudio]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (stableAudio) {
      stableAudio.currentTime = time;
    }
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
  }, [stableAudio, onTimeUpdate]);

  const formatTime = useCallback((time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  }, []);

  // Don't render extra audio elements, rely on the stable audio reference
  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      {/* Only render audio element if using internal ref and no stable audio exists yet */}
      {!externalAudioRef && !stableAudio && (
        <audio
          ref={internalAudioRef}
          src={audioSrc}
          style={{ display: 'none' }}
        />
      )}
      
      <div className="flex items-center justify-center space-x-2">
        <Button 
          onClick={skipBackward} 
          variant="outline" 
          size="icon" 
          className="h-8 w-8"
          title="Skip backward 5 seconds"
        >
          <SkipBack className="h-4 w-4" />
        </Button>
        
        <Button 
          onClick={togglePlayPause} 
          variant="default" 
          size="icon"
          className="h-10 w-10 rounded-full"
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
          className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        
        <span className="text-sm tabular-nums">
          {formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
