import { ObjectDetector, FilesetResolver } from '@mediapipe/tasks-vision';

export interface BoundingBox {
  originX: number;
  originY: number;
  width: number;
  height: number;
}

export interface DetectionCategory {
  score: number;
  categoryName: string;
}

export interface PersonDetection {
  boundingBox?: BoundingBox;
  categories?: DetectionCategory[];
  [key: string]: any;
}

let detectorInstance: ObjectDetector | null = null;
let detectorLoadingPromise: Promise<ObjectDetector | null> | null = null;

/**
 * 取得共用之 MediaPipe 人員偵測器實例 (單例模式)
 */
export const getSharedPersonDetector = async (): Promise<ObjectDetector | null> => {
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
        console.warn('[PersonDetector] MediaPipe 初始化失敗:', err);
        return null;
      }
    })();
  }
  return detectorLoadingPromise;
};
