-- ==============================================================================
-- 視覺化智慧點名系統 (Attendance AI System)
-- PostgreSQL / Supabase Cloud Database Schema & RLS Policies
-- ==============================================================================

-- 啟用必要的擴充功能
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------------------------
-- 1. 學校實體 (Schools)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 2. 使用者個人資訊 (Profiles) - 整合 Supabase Auth
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    role TEXT NOT NULL CHECK (role IN ('sys_admin', 'school_admin', 'teacher')),
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 3. 班級實體 (Classes)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    grade TEXT NOT NULL,
    academic_year TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 4. 班級與任課教師關聯 (Class Teachers)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.class_teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (class_id, teacher_id)
);

-- ------------------------------------------------------------------------------
-- 5. 學生名冊 (Students)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    student_number TEXT NOT NULL,
    name TEXT NOT NULL,
    seat_number INTEGER NOT NULL,
    gender TEXT,
    parent_phone TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (school_id, student_number)
);

-- ------------------------------------------------------------------------------
-- 6. 教室座位表 (Seating Charts)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seating_charts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    name TEXT NOT NULL DEFAULT '預設座位表',
    aspect_ratio TEXT NOT NULL DEFAULT '16:9',
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 7. 座位座標框 (Seating Boxes) - 正規化比例 0.0 ~ 1.0
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.seating_boxes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    chart_id UUID NOT NULL REFERENCES public.seating_charts(id) ON DELETE CASCADE,
    student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
    seat_label TEXT NOT NULL,
    x_ratio DOUBLE PRECISION NOT NULL,
    y_ratio DOUBLE PRECISION NOT NULL,
    w_ratio DOUBLE PRECISION NOT NULL,
    h_ratio DOUBLE PRECISION NOT NULL,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 8. 點名場次紀錄 (Attendance Sessions)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
    teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    chart_id UUID REFERENCES public.seating_charts(id) ON DELETE SET NULL,
    session_date DATE NOT NULL DEFAULT CURRENT_DATE,
    period TEXT,
    snapshot_path TEXT,
    detection_raw_json JSONB,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- ------------------------------------------------------------------------------
-- 9. 學生個別出勤紀錄 (Attendance Records)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave')),
    ai_detected_status TEXT CHECK (ai_detected_status IN ('present', 'absent')),
    is_overridden BOOLEAN NOT NULL DEFAULT false,
    note TEXT,
    created_at TIMESTAMPTZ DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    UNIQUE (session_id, student_id)
);

