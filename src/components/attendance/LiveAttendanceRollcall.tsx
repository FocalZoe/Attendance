import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FilesetResolver, ObjectDetector, Detection } from '@mediapipe/tasks-vision';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
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
import { Loader2, CheckCircle2, ZoomIn, ZoomOut } from 'lucide-react';
import { toast } from 'sonner';

interface LiveAttendanceRollcallProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  teacherId: string;
  students: Student[];
  onAttendanceCompleted?: () => void;
}

export const LiveAttendanceRollcall: React.FC<LiveAttendanceRollcallProps> = ({
  open,
  onOpenChange,
  classId,
  className,
  teacherId,
  students,
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

  // 1. 初始化設備與 MediaPipe 檢測器
  useEffect(() => {
    const mobile = isMobileDevice();
    setIsMobile(mobile);

    if (!mobile) {
      getDesktopCameraSources().then((sources) => {
        setCameraSources(sources);
        if (sources.length > 0) {
          setSelectedDeviceId(sources[0].deviceId);
        }
      });
    }

    // 載入 MediaPipe ObjectDetector
    const initDetector = async () => {
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
          scoreThreshold: 0.15,
          categoryAllowlist: ['person'],
          runningMode: 'VIDEO',
          maxResults: 50,
        });
        detectorRef.current = detector;
        setDetectorReady(true);
      } catch (err) {
        console.warn('GPU delegate 初始化失敗，切換為 CPU:', err);
        try {
          const vision = await FilesetResolver.forVisionTasks(
            'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.18/wasm'
          );
          const detector = await ObjectDetector.createFromOptions(vision, {
            baseOptions: {
              modelAssetPath:
                'https://storage.googleapis.com/mediapipe-models/object_detector/efficientdet_lite0/float16/1/efficientdet_lite0.tflite',
              delegate: 'CPU',
            },
            scoreThreshold: 0.15,
            categoryAllowlist: ['person'],
            runningMode: 'VIDEO',
            maxResults: 50,
          });
          detectorRef.current = detector;
          setDetectorReady(true);
        } catch (cpuErr) {
          console.error('MediaPipe 初始化失敗:', cpuErr);
          toast.error('無法載入 AI 影像模型，請檢查網路連線');
        }
      }
    };

    if (open) {
      initDetector();
    }

    return () => {
      if (detectorRef.current) {
        detectorRef.current.close();
        detectorRef.current = null;
      }
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
        toast.warning('此班級尚未建立座位表，請先於「教室劃位」建立劃位');
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '載入劃位資料失敗';
      toast.error(msg);
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
      toast.error('劃位自動儲存失敗，請檢查網路連線');
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

  // 點名視窗中的快捷放大 / 縮小
  const handleScaleBoxInRollcall = (boxId: string, factor: number) => {
    let updatedTarget: SeatingBox | null = null;
    setSeatingBoxes((prev) => {
      const copy = prev.map((box) => {
        if (box.id !== boxId) return box;
        const newW = Math.max(0.02, Math.min(1 - box.x_ratio, box.w_ratio * factor));
        const newH = Math.max(0.02, Math.min(1 - box.y_ratio, box.h_ratio * factor));
        updatedTarget = { ...box, w_ratio: newW, h_ratio: newH };
        return updatedTarget;
      });
      seatingBoxesRef.current = copy;
      return copy;
    });
    if (updatedTarget) {
      autoSaveBox(updatedTarget);
    }
  };

  useEffect(() => {
    if (open) {
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
  }, [open, loadClassSeatingChart]);

  // 3. 啟動鏡頭串流
  const handleStartCamera = async () => {
    try {
      if (streamRef.current) {
        stopMediaStream(streamRef.current);
      }

      const stream = await acquireCameraStream(selectedDeviceId, amebaIp);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.onloadedmetadata = () => {
          videoRef.current?.play();
          setCameraActive(true);
        };
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '啟動相機失敗';
      toast.error(msg);
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
              ctx.fillText(`AI ${(person.score * 100).toFixed(0)}%`, px + 4, py + 12);
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
      toast.error('無有效座位表，無法執行點名');
      return;
    }

    setIsSaving(true);
    try {
      const today = new Date().toISOString().split('T')[0];
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
      const msg = err instanceof Error ? err.message : '寫入點名資料失敗';
      toast.error(msg);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl p-6 bg-white border border-slate-300">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-800">
            AI 視覺即時點名系統 · {className}
          </DialogTitle>
        </DialogHeader>

        {/* 控制工具列 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 py-2 border-b border-slate-100">
          <div>
            <Label className="text-xs text-slate-500 mb-1 block">鏡頭來源</Label>
            {isMobile ? (
              <Select value="mobile_env" onValueChange={() => {}}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="行動裝置鏡頭" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="mobile_env">行動後置鏡頭 (環境)</SelectItem>
                </SelectContent>
              </Select>
            ) : (
              <Select value={selectedDeviceId} onValueChange={setSelectedDeviceId}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="選擇鏡頭設備" />
                </SelectTrigger>
                <SelectContent>
                  {cameraSources.map((s) => (
                    <SelectItem key={s.deviceId} value={s.deviceId}>
                      {s.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {!isMobile && selectedDeviceId === AMEBA_DEVICE_ID && (
            <div>
              <Label className="text-xs text-slate-500 mb-1 block">Ameba 鏡頭 IP</Label>
              <Input
                type="text"
                value={amebaIp}
                onChange={(e) => setAmebaIp(e.target.value)}
                placeholder="192.168.1.100"
                className="h-8 text-xs"
              />
            </div>
          )}

          <div>
            <Label className="text-xs text-slate-500 mb-1 block">點名節次</Label>
            <Select value={period} onValueChange={setPeriod}>
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="選擇節次" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="morning">晨間點名</SelectItem>
                <SelectItem value="1">第 1 節</SelectItem>
                <SelectItem value="2">第 2 節</SelectItem>
                <SelectItem value="3">第 3 節</SelectItem>
                <SelectItem value="4">第 4 節</SelectItem>
                <SelectItem value="afternoon">午後點名</SelectItem>
                <SelectItem value="5">第 5 節</SelectItem>
                <SelectItem value="6">第 6 節</SelectItem>
                <SelectItem value="7">第 7 節</SelectItem>
                <SelectItem value="8">第 8 節</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* 正在微調選取座位時之快捷控制列 */}
        {selectedBoxId && (
          <div className="flex items-center justify-between bg-blue-50/90 border border-blue-200 px-3 py-1.5 rounded text-xs">
            <div className="flex items-center gap-2">
              <span className="font-bold text-blue-900">
                微調座位 [{seatingBoxes.find((b) => b.id === selectedBoxId)?.seat_label}]：
              </span>
              <span className="text-blue-700 text-[11px]">
                在畫面上拖曳可移動位置，拉右下角把手可縮放，放開後自動儲存
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleScaleBoxInRollcall(selectedBoxId, 1.1)}
                className="h-7 px-2 text-xs bg-white text-blue-700 hover:bg-blue-100"
                title="放大此座位"
              >
                <ZoomIn className="w-3.5 h-3.5 mr-1" />
                放大
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => handleScaleBoxInRollcall(selectedBoxId, 0.9)}
                className="h-7 px-2 text-xs bg-white text-blue-700 hover:bg-blue-100"
                title="縮小此座位"
              >
                <ZoomOut className="w-3.5 h-3.5 mr-1" />
                縮小
              </Button>
            </div>
          </div>
        )}

        {/* 視訊預覽與檢測繪製區 (16:9) */}
        <div
          ref={videoContainerRef}
          onClick={() => setSelectedBoxId(null)}
          className="relative w-full aspect-video bg-slate-950 border border-slate-300 rounded overflow-hidden select-none"
        >
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {/* 鏡頭啟用時的即時劃位互動圖層 */}
          {cameraActive && seatingBoxes.map((box) => {
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
                className={`absolute cursor-move flex flex-col justify-between p-1 rounded border transition-colors select-none ${
                  isSelected
                    ? 'border-blue-400 bg-blue-500/25 ring-2 ring-blue-400 z-20'
                    : isOccupied
                    ? 'border-emerald-500 bg-emerald-500/20 hover:border-emerald-400 z-10'
                    : 'border-slate-500 bg-slate-900/40 hover:border-slate-400 z-10'
                }`}
              >
                <div className="flex items-center justify-between pointer-events-none">
                  <span className="text-[10px] font-mono font-bold text-slate-200">
                    {box.seat_label}
                  </span>
                  <span
                    className={`text-[9px] font-mono px-1 rounded ${
                      isOccupied ? 'bg-emerald-600/90 text-white font-bold' : 'bg-slate-700/80 text-slate-300'
                    }`}
                  >
                    {isOccupied ? '● 在座' : '○ 缺席'}
                  </span>
                </div>
                <div className="text-[11px] font-medium text-white truncate max-w-full pointer-events-none">
                  {assignedStudent ? assignedStudent.name : '（空位）'}
                </div>

                {/* 右下角拖曳縮放把手 */}
                {isSelected && (
                  <div
                    onPointerDown={(e) => handleResizePointerDown(e, box.id)}
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-white border-2 border-blue-500 rounded-sm cursor-se-resize shadow-md hover:scale-125 transition-transform z-30 pointer-events-auto"
                    title="拖曳右下角把手以縮放座位尺寸（放開後自動儲存）"
                  />
                )}
              </div>
            );
          })}

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-slate-300">
              <span className="text-sm mb-3">鏡頭尚未啟動</span>
              <Button
                type="button"
                onClick={handleStartCamera}
                disabled={!detectorReady}
                className="text-xs"
              >
                {detectorReady ? '開啟鏡頭並啟動 AI' : 'AI 引擎載入中...'}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter className="border-t border-slate-200 pt-3 flex justify-between items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700">
              偵測到出席：<span className="text-emerald-600 font-bold">{presentCount}</span> / 總座位 {seatingBoxes.length}
            </span>
            {autoSaveStatus === 'saving' && (
              <span className="text-xs text-amber-600 flex items-center font-medium">
                <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                劃位自動儲存中...
              </span>
            )}
            {autoSaveStatus === 'saved' && (
              <span className="text-xs text-emerald-600 flex items-center font-medium">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                劃位已自動儲存
              </span>
            )}
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
              className="text-xs"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleConfirmAttendance}
              disabled={!cameraActive || isSaving}
              className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSaving ? '儲存中...' : '確認完成點名'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
