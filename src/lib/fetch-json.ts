/**
 * Read response body as text and parse JSON when possible (handles empty body).
 */
export async function readFetchJson(res: Response): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
  rawText: string;
}> {
  const rawText = await res.text();
  const status = res.status;
  const ok = res.ok;
  if (!rawText.trim()) {
    return { ok, status, data: null, rawText };
  }
  try {
    return { ok, status, data: JSON.parse(rawText), rawText };
  } catch {
    return {
      ok,
      status,
      data: { _nonJson: true, _preview: rawText.slice(0, 500) },
      rawText,
    };
  }
}
