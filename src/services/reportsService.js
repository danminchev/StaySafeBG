import { requireSupabase } from './supabaseClient.js';

export async function createScamReport({
  title,
  description,
  category,
  scamType,
  url,
  phone,
  iban,
  createdBy,
}) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('scam_reports')
    .insert({
      title,
      description,
      category,
      scam_type: scamType,
      url,
      phone,
      iban,
      created_by: createdBy,
      status: 'pending',
    })
    .select('id')
    .single();

  if (error) throw error;

  return data;
}

export async function attachReportFile({ reportId, filePath, mimeType }) {
  const supabase = requireSupabase();
  const { error } = await supabase.from('report_files').insert({
    report_id: reportId,
    file_path: filePath,
    mime_type: mimeType,
  });

  if (error) throw error;
}
