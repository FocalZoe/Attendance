import { useState, useEffect, useRef, useCallback } from 'react';
import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';

let detectorInstance = null;
let detectorLoadingPromise = null;

export const getSharedPersonDetector = async () => {
  if (detectorInstance) return detectorInstance;
  if (!detectorLoadingPromise) {
    detectorLoadingPromise = (async () => {
      try {
        const vision = await FilesetResolver.forVisionTasks(
          'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
        );
        const detector = await ObjectDetector.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          scoreThreshold: 0.10,
          maxResults: 50,
          categoryAllowlist: ['person'],
        });
        detectorInstance = detector;
        return detector;
      } catch (err) {
        console.warn('[useMediaPipe] MediaPipe init warning:', err);
        return null;
      }
    })();
  }
  return detectorLoadingPromise;
};

export const useMediaPipe = () => {
  const [detector, setDetector] = useState(detectorInstance);
  const [isLoading, setIsLoading] = useState(!detectorInstance);
  const lastVideoTimeRef = useRef(-1);
  const lastDetectionsRef = useRef([]);
  const lastDetectionTimeRef = useRef(0);
  const lastDetectionTimestampRef = useRef(0);

  useEffect(() => {
    let active = true;
    getSharedPersonDetector().then((inst) => {
      if (active) {
        setDetector(inst);
        setIsLoading(false);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const detectFrame = useCallback(
    (video) => {
      if (!detector || !video || video.readyState < 2 || video.videoWidth === 0) {
        return lastDetectionsRef.current;
      }

      const now = performance.now();
      if (video.currentTime !== lastVideoTimeRef.current) {
        lastVideoTimeRef.current = video.currentTime;
        try {
          const safeTimestamp = Math.max(now, lastDetectionTimestampRef.current + 1);
          lastDetectionTimestampRef.current = safeTimestamp;

          const results = detector.detectForVideo(video, safeTimestamp);
          const newDetections = results.detections || [];
          if (newDetections.length > 0) {
            lastDetectionsRef.current = newDetections;
            lastDetectionTimeRef.current = now;
          } else if (now - lastDetectionTimeRef.current > 400) {
            lastDetectionsRef.current = [];
          }
        } catch (e) {
          console.warn('[useMediaPipe] detectForVideo exception:', e);
        }
      }

      return lastDetectionsRef.current;
    },
    [detector]
  );

  return {
    detector,
    isLoading,
    detectFrame,
    lastDetectionsRef,
  };
};
