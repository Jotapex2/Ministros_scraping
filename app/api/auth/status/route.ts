import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api";
export async function GET() {
  return NextResponse.json({
    authenticated: await requireAuth(),
    passwordConfigured: !!process.env.APP_ACCESS_PASSWORD,
    limits: {
      xPostsPerAccount: Number(process.env.MAX_X_POSTS_PER_ACCOUNT || 100),
      instagramPostsPerAccount: Number(
        process.env.MAX_INSTAGRAM_POSTS_PER_ACCOUNT || 100,
      ),
      commentsPerPost: Number(process.env.MAX_COMMENTS_PER_POST || 50),
      searchResults: Number(process.env.MAX_SEARCH_RESULTS || 1000),
      deepseekItems: Number(process.env.MAX_DEEPSEEK_ITEMS || 1000),
      deepseekBatchSize: Number(process.env.MAX_DEEPSEEK_BATCH_SIZE || 25),
    },
  });
}