-- ------------------------------------------------------------------------------
-- 10. 輔助函式：取得目前使用者之角色與學校識別碼
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS TEXT
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT role FROM public.profiles WHERE id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.current_user_school_id()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT school_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ------------------------------------------------------------------------------
-- 11. 家長免登入雙重校驗查詢 RPC (Security Definer)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.query_student_attendance(
    p_student_number TEXT,
    p_parent_phone_last4 TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_student RECORD;
    v_records JSONB;
BEGIN
    -- 1. 查找符合學號且家長電話後四碼一致之學生
    SELECT s.id, s.name, s.student_number, s.seat_number, c.name AS class_name, sch.name AS school_name
    INTO v_student
    FROM public.students s
    JOIN public.classes c ON c.id = s.class_id
    JOIN public.schools sch ON sch.id = s.school_id
    WHERE s.student_number = p_student_number
      AND RIGHT(REPLACE(s.parent_phone, '-', ''), 4) = p_parent_phone_last4
    LIMIT 1;

    IF v_student.id IS NULL THEN
        RETURN jsonb_build_object('success', false, 'message', '學號或家長電話後四碼校驗不符合');
    END IF;

    -- 2. 獲取近 30 筆出勤歷史
    SELECT jsonb_agg(
        jsonb_build_object(
            'record_id', r.id,
            'date', sess.session_date,
            'period', sess.period,
            'status', r.status,
            'ai_detected_status', r.ai_detected_status,
            'is_overridden', r.is_overridden,
            'note', r.note,
            'snapshot_path', sess.snapshot_path,
            'created_at', r.created_at
        ) ORDER BY sess.session_date DESC, sess.created_at DESC
    )
    INTO v_records
    FROM public.attendance_records r
    JOIN public.attendance_sessions sess ON sess.id = r.session_id
    WHERE r.student_id = v_student.id;

    RETURN jsonb_build_object(
        'success', true,
        'student', jsonb_build_object(
            'id', v_student.id,
            'name', v_student.name,
            'student_number', v_student.student_number,
            'seat_number', v_student.seat_number,
            'class_name', v_student.class_name,
            'school_name', v_student.school_name
        ),
        'records', COALESCE(v_records, '[]'::jsonb)
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 12. 行級安全策略 (Row Level Security - RLS)
-- ------------------------------------------------------------------------------
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.class_teachers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_charts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.seating_boxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;

-- Schools 權限
CREATE POLICY "Schools sys_admin full access" ON public.schools
    FOR ALL USING (public.current_user_role() = 'sys_admin');
CREATE POLICY "Schools authenticated read access" ON public.schools
    FOR SELECT TO authenticated USING (true);

-- Profiles 權限
CREATE POLICY "Profiles self access" ON public.profiles
    FOR ALL USING (auth.uid() = id);
CREATE POLICY "Profiles sys_admin full access" ON public.profiles
    FOR ALL USING (public.current_user_role() = 'sys_admin');
CREATE POLICY "Profiles school_admin read/manage in school" ON public.profiles
    FOR ALL USING (
        public.current_user_role() = 'school_admin'
        AND school_id = public.current_user_school_id()
    );
CREATE POLICY "Profiles read in same school" ON public.profiles
    FOR SELECT TO authenticated USING (
        school_id = public.current_user_school_id()
    );

-- Classes 權限
CREATE POLICY "Classes sys_admin full" ON public.classes
    FOR ALL USING (public.current_user_role() = 'sys_admin');
CREATE POLICY "Classes school_admin manage" ON public.classes
    FOR ALL USING (
        public.current_user_role() = 'school_admin'
        AND school_id = public.current_user_school_id()
    );
CREATE POLICY "Classes teacher read" ON public.classes
    FOR SELECT TO authenticated USING (
        school_id = public.current_user_school_id()
    );

-- Class Teachers 權限
CREATE POLICY "Class teachers manage" ON public.class_teachers
    FOR ALL TO authenticated USING (
        public.current_user_role() IN ('sys_admin', 'school_admin')
        OR teacher_id = auth.uid()
    );

-- Students 權限
CREATE POLICY "Students manage" ON public.students
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR (
            school_id = public.current_user_school_id()
            AND public.current_user_role() IN ('school_admin', 'teacher')
        )
    );

-- Seating Charts & Boxes 權限
CREATE POLICY "Seating charts access" ON public.seating_charts
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR class_id IN (
            SELECT c.id FROM public.classes c WHERE c.school_id = public.current_user_school_id()
        )
    );

CREATE POLICY "Seating boxes access" ON public.seating_boxes
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR chart_id IN (
            SELECT sc.id FROM public.seating_charts sc
            JOIN public.classes c ON c.id = sc.class_id
            WHERE c.school_id = public.current_user_school_id()
        )
    );

-- Attendance Sessions & Records 權限
CREATE POLICY "Attendance sessions access" ON public.attendance_sessions
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR class_id IN (
            SELECT c.id FROM public.classes c WHERE c.school_id = public.current_user_school_id()
        )
    );

CREATE POLICY "Attendance records access" ON public.attendance_records
    FOR ALL TO authenticated USING (
        public.current_user_role() = 'sys_admin'
        OR session_id IN (
            SELECT s.id FROM public.attendance_sessions s
            JOIN public.classes c ON c.id = s.class_id
            WHERE c.school_id = public.current_user_school_id()
        )
    );

