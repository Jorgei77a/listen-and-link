
import { useState, useRef, useEffect } from "react";
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
  const audioRef = useRef<HTMLAudioElement>(null);
  const seekQueueRef = useRef<number | null>(null);
  const playAfterSeekRef = useRef(false);
  const seekOperationInProgressRef = useRef(false);

  const togglePlayPause = () => {
    console.log("📢 AudioPlayer: Toggle Play/Pause called, current state:", isPlaying ? "playing" : "paused");
    
    if (!audioRef.current) {
      console.error("📢 AudioPlayer: Audio element ref is null");
      return;
    }

    if (isPlaying) {
      console.log("📢 AudioPlayer: Pausing audio");
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      console.log("📢 AudioPlayer: Attempting to play audio");
      playAudio();
    }
  };

  // Separated play logic for better reusability
  const playAudio = () => {
    if (!audioRef.current) return;
    
    console.log("📢 AudioPlayer: playAudio called with readyState:", audioRef.current.readyState);
    
    // Handle buffering state
    if (audioRef.current.readyState < 3) {
      setIsBuffering(true);
    }
    
    const playPromise = audioRef.current.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log("📢 AudioPlayer: Playback started successfully");
          setIsPlaying(true);
          setIsBuffering(false);
        })
        .catch(error => {
          console.error("📢 AudioPlayer: Playback error:", error);
          // Only update state if an actual error (not an aborted operation)
          if (error.name !== 'AbortError') {
            setIsPlaying(false);
            setIsBuffering(false);
          }
        });
    }
  };

  const skipForward = () => {
    console.log("📢 AudioPlayer: Skip forward called");
    if (audioRef.current) {
      const newTime = Math.min(audioRef.current.currentTime + 5, duration);
      console.log(`📢 AudioPlayer: Skipping forward to ${newTime}s`);
      jumpToTime(newTime);
    }
  };

  const skipBackward = () => {
    console.log("📢 AudioPlayer: Skip backward called");
    if (audioRef.current) {
      const newTime = Math.max(audioRef.current.currentTime - 5, 0);
      console.log(`📢 AudioPlayer: Skipping backward to ${newTime}s`);
      jumpToTime(newTime);
    }
  };

  // Completely revised jumpToTime function with better state management
  const jumpToTime = (time: number) => {
    if (!audioRef.current) {
      console.error("📢 AudioPlayer: jumpToTime - Audio element ref is null");
      return;
    }
    
    console.log(`📢 AudioPlayer: jumpToTime called with time=${time}, current play state=${isPlaying ? "playing" : "paused"}, readyState=${audioRef.current.readyState}`);
    
    // If we're already seeking, queue this request instead of executing immediately
    if (seekOperationInProgressRef.current) {
      console.log(`📢 AudioPlayer: Seek operation already in progress, queueing time=${time}`);
      seekQueueRef.current = time;
      return;
    }
    
    // Set that we're now seeking
    seekOperationInProgressRef.current = true;
    setIsSeeking(true);
    
    // Update UI immediately for responsiveness
    setCurrentTime(time);
    
    // Store if we should play after seeking
    playAfterSeekRef.current = isPlaying || audioRef.current.paused === false;
    
    // If we were playing, we need to pause first to avoid race conditions
    if (!audioRef.current.paused) {
      console.log("📢 AudioPlayer: Pausing before seeking to avoid race conditions");
      // Just pause, don't update state as we'll resume after seeking
      audioRef.current.pause();
    }
    
    // Update audio element's time - this will trigger the seeking event
    console.log(`📢 AudioPlayer: Setting currentTime to ${time}`);
    audioRef.current.currentTime = time;
    
    // Trigger the callback if provided
    if (onTimeUpdate) {
      console.log(`📢 AudioPlayer: Calling onTimeUpdate with time=${time}`);
      onTimeUpdate(time);
    }

    // We'll resume playback in the seeked event handler if needed
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const newTime = audioRef.current.currentTime;
      // Only log every second to avoid console spam
      if (Math.floor(newTime) !== Math.floor(currentTime)) {
        console.log(`📢 AudioPlayer: Time updated to ${newTime.toFixed(2)}s`);
      }
      
      setCurrentTime(newTime);
      
      // Update parent component if callback provided
      if (onTimeUpdate) {
        onTimeUpdate(newTime);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      console.log(`📢 AudioPlayer: Audio metadata loaded, duration=${audioDuration}s, src=${src}`);
      setDuration(audioDuration);
      setIsLoading(false);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    console.log(`📢 AudioPlayer: Manual seek to ${time}s via slider`);
    jumpToTime(time);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const handleCanPlay = () => {
    console.log("📢 AudioPlayer: Audio can play event fired");
    setIsLoading(false);
    setIsBuffering(false);
  };

  const handleWaiting = () => {
    console.log("📢 AudioPlayer: Audio waiting event fired");
    setIsLoading(true);
    setIsBuffering(true);
  };

  const handlePlay = () => {
    console.log("📢 AudioPlayer: Audio play event fired");
    setIsPlaying(true);
  };

  const handlePause = () => {
    console.log("📢 AudioPlayer: Audio pause event fired");
    // Only update the playing state if we're not in the middle of a seek operation
    if (!seekOperationInProgressRef.current) {
      setIsPlaying(false);
    }
  };

  const handleSeeking = () => {
    console.log(`📢 AudioPlayer: Audio seeking event fired, seeking to ${audioRef.current?.currentTime}s`);
    setIsSeeking(true);
    setIsBuffering(true);
  };

  const handleSeeked = () => {
    if (!audioRef.current) return;
    
    const currentSeekTime = audioRef.current.currentTime;
    console.log(`📢 AudioPlayer: Audio seeked event fired, now at ${currentSeekTime}s`);
    
    // Mark that we're no longer seeking
    setIsSeeking(false);
    setIsBuffering(false);
    
    // If we should resume playback after seeking
    if (playAfterSeekRef.current) {
      console.log("📢 AudioPlayer: Resuming playback after seek");
      // Use setTimeout to let the browser catch up after the seeking operation
      setTimeout(() => {
        if (!audioRef.current) return;
        
        // Ensure we're still at the right position and not at 0 due to some browsers resetting
        if (Math.abs(audioRef.current.currentTime - currentSeekTime) > 0.5) {
          console.log(`📢 AudioPlayer: Detected time drift after seeking, correcting to ${currentSeekTime}`);
          audioRef.current.currentTime = currentSeekTime;
        }
        
        playAudio();
        playAfterSeekRef.current = false;
      }, 50);
    }
    
    // Check if we have queued seeks and process them
    setTimeout(() => {
      seekOperationInProgressRef.current = false;
      
      if (seekQueueRef.current !== null) {
        const nextSeekTime = seekQueueRef.current;
        seekQueueRef.current = null;
        console.log(`📢 AudioPlayer: Processing queued seek to ${nextSeekTime}s`);
        jumpToTime(nextSeekTime);
      }
    }, 100);
  };

  const handleEnded = () => {
    console.log("📢 AudioPlayer: Audio ended event fired");
    setIsPlaying(false);
  };

  const handleError = (e: React.SyntheticEvent<HTMLAudioElement, Event>) => {
    const target = e.target as HTMLAudioElement;
    console.error("📢 AudioPlayer: Audio error event fired", target.error);
    setIsLoading(false);
    setIsPlaying(false);
    setIsBuffering(false);
    // Reset seek operation status to prevent deadlocks
    seekOperationInProgressRef.current = false;
  };

  // Effect to handle external time jumps from text clicks
  useEffect(() => {
    if (onJumpToTime && audioRef.current) {
      console.log("📢 AudioPlayer: Registering jumpToTime callback");
      // Register the jumpToTime function as a callback
      onJumpToTime(jumpToTime);
    }
  }, [onJumpToTime]);

  // Effect to handle src changes
  useEffect(() => {
    if (src) {
      console.log(`📢 AudioPlayer: Source changed to ${src}`);
      setIsLoading(true);
      setIsPlaying(false);
      setCurrentTime(0);
      setIsBuffering(false);
      seekOperationInProgressRef.current = false;
      seekQueueRef.current = null;
      playAfterSeekRef.current = false;
      
      // Reset audio element when src changes
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
        audioRef.current.load();
        console.log("📢 AudioPlayer: Audio element reset and reloaded");
      }
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
        playsInline // Better mobile support
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

      {/* Enhanced visual debugging indicators */}
      <div className="text-xs text-center text-muted-foreground">
        {isSeeking && <span className="animate-pulse">Seeking... </span>}
        {isBuffering && <span className="animate-pulse">Buffering... </span>}
        {isLoading && <span className="animate-pulse">Loading... </span>}
        <span className={isPlaying ? "text-green-600 font-medium" : ""}>
          {isPlaying ? "Playing" : "Paused"}
        </span>
        {playAfterSeekRef.current && <span className="ml-1 text-blue-500">(Resume pending)</span>}
      </div>
    </div>
  );
}
