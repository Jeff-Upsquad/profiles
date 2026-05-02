import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateHowItWorksVideoInput,
  UpdateHowItWorksVideoInput,
} from '../validators/how-it-works.validators.js';

export async function getVideos() {
  const { data, error } = await supabaseAdmin
    .from('how_it_works_videos')
    .select('*')
    .order('language');
  if (error) throw new AppError(500, `Failed to fetch videos: ${error.message}`);
  return data;
}

export async function getActiveVideos() {
  const { data, error } = await supabaseAdmin
    .from('how_it_works_videos')
    .select('id, language, loom_url')
    .eq('is_active', true)
    .order('language');
  if (error) throw new AppError(500, `Failed to fetch videos: ${error.message}`);
  return data;
}

export async function createVideo(input: CreateHowItWorksVideoInput) {
  const { data, error } = await supabaseAdmin
    .from('how_it_works_videos')
    .insert({
      language: input.language,
      loom_url: input.loom_url,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();
  if (error) {
    if (error.code === '23505') throw new AppError(409, `A video for language "${input.language}" already exists`);
    throw new AppError(500, `Failed to create video: ${error.message}`);
  }
  return data;
}

export async function updateVideo(id: string, input: UpdateHowItWorksVideoInput) {
  const { data, error } = await supabaseAdmin
    .from('how_it_works_videos')
    .update({ ...input, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single();
  if (error) {
    if (error.code === 'PGRST116') throw new AppError(404, 'Video not found');
    if (error.code === '23505') throw new AppError(409, `A video for that language already exists`);
    throw new AppError(500, `Failed to update video: ${error.message}`);
  }
  return data;
}

export async function deleteVideo(id: string) {
  const { error } = await supabaseAdmin
    .from('how_it_works_videos')
    .delete()
    .eq('id', id);
  if (error) throw new AppError(500, `Failed to delete video: ${error.message}`);
  return { success: true };
}
