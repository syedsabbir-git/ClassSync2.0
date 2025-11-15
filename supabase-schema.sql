-- =============================================
-- ClassSync - Complete Supabase Schema Migration
-- =============================================
-- This schema replaces Firebase Firestore with PostgreSQL
-- Includes Row Level Security (RLS) policies for all tables
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================
-- 1. USERS TABLE (replaces Firebase Auth + users collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('student', 'cr')),
  phone TEXT DEFAULT '',
  student_id TEXT DEFAULT '',
  email_verified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS Policies for users
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- Users can read their own data
CREATE POLICY "Users can read own data"
  ON public.users FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own data
CREATE POLICY "Users can update own data"
  ON public.users FOR UPDATE
  USING (auth.uid() = id);

-- Anyone can insert (for signup)
CREATE POLICY "Anyone can insert users"
  ON public.users FOR INSERT
  WITH CHECK (true);

-- =============================================
-- 2. SECTIONS TABLE (replaces sections collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.sections (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_key TEXT UNIQUE NOT NULL,
  department_name TEXT NOT NULL,
  batch_number TEXT NOT NULL,
  cr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cr_name TEXT NOT NULL,
  student_count INTEGER DEFAULT 0,
  activity_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for faster lookups
CREATE INDEX idx_sections_cr_id ON public.sections(cr_id);
CREATE INDEX idx_sections_section_key ON public.sections(section_key);

-- RLS Policies for sections
ALTER TABLE public.sections ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read sections
CREATE POLICY "Authenticated users can read sections"
  ON public.sections FOR SELECT
  USING (auth.role() = 'authenticated');

-- Only CRs can create sections (and only ONE section at a time)
CREATE POLICY "CRs can create one section"
  ON public.sections FOR INSERT
  WITH CHECK (
    auth.uid() = cr_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'cr' AND
    NOT EXISTS (
      SELECT 1 FROM public.sections WHERE cr_id = auth.uid()
    )
  );

-- CRs can update their own sections
CREATE POLICY "CRs can update own sections"
  ON public.sections FOR UPDATE
  USING (auth.uid() = cr_id);

-- CRs can delete their own sections
CREATE POLICY "CRs can delete own sections"
  ON public.sections FOR DELETE
  USING (auth.uid() = cr_id);

-- =============================================
-- 3. ENROLLMENTS TABLE (replaces enrollments collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.enrollments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  section_key TEXT NOT NULL,
  enrolled_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(student_id, section_id)
);

-- Indexes
CREATE INDEX idx_enrollments_student_id ON public.enrollments(student_id);
CREATE INDEX idx_enrollments_section_id ON public.enrollments(section_id);

-- RLS Policies
ALTER TABLE public.enrollments ENABLE ROW LEVEL SECURITY;

-- Students can read their own enrollments
CREATE POLICY "Students can read own enrollments"
  ON public.enrollments FOR SELECT
  USING (auth.uid() = student_id);

-- CRs can read enrollments for their sections
CREATE POLICY "CRs can read section enrollments"
  ON public.enrollments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.sections 
      WHERE sections.id = enrollments.section_id 
      AND sections.cr_id = auth.uid()
    )
  );

-- Students can enroll themselves
CREATE POLICY "Students can enroll"
  ON public.enrollments FOR INSERT
  WITH CHECK (
    auth.uid() = student_id AND
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'student'
  );

-- CRs can delete enrollments from their sections
CREATE POLICY "CRs can delete enrollments"
  ON public.enrollments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.sections 
      WHERE sections.id = enrollments.section_id 
      AND sections.cr_id = auth.uid()
    )
  );

-- =============================================
-- 4. ACTIVITIES TABLE (replaces activities collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  cr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('assignment', 'quiz', 'lab', 'presentation')),
  due_date TIMESTAMPTZ NOT NULL,
  submission_type TEXT NOT NULL CHECK (submission_type IN ('online', 'physical')),
  submission_link TEXT,
  submission_location TEXT,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'draft', 'archived')),
  submission_count INTEGER DEFAULT 0,
  completed_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_activities_section_id ON public.activities(section_id);
CREATE INDEX idx_activities_cr_id ON public.activities(cr_id);
CREATE INDEX idx_activities_due_date ON public.activities(due_date);

