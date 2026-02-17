import { list, put } from '@vercel/blob';

const BLOB_PATHNAME = 'klickit/transactions.json';

const parseBody = (body: unknown): any => {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
};

export default async function handler(req: any, res: any) {
  try {
    if (req.method === 'GET') {
      const { blobs } = await list({ prefix: BLOB_PATHNAME, limit: 5 });
      const target =
        blobs.find((blob) => blob.pathname === BLOB_PATHNAME) ??
        blobs.sort((a, b) => +new Date(b.uploadedAt) - +new Date(a.uploadedAt))[0];

      if (!target) {
        return res.status(200).json({ transactions: [], updatedAt: null });
      }

      const response = await fetch(target.url, { cache: 'no-store' });
      if (!response.ok) {
        return res.status(200).json({ transactions: [], updatedAt: null });
      }

      const payload = await response.json();
      const transactions = Array.isArray(payload?.transactions) ? payload.transactions : [];
      return res.status(200).json({ transactions, updatedAt: payload?.updatedAt ?? target.uploadedAt ?? null });
    }

    if (req.method === 'POST') {
      const body = parseBody(req.body);
      const transactions = Array.isArray(body?.transactions) ? body.transactions : [];
      const updatedAt = new Date().toISOString();

      await put(
        BLOB_PATHNAME,
        JSON.stringify(
          {
            transactions,
            updatedAt,
          },
          null,
          2
        ),
        {
          access: 'public',
          addRandomSuffix: false,
          allowOverwrite: true,
          contentType: 'application/json',
          cacheControlMaxAge: 0,
        }
      );

      return res.status(200).json({ ok: true, count: transactions.length, updatedAt });
    }

    return res.status(405).json({ message: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({
      message: 'Failed to process transactions request',
      error: error?.message ?? 'Unknown error',
    });
  }
}

