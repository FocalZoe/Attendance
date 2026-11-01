import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/lib/supabase';
import { SeatingChart, SeatingBox, Student } from '@/types/database';
import { generateGridSeats, NormalizedBox } from '@/services/seatOccupancyService';
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
  const isDraggingRef = useRef<{ index: number; startX: number; startY: number; origX: number; origY: number } | null>(null);

  // 全域滑鼠監聽，防範游標移出畫布範圍導致拖曳卡死
  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!isDraggingRef.current || !canvasContainerRef.current) return;
      const rect = canvasContainerRef.current.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const deltaX = (e.clientX - isDraggingRef.current.startX) / rect.width;
      const deltaY = (e.clientY - isDraggingRef.current.startY) / rect.height;

      const idx = isDraggingRef.current.index;
      setBoxes((prev) => {
        const copy = [...prev];
        const target = copy[idx];
        if (!target) return prev;
        const newX = Math.max(0, Math.min(1 - target.w_ratio, isDraggingRef.current!.origX + deltaX));
        const newY = Math.max(0, Math.min(1 - target.h_ratio, isDraggingRef.current!.origY + deltaY));
        copy[idx] = { ...target, x_ratio: newX, y_ratio: newY };
        return copy;
      });
    };

    const handleGlobalMouseUp = () => {
      isDraggingRef.current = null;
    };

    window.addEventListener('mousemove', handleGlobalMouseMove);
    window.addEventListener('mouseup', handleGlobalMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleGlobalMouseMove);
      window.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, []);

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
    isDraggingRef.current = {
      index,
      startX: e.clientX,
      startY: e.clientY,
      origX: box.x_ratio,
      origY: box.y_ratio,
    };
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
      <DialogContent className="max-w-4xl p-6 bg-white border border-slate-300">
        <DialogHeader className="border-b border-slate-200 pb-3">
          <DialogTitle className="text-lg font-bold text-slate-800">
            教室劃位管理 · {className}
          </DialogTitle>
        </DialogHeader>

        {/* 頂部操作工具列 */}
        <div className="flex flex-wrap items-center justify-between gap-4 py-2 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-600">產生網格：</span>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-slate-500">列 (Rows)</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={gridRows}
                onChange={(e) => setGridRows(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 text-center text-xs"
              />
            </div>
            <div className="flex items-center gap-1.5">
              <Label className="text-xs text-slate-500">行 (Cols)</Label>
              <Input
                type="number"
                min={1}
                max={12}
                value={gridCols}
                onChange={(e) => setGridCols(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 text-center text-xs"
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
          </div>

          {selectedBoxIndex !== null && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-slate-700">
                座位 [{boxes[selectedBoxIndex]?.seat_label}] 綁定學生：
              </span>
              <Select
                value={boxes[selectedBoxIndex]?.student_id || 'none'}
                onValueChange={handleAssignStudent}
              >
                <SelectTrigger className="w-44 h-8 text-xs">
                  <SelectValue placeholder="選擇學生" />
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
          )}
        </div>

        {/* 劃位畫布主體 (16:9 比例) */}
        <div
          ref={canvasContainerRef}
          className="relative w-full aspect-video bg-slate-900 border border-slate-300 rounded overflow-hidden select-none"
        >
          {/* 黑板 / 講台方向標示 */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 px-4 py-1 bg-slate-800 border border-slate-700 text-slate-400 text-[11px] font-mono tracking-widest rounded-sm pointer-events-none">
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
                style={{
                  left: `${box.x_ratio * 100}%`,
                  top: `${box.y_ratio * 100}%`,
                  width: `${box.w_ratio * 100}%`,
                  height: `${box.h_ratio * 100}%`,
                }}
                className={`absolute cursor-move flex flex-col items-center justify-center p-1 rounded border transition-colors ${
                  isSelected
                    ? 'border-emerald-400 bg-emerald-500/30 ring-2 ring-emerald-400'
                    : 'border-slate-500 bg-slate-800/80 hover:border-slate-400'
                }`}
              >
                <span className="text-[10px] font-mono font-bold text-slate-300">
                  {box.seat_label}
                </span>
                <span className="text-[11px] font-medium text-white truncate max-w-full">
                  {assignedStudent ? assignedStudent.name : '（空位）'}
                </span>
              </div>
            );
          })}
        </div>

        <DialogFooter className="border-t border-slate-200 pt-3 flex justify-between items-center sm:justify-between">
          <span className="text-xs text-slate-500">
            共 {boxes.length} 個座位 · 點擊並拖曳可微調座位位置
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