-- RLS Policies
ALTER TABLE public.activities ENABLE ROW LEVEL SECURITY;

-- Students can read activities for their enrolled sections
CREATE POLICY "Students can read section activities"
  ON public.activities FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE enrollments.section_id = activities.section_id 
      AND enrollments.student_id = auth.uid()
    )
  );

-- CRs can read their own activities
CREATE POLICY "CRs can read own activities"
  ON public.activities FOR SELECT
  USING (auth.uid() = cr_id);

-- CRs can create activities
CREATE POLICY "CRs can create activities"
  ON public.activities FOR INSERT
  WITH CHECK (
    auth.uid() = cr_id AND
    EXISTS (
      SELECT 1 FROM public.sections 
      WHERE sections.id = section_id 
      AND sections.cr_id = auth.uid()
    )
  );

-- CRs can update their own activities
CREATE POLICY "CRs can update own activities"
  ON public.activities FOR UPDATE
  USING (auth.uid() = cr_id);

-- CRs can delete their own activities
CREATE POLICY "CRs can delete own activities"
  ON public.activities FOR DELETE
  USING (auth.uid() = cr_id);

-- =============================================
-- 5. ANNOUNCEMENTS TABLE (replaces announcements collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  cr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cr_name TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived')),
  read_by UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_announcements_section_id ON public.announcements(section_id);
CREATE INDEX idx_announcements_cr_id ON public.announcements(cr_id);

-- RLS Policies
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- Students can read announcements for their enrolled sections
CREATE POLICY "Students can read section announcements"
  ON public.announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE enrollments.section_id = announcements.section_id 
      AND enrollments.student_id = auth.uid()
    )
  );

-- CRs can read their own announcements
CREATE POLICY "CRs can read own announcements"
  ON public.announcements FOR SELECT
  USING (auth.uid() = cr_id);

-- CRs can create announcements
CREATE POLICY "CRs can create announcements"
  ON public.announcements FOR INSERT
  WITH CHECK (
    auth.uid() = cr_id AND
    EXISTS (
      SELECT 1 FROM public.sections 
      WHERE sections.id = section_id 
      AND sections.cr_id = auth.uid()
    )
  );

-- CRs can update their own announcements
CREATE POLICY "CRs can update own announcements"
  ON public.announcements FOR UPDATE
  USING (auth.uid() = cr_id);

-- CRs can delete their own announcements
CREATE POLICY "CRs can delete own announcements"
  ON public.announcements FOR DELETE
  USING (auth.uid() = cr_id);

-- Students can update read_by for announcements they can read
CREATE POLICY "Students can mark announcements as read"
  ON public.announcements FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE enrollments.section_id = announcements.section_id 
      AND enrollments.student_id = auth.uid()
    )
  );

-- =============================================
-- 6. POLLS TABLE (replaces Firebase Realtime Database polls)
-- =============================================
CREATE TABLE IF NOT EXISTS public.polls (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  cr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cr_name TEXT NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL, -- Array of {id, text, votes}
  allow_multiple BOOLEAN DEFAULT FALSE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'closed', 'draft')),
  total_responses INTEGER DEFAULT 0,
  responded_users UUID[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_polls_section_id ON public.polls(section_id);
CREATE INDEX idx_polls_cr_id ON public.polls(cr_id);

-- RLS Policies
ALTER TABLE public.polls ENABLE ROW LEVEL SECURITY;

-- Students can read polls for their enrolled sections
CREATE POLICY "Students can read section polls"
  ON public.polls FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE enrollments.section_id = polls.section_id 
      AND enrollments.student_id = auth.uid()
    )
  );

-- CRs can read their own polls
CREATE POLICY "CRs can read own polls"
  ON public.polls FOR SELECT
  USING (auth.uid() = cr_id);

-- CRs can create polls
CREATE POLICY "CRs can create polls"
  ON public.polls FOR INSERT
  WITH CHECK (
    auth.uid() = cr_id AND
    EXISTS (
      SELECT 1 FROM public.sections 
      WHERE sections.id = section_id 
      AND sections.cr_id = auth.uid()
    )
  );

-- CRs can update their own polls
CREATE POLICY "CRs can update own polls"
  ON public.polls FOR UPDATE
  USING (auth.uid() = cr_id);

