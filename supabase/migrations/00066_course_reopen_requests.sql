-- Course reopen requests: talents request access to a course that has expired,
-- admins approve/reject from the Access Requests queue.

CREATE TABLE course_reopen_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_user_id UUID NOT NULL REFERENCES talent_users(id) ON DELETE CASCADE,
  course_id UUID NOT NULL REFERENCES training_courses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  reason TEXT,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID,
  admin_notes TEXT
);

-- Only one pending request per (talent, course) at a time
CREATE UNIQUE INDEX uniq_pending_course_reopen
  ON course_reopen_requests (talent_user_id, course_id)
  WHERE status = 'pending';

-- Fast queue queries
CREATE INDEX idx_course_reopen_requests_status_requested_at
  ON course_reopen_requests (status, requested_at DESC);

-- RLS: backend uses service role and bypasses; talents see/insert their own
ALTER TABLE course_reopen_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "talent_insert_own_request"
  ON course_reopen_requests FOR INSERT
  TO authenticated
  WITH CHECK (talent_user_id = auth.uid());

CREATE POLICY "talent_view_own_requests"
  ON course_reopen_requests FOR SELECT
  TO authenticated
  USING (talent_user_id = auth.uid());
