import { useRef, useCallback } from 'react';
import { matchPersonsToSeats, SeatTemporalTracker } from '../services/seatOccupancyService';

export const useSeatAnalysis = (holdOffMs = 800) => {
  const seatTrackerRef = useRef(new SeatTemporalTracker({ holdOffMs }));
  const latestSmoothedStatusesRef = useRef([]);

  const resetTracker = useCallback(() => {
    if (seatTrackerRef.current) {
      seatTrackerRef.current.reset();
    }
    latestSmoothedStatusesRef.current = [];
  }, []);

  /**
   * 過濾並正規化偵測到的人員框 (透視自適應門檻與形態防偽)
   */
  const processDetectedPersons = useCallback((detections, vWidth, vHeight, cWidth, cHeight) => {
    const scaleX = cWidth / (vWidth || 1);
    const scaleY = cHeight / (vHeight || 1);

    return (detections || [])
      .filter((det) => {
        const { originY, width, height } = det.boundingBox;
        const score = det.categories[0]?.score || 0;
        const yNorm = originY / (vHeight || 1);
        const aspectRatio = height / (width || 1);

        if (yNorm <= 0.5) {
          return score >= 0.1 && aspectRatio >= 0.4;
        } else {
          return score >= 0.22 && aspectRatio >= 0.6;
        }
      })
      .map((det) => {
        const { originX, originY, width, height } = det.boundingBox;
        return {
          x: originX * scaleX,
          y: originY * scaleY,
          width: width * scaleX,
          height: height * scaleY,
          confidence: det.categories[0]?.score || 0.95,
        };
      });
  }, []);

  /**
   * 將座位百分比座標等比例映射至當前 Client 像素座標
   */
  const scaleSeatsToClient = useCallback((seats, cWidth, cHeight) => {
    return (seats || []).map((seat) => {
      const roi = seat.roi;
      const xPct = typeof roi.x_pct === 'number' ? roi.x_pct : (roi.x / 640) * 100;
      const yPct = typeof roi.y_pct === 'number' ? roi.y_pct : (roi.y / 480) * 100;
      const wPct = typeof roi.width_pct === 'number' ? roi.width_pct : ((roi.width || 100) / 640) * 100;
      const hPct = typeof roi.height_pct === 'number' ? roi.height_pct : ((roi.height || 80) / 480) * 100;

      return {
        ...seat,
        roi: {
          x: (xPct / 100) * cWidth,
          y: (yPct / 100) * cHeight,
          width: (wPct / 100) * cWidth,
          height: (hPct / 100) * cHeight,
        },
      };
    });
  }, []);

  /**
   * 計算即時平滑狀態
   */
  const computeSeatStatuses = useCallback((scaledSeats, detectedPersonsInView, timestamp = performance.now()) => {
    const rawStatuses = matchPersonsToSeats(scaledSeats, detectedPersonsInView);
    const statuses = seatTrackerRef.current.update(rawStatuses, timestamp);
    latestSmoothedStatusesRef.current = statuses;
    return statuses;
  }, []);

  /**
   * 繪製 AI 覆蓋層至 Overlay Canvas
   */
  const renderOverlay = useCallback(
    (ctx, width, height, statuses, detectedPersons) => {
      ctx.clearRect(0, 0, width, height);

      // 繪製座位標註框
      (statuses || []).forEach((st) => {
        const isOcc = st.status === 'OCCUPIED';
        const { x, y, width: w, height: h } = st.roi;

        ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.18)' : 'rgba(239, 68, 68, 0.1)';
        ctx.fillRect(x, y, w, h);

        ctx.strokeStyle = isOcc ? '#10b981' : '#ef4444';
        ctx.lineWidth = isOcc ? 2.5 : 1.8;
        ctx.setLineDash(isOcc ? [] : [6, 4]);
        ctx.strokeRect(x, y, w, h);
        ctx.setLineDash([]);

        const label = isOcc ? `🟢 [${st.seat_id}] 在座` : `❌ [${st.seat_id}] 未到`;
        ctx.font = 'bold 12px monospace';
        const textW = ctx.measureText(label).width;

        ctx.fillStyle = isOcc ? 'rgba(16, 185, 129, 0.95)' : 'rgba(239, 68, 68, 0.95)';
        ctx.fillRect(x, y - 22 > 0 ? y - 22 : y + 4, textW + 12, 20);

        ctx.fillStyle = isOcc ? '#0f172a' : '#ffffff';
        ctx.fillText(label, x + 6, y - 22 > 0 ? y - 8 : y + 18);
      });

      // 繪製人員邊框
      (detectedPersons || []).forEach((p) => {
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 2;
        ctx.setLineDash([4, 4]);
        ctx.strokeRect(p.x, p.y, p.width, p.height);
        ctx.setLineDash([]);
      });
    },
    []
  );

  return {
    seatTrackerRef,
    latestSmoothedStatusesRef,
    resetTracker,
    processDetectedPersons,
    scaleSeatsToClient,
    computeSeatStatuses,
    renderOverlay,
  };
};
