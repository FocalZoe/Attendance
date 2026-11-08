import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, ObjectDetector, Detection } from '@mediapipe/tasks-vision';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabase';
import { SeatingBox, Student } from '@/types/database';
import {
  CameraSource,
  isMobileDevice,
  getDesktopCameraSources,
  acquireCameraStream,
  stopMediaStream,
  AMEBA_DEVICE_ID,
} from '@/services/cameraDeviceService';
import {
  DetectedPerson,
  matchPersonsToSeats,
  SeatTemporalTracker,
  formatFullPeriodMessage,
  compileAttendanceRecords,
} from '@/services/seatOccupancyService';
import { PERIOD_OPTIONS } from '@/lib/periods';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Spinner } from '@/components/ui/spinner';
import { toast } from 'sonner';
import { toastError } from '@/lib/errors';

interface LiveAttendanceRollcallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  teacherId: string;
  students: Student[];
  /** 由課表提醒開啟時預選的節次 */
  initialPeriod?: string;
  onAttendanceCompleted?: () => void;
}

export const LiveAttendanceRollcall: React.FC<LiveAttendanceRollcallProps> = ({
  open,
  onOpenChange,
  classId,
  className,
  teacherId,
  students,
  initialPeriod,
  onAttendanceCompleted,
}) => {
  // 鏡頭來源清單與選取
  const [cameraSources, setCameraSources] = useState<CameraSource[]>([]);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [amebaIp, setAmebaIp] = useState<string>('192.168.1.100');
  const [isMobile, setIsMobile] = useState<boolean>(false);

  // 點名節次配置
  const [period, setPeriod] = useState<string>('1');

  // 狀態管理
  const [detectorReady, setDetectorReady] = useState<boolean>(false);
  const [cameraActive, setCameraActive] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [presentCount, setPresentCount] = useState<number>(0);
  const [currentStudents, setCurrentStudents] = useState<Student[]>(students);

  // 座位表資料與即時互動 Ref
  const [chartId, setChartId] = useState<string | null>(null);
  const [seatingBoxes, setSeatingBoxes] = useState<SeatingBox[]>([]);
  const seatingBoxesRef = useRef<SeatingBox[]>([]);
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [occupancies, setOccupancies] = useState<Record<string, boolean>>({});
  const lastOccupancyMapRef = useRef<Record<string, boolean>>({});

  // 自動儲存狀態
  const [autoSaveStatus, setAutoSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null);

  // 容器與指標互動參照
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    type: 'drag' | 'resize';
    boxId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  useEffect(() => {
    seatingBoxesRef.current = seatingBoxes;
  }, [seatingBoxes]);

  // 確保名冊永遠對應當前 classId，防範父層非同步傳入舊名冊造成錯置
  useEffect(() => {
    if (!classId || !open) return;
    let isCancelled = false;
    supabase
      .from('students')
      .select('*')
      .eq('class_id', classId)
      .order('seat_number', { ascending: true })
      .then(({ data, error }) => {
        if (!isCancelled && !error && data) {
          setCurrentStudents(data);
        }
      });
    return () => {
      isCancelled = true;
    };
  }, [classId, open]);

  // 元素與串流 Ref
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<ObjectDetector | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const trackerRef = useRef<SeatTemporalTracker>(new SeatTemporalTracker(800));
  const latestOccupancyRef = useRef<Map<string, boolean>>(new Map());
  const openRef = useRef<boolean>(open);

  // 1. 初始化設備與 MediaPipe 檢測器
  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);

    if (!mobile) {
      getDesktopCameraSources().then((sources) => {
        setCameraSources(sources);
        if (sources.length > 0) {
          setSelectedDeviceId(sources[0].id);
        }
      });
    }

    let cancelled = false;

    // 載入 MediaPipe ObjectDetector
    const createDetector = async (delegate: 'GPU' | 'CPU') => {
      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
      );
      return ObjectDetector.createFromOptions(vision, {
        baseOptions: {
          modelAssetPath:
            'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
          delegate,
        },
        scoreThreshold: 0.15,
        categoryAllowlist: ['person'],
        runningMode: 'VIDEO',
        maxResults: 50,
      });
    };

    const initDetector = async () => {
      let detector: ObjectDetector | null = null;
      try {
        detector = await createDetector('GPU');
      } catch (err) {
        console.warn('GPU delegate 初始化失敗，切換為 CPU:', err);
        try {
          detector = await createDetector('CPU');
        } catch (cpuErr) {
          console.error('MediaPipe 初始化失敗:', cpuErr);
          if (!cancelled) toast.error('鏡頭辨識功能載入失敗。請檢查網路後，關掉這個視窗再開一次。');
          return;
        }
      }
      // 初始化期間若已關閉或卸載，立即釋放，避免洩漏
      if (cancelled) {
        detector.close();
        return;
      }
      detectorRef.current = detector;
      setDetectorReady(true);
    };

    if (open) {
      initDetector();
    }

    return () => {
      cancelled = true;
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
      setDetectorReady(false);
    };
  }, [open]);

  // 2. 載入班級座位表
  const loadClassSeatingChart = useCallback(async () => {
    if (!classId) return;
    try {
      const { data: charts, error: cErr } = await supabase
        .from('seating_charts')
        .select('*')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (cErr) throw cErr;

      if (charts && charts.length > 0) {
        const activeChart = charts[0];
        setChartId(activeChart.id);

        const { data: boxes, error: bErr } = await supabase
          .from('seating_boxes')
          .select('*')
          .eq('chart_id', activeChart.id);

        if (bErr) throw bErr;
        setSeatingBoxes(boxes || []);
        seatingBoxesRef.current = boxes || [];
      } else {
        setChartId(null);
        setSeatingBoxes([]);
        seatingBoxesRef.current = [];
        toast.warning('這班還沒有座位表。請先關掉這個視窗，到班級列按「座位」排好座位。');
      }
    } catch (err: unknown) {
      toastError(err, '讀取座位表失敗。請關掉這個視窗再開一次。');
    }
  }, [classId]);

  // 自動儲存單一座位劃位變更至 Supabase
  const autoSaveBox = useCallback(async (boxToSave: SeatingBox) => {
    if (!boxToSave.id) return;
    setAutoSaveStatus('saving');
    try {
      const { error } = await supabase
        .from('seating_boxes')
        .update({
          x_ratio: boxToSave.x_ratio,
          y_ratio: boxToSave.y_ratio,
          w_ratio: boxToSave.w_ratio,
          h_ratio: boxToSave.h_ratio,
        })
        .eq('id', boxToSave.id);

      if (error) throw error;

      setAutoSaveStatus('saved');
      if (autoSaveTimerRef.current) clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = setTimeout(() => {
        setAutoSaveStatus('idle');
      }, 2500);
    } catch (err) {
      console.error('劃位自動儲存失敗:', err);
      setAutoSaveStatus('error');
      toast.error('座位儲存失敗。請檢查網路連線。');
    }
  }, []);

  // 全域指標監聽，支援拖曳移動與右下角把手縮放
  useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!interactionRef.current || !videoContainerRef.current) return;
      const rect = videoContainerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const { type, boxId, startX, startY, origX, origY, origW, origH } = interactionRef.current;
      const deltaX = (e.clientX - startX) / rect.width;
      const deltaY = (e.clientY - startY) / rect.height;

      setSeatingBoxes((prev) => {
        const copy = prev.map((box) => {
          if (box.id !== boxId) return box;
          if (type === 'drag') {
            const newX = Math.max(0, Math.min(1 - box.w_ratio, origX + deltaX));
            const newY = Math.max(0, Math.min(1 - box.h_ratio, origY + deltaY));
            return { ...box, x_ratio: newX, y_ratio: newY };
          } else {
            // resize
            const newW = Math.max(0.02, Math.min(1 - box.x_ratio, origW + deltaX));
            const newH = Math.max(0.02, Math.min(1 - box.y_ratio, origH + deltaY));
            return { ...box, w_ratio: newW, h_ratio: newH };
          }
        });
        seatingBoxesRef.current = copy;
        return copy;
      });
    };

    const handleGlobalPointerUp = () => {
      if (interactionRef.current) {
        const { boxId } = interactionRef.current;
        const targetBox = seatingBoxesRef.current.find((b) => b.id === boxId);
        if (targetBox) {
          autoSaveBox(targetBox);
        }
        interactionRef.current = null;
      }
    };

    window.addEventListener('pointermove', handleGlobalPointerMove);
    window.addEventListener('pointerup', handleGlobalPointerUp);

    return () => {
      window.removeEventListener('pointermove', handleGlobalPointerMove);
      window.removeEventListener('pointerup', handleGlobalPointerUp);
    };
  }, [autoSaveBox]);

  // 滑鼠/觸控按下座位框 (開始拖曳)
  const handleBoxPointerDown = (e: React.PointerEvent, boxId: string) => {
    e.stopPropagation();
    setSelectedBoxId(boxId);
    const box = seatingBoxesRef.current.find((b) => b.id === boxId);
    if (!box) return;

    interactionRef.current = {
      type: 'drag',
      boxId,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x_ratio,
      origY: box.y_ratio,
      origW: box.w_ratio,
      origH: box.h_ratio,
    };
  };

  // 滑鼠/觸控按下右下角縮放把手 (開始縮放)
  const handleResizePointerDown = (e: React.PointerEvent, boxId: string) => {
    e.stopPropagation();
    setSelectedBoxId(boxId);
    const box = seatingBoxesRef.current.find((b) => b.id === boxId);
    if (!box) return;

    interactionRef.current = {
      type: 'resize',
      boxId,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x_ratio,
      origY: box.y_ratio,
      origW: box.w_ratio,
      origH: box.h_ratio,
    };
  };

  useEffect(() => {
    openRef.current = open;
    if (open) {
      // 重置上一場次殘留的偵測與選取狀態
      if (initialPeriod) setPeriod(initialPeriod);
      setCameraActive(false);
      setOccupancies({});
      setPresentCount(0);
      setSelectedBoxId(null);
      lastOccupancyMapRef.current = {};
      latestOccupancyRef.current = new Map();
      loadClassSeatingChart();
      trackerRef.current.reset();
    } else {
      // 關閉彈窗時釋放相機
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
        streamRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
      setCameraActive(false);
    }

    return () => {
      // 元件卸載 (Unmount) 時確實驗收硬體串流與動畫幀，防範記憶體與鏡頭佔用洩漏
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
        streamRef.current = null;
      }
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
        animationFrameIdRef.current = null;
      }
    };
  }, [open, loadClassSeatingChart, initialPeriod]);

  // 3. 啟動鏡頭串流
  const handleStartCamera = async () => {
    try {
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
      }

      const stream = await acquireCameraStream(selectedDeviceId, amebaIp);
      // 等待授權期間對話框已關閉：立即釋放，避免鏡頭持續佔用
      if (!openRef.current) {
        stopMediaStream(stream);
        return;
      }
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
        };
      }
    } catch (err: unknown) {
      const name = err instanceof Error ? err.name : '';
      toast.error(
        name === 'NotAllowedError'
          ? '瀏覽器沒有允許使用鏡頭。請按網址列旁的鎖頭圖示，把「相機」改成允許，再按一次「開啟鏡頭」。'
          : name === 'NotFoundError'
          ? '找不到鏡頭。請確認鏡頭已接上，再按一次「開啟鏡頭」。'
          : '無法開啟鏡頭。請確認沒有其他程式正在使用鏡頭，再試一次。'
      );
      setCameraActive(false);
    }
  };

  // 4. 影像辨識主循環與 Canvas 即時渲染
  useEffect(() => {
    if (!cameraActive || !detectorReady) return;

    let isRunning = true;

    const renderLoop = () => {
      if (!isRunning) return;

      const video = videoRef.current;
      const canvas = canvasRef.current;
      const detector = detectorRef.current;

      if (video && canvas && detector && video.readyState >= 2) {
        const vw = video.videoWidth;
        const vh = video.videoHeight;

        if (vw > 0 && vh > 0) {
          if (canvas.width !== vw || canvas.height !== vh) {
            canvas.width = vw;
            canvas.height = vh;
          }
          const ctx = canvas.getContext('2d');

          if (ctx) {
            ctx.clearRect(0, 0, vw, vh);

            // 執行 MediaPipe 偵測
            const now = performance.now();
            let detections: Detection[] = [];
            try {
              const result = detector.detectForVideo(video, now);
              detections = result.detections;
            } catch {
              // 略過單幀推論超時異常
            }

            // 格式化人體邊界框
            const detectedPersons: DetectedPerson[] = detections
              .filter((d) => d.boundingBox)
              .map((d) => ({
                originX: d.boundingBox!.originX,
                originY: d.boundingBox!.originY,
                width: d.boundingBox!.width,
                height: d.boundingBox!.height,
                score: d.categories[0]?.score || 0,
              }));

            // 繪製 AI 人體邊界框（以半透明琥珀金邊框標示，便於老師對齊鏡頭）
            for (const person of detectedPersons) {
              const px = person.originX > 1 ? person.originX : person.originX * vw;
              const py = person.originY > 1 ? person.originY : person.originY * vh;
              const pw = person.width > 1 ? person.width : person.width * vw;
              const ph = person.height > 1 ? person.height : person.height * vh;

              ctx.strokeStyle = 'rgba(250, 204, 21, 0.7)';
              ctx.lineWidth = 1.5;
              ctx.strokeRect(px, py, pw, ph);

              ctx.font = '10px monospace';
              ctx.fillStyle = 'rgba(250, 204, 21, 0.9)';
              ctx.fillText(`人 ${(person.score * 100).toFixed(0)}%`, px + 4, py + 12);
            }

            // 執行幾何匹配
            const currentBoxes = seatingBoxesRef.current;
            const matchResults = matchPersonsToSeats(
              currentBoxes,
              detectedPersons,
              { width: vw, height: vh },
              0.15
            );

            // 時序平滑追蹤
            const occupancyMap = trackerRef.current.update(matchResults, Date.now());
            latestOccupancyRef.current = occupancyMap;

            let occupiedCount = 0;
            let occChanged = false;

            for (const box of currentBoxes) {
              const isOccupied = occupancyMap.get(box.id) || false;
              if (isOccupied) occupiedCount++;
              if (isOccupied !== lastOccupancyMapRef.current[box.id]) {
                occChanged = true;
              }
            }

            if (occChanged) {
              const nextOcc: Record<string, boolean> = {};
              for (const box of currentBoxes) {
                nextOcc[box.id] = occupancyMap.get(box.id) || false;
              }
              lastOccupancyMapRef.current = nextOcc;
              setOccupancies(nextOcc);
            }

            setPresentCount((prev) => (prev !== occupiedCount ? occupiedCount : prev));
          }
        }
      }

      animationFrameIdRef.current = requestAnimationFrame(renderLoop);
    };

    animationFrameIdRef.current = requestAnimationFrame(renderLoop);

    return () => {
      isRunning = false;
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
    };
  }, [cameraActive, detectorReady]);

  // 5. 確認點名並寫入資料庫與快照
  const handleConfirmAttendance = async () => {
    if (!classId || !teacherId) return;
    if (seatingBoxes.length === 0) {
      toast.error('這班還沒有座位表，無法點名。請先到班級列按「座位」排好座位。');
      return;
    }

    setIsSaving(true);
    try {
      const now = new Date();
      const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
      const video = videoRef.current;
      let snapshotPath: string | null = null;

      // 截取當前畫面產生快照圖片 Blob
      if (video && video.videoWidth > 0 && video.videoHeight > 0) {
        const offCanvas = document.createElement('canvas');
        offCanvas.width = video.videoWidth;
        offCanvas.height = video.videoHeight;
        const offCtx = offCanvas.getContext('2d');
        if (offCtx) {
          offCtx.drawImage(video, 0, 0);
          const blob = await new Promise<Blob | null>((resolve) =>
            offCanvas.toBlob(resolve, 'image/jpeg', 0.85)
          );

          if (blob) {
            const fileName = `${classId}/${today}_period${period}_${Date.now()}.jpg`;
            const { error: uploadErr } = await supabase.storage
              .from('attendance-snapshots')
              .upload(fileName, blob, {
                contentType: 'image/jpeg',
                upsert: true,
              });

            if (!uploadErr) {
              snapshotPath = fileName;
            } else {
              console.warn('快照上傳失敗:', uploadErr.message);
            }
          }
        }
      }

      // 建立 attendance_sessions 紀錄
      const { data: sessionData, error: sessionErr } = await supabase
        .from('attendance_sessions')
        .insert({
          class_id: classId,
          teacher_id: teacherId,
          chart_id: chartId,
          session_date: today,
          period,
          snapshot_path: snapshotPath,
          detection_raw_json: {
            totalSeats: seatingBoxes.length,
            presentCount,
            timestamp: new Date().toISOString(),
          },
        })
        .select()
        .single();

      if (sessionErr) throw sessionErr;

      // 建立各學生之 attendance_records 紀錄（全班母體收斂、去重並涵蓋未劃位學生）
      const recordsToInsert = compileAttendanceRecords(
        currentStudents,
        seatingBoxes,
        latestOccupancyRef.current
      ).map((rec) => ({
        session_id: sessionData.id,
        student_id: rec.student_id,
        status: rec.status,
        ai_detected_status: rec.ai_detected_status,
        is_overridden: rec.is_overridden,
        note: rec.note,
      }));

      if (recordsToInsert.length > 0) {
        const { error: recErr } = await supabase
          .from('attendance_records')
          .insert(recordsToInsert);

        if (recErr) {
          // 若明細寫入失敗，立即清理該場次，防範留下無明細的孤兒 session
          await supabase.from('attendance_sessions').delete().eq('id', sessionData.id);
          throw recErr;
        }
      }

      const actualPresent = recordsToInsert.filter((r) => r.status === 'present').length;
      toast.success(
        `點名完成！${formatFullPeriodMessage(today, period)} · 實到 ${actualPresent} / 應到 ${recordsToInsert.length}`
      );

      onAttendanceCompleted?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toastError(err, '寫入點名資料失敗');
    } finally {
      setIsSaving(false);
    }
  };

  const selectedBox = seatingBoxes.find((b) => b.id === selectedBoxId);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* 手機與平板直式：滿版；寬螢幕：置中對話框 */}
      <DialogContent
        scroll={false}
        className="flex h-[100dvh] max-h-none w-screen max-w-none flex-col gap-4 rounded-none p-4 sm:h-auto sm:max-h-[calc(100dvh-1.5rem)] sm:w-[calc(100%-1.5rem)] sm:max-w-4xl sm:rounded-lg sm:p-6"
      >
        <DialogHeader>
          <DialogTitle>{className}　點名</DialogTitle>
          <DialogDescription>
            三個步驟：① 按「開啟鏡頭」，對準教室　② 看每個座位標示的「在座／無人」對不對，不對可以拖曳座位框修正　③ 按「完成點名」存檔。
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1" viewportClassName="max-h-[calc(100dvh-12rem)]">
        <div className="space-y-4">
        {/* 設定列 */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="rc-camera">鏡頭</Label>
            {isMobile ? (
              <Select value="mobile_env" onValueChange={() => {}}>
                <SelectTrigger id="rc-camera">
                  <SelectValue placeholder="行動裝置鏡頭" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_env">後置鏡頭</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger id="rc-camera">
                  <SelectValue placeholder="選擇鏡頭" />
                </SelectTrigger>
                <SelectContent>
                  {cameraSources.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!isMobile && selectedDeviceId === AMEBA_DEVICE_ID && (
            <div className="space-y-2">
              <Label htmlFor="rc-ameba-ip">網路攝影機位址</Label>
              <Input
                id="rc-ameba-ip"
                type="text"
                value={amebaIp}
                onChange={(e) => setAmebaIp(e.target.value)}
                placeholder="192.168.1.100"
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="rc-period">節次</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger id="rc-period">
                <SelectValue placeholder="選擇節次" />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((p) => (
                  <SelectItem key={p.value} value={p.value}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {selectedBox && (
          <p className="rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground">
            <span className="font-bold">座位 {selectedBox.seat_label}</span>
            <span className="ml-2 text-muted-foreground">拖曳移動，拉右下角縮放，放開後自動儲存。</span>
          </p>
        )}

        {/* 影像與座位疊圖：影像區固定使用深色，不隨主題變動 */}
        <div
          ref={videoContainerRef}
          onClick={() => setSelectedBoxId(null)}
          className="relative aspect-video w-full select-none overflow-hidden rounded-lg border border-border bg-neutral-950 touch-none"
        >
          <video ref={videoRef} playsInline muted className="h-full w-full object-cover" />
          <canvas ref={canvasRef} className="pointer-events-none absolute inset-0 h-full w-full" />

          {cameraActive &&
            seatingBoxes.map((box) => {
              const isSelected = selectedBoxId === box.id;
              const isOccupied = occupancies[box.id] || false;
              const assignedStudent = currentStudents.find((s) => s.id === box.student_id);

              return (
                <div
                  key={box.id}
                  onPointerDown={(e) => handleBoxPointerDown(e, box.id)}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBoxId(box.id);
                  }}
                  style={{
                    left: `${box.x_ratio * 100}%`,
                    top: `${box.y_ratio * 100}%`,
                    width: `${box.w_ratio * 100}%`,
                    height: `${box.h_ratio * 100}%`,
                  }}
                  className={cn(
                    'absolute flex cursor-move select-none flex-col justify-between rounded-sm border-2 p-1 transition-colors',
                    isSelected
                      ? 'z-20 border-[#e8c98b] bg-[#e8c98b]/25'
                      : isOccupied
                      ? 'z-10 border-[#8fba87] bg-[#8fba87]/25'
                      : 'z-10 border-white/60 bg-black/40'
                  )}
                >
                  <div className="pointer-events-none flex items-center justify-between gap-1">
                    <span className="tabular text-[11px] font-bold text-white">{box.seat_label}</span>
                    <span
                      className={cn(
                        'rounded-sm px-1 text-[10px] font-bold',
                        isOccupied ? 'bg-[#3f6b3a] text-white' : 'bg-black/70 text-white'
                      )}
                    >
                      {isOccupied ? '在座' : '無人'}
                    </span>
                  </div>
                  <div className="pointer-events-none max-w-full truncate text-xs font-medium text-white">
                    {assignedStudent ? assignedStudent.name : '空位'}
                  </div>

                  {isSelected && (
                    <div
                      onPointerDown={(e) => handleResizePointerDown(e, box.id)}
                      className="pointer-events-auto absolute -bottom-2 -right-2 z-30 h-5 w-5 cursor-se-resize rounded-sm border-2 border-[#e8c98b] bg-white"
                      title="拖曳以縮放座位"
                    />
                  )}
                </div>
              );
            })}

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-neutral-950/90 p-4 text-center text-white">
              <p className="max-w-xs text-sm text-white/80">
                {detectorReady ? '還沒有開啟鏡頭。開啟後，系統會即時判斷每個座位有沒有人。' : '正在載入辨識模型，請稍候。'}
              </p>
              <Button type="button" onClick={handleStartCamera} disabled={!detectorReady}>
                {detectorReady ? '開啟鏡頭' : '載入中'}
              </Button>
            </div>
          )}
        </div>

        </div>
        </ScrollArea>

        <DialogFooter className="mt-auto flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <p className="text-sm text-foreground">
              <span className="tabular font-display text-2xl font-bold text-present">{presentCount}</span>
              <span className="tabular text-muted-foreground"> / {seatingBoxes.length} 個座位有人</span>
            </p>
            {autoSaveStatus === 'saving' && (
              <span className="flex items-center text-sm text-muted-foreground">
                <Loader2 className="mr-1 h-4 w-4 animate-spin" aria-hidden="true" />
                正在儲存座位
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="flex items-center text-sm text-present">
                <CheckCircle2 className="mr-1 h-4 w-4" aria-hidden="true" />
                座位已儲存
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              onClick={handleConfirmAttendance}
              disabled={!cameraActive || isSaving}
              className="flex-1 sm:flex-none"
            >
              {isSaving && <Spinner />}
              完成點名
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
