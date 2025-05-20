
import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Slider } from '@/components/ui/slider'
import { Download, Play, Pause } from 'lucide-react'
import { formatTime } from '@/utils/audioUtils'

interface TranscriptAudioPlayerProps {
  audioUrl?: string
  fileName: string
  onTimeUpdate?: (currentTime: number) => void
  onSeek?: (time: number) => void
}

const TranscriptAudioPlayer = ({
  audioUrl,
  fileName,
  onTimeUpdate,
  onSeek
}: TranscriptAudioPlayerProps) => {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [isLoaded, setIsLoaded] = useState(false)

  const togglePlayPause = () => {
    if (audioRef.current) {
      if (isPlaying) {
        audioRef.current.pause()
      } else {
        audioRef.current.play()
      }
      setIsPlaying(!isPlaying)
    }
  }

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const time = audioRef.current.currentTime
      setCurrentTime(time)
      if (onTimeUpdate) {
        onTimeUpdate(time)
      }
    }
  }

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      setDuration(audioRef.current.duration)
      setIsLoaded(true)
    }
  }

  const handleSeek = (value: number[]) => {
    const time = value[0]
    setCurrentTime(time)
    if (audioRef.current) {
      audioRef.current.currentTime = time
    }
    if (onSeek) {
      onSeek(time)
    }
  }

  // Use a dummy audio URL for now if none is provided
  const actualAudioUrl = audioUrl || `data:audio/mp3;base64,SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tAwAAAAAAAAAAAAAAAAAAAAAAAWGluZwAAAA8AAAACAAAFWgD///////////////////////////////////////////8AAAAATGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAVbAfChTAAAAAAD/+xDEAAAHgAKn0AAAIS9FV93gACFfMiOI1zHcccUMRoimZIiJERETMzMzEQAAABERMzMzMwAAAAABERETMzMABEREAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAP/7EMQAAAd0BJ9AAAA7sEFWYG4AJwQEBAQEAZm3bt2wBduw+D8Hwfg/AMDAOAGD4Pg/B8YPg+D8Hwf8AwMDAMAwDAADA/B8HwfB+D4Pwfg/g+D8Hwfg+D4Pg/B8H/wfB8H4Pg/B8Hwf/wAOALw`

  return (
    <div className="mt-4 p-4 border rounded-md bg-muted/20">
      <audio
        ref={audioRef}
        src={actualAudioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={() => setIsPlaying(false)}
        className="hidden"
      />

      <div className="space-y-2">
        <div className="flex items-center space-x-2">
          <Button
            variant="outline" 
            size="icon"
            onClick={togglePlayPause}
            disabled={!isLoaded}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </Button>
          <div className="flex-grow">
            <Slider
              value={[currentTime]}
              min={0}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              disabled={!isLoaded}
              aria-label="Audio progress"
            />
          </div>
          <div className="text-sm text-muted-foreground whitespace-nowrap">
            {formatTime(currentTime)} / {formatTime(duration)}
          </div>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground truncate max-w-[70%]" title={fileName}>
            {fileName}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TranscriptAudioPlayer;