-- Students can update polls to submit responses
CREATE POLICY "Students can submit poll responses"
  ON public.polls FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.enrollments 
      WHERE enrollments.section_id = polls.section_id 
      AND enrollments.student_id = auth.uid()
    )
  );

-- CRs can delete their own polls
CREATE POLICY "CRs can delete own polls"
  ON public.polls FOR DELETE
  USING (auth.uid() = cr_id);

-- =============================================
-- 7. POLL RESPONSES TABLE (for detailed tracking)
-- =============================================
CREATE TABLE IF NOT EXISTS public.poll_responses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  poll_id UUID NOT NULL REFERENCES public.polls(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  student_name TEXT NOT NULL,
  selected_options INTEGER[] NOT NULL,
  responded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(poll_id, student_id)
);

-- Indexes
CREATE INDEX idx_poll_responses_poll_id ON public.poll_responses(poll_id);
CREATE INDEX idx_poll_responses_student_id ON public.poll_responses(student_id);

-- RLS Policies
ALTER TABLE public.poll_responses ENABLE ROW LEVEL SECURITY;

-- Students can read their own responses
CREATE POLICY "Students can read own responses"
  ON public.poll_responses FOR SELECT
  USING (auth.uid() = student_id);

-- CRs can read responses for their polls
CREATE POLICY "CRs can read poll responses"
  ON public.poll_responses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.polls 
      WHERE polls.id = poll_responses.poll_id 
      AND polls.cr_id = auth.uid()
    )
  );

-- Students can submit responses
CREATE POLICY "Students can submit responses"
  ON public.poll_responses FOR INSERT
  WITH CHECK (
    auth.uid() = student_id AND
    EXISTS (
      SELECT 1 FROM public.enrollments e
      JOIN public.polls p ON p.section_id = e.section_id
      WHERE p.id = poll_id AND e.student_id = auth.uid()
    )
  );

-- =============================================
-- 8. RESOURCES TABLE (replaces resources collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  uploader_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  uploader_name TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  course TEXT NOT NULL,
  topic TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('pdf', 'video', 'link')),
  url TEXT NOT NULL,
  thumbnail_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_resources_uploader_id ON public.resources(uploader_id);
CREATE INDEX idx_resources_course ON public.resources(course);
CREATE INDEX idx_resources_type ON public.resources(type);

-- RLS Policies
ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read resources
CREATE POLICY "Authenticated users can read resources"
  ON public.resources FOR SELECT
  USING (auth.role() = 'authenticated');

-- Anyone authenticated can create resources
CREATE POLICY "Authenticated users can create resources"
  ON public.resources FOR INSERT
  WITH CHECK (auth.uid() = uploader_id);

-- Users can update their own resources
CREATE POLICY "Users can update own resources"
  ON public.resources FOR UPDATE
  USING (auth.uid() = uploader_id);

-- Users can delete their own resources
CREATE POLICY "Users can delete own resources"
  ON public.resources FOR DELETE
  USING (auth.uid() = uploader_id);

-- =============================================
-- 9. NOTIFICATIONS TABLE (replaces notifications collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  cr_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  cr_name TEXT NOT NULL,
  student_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('task', 'announcement', 'poll', 'task_created', 'announcement_created', 'poll_created')),
  related_id UUID,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_notifications_student_id ON public.notifications(student_id);
CREATE INDEX idx_notifications_section_id ON public.notifications(section_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);

-- RLS Policies
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can read their own notifications
CREATE POLICY "Users can read own notifications"
  ON public.notifications FOR SELECT
  USING (auth.uid() = student_id);

-- CRs can create notifications for their sections
CREATE POLICY "CRs can create notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (
    auth.uid() = cr_id AND
    EXISTS (
      SELECT 1 FROM public.sections 
      WHERE sections.id = section_id 
      AND sections.cr_id = auth.uid()
    )
  );

-- Users can update their own notifications (mark as read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = student_id);

-- =============================================
-- 10. ONESIGNAL SUBSCRIPTIONS TABLE
-- =============================================
CREATE TABLE IF NOT EXISTS public.onesignal_subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  section_id UUID REFERENCES public.sections(id) ON DELETE CASCADE,
  player_id TEXT NOT NULL,
  subscription_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, section_id, player_id)
);

-- Indexes
CREATE INDEX idx_onesignal_user_id ON public.onesignal_subscriptions(user_id);
CREATE INDEX idx_onesignal_section_id ON public.onesignal_subscriptions(section_id);

