import { useEffect, useRef, useState, useCallback } from 'react';
import { ObjectDetector, FilesetResolver, type ObjectDetectorResult } from '@mediapipe/tasks-vision';

export interface VisionCameraOptions {
  modelPath: string;
  scoreThreshold?: number;
  maxResults?: number;
  onResult: (result: ObjectDetectorResult, timestamp: number) => void;
}

export function useVisionCamera(options: VisionCameraOptions) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  
  const lastVideoTimeRef = useRef<number>(-1);
  const optionsRef = useRef(options);

  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  useEffect(() => {
    let isMounted = true;
    const initDetector = async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm"
        );
        
        const detectorInstance = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath: options.modelPath,
            delegate: "GPU"
          },
          runningMode: "LIVE_STREAM",
          scoreThreshold: options.scoreThreshold ?? 0.5,
          maxResults: options.maxResults ?? 5,
          resultListener: ((result: ObjectDetectorResult, timestamp: number) => {
             optionsRef.current.onResult(result, timestamp);
          })
        } as any);

        if (isMounted) {
          detectorRef.current = detectorInstance;
          setIsReady(true);
        }
      } catch (err) {
        if (isMounted) setError(err instanceof Error ? err : new Error(String(err)));
      }
    };
    initDetector();
    return () => { 
      isMounted = false; 
      if (detectorRef.current) {
        detectorRef.current.close();
      }
    };
  }, [options.modelPath, options.scoreThreshold, options.maxResults]);

  const detectFrame = useCallback(() => {
    if (!detectorRef.current || !videoRef.current) return;
    
    const video = videoRef.current;
    if (video.readyState >= 2) {
      const timestamp = Math.floor(performance.now());
      
      if (timestamp <= lastVideoTimeRef.current) {
        throw new Error("ERR_INVALID_TIMESTAMP: Timestamp must be monotonically increasing.");
      }
      
      detectorRef.current.detectForVideo(video, timestamp);
      lastVideoTimeRef.current = timestamp;
    }
  }, []);

  return { videoRef, isReady, error, detectFrame };
}
