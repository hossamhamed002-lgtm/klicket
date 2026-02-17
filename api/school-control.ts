const DEFAULT_TABLE = 'school_control_snapshots';

const parseBody = (body: unknown): any => {
  if (!body) return {};
  if (Buffer.isBuffer(body)) {
    try {
      return JSON.parse(body.toString('utf-8'));
    } catch {
      return {};
    }
  }
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

const parseSupabaseError = async (response: Response): Promise<string> => {
  try {
    const payload = await response.json();
    if (payload?.message) return String(payload.message);
    if (payload?.error) return String(payload.error);
    if (payload?.hint) return String(payload.hint);
    return JSON.stringify(payload);
  } catch {
    try {
      const text = await response.text();
      return text || `HTTP ${response.status}`;
    } catch {
      return `HTTP ${response.status}`;
    }
  }
};

const resolveSupabaseConfig = () => {
  const rawUrl = process.env.SUPABASE_URL || '';
  const supabaseUrl = rawUrl.replace(/\/+$/, '');
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SERVICE_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    '';
  const tableFromEnv = process.env.SUPABASE_SCHOOL_TABLE || DEFAULT_TABLE;
  const table = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(tableFromEnv) ? tableFromEnv : DEFAULT_TABLE;

  return { supabaseUrl, serviceRoleKey, table };
};

export default async function handler(req: any, res: any) {
  try {
    const { supabaseUrl, serviceRoleKey, table } = resolveSupabaseConfig();

    if (!supabaseUrl || !serviceRoleKey) {
      return res.status(500).json({
        message: 'Supabase env vars are missing',
        error: 'SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_SERVICE_KEY/SUPABASE_ANON_KEY is not set',
      });
    }

    if (req.method === 'GET') {
      const url = `${supabaseUrl}/rest/v1/${table}?select=parents,students,updated_at&order=updated_at.desc&limit=1`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Accept: 'application/json',
        },
      });

      if (!response.ok) {
        const supabaseError = await parseSupabaseError(response);
        return res.status(500).json({
          message: 'Failed to load school-control data from Supabase',
          error: supabaseError,
        });
      }

      const rows = await response.json();
      if (!Array.isArray(rows) || rows.length === 0) {
        return res.status(200).json({ parents: [], students: [], updatedAt: null });
      }

      const latest = rows[0];
      const parents = Array.isArray(latest?.parents) ? latest.parents : [];
      const students = Array.isArray(latest?.students) ? latest.students : [];

      return res.status(200).json({
        parents,
        students,
        updatedAt: latest?.updated_at ?? null,
      });
    }

    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const parents = Array.isArray(body?.parents) ? body.parents : [];
      const students = Array.isArray(body?.students) ? body.students : [];
      const updatedAt = new Date().toISOString();

      const deleteUrl = `${supabaseUrl}/rest/v1/${table}?id=not.is.null`;
      const deleteResponse = await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          Prefer: 'return=minimal',
        },
      });

      if (!deleteResponse.ok) {
        const supabaseError = await parseSupabaseError(deleteResponse);
        return res.status(500).json({
          message: 'Failed to clear previous school-control data in Supabase',
          error: supabaseError,
        });
      }

      const insertUrl = `${supabaseUrl}/rest/v1/${table}`;
      const response = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify([
          {
            parents,
            students,
            updated_at: updatedAt,
          },
        ]),
      });

      if (!response.ok) {
        const supabaseError = await parseSupabaseError(response);
        return res.status(500).json({
          message: 'Failed to save school-control data to Supabase',
          error: supabaseError,
        });
      }

      return res.status(200).json({
        ok: true,
        parentsCount: parents.length,
        studentsCount: students.length,
        updatedAt,
      });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Failed to process school-control request',
      error: error?.message ?? 'Unknown error',
    });
  }
}
