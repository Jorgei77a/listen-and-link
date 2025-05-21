
import { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Play, Pause, SkipBack, SkipForward } from "lucide-react";

interface AudioPlayerProps {
  src: string;
  className?: string;
  onTimeUpdate?: (currentTime: number) => void;
  onJumpToTime?: (registerJumpFn: (time: number) => void) => void;
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioSourceRef = useRef<string | null>(null);
  
  // Create audio element only once
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      
      // Set up event listeners
      audioRef.current.addEventListener('timeupdate', handleTimeUpdate);
      audioRef.current.addEventListener('loadedmetadata', handleLoadedMetadata);
      audioRef.current.addEventListener('ended', () => setIsPlaying(false));
      audioRef.current.addEventListener('pause', () => setIsPlaying(false));
      audioRef.current.addEventListener('play', () => setIsPlaying(true));
    }
    
    // Cleanup function
    return () => {
      if (audioRef.current) {
        audioRef.current.removeEventListener('timeupdate', handleTimeUpdate);
        audioRef.current.removeEventListener('loadedmetadata', handleLoadedMetadata);
        audioRef.current.removeEventListener('ended', () => setIsPlaying(false));
        audioRef.current.removeEventListener('pause', () => setIsPlaying(false));
        audioRef.current.removeEventListener('play', () => setIsPlaying(true));
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  
  // Handle source changes separately to maintain playback state
  useEffect(() => {
    // Only update the source if it has changed
    if (src !== audioSourceRef.current && audioRef.current) {
      const wasPlaying = isPlaying;
      const currentPlaybackTime = audioRef.current.currentTime;
      
      // Save current playback position if it's the same audio file with a refreshed URL
      const isSameAudioWithNewUrl = audioSourceRef.current && 
        audioSourceRef.current.includes(src.split('?')[0]) || 
        src.includes(audioSourceRef.current?.split('?')[0] || '');
      
      // Update the source
      audioRef.current.src = src;
      audioSourceRef.current = src;
      
      // Load the new audio
      audioRef.current.load();
      
      // When the metadata is loaded, restore playback if needed
      if (isSameAudioWithNewUrl && currentPlaybackTime > 0) {
        const restorePlayback = () => {
          if (audioRef.current) {
            audioRef.current.currentTime = currentPlaybackTime;
            if (wasPlaying) {
              audioRef.current.play().catch(err => console.error('Failed to restore playback:', err));
            }
          }
          audioRef.current?.removeEventListener('loadedmetadata', restorePlayback);
        };
        
        audioRef.current.addEventListener('loadedmetadata', restorePlayback);
      }
    }
  }, [src, isPlaying]);

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause();
      } else {
        audioRef.current.play().catch(err => console.error('Failed to play audio:', err));
      }
    }
  };

  const skipForward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime += 5;
    }
  };

  const skipBackward = () => {
    if (audioRef.current) {
      audioRef.current.currentTime -= 5;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
      if (onTimeUpdate) {
        onTimeUpdate(audioRef.current.currentTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
    if (onTimeUpdate) {
      onTimeUpdate(time);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Define the jump function
  const jumpToTime = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      if (!isPlaying) {
        audioRef.current.play().catch(err => console.error('Failed to play audio:', err));
        setIsPlaying(true);
      }
    }
  }, [isPlaying]);

  // Register the jump function with the parent component
  useEffect(() => {
    if (onJumpToTime) {
      onJumpToTime(jumpToTime);
    }
  }, [onJumpToTime, jumpToTime]);

  return (
    <div className={cn("flex flex-col space-y-2", className)}>
      {/* No audio element in JSX - we're managing it via ref instead */}
      
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
