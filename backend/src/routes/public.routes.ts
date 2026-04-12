import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { supabaseAdmin } from '../config/supabase.js';
import * as adminService from '../services/admin.service.js';

const router = Router();

// ---------------------------------------------------------------------------
// Truly public routes (no auth) — shared profile links
// ---------------------------------------------------------------------------

router.get('/shared/:token', async (req, res, next) => {
  try {
    const result = await adminService.getProfileByShareToken(req.params.token);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

router.get('/profiles/:id', async (req, res, next) => {
  try {
    const result = await adminService.getPublicProfile(req.params.id);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Authenticated public routes (no specific role)
// ---------------------------------------------------------------------------

router.use(authenticate);

router.get('/categories', talentController.getCategories);
router.get('/categories/:slug', talentController.getCategoryBySlug);

// Template skills & tools for a category (used by talent frontend)
router.get('/categories/:categoryId/skills', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('template_skill_sets')
      .select('*')
      .eq('category_id', req.params.categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ message: error.message });
    res.json({ skills: data });
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:categoryId/tools', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('template_tools')
      .select('*')
      .eq('category_id', req.params.categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ message: error.message });
    res.json({ tools: data });
  } catch (err) {
    next(err);
  }
});

router.get('/categories/:categoryId/ai-tools', async (req, res, next) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('template_ai_tools')
      .select('*')
      .eq('category_id', req.params.categoryId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) return res.status(500).json({ message: error.message });
    res.json({ ai_tools: data });
  } catch (err) {
    next(err);
  }
});

export default router;
