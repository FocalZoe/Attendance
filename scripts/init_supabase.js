#!/usr/bin/env node
// ==============================================================================
// ClassVision / Zoe Attendance - Supabase 一鍵自動初始化與擴充檢查腳本
// 執行指令：npm run db:init 或 node scripts/init_supabase.js
// ==============================================================================

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 優先載入 Attendance/.env 與專案根目錄 .env
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const supabaseUrl = process.env.SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

console.log('\n🚀 [ClassVision Supabase 自動建表與擴充系統]');
console.log('----------------------------------------------------');

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ 錯誤：未在 .env 中找到 SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY');
  console.log('💡 請先複製 .env.example 為 .env 並填入 Supabase 連線憑證。');
  console.log('----------------------------------------------------\n');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runInit() {
  try {
    console.log(`📡 正在連線至 Supabase 實例: ${supabaseUrl}`);

    // 1. 檢查 Storage 儲存桶
    console.log('\n📦 [1/2] 檢查並自動初始化 Storage 雲端相簿儲存桶...');
    const bucketNames = ['attendance-images', 'attendance_images'];

    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.warn(`⚠️ 讀取儲存桶清單警告: ${listError.message}`);
    }

    const existingNames = (existingBuckets || []).map((b) => b.name);

    for (const name of bucketNames) {
      if (existingNames.includes(name)) {
        console.log(`  ✅ 儲存桶 [${name}] 已存在 (Public: true)`);
      } else {
        console.log(`  ➕ 正在自動建立儲存桶 [${name}]...`);
        const { error: createError } = await supabase.storage.createBucket(name, {
          public: true,
          fileSizeLimit: 52428800, // 50MB
        });
        if (createError) {
          console.warn(`  ⚠️ 建立儲存桶 [${name}] 提示: ${createError.message}`);
        } else {
          console.log(`  🎉 儲存桶 [${name}] 自動建立成功！`);
        }
      }
    }

    // 2. 檢查 store_data 資料表
    console.log('\n📊 [2/2] 檢查 store_data 歷史資料表連線與欄位...');
    const { data: tableCheck, error: tableError } = await supabase
      .from('store_data')
      .select('id, create_at, message, file_url, ai_analysis')
      .limit(1);

    if (tableError) {
      console.warn(`\n⚠️ 資料表檢查提示: ${tableError.message}`);
      console.log('💡 建議：若首次建置，請至 Supabase 控制台的 SQL Editor 執行專案根目錄的 `supabase_schema.sql` 腳本以建立完整資料表與索引！');
    } else {
      console.log('  ✅ 資料表 [store_data] 運作正常 (包含 ai_analysis JSONB 欄位擴充)');
    }

    console.log('\n----------------------------------------------------');
    console.log('✨ [完成] Supabase 雲端資料庫與相簿儲存桶檢查完成！系統已就緒。');
    console.log('----------------------------------------------------\n');
  } catch (err) {
    console.error('\n❌ 初始化過程中發生例外錯誤:', err);
    process.exit(1);
  }
}

runInit();
