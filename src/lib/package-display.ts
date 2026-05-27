const NON_DATA_LABEL_RE = new RegExp(
  "registration|sim\\s*reg|router|combo|voice|minute|sms|special",
  "i"
);

export function parseDataPackageVolumeGb(
  pkg: Record<string, unknown>
): number | null {
  const volumeGB = pkg.volumeGB != null ? String(pkg.volumeGB).trim() : "";
  const gbFromLabel = volumeGB.match(/(\d+(?:\.\d+)?)\s*gb/i);
  if (gbFromLabel) {
    const n = parseFloat(gbFromLabel[1]);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  const vol = pkg.volume ?? pkg.shared_bundle;
  if (vol == null) return null;

  const s = String(vol).trim();
  if (/^\d+(\.\d+)?$/.test(s)) {
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : null;
  }

  return null;
}

export function formatDataPackageLabel(
  pkg: Record<string, unknown>,
  volumeGb: number
): string {
  const volumeGB = pkg.volumeGB != null ? String(pkg.volumeGB).trim() : "";
  if (/^\d+(\.\d+)?\s*gb$/i.test(volumeGB)) {
    return volumeGB.replace(/\s+/g, "").toUpperCase();
  }
  return Number.isInteger(volumeGb) ? `${volumeGb}GB` : `${volumeGb}GB`;
}

export function isConsumerDataBundle(pkg: Record<string, unknown>): boolean {
  const volumeGb = parseDataPackageVolumeGb(pkg);
  if (volumeGb == null || volumeGb < 0.5 || volumeGb > 500) return false;

  const labelText = [pkg.name, pkg.description, pkg.volume, pkg.volumeGB]
    .filter((v) => v != null && String(v).trim() !== "")
    .join(" ");

  if (NON_DATA_LABEL_RE.test(labelText)) return false;

  const packageId = Number(pkg.id);
  return Number.isFinite(packageId) && packageId > 0;
}
