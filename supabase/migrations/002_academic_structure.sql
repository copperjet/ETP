-- ============================================================
-- 002_academic_structure.sql
-- ============================================================

CREATE TABLE school_sections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  code        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE grades (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  section_id  UUID NOT NULL REFERENCES school_sections(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE streams (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_id    UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE subjects (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id   UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  department  TEXT
);

CREATE TABLE grade_subject_assignments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id    UUID NOT NULL REFERENCES schools(id) ON DELETE CASCADE,
  grade_id     UUID NOT NULL REFERENCES grades(id) ON DELETE CASCADE,
  subject_id   UUID NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  is_mandatory BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (grade_id, subject_id)
);

-- ── RLS ───────────────────────────────────────────────────────
DO $$ DECLARE t TEXT; BEGIN
  FOR t IN SELECT unnest(ARRAY['school_sections','grades','streams','subjects','grade_subject_assignments']) LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('CREATE POLICY "si_%I" ON %I FOR ALL TO authenticated USING (school_id = (auth.jwt()->>''app_metadata''->>''school_id'')::uuid)', t, t);
  END LOOP;
END $$;

-- ── Indexes ───────────────────────────────────────────────────
CREATE INDEX idx_sections_school   ON school_sections(school_id);
CREATE INDEX idx_grades_school     ON grades(school_id);
CREATE INDEX idx_grades_section    ON grades(section_id);
CREATE INDEX idx_streams_school    ON streams(school_id);
CREATE INDEX idx_streams_grade     ON streams(grade_id);
CREATE INDEX idx_subjects_school   ON subjects(school_id);
CREATE INDEX idx_gsa_grade         ON grade_subject_assignments(grade_id);
CREATE INDEX idx_gsa_subject       ON grade_subject_assignments(subject_id);
