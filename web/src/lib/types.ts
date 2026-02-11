export type Channel = {
  id: string;
  name: string;
  group: string;
  logo_url: string | null;
  stream_url: string;
  is_live: boolean;
  tvg_id?: string;
};

export type EpgProgram = {
  id: string;
  channel_id: string;
  title: string;
  description?: string;
  start: string;
  end: string;
  category?: string;
  icon_url?: string;
};

export type EpgSchedule = {
  channel_id: string;
  programs: EpgProgram[];
};

export type EpgNowNext = {
  channel_id: string;
  now: EpgProgram | null;
  next: EpgProgram | null;
};

export type Playlist = {
  name: string;
  channels: Channel[];
  last_checked: string | null;
  source: string;
};

export type UserSettings = {
  favoriteChannels: string[];
  lastWatchedChannelId: string | null;
  volume: number;
};

export type CompactChannel = {
  n: string;
  g: string;
  l: string | null;
  s: string;
};

export type OnChainPlaylist = {
  v: number;
  n: string;
  c: CompactChannel[];
};

export type ChainPlaylistResponse = {
  found: boolean;
  playlist?: Playlist;
  block_number?: number;
  extrinsic_hash?: string;
  cid?: string;
};