-- RLS Policies
ALTER TABLE public.onesignal_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can manage their own subscriptions
CREATE POLICY "Users can manage own subscriptions"
  ON public.onesignal_subscriptions FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =============================================
-- TRIGGERS for updated_at timestamps
-- =============================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to all tables
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_sections_updated_at BEFORE UPDATE ON public.sections FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_activities_updated_at BEFORE UPDATE ON public.activities FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_announcements_updated_at BEFORE UPDATE ON public.announcements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_polls_updated_at BEFORE UPDATE ON public.polls FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_resources_updated_at BEFORE UPDATE ON public.resources FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- =============================================
-- FUNCTIONS for automatic counters
-- =============================================

-- Update section student count when enrollment changes
CREATE OR REPLACE FUNCTION update_section_student_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sections 
    SET student_count = student_count + 1 
    WHERE id = NEW.section_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sections 
    SET student_count = GREATEST(0, student_count - 1)
    WHERE id = OLD.section_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER enrollment_count_trigger
AFTER INSERT OR DELETE ON public.enrollments
FOR EACH ROW EXECUTE FUNCTION update_section_student_count();

-- Update section activity count when activity changes
CREATE OR REPLACE FUNCTION update_section_activity_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.sections 
    SET activity_count = activity_count + 1 
    WHERE id = NEW.section_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.sections 
    SET activity_count = GREATEST(0, activity_count - 1)
    WHERE id = OLD.section_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_count_trigger
AFTER INSERT OR DELETE ON public.activities
FOR EACH ROW EXECUTE FUNCTION update_section_activity_count();

-- =============================================
-- 11. COURSE RESOURCES TABLE (replaces courseResources collection)
-- =============================================
CREATE TABLE IF NOT EXISTS public.course_resources (
  id TEXT PRIMARY KEY, -- Format: {sectionId}_{courseCode}
  section_id UUID NOT NULL REFERENCES public.sections(id) ON DELETE CASCADE,
  cr_id UUID NOT NULL REFERENCES public.users(id),
  course_code TEXT NOT NULL,
  course_name TEXT NOT NULL,
  telegram_link TEXT,
  whatsapp_link TEXT,
  blc_link TEXT,
  enrollment_key TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(section_id, course_code)
);

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_course_resources_section ON public.course_resources(section_id);
CREATE INDEX IF NOT EXISTS idx_course_resources_cr ON public.course_resources(cr_id);

-- RLS Policies for course_resources
ALTER TABLE public.course_resources ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read course resources
CREATE POLICY "Authenticated users can read course resources"
  ON public.course_resources FOR SELECT
  TO authenticated
  USING (true);

-- Only CR can create course resources for their section
CREATE POLICY "CR can create course resources for their section"
  ON public.course_resources FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.sections
      WHERE sections.id = course_resources.section_id
      AND sections.cr_id = auth.uid()
    )
  );

-- Only CR can update their course resources
CREATE POLICY "CR can update their course resources"
  ON public.course_resources FOR UPDATE
  TO authenticated
  USING (cr_id = auth.uid());

-- Only CR can delete their course resources
CREATE POLICY "CR can delete their course resources"
  ON public.course_resources FOR DELETE
  TO authenticated
  USING (cr_id = auth.uid());

-- Trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_course_resources_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER course_resources_updated_at
  BEFORE UPDATE ON public.course_resources
  FOR EACH ROW
  EXECUTE FUNCTION update_course_resources_updated_at();

-- =============================================
-- ENABLE REALTIME for tables that need it
-- =============================================
-- Run these commands in Supabase dashboard or via API:
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.polls;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.announcements;
-- ALTER PUBLICATION supabase_realtime ADD TABLE public.activities;

-- =============================================
-- STORAGE BUCKETS (Create via Supabase Dashboard)
-- =============================================
-- Bucket name: resources
-- Public: true
-- File size limit: 10MB
-- Allowed MIME types: application/pdf

-- =============================================
-- MIGRATION COMPLETE
-- =============================================
-- TODO: Execute this SQL in Supabase SQL Editor
-- TODO: Create storage bucket 'resources' with public access
-- TODO: Enable Realtime for notifications, polls, announcements, activities tables
-- TODO: Set up OneSignal app and get App ID
