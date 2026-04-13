export type AvatarOption = {
  id: string;
  label: string;
  seed: string;
};

export const AVATAR_OPTIONS: AvatarOption[] = [
  { id: "felix", label: "Felix", seed: "Felix" },
  { id: "lily", label: "Lily", seed: "Lily" },
  { id: "max", label: "Max", seed: "Max" },
  { id: "zara", label: "Zara", seed: "Zara" },
  { id: "leo", label: "Leo", seed: "Leo" },
  { id: "maya", label: "Maya", seed: "Maya" },
  { id: "kai", label: "Kai", seed: "Kai" },
  { id: "nora", label: "Nora", seed: "Nora" },
  { id: "sam", label: "Sam", seed: "Sam" },
  { id: "luna", label: "Luna", seed: "Luna" },
  { id: "ace", label: "Ace", seed: "Ace" },
  { id: "jade", label: "Jade", seed: "Jade" },
];

export function buildAvatarUrl(seed: string): string {
  const url = new URL("https://api.dicebear.com/9.x/adventurer/svg");
  url.searchParams.set("seed", seed);
  url.searchParams.set("size", "128");
  return url.href;
}

export const ALLOWED_AVATAR_URLS: string[] = AVATAR_OPTIONS.map((avatar) =>
  buildAvatarUrl(avatar.seed)
);