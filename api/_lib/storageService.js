// TEAM_005: Supabase Storage 圖片上傳模組 (Vercel Serverless)

import { supabase } from './supabaseClient.js';

export async function uploadBase64Image(base64Data, filename) {
  try {
    const cleanBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    const finalFilename = filename || `attendance_${Date.now()}_${Math.random().toString(36).substring(7)}.jpg`;

    const bucketCandidates = ['attendance_images', 'attendances', 'images', 'photos', 'telemetry'];
    let publicUrl = null;
    let uploadError = null;

    for (const bucket of bucketCandidates) {
      const { data, error } = await supabase.storage
        .from(bucket)
        .upload(finalFilename, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!error && data) {
        const { data: urlData } = supabase.storage.from(bucket).getPublicUrl(finalFilename);
        publicUrl = urlData.publicUrl;
        uploadError = null;
        break;
      } else {
        uploadError = error;
      }
    }

    if (!publicUrl) {
      console.warn('[TEAM_005 Storage Fallback] Storage 上傳失敗，使用直接 Base64 Data URL');
      return base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${cleanBase64}`;
    }

    return publicUrl;
  } catch (err) {
    console.error('[TEAM_005 Storage Error]', err);
    return base64Data.startsWith('data:') ? base64Data : `data:image/jpeg;base64,${base64Data}`;
  }
}