-- ------------------------------------------------------------------------------
-- 13. 自動化觸發器：在 auth.users 註冊時同步建立 profiles 記錄
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO public.profiles (id, school_id, role, name, email, phone)
    VALUES (
        NEW.id,
        (NEW.raw_user_meta_data->>'school_id')::uuid,
        COALESCE(NEW.raw_user_meta_data->>'role', 'teacher'),
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
        NEW.email,
        NEW.raw_user_meta_data->>'phone'
    );
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ------------------------------------------------------------------------------
-- 14. 安全預存程序：學校單位開通與多主管綁定 (register_school_admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.register_school_admin(
    p_school_name TEXT,
    p_school_code TEXT,
    p_admin_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
    v_school_id UUID;
    v_clean_code TEXT;
    v_user_email TEXT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION '未經身分驗證，無法執行學校主管開通';
    END IF;

    v_clean_code := UPPER(TRIM(p_school_code));

    -- 取得呼叫者信箱
    SELECT email INTO v_user_email FROM auth.users WHERE id = v_user_id;

    -- 檢查學校是否已存在（支援既有學校加入新主管）
    SELECT id INTO v_school_id FROM public.schools WHERE code = v_clean_code;

    IF v_school_id IS NULL THEN
        -- 學校不存在，建立新學校
        INSERT INTO public.schools (name, code)
        VALUES (TRIM(p_school_name), v_clean_code)
        RETURNING id INTO v_school_id;
    END IF;

    -- 配置或更新呼叫者的 Profile 為該校主管
    INSERT INTO public.profiles (id, school_id, role, name, email, phone)
    VALUES (
        v_user_id,
        v_school_id,
        'school_admin',
        TRIM(p_admin_name),
        v_user_email,
        p_phone
    )
    ON CONFLICT (id) DO UPDATE SET
        school_id = v_school_id,
        role = 'school_admin',
        name = TRIM(p_admin_name),
        phone = p_phone,
        updated_at = TIMEZONE('utc'::text, NOW());

    RETURN jsonb_build_object(
        'success', true,
        'school_id', v_school_id,
        'school_code', v_clean_code
    );
END;
$$;

-- ------------------------------------------------------------------------------
-- 15. 系統總管安全預存程序：主管解任與指派 (remove_school_admin / assign_school_admin)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.remove_school_admin(p_profile_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF public.current_user_role() != 'sys_admin' THEN
        RAISE EXCEPTION '權限不足，僅系統總管可執行解任操作';
    END IF;

    UPDATE public.profiles
    SET school_id = NULL, role = 'teacher', updated_at = TIMEZONE('utc'::text, NOW())
    WHERE id = p_profile_id;

    RETURN jsonb_build_object('success', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.assign_school_admin(
    p_school_id UUID,
    p_email TEXT,
    p_name TEXT,
    p_phone TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_target_id UUID;
BEGIN
    IF public.current_user_role() != 'sys_admin' THEN
        RAISE EXCEPTION '權限不足，僅系統總管可指派學校主管';
    END IF;

    SELECT id INTO v_target_id FROM public.profiles WHERE LOWER(email) = LOWER(TRIM(p_email));

    IF v_target_id IS NOT NULL THEN
        UPDATE public.profiles
        SET school_id = p_school_id,
            role = 'school_admin',
            name = COALESCE(NULLIF(TRIM(p_name), ''), name),
            phone = COALESCE(p_phone, phone),
            updated_at = TIMEZONE('utc'::text, NOW())
        WHERE id = v_target_id;

        RETURN jsonb_build_object('success', true, 'action', 'updated');
    ELSE
        RETURN jsonb_build_object('success', false, 'error', '查無此信箱之帳號，請請該員先進行註冊');
    END IF;
END;
$$;
