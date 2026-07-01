import { supabaseSelect } from "@/lib/supabaseServer";
import { HOMEPAGE_VIDEO_TOPIC } from "@/lib/socialMediaTopics";

export type HomepageVideo = {
  id: string;
  title?: string | null;
  file_url: string;
  thumbnail_url?: string | null;
  alt_text?: string | null;
};

type HomepageVideoRow = HomepageVideo & {
  media_type?: string | null;
  is_active?: boolean | null;
  topic?: string | null;
  updated_at?: string | null;
  created_at?: string | null;
};

export async function getHomepageVideo(): Promise<HomepageVideo | null> {
  const topic = encodeURIComponent(HOMEPAGE_VIDEO_TOPIC);
  const rows = await supabaseSelect<HomepageVideoRow>(
    "admin_social_media",
    `select=*&is_active=eq.true&media_type=eq.video&topic=eq.${topic}&order=updated_at.desc&limit=1`
  );

  const video = Array.isArray(rows) ? rows[0] : null;
  if (!video?.file_url) return {
    id: "manual-supabase-homepage-video",
    title: "ReviewIntel Homepage Instructional Video",
    file_url: "https://iqakizejitdhcwbnsxpj.supabase.co/storage/v1/object/sign/reviewintel-media/getreviewintel.com.mp4?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV85MjA4OGQyNy1lNDhjLTQwM2ItYmViNy1lY2NkNjVhNTk4ZDAiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJyZXZpZXdpbnRlbC1tZWRpYS9nZXRyZXZpZXdpbnRlbC5jb20ubXA0Iiwic2NvcGUiOiJkb3dubG9hZCIsImlhdCI6MTc4MjkyMjQzNCwiZXhwIjoyNDEzNjQyNDM0fQ.81WM024iDfmwIlSvPvKPBKuWP6RkMNRJMQmb7fmNyLo",
    thumbnail_url: "",
  };

  return {
    id: video.id,
    title: video.title,
    file_url: video.file_url,
    thumbnail_url: video.thumbnail_url,
    alt_text: video.alt_text,
  };
}
