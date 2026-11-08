import { supabase } from "@/integrations/supabase/client";
import { toAppError } from "./offline";

export type HashtagHit = { tag: string; postCount: number };

/** Prefix search over existing hashtags, most used first. Empty query = popular tags. */
export async function searchHashtags(q: string): Promise<HashtagHit[]> {
  const prefix = q.trim().replace(/^#+/, "").toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 30);
  try {
    let query = supabase
      .from("hashtags")
      .select("tag, post_count")
      .order("post_count", { ascending: false })
      .limit(20);
    // "_" is a LIKE wildcard; escape it so it matches literally.
    if (prefix) query = query.like("tag", `${prefix.replace(/_/g, "\\_")}%`);
    const { data, error } = await query;
    if (error) throw error;
    return (data ?? []).map((r) => ({ tag: r.tag, postCount: r.post_count }));
  } catch (err) {
    throw toAppError(err);
  }
}
