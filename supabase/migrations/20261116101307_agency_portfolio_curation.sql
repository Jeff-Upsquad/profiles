-- Agency presentation only; never changes partners' original portfolio_items.
ALTER TABLE public.agency_portfolio_items
  ADD COLUMN hidden_from_agency boolean NOT NULL DEFAULT false;

-- Save the ordering and visibility together, with ownership checked before any writes.
CREATE FUNCTION public.save_agency_portfolio_curation(p_agency_id uuid, p_items jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' THEN
    RAISE EXCEPTION 'Expected portfolio items array';
  END IF;
  IF EXISTS (
    SELECT 1 FROM jsonb_to_recordset(p_items) AS x(id uuid, sort_order integer, hidden_from_agency boolean)
    LEFT JOIN public.agency_portfolio_items i ON i.id = x.id AND i.agency_user_id = p_agency_id
    WHERE i.id IS NULL OR x.sort_order IS NULL OR x.sort_order < 0 OR x.hidden_from_agency IS NULL
  ) OR (SELECT count(*) <> count(DISTINCT x.id) FROM jsonb_to_recordset(p_items) AS x(id uuid)) THEN
    RAISE EXCEPTION 'Invalid portfolio items or ownership' USING ERRCODE = '22023';
  END IF;
  UPDATE public.agency_portfolio_items i
  SET sort_order = x.sort_order, hidden_from_agency = x.hidden_from_agency
  FROM jsonb_to_recordset(p_items) AS x(id uuid, sort_order integer, hidden_from_agency boolean)
  WHERE i.id = x.id AND i.agency_user_id = p_agency_id;
END;
$$;
REVOKE ALL ON FUNCTION public.save_agency_portfolio_curation(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.save_agency_portfolio_curation(uuid, jsonb) TO service_role;

-- Businesses must not bypass the agency's visibility choice through the Data API.
DROP POLICY agency_portfolio_items_select_business ON public.agency_portfolio_items;
CREATE POLICY agency_portfolio_items_select_business ON public.agency_portfolio_items
  FOR SELECT TO authenticated USING (
    NOT hidden_from_agency AND EXISTS (SELECT 1 FROM public.business_users WHERE id = (SELECT auth.uid()))
  );
