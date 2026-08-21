import type {
  AccountConfig,
  Platform,
  SentimentResult,
  SocialPost,
  SocialProfileSnapshot,
} from "./social";

export interface AnalysisConfig {
  startDate: string;
  endDate: string;
  platforms: Platform[];
  accounts: AccountConfig[];
  queries: string[];
  limits: {
    xPostsPerAccount: number;
    instagramPostsPerAccount: number;
    commentsPerPost: number;
    searchResults: number;
    deepseekItems: number;
    deepseekBatchSize: number;
  };
  deepseekMode: "all" | "1000" | "5000" | "sample";
  llmProvider?: "deepseek" | "ollama";
  ollamaHost?: string;
  ollamaModel?: string;
  apifyInputTemplates?: Partial<Record<Platform, Record<string, unknown>>>;
  apifyFieldMaps?: Partial<Record<Platform, Record<string, string[]>>>;
}

export interface TopicResult {
  id: string;
  topicName: string;
  summary: string;
  posts: number;
  comments: number;
  uniqueAuthors: number;
  engagement: number;
  positive: number;
  negative: number;
  neutral: number;
  uncertain: number;
  netSentiment: number;
  platformDistribution: Record<Platform, number>;
  keywords: string[];
}

export interface DataQuality {
  x: SourceQuality;
  instagram: SourceQuality;
  deepseek: {
    processed: number;
    errors: number;
    uncertain: number;
    omitted: number;
  };
}
export interface SourceQuality {
  requested: number;
  succeeded: number;
  errors: number;
  posts: number;
}

export interface AnalysisMetrics {
  publications: number;
  comments: number;
  interactionsBasic: number;
  interactionsExpanded: number;
  governmentMentions: number;
  ministerMentions: number;
  uniqueUsers: number;
  sentiment: Record<"positive" | "negative" | "neutral" | "uncertain", number>;
  governmentSentiment: Record<
    "positive" | "negative" | "neutral" | "uncertain",
    number
  >;
  ministerRankings: MinisterMetric[];
  platformMetrics: Record<Platform, PlatformMetric>;
  topPosts: Partial<Record<Platform | "general", SocialPost>>;
}
export interface MinisterMetric {
  accountId: string;
  name: string;
  position: string;
  postsX: number;
  postsInstagram: number;
  likesX: number;
  commentsX: number;
  likesInstagram: number;
  commentsInstagram: number;
  engagement: number;
  averageEngagement: number;
  mentionsX: number;
  mentionsInstagram: number;
  uniqueAuthors: number;
  positive: number;
  negative: number;
  neutral: number;
  uncertain: number;
  netSentiment: number;
  followersX?: number;
  followersInstagram?: number;
  shareOfVoice: number;
}
export interface PlatformMetric {
  posts: number;
  comments: number;
  interactions: number;
  mentions: number;
  averageEngagement: number;
  sentiment: AnalysisMetrics["sentiment"];
}

export interface AnalysisSession {
  schemaVersion: 1;
  id: string;
  createdAt: string;
  completedAt?: string;
  status: "idle" | "running" | "partial" | "completed" | "cancelled" | "error";
  stage: string;
  config: AnalysisConfig;
  posts: SocialPost[];
  profiles: SocialProfileSnapshot[];
  sentiments: SentimentResult[];
  topics: TopicResult[];
  metrics?: AnalysisMetrics;
  quality: DataQuality;
  executiveSummary: string[];
  errors: string[];
}
