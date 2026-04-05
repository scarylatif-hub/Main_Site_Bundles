import type { Network, NetworkName } from './definitions';

export const NETWORKS: Network[] = [
  /** MTN */
  { id: 1, name: 'MTN', prefixes: ['024', '025', '053', '054', '055', '059'] },
  /** Telecel (formerly Vodafone) */
  { id: 2, name: 'Telecel', prefixes: ['020', '050'] },
  /** AirtelTigo */
  { id: 3, name: 'AirtelTigo', prefixes: ['027', '057', '026', '056'] },
];

const networkPrefixMap = new Map<string, Network>();
NETWORKS.forEach(network => {
  network.prefixes.forEach(prefix => {
    networkPrefixMap.set(prefix, network);
  });
});

export const normalizePhoneNumber = (phone: string): string => {
  if (!phone) return '';
  let cleaned = phone.replace(/\s+/g, ''); // Remove spaces
  if (cleaned.startsWith('+233')) {
    cleaned = `0${cleaned.substring(4)}`;
  } else if (cleaned.startsWith('233')) {
    cleaned = `0${cleaned.substring(3)}`;
  }
  
  if (cleaned.length > 10) {
    return cleaned.substring(0, 10);
  }

  return cleaned;
};

export const detectNetwork = (phone: string): Network | null => {
  const normalized = normalizePhoneNumber(phone);
  if (normalized.length >= 3) {
    const prefix = normalized.substring(0, 3);
    return networkPrefixMap.get(prefix) || null;
  }
  return null;
};

export const validatePhoneNumber = (phone: string): boolean => {
  const normalized = normalizePhoneNumber(phone);
  // MTN 024,025,053,054,055,059 | Telecel 020,050 | AirtelTigo 026,027,056,057
  return /^0(20|24|25|26|27|50|53|54|55|56|57|59)\d{7}$/.test(normalized);
};