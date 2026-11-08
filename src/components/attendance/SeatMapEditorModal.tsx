import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { SeatingChart, SeatingBox, Student } from '@/types/database';
import { generateGridSeats, NormalizedBox } from '@/services/seatOccupancyService';
import { Trash2, PlusCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { toastError } from '@/lib/errors';

interface SeatMapEditorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  classId: string;
  className: string;
  students: Student[];
  onSaved?: () => void;
}

export const SeatMapEditorModal: React.FC<SeatMapEditorModalProps> = ({
  open,
  onOpenChange,
  classId,
  className,
  students,
  onSaved,
}) => {
  const [loading, setLoading] = useState<boolean>(false);
  const [chart, setChart] = useState<SeatingChart | null>(null);
  const [boxes, setBoxes] = useState<NormalizedBox[]>([]);
  const [selectedBoxIndex, setSelectedBoxIndex] = useState<number | null>(null);
  const [currentStudents, setCurrentStudents] = useState<Student[]>(students);

  // 網格快速產生器參數
  const [gridRows, setGridRows] = useState<number>(5);
  const [gridCols, setGridCols] = useState<number>(6);

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

  // 畫布參考
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const interactionRef = useRef<{
    mode: 'drag' | 'resize';
    index: number;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  } | null>(null);

  // 全域滑鼠監聽，防範游標移出畫布範圍導致拖曳或縮放卡死
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!interactionRef.current || !canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaX = (e.clientX - interactionRef.current.startX) / rect.width;
      const deltaY = (e.clientY - interactionRef.current.startY) / rect.height;
      const idx = interactionRef.current.index;

      setBoxes((prev) => {
        const copy = [...prev];
        const target = copy[idx];
        if (!target) return prev;

        if (interactionRef.current!.mode === 'drag') {
          const newX = Math.max(0, Math.min(1 - target.w_ratio, interactionRef.current!.origX + deltaX));
          const newY = Math.max(0, Math.min(1 - target.h_ratio, interactionRef.current!.origY + deltaY));
          copy[idx] = { ...target, x_ratio: newX, y_ratio: newY };
        } else {
          // resize (拖曳右下角把手縮放寬度與高度)
          const newW = Math.max(0.02, Math.min(1 - target.x_ratio, interactionRef.current!.origW + deltaX));
          const newH = Math.max(0.02, Math.min(1 - target.y_ratio, interactionRef.current!.origH + deltaY));
          copy[idx] = { ...target, w_ratio: newW, h_ratio: newH };
        }
        return copy;
      });
    };

    const handleGlobalMouseUp = () => {
      interactionRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

  // 鍵盤 Delete / Backspace 快速刪除選取座位
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (selectedBoxIndex === null) return;
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        setBoxes((prev) => prev.filter((_, i) => i !== selectedBoxIndex));
        setSelectedBoxIndex(null);
        toast.success('已刪除座位');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedBoxIndex]);

  // 載入當前班級的啟用座位表
  const loadSeatingChart = useCallback(async () => {
    if (!classId) return;
    setLoading(true);
    try {
      const { data: charts, error: chartError } = await supabase
        .from('seating_charts')
        .select('*')
        .eq('class_id', classId)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1);

      if (chartError) throw chartError;

      if (charts && charts.length > 0) {
        const currentChart = charts[0];
        setChart(currentChart);

        const { data: seatBoxes, error: boxError } = await supabase
          .from('seating_boxes')
          .select('*')
          .eq('chart_id', currentChart.id)
          .order('seat_label', { ascending: true });

        if (boxError) throw boxError;

        if (seatBoxes && seatBoxes.length > 0) {
          setBoxes(
            seatBoxes.map((b: SeatingBox) => ({
              id: b.id,
              seat_label: b.seat_label,
              student_id: b.student_id,
              x_ratio: b.x_ratio,
              y_ratio: b.y_ratio,
              w_ratio: b.w_ratio,
              h_ratio: b.h_ratio,
            }))
          );
        } else {
          // 若無座位框，預設產生 5x6
          setBoxes(generateGridSeats(5, 6));
        }
      } else {
        setChart(null);
        setBoxes(generateGridSeats(5, 6));
      }
    } catch (err: unknown) {
      toastError(err, '載入座位表失敗');
    } finally {
      setLoading(false);
    }
  }, [classId]);

  useEffect(() => {
    if (open) {
      loadSeatingChart();
      setSelectedBoxIndex(null);
    }
  }, [open, loadSeatingChart]);

  // 重新產生網格座位
  const handleGenerateGrid = () => {
    const generated = generateGridSeats(gridRows, gridCols);
    // 自動根據座號嘗試配對學生 (如果學生座號與 grid seat_label 相符)
    const bound = generated.map((b) => {
      const matched = currentStudents.find((s) => String(s.seat_number) === b.seat_label);
      return {
        ...b,
        student_id: matched ? matched.id : null,
      };
    });
    setBoxes(bound);
    setSelectedBoxIndex(null);
    toast.success(`已排好 ${gridRows} 排 × ${gridCols} 位的座位`);
  };

  // 滑鼠拖曳移動座位框
  const handleMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedBoxIndex(index);
    const box = boxes[index];
    interactionRef.current = {
      mode: 'drag',
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x_ratio,
      origY: box.y_ratio,
      origW: box.w_ratio,
      origH: box.h_ratio,
    };
  };

  // 滑鼠拖曳右下角縮放把手
  const handleResizeMouseDown = (e: React.MouseEvent, index: number) => {
    e.stopPropagation();
    setSelectedBoxIndex(index);
    const box = boxes[index];
    interactionRef.current = {
      mode: 'resize',
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x_ratio,
      origY: box.y_ratio,
      origW: box.w_ratio,
      origH: box.h_ratio,
    };
  };

  // 套用當前選中座位尺寸至全班座位
  const handleApplySizeToAll = () => {
    if (selectedBoxIndex === null) return;
    const current = boxes[selectedBoxIndex];
    if (!current) return;
    setBoxes((prev) =>
      prev.map((b) => ({
        ...b,
        w_ratio: Math.min(1 - b.x_ratio, current.w_ratio),
        h_ratio: Math.min(1 - b.y_ratio, current.h_ratio),
      }))
    );
    toast.success('所有座位都改成一樣大了');
  };

  // 刪除選取座位
  const handleDeleteSelectedBox = (idxToDelete: number) => {
    setBoxes((prev) => prev.filter((_, i) => i !== idxToDelete));
    setSelectedBoxIndex(null);
    toast.success('已刪除座位');
  };

  // 新增單一座位
  const handleAddSeat = () => {
    const existingLabels = boxes
      .map((b) => parseInt(b.seat_label || '0', 10))
      .filter((n) => !isNaN(n));
    const nextNum = existingLabels.length > 0 ? Math.max(...existingLabels) + 1 : boxes.length + 1;
    const defaultW = boxes.length > 0 ? boxes[0].w_ratio : 0.12;
    const defaultH = boxes.length > 0 ? boxes[0].h_ratio : 0.1;

    const newBox: NormalizedBox = {
      seat_label: String(nextNum),
      student_id: null,
      x_ratio: 0.44,
      y_ratio: 0.44,
      w_ratio: defaultW,
      h_ratio: defaultH,
    };
    setBoxes((prev) => [...prev, newBox]);
    setSelectedBoxIndex(boxes.length);
    toast.success(`已新增座位 [${nextNum}]`);
  };

  // 更新選取框的學生綁定（自動防重：若其他座位已被指派此學生，自動解除綁定）
  const handleAssignStudent = (studentId: string) => {
    if (selectedBoxIndex === null) return;
    const val = studentId === 'none' ? null : studentId;
    setBoxes((prev) =>
      prev.map((box, idx) => {
        if (idx === selectedBoxIndex) {
          return { ...box, student_id: val };
        }
        if (val !== null && box.student_id === val) {
          return { ...box, student_id: null };
        }
        return box;
      })
    );
  };

  // 儲存座位表回 Supabase
  const handleSave = async () => {
    if (!classId) return;
    setLoading(true);
    try {
      let chartId = chart?.id;

      if (!chartId) {
        // 新增啟用中的 seating_charts
        const { data: newChart, error: cErr } = await supabase
          .from('seating_charts')
          .insert({
            class_id: classId,
            name: `${className} 預設座位表`,
            aspect_ratio: '16:9',
            is_active: true,
          })
          .select()
          .single();

        if (cErr) throw cErr;
        chartId = newChart.id;
      }

      // 清除舊座位框並插入最新配置
      const { error: delErr } = await supabase
        .from('seating_boxes')
        .delete()
        .eq('chart_id', chartId);

      if (delErr) throw delErr;

      const recordsToInsert = boxes.map((b) => ({
        chart_id: chartId,
        student_id: b.student_id,
        seat_label: b.seat_label || '',
        x_ratio: b.x_ratio,
        y_ratio: b.y_ratio,
        w_ratio: b.w_ratio,
        h_ratio: b.h_ratio,
      }));

      const { error: insErr } = await supabase
        .from('seating_boxes')
        .insert(recordsToInsert);

      if (insErr) throw insErr;

      toast.success('座位表已儲存');
      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      toastError(err, '儲存失敗');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader>
          <DialogTitle>{className}　座位表</DialogTitle>
          <DialogDescription>
            這是教室的俯視圖。先排出座位，再指定每個座位坐哪位學生，點名時鏡頭就知道誰該坐在哪裡。
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 border-t border-border pt-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2">
              <Label htmlFor="seat-rows">幾排</Label>
              <Input
                id="seat-rows"
                type="number"
                min={1}
                max={10}
                value={gridRows}
                onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="seat-cols">每排幾位</Label>
              <Input
                id="seat-cols"
                type="number"
                min={1}
                max={12}
                value={gridCols}
                onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-20 text-center"
              />
            </div>
            <Button type="button" variant="outline" onClick={handleGenerateGrid}>
              自動排座位
            </Button>
            <Button type="button" variant="outline" onClick={handleAddSeat}>
              <PlusCircle aria-hidden="true" />
              加一個座位
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            「自動排座位」會重排所有座位。排好後，點一個座位就能移動、拉右下角調整大小，並指定學生。
          </p>

          {selectedBoxIndex !== null && boxes[selectedBoxIndex] && (
            <div className="flex flex-wrap items-end justify-between gap-3 rounded-md border border-border bg-secondary p-3">
              <div className="space-y-2">
                <Label htmlFor="seat-student">
                  座位 {boxes[selectedBoxIndex]?.seat_label} 坐的是
                </Label>
                <Select
                  value={boxes[selectedBoxIndex]?.student_id || 'none'}
                  onValueChange={handleAssignStudent}
                >
                  <SelectTrigger id="seat-student" className="w-52 bg-card">
                    <SelectValue placeholder="選擇學生" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">還沒指定</SelectItem>
                    {currentStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.seat_number} 號 {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" onClick={handleApplySizeToAll}>
                  <Copy aria-hidden="true" />
                  所有座位一樣大
                </Button>
                <Button type="button" variant="outline" onClick={() => handleDeleteSelectedBox(selectedBoxIndex)}>
                  <Trash2 aria-hidden="true" />
                  刪除這個座位
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* Seat canvas (16:9) */}
        <div
          ref={canvasContainerRef}
          onClick={() => setSelectedBoxIndex(null)}
          className="relative w-full aspect-video bg-neutral-950 border border-border rounded overflow-hidden select-none"
        >
          {/* 黑板 / 講台方向標示 */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-black/70 border border-white/30 text-white/80 text-[11px] tracking-widest rounded-sm pointer-events-none">
            黑板在這一側
          </div>

          {/* 互動座位方塊列表 */}
          {boxes.map((box, index) => {
            const isSelected = selectedBoxIndex === index;
            const assignedStudent = currentStudents.find((s) => s.id === box.student_id);

            return (
              <div
                key={box.id || index}
                onMouseDown={(e) => handleMouseDown(e, index)}
                onClick={(e) => e.stopPropagation()}
                style={{
                  left: `${box.x_ratio * 100}%`,
                  top: `${box.y_ratio * 100}%`,
                  width: `${box.w_ratio * 100}%`,
                  height: `${box.h_ratio * 100}%`,
                }}
                className={`absolute cursor-move flex flex-col items-center justify-center p-1 rounded border transition-colors ${
                  isSelected
                    ? 'border-[#e8c98b] bg-[#e8c98b]/25 ring-2 ring-[#e8c98b] z-10'
                    : 'border-white/60 bg-black/40 hover:border-white'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-white">
                  {box.seat_label}
                </span>
                <span className="text-[11px] font-medium text-neutral-50 truncate max-w-full">
                  {assignedStudent ? assignedStudent.name : '空位'}
                </span>

                {/* 右上角快速刪除按鈕 */}
                {isSelected && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteSelectedBox(index);
                    }}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-absent hover:bg-absent/90 text-white rounded-full flex items-center justify-center text-[10px] font-bold shadow-md z-20"
                    title="刪除這個座位"
                  >
                    ×
                  </button>
                )}

                {/* 右下角拖曳縮放把手 */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, index)}
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-card border-2 border-present rounded-sm cursor-se-resize shadow-md hover:scale-125 transition-transform z-20"
                    title="拖曳調整大小"
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between sm:space-x-0">
          <span className="text-sm text-muted-foreground">
            共 {boxes.length} 個座位。點座位可移動，拉右下角可調整大小。
          </span>
          <Button type="button" onClick={handleSave} disabled={loading}>
            {loading && <Spinner />}
            儲存座位表
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
