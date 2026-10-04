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

// POST /api/init-demo (初始化競賽展示資料)
app.post('/api/init-demo', async (req, res) => {
  try {
    const demoCode = '333301';
    const demoEmail = 'office@tp.edu.tw';
    const demoPassword = 'School@2026';
    const demoName = '臺北市立示範高級中學';

    // 1. 檢查學校是否存在
    let { data: school, error: schoolError } = await supabase
      .from('schools')
      .select('*')
      .eq('code', demoCode)
      .single();

    if (!school) {
      const { data: newSchool, error: insertSchoolError } = await supabase
        .from('schools')
        .insert([{
          name: demoName,
          code: demoCode,
          edu_code: demoCode,
          contact_email: demoEmail,
          is_verified: true,
        }])
        .select('*')
        .single();
      
      if (insertSchoolError) throw insertSchoolError;
      school = newSchool;
    }

    // 2. 檢查/建立管理員帳號
    // 透過 supabase.auth.admin.createUser 建立
    // (需確保 supabaseClient.js 是使用 Service Role Key)
    let adminUserId = null;
    const { data: listUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (!listError && listUsers?.users) {
      const existingUser = listUsers.users.find(u => u.email === demoEmail);
      if (existingUser) {
        adminUserId = existingUser.id;
        // 更新密碼確保可登入
        await supabase.auth.admin.updateUserById(adminUserId, { password: demoPassword });
      }
    }

    if (!adminUserId) {
      const { data: newUser, error: createUserError } = await supabase.auth.admin.createUser({
        email: demoEmail,
        password: demoPassword,
        email_confirm: true,
      });
      if (createUserError) throw createUserError;
      adminUserId = newUser.user.id;
    }

    // 3. 確保 user_profiles 存在
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', adminUserId)
      .single();

    if (!profile) {
      await supabase.from('user_profiles').insert([{
        id: adminUserId,
        school_id: school.id,
        role: 'school_admin',
        name: '示範管理員',
        email: demoEmail,
      }]);
    }

    return res.json({
      success: true,
      message: '示範資料初始化完成',
      school,
    });
  } catch (err) {
    console.error('[Vercel Init Demo Error]', err);
    return res.status(500).json({ error: 'Internal server error initializing demo', details: err?.message });
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
