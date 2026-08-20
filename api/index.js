// TEAM_005: Vercel Serverless Function 入口 (api/index.js)
// 支援在 Frontend 專案內直接提供 /api/telemetry 與 /api/history

import express from 'express';
import cors from 'cors';
import { uploadBase64Image } from './_lib/storageService.js';
import { analyzeAttendanceImage } from './_lib/visionService.js';
import { supabase } from './_lib/supabaseClient.js';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// POST /api/telemetry (接收相機考勤通報)
app.post('/api/telemetry', async (req, res) => {
  try {
    const { message, file, timestamp, detected_persons, detected_faces, seats, seat_config } = req.body;

    if (!message || !file) {
      return res.status(400).json({ error: 'Missing required fields: message and file are required.' });
    }

    const clientPersons = Array.isArray(detected_persons)
      ? detected_persons
      : Array.isArray(detected_faces)
        ? detected_faces
        : [];

    const clientSeats = Array.isArray(seats)
      ? seats
      : Array.isArray(seat_config?.seats)
        ? seat_config.seats
        : [];

    // 1. 上傳相片
    const fileUrl = await uploadBase64Image(file);

    // 2. 空間重疊佔用分析 (含真實 ROI 保留)
    const aiAnalysis = await analyzeAttendanceImage(file, message, clientPersons, clientSeats);

    // 3. 準備寫入 Supabase DB
    const createAt = timestamp ? new Date(timestamp).toISOString() : new Date().toISOString();
    const insertPayload = {
      create_at: createAt,
      message: message,
      file_url: fileUrl,
      ai_analysis: aiAnalysis,
    };

    let data = null;
    let dbError = null;
    const tableCandidates = ['store_data', 'attendance_records', 'attendances', 'attendance', 'records'];

    for (const tableName of tableCandidates) {
      const result = await supabase
        .from(tableName)
        .insert([insertPayload])
        .select('*')
        .single();

      if (!result.error) {
        data = result.data;
        dbError = null;
        break;
      } else {
        dbError = result.error;
      }
    }

    if (!data) {
      // 容錯備用寫入
      const fallbackPayload = { create_at: createAt, message: message, file_url: fileUrl };
      for (const tableName of tableCandidates) {
        const result = await supabase.from(tableName).insert([fallbackPayload]).select('*').single();
        if (!result.error) {
          data = { ...result.data, ai_analysis: aiAnalysis };
          dbError = null;
          break;
        }
      }
    }

    if (!data) {
      console.error('[Vercel DB Insert Error]', dbError);
      return res.status(500).json({ error: 'Failed to save record to Supabase DB', details: dbError?.message });
    }

    return res.status(201).json({
      success: true,
      message: 'Multi-seat telemetry processed successfully via Vercel',
      record: data,
      ai_analysis: aiAnalysis,
    });
  } catch (err) {
    console.error('[Vercel Telemetry Error]', err);
    return res.status(500).json({ error: 'Internal server error processing telemetry', details: err?.message });
  }
});

// GET /api/history (查詢歷史考勤紀錄)
app.get('/api/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const search = req.query.search || '';

    const tableCandidates = ['store_data', 'attendance_records', 'attendances', 'attendance', 'records'];
    let recordsData = [];

    for (const tableName of tableCandidates) {
      let query = supabase
        .from(tableName)
        .select('*')
        .order('create_at', { ascending: false })
        .limit(limit);

      if (search) {
        query = query.ilike('message', `%${search}%`);
      }

      const { data, error } = await query;
      if (!error && data) {
        recordsData = data;
        break;
      }
    }

    return res.json({
      success: true,
      records: recordsData,
      count: recordsData.length,
    });
  } catch (err) {
    console.error('[Vercel History Error]', err);
    return res.status(500).json({ error: 'Internal server error fetching history', details: err?.message });
  }
});

// GET /api/health
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'online',
    platform: 'vercel-serverless-monorepo',
    timestamp: new Date().toISOString(),
  });
});

export default app;
