import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { SeatingChart, SeatingBox, Student } from '@/types/database';
import { generateGridSeats, NormalizedBox } from '@/services/seatOccupancyService';
import { ZoomIn, ZoomOut, Trash2, PlusCircle, Copy } from 'lucide-react';
import { toast } from 'sonner';

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
      const msg = err instanceof Error ? err.message : '載入座位表失敗';
      toast.error(msg);
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
    toast.success(`已重新產生 ${gridRows} × ${gridCols} 座位網格`);
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

  // 放大 / 縮小特定比例（按鈕點擊）
  const handleScaleSelectedBox = (factor: number) => {
    if (selectedBoxIndex === null) return;
    setBoxes((prev) => {
      const copy = [...prev];
      const target = copy[selectedBoxIndex];
      if (!target) return prev;
      const newW = Math.max(0.02, Math.min(1 - target.x_ratio, target.w_ratio * factor));
      const newH = Math.max(0.02, Math.min(1 - target.y_ratio, target.h_ratio * factor));
      copy[selectedBoxIndex] = { ...target, w_ratio: newW, h_ratio: newH };
      return copy;
    });
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
    toast.success('已將當前座位尺寸套用至全班座位');
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

      toast.success('座位表已成功儲存');
      onSaved?.();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : '儲存失敗';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl">
        <DialogHeader className="border-b border-border pb-3">
          <DialogTitle className="text-lg font-bold text-foreground">
            教室劃位管理 · {className}
          </DialogTitle>
        </DialogHeader>

        {/* 頂部操作工具列 */}
        <div className="space-y-2 py-2 border-b border-border">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">產生網格：</span>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">列</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={gridRows}
                  onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 h-8 text-center text-xs"
                />
              </div>
              <div className="flex items-center gap-1">
                <Label className="text-xs text-muted-foreground">行</Label>
                <Input
                  type="number"
                  min={1}
                  max={12}
                  value={gridCols}
                  onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-14 h-8 text-center text-xs"
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleGenerateGrid}
                className="h-8 text-xs font-medium"
              >
                重新產生網格
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddSeat}
                className="h-8 text-xs font-medium text-present hover:text-present"
              >
                <PlusCircle className="w-3.5 h-3.5 mr-1" />
                新增座位
              </Button>
            </div>
          </div>

          {selectedBoxIndex !== null && boxes[selectedBoxIndex] && (
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 bg-secondary border border-border rounded text-xs">
              <div className="flex items-center gap-2">
                <span className="font-bold text-foreground">
                  座位 [{boxes[selectedBoxIndex]?.seat_label}]：
                </span>
                <Select
                  value={boxes[selectedBoxIndex]?.student_id || 'none'}
                  onValueChange={handleAssignStudent}
                >
                  <SelectTrigger className="w-40 h-8 text-xs bg-card">
                    <SelectValue placeholder="綁定學生" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- 無指定學生 --</SelectItem>
                    {currentStudents.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.seat_number} 號 {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 縮放與尺寸調整群組 */}
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">
                  寬 {Math.round(boxes[selectedBoxIndex].w_ratio * 100)}% × 高 {Math.round(boxes[selectedBoxIndex].h_ratio * 100)}%
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleScaleSelectedBox(1.1)}
                  className="h-7 px-2 text-xs"
                  title="放大座位 (或直接拖曳右下角把手)"
                >
                  <ZoomIn className="w-3.5 h-3.5 mr-1" />
                  放大
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleScaleSelectedBox(0.9)}
                  className="h-7 px-2 text-xs"
                  title="縮小座位 (或直接拖曳右下角把手)"
                >
                  <ZoomOut className="w-3.5 h-3.5 mr-1" />
                  縮小
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleApplySizeToAll}
                  className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
                  title="將此座位的寬高套用至全班所有座位"
                >
                  <Copy className="w-3.5 h-3.5 mr-1" />
                  套用全班
                </Button>
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteSelectedBox(selectedBoxIndex)}
                  className="h-7 px-2.5 text-xs bg-absent hover:bg-absent/90"
                  title="刪除此座位 (可按鍵盤 Delete 鍵)"
                >
                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                  刪除座位
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* 劃位畫布主體 (16:9 比例) */}
        <div
          ref={canvasContainerRef}
          onClick={() => setSelectedBoxIndex(null)}
          className="relative w-full aspect-video bg-neutral-950 border border-border rounded overflow-hidden select-none"
        >
          {/* 黑板 / 講台方向標示 */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-black/70 border border-white/30 text-white/80 text-[11px] font-mono tracking-widest rounded-sm pointer-events-none">
            [ 講台 / 黑板方向 ]
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
                  {assignedStudent ? assignedStudent.name : '（空位）'}
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
                    title="刪除此座位 (Delete)"
                  >
                    ×
                  </button>
                )}

                {/* 右下角拖曳縮放把手 */}
                {isSelected && (
                  <div
                    onMouseDown={(e) => handleResizeMouseDown(e, index)}
                    className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-card border-2 border-present rounded-sm cursor-se-resize shadow-md hover:scale-125 transition-transform z-20"
                    title="拖曳右下角把手以縮放座位尺寸"
                  />
                )}
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t border-border pt-3 flex justify-between items-center sm:justify-between">
          <span className="text-xs text-muted-foreground">
            共 {boxes.length} 個座位 · 點選座位可拖曳移動、拉右下角可放大縮小、按 Delete 鍵可刪除
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              className="text-xs"
            >
              取消
            </Button>
            <Button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="text-xs"
            >
              {loading ? '儲存中...' : '儲存劃位配置'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
