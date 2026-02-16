import { requireSupabase } from './supabaseClient.js';

const EVIDENCE_BUCKET = 'evidence';

function sanitizeFilename(filename) {
  return filename.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function uploadEvidenceFile({ userId, reportId, file }) {
  const supabase = requireSupabase();
  const safeFileName = `${Date.now()}-${sanitizeFilename(file.name)}`;
  const path = `${userId}/${reportId}/${safeFileName}`;

  const { error } = await supabase.storage
    .from(EVIDENCE_BUCKET)
    .upload(path, file, {
      upsert: false,
      contentType: file.type || 'application/octet-stream',
    });

  if (error) throw error;

  return {
    path,
    mimeType: file.type || null,
  };
}
