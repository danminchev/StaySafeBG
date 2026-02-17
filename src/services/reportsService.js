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

export async function getAdminReports({ limit = 20, offset = 0 } = {}) {
  const supabase = requireSupabase();
  const { data, error, count } = await supabase
    .from('scam_reports')
    .select('id, created_at, category, scam_type, url, phone, iban, status, title', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    count: count || 0,
  };
}

export async function getApprovedReports({ limit = 3 } = {}) {
  const supabase = requireSupabase();
  const { data, error, count } = await supabase
    .from('scam_reports')
    .select('id, created_at, category, scam_type, title', { count: 'exact' })
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw error;

  return {
    data: data || [],
    count: count || 0,
  };
}

export async function getApprovedReportsFeed({ limit = 20, offset = 0 } = {}) {
  const supabase = requireSupabase();
  const { data, error, count } = await supabase
    .from('scam_reports')
    .select('id, created_at, category, scam_type, title, description, url, phone, iban', { count: 'exact' })
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) throw error;

  return {
    data: data || [],
    count: count || 0,
  };
}

export async function getAdminReportStats() {
  const supabase = requireSupabase();

  const [pendingResult, approvedResult] = await Promise.all([
    supabase.from('scam_reports').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
    supabase.from('scam_reports').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
  ]);

  if (pendingResult.error) throw pendingResult.error;
  if (approvedResult.error) throw approvedResult.error;

  return {
    pendingCount: pendingResult.count || 0,
    approvedCount: approvedResult.count || 0,
  };
}

export async function getAdminReportById(reportId) {
  const supabase = requireSupabase();

  const { data: report, error: reportError } = await supabase
    .from('scam_reports')
    .select('id, title, description, category, scam_type, url, phone, iban, status, created_at, created_by')
    .eq('id', reportId)
    .single();

  if (reportError) throw reportError;

  const { data: files, error: filesError } = await supabase
    .from('report_files')
    .select('id, file_path, mime_type, created_at')
    .eq('report_id', reportId)
    .order('created_at', { ascending: false });

  if (filesError) throw filesError;

  return {
    ...report,
    files: files || [],
  };
}

export async function updateReportStatus(reportId, status) {
  const supabase = requireSupabase();
  const { data, error } = await supabase
    .from('scam_reports')
    .update({ status })
    .eq('id', reportId)
    .select('id, status')
    .single();

  if (error) throw error;
  return data;
}

export async function getEvidenceFileSignedUrl(filePath, expiresIn = 3600) {
  const supabase = requireSupabase();
  const { data, error } = await supabase.storage
    .from('evidence')
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data?.signedUrl || null;
}
