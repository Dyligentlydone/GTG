export type DoorDestination = {
  slug: string;
  name: string;
  href: string;
  accent: number;
  /** When set, the hall interior renders this game's live quest board. */
  gameSlug?: string;
};
