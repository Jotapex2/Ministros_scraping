export type Platform = "x" | "instagram";
export type AccountType = "minister" | "institutional" | "president";
export type AvailabilityStatus =
  "available" | "not_available" | "not_queried" | "api_error";
export type Availability<T> = {
  status: AvailabilityStatus;
  value?: T;
  message?: string;
};

export interface AccountConfig {
  id: string;
  name: string;
  position: string;
  ministry: string;
  accountType: AccountType;
  xUsername: string;
  instagramUsername: string;
  aliases: string[];
  active: boolean;
}

export interface SocialProfileSnapshot {
  accountId: string;
  platform: Platform;
  username: string;
  followers: Availability<number>;
  capturedAt: string;
}

export interface SocialPost {
  id: string;
  platform: Platform;
  authorName: string;
  username: string;
  authorType: AccountType | "public";
  accountId?: string;
  ministerId?: string;
  text: string;
  createdAt: string;
  likes: Availability<number>;
  comments: Availability<number>;
  shares: Availability<number>;
  reposts: Availability<number>;
  quotes: Availability<number>;
  views: Availability<number>;
  followers: Availability<number>;
  url: string;
  hashtags: string[];
  parentPostId?: string;
  isComment?: boolean;
}

export type Sentiment = "positive" | "negative" | "neutral" | "uncertain";
export type SentimentTargetKind =
  | "government"
  | "president"
  | "institution"
  | "public_policy"
  | "minister"
  | "congress"
  | "opposition"
  | "other";
export interface SentimentResult {
  itemId: string;
  sentiment: Sentiment;
  score: number;
  confidence: number;
  target: string;
  targetKind: SentimentTargetKind;
  reasonShort: string;
  topic: string;
  keywords: string[];
  entities: string[];
}
