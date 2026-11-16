-- Security checks for schema.sql. Run in the Supabase SQL Editor AFTER schema.sql.
-- Everything runs in one transaction and ends with ROLLBACK, so no data is kept.
-- A failed check raises an exception; "ROLLBACK" with no error means every check passed.
BEGIN;

DO $$
DECLARE
    v_school UUID := gen_random_uuid();
    v_class1 UUID := gen_random_uuid();
    v_class2 UUID := gen_random_uuid();
    v_teacher_a UUID := gen_random_uuid();
    v_teacher_b UUID := gen_random_uuid();
    v_teacher_c UUID := gen_random_uuid();
    v_student2 UUID := gen_random_uuid();
    v_count INTEGER;
    v_result JSONB;
BEGIN
    -- Fixtures (the auth.users trigger creates the profiles as unbound teachers)
    INSERT INTO public.schools (id, name, code) VALUES (v_school, 'Test School', 'SECTEST');
    INSERT INTO public.classes (id, school_id, name, grade, academic_year) VALUES
        (v_class1, v_school, 'C1', '1', '2026'),
        (v_class2, v_school, 'C2', '1', '2026');
    INSERT INTO auth.users (id, email, aud, role) VALUES
        (v_teacher_a, 'sec-a@example.test', 'authenticated', 'authenticated'),
        (v_teacher_b, 'sec-b@example.test', 'authenticated', 'authenticated');
    UPDATE public.profiles SET school_id = v_school WHERE id IN (v_teacher_a, v_teacher_b);
    INSERT INTO public.class_teachers (class_id, teacher_id, role) VALUES
        (v_class1, v_teacher_a, 'subject'),
        (v_class2, v_teacher_b, 'subject');
    INSERT INTO public.students (id, school_id, class_id, student_number, name, seat_number, parent_phone)
    VALUES (v_student2, v_school, v_class2, 'S200', 'Other Class Student', 1, '0912-345678');

    -- 1. Parent query locks after 5 wrong tries, even when the 6th try is correct
    FOR i IN 1..5 LOOP
        PERFORM public.query_student_attendance('SECTEST', 'S200', '0000');
    END LOOP;
    v_result := public.query_student_attendance('SECTEST', 'S200', '5678');
    IF (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'FAIL: parent query was not locked after 5 failures';
    END IF;

    -- 2. Parent query result never has more than 30 records
    DELETE FROM public.parent_query_attempts;
    v_result := public.query_student_attendance('SECTEST', 'S200', '5678');
    IF NOT (v_result->>'success')::boolean OR jsonb_array_length(v_result->'records') > 30 THEN
        RAISE EXCEPTION 'FAIL: correct parent query failed or returned more than 30 records';
    END IF;

    -- 3. Teacher A (assigned to C1 only) cannot delete a student of C2
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher_a, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_teacher_a::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.students WHERE id = v_student2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: teacher deleted a student of a class they are not assigned to';
    END IF;

    -- 4. Teacher A cannot assign themselves to C2
    BEGIN
        INSERT INTO public.class_teachers (class_id, teacher_id, role) VALUES (v_class2, v_teacher_a, 'subject');
        RAISE EXCEPTION 'FAIL: teacher added themselves to a class';
    EXCEPTION WHEN insufficient_privilege OR check_violation THEN
        NULL; -- expected: blocked by RLS
    END;

    -- 4b. Teacher A can read their own profile but not a colleague's contact details
    SELECT COUNT(*) INTO v_count FROM public.profiles WHERE id IN (v_teacher_a, v_teacher_b);
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FAIL: teacher should see only their own profile, saw %', v_count;
    END IF;
    RESET ROLE;

    -- 5. Teacher C (assigned to no class) cannot delete any student
    INSERT INTO auth.users (id, email, aud, role) VALUES (v_teacher_c, 'sec-c@example.test', 'authenticated', 'authenticated');
    UPDATE public.profiles SET school_id = v_school WHERE id = v_teacher_c;
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher_c, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_teacher_c::text, true);
    SET LOCAL ROLE authenticated;
    DELETE FROM public.students WHERE id = v_student2;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: teacher with no class assignment deleted a student';
    END IF;
    RESET ROLE;
END $$;

-- Second block: school-wide parent lockout, phone formats, record/session rules, layouts, public school list
DO $$
DECLARE
    v_school UUID := gen_random_uuid();
    v_other UUID := gen_random_uuid();
    v_class1 UUID := gen_random_uuid();
    v_class2 UUID := gen_random_uuid();
    v_teacher UUID := gen_random_uuid();
    v_outsider UUID := gen_random_uuid();
    v_s1 UUID := gen_random_uuid();
    v_s2 UUID := gen_random_uuid();
    v_session UUID := gen_random_uuid();
    v_count INTEGER;
    v_result JSONB;
BEGIN
    INSERT INTO public.schools (id, name, code) VALUES (v_school, 'Test School 2', 'SECT2'), (v_other, 'Test School 3', 'SECT3');
    INSERT INTO public.classes (id, school_id, name, grade, academic_year) VALUES
        (v_class1, v_school, 'C1', '1', '2026'),
        (v_class2, v_school, 'C2', '1', '2026');
    INSERT INTO auth.users (id, email, aud, role) VALUES
        (v_teacher, 'sec-d@example.test', 'authenticated', 'authenticated'),
        (v_outsider, 'sec-e@example.test', 'authenticated', 'authenticated');
    UPDATE public.profiles SET school_id = v_school WHERE id = v_teacher;
    UPDATE public.profiles SET school_id = v_other WHERE id = v_outsider;
    INSERT INTO public.class_teachers (class_id, teacher_id, role) VALUES (v_class1, v_teacher, 'subject');
    INSERT INTO public.students (id, school_id, class_id, student_number, name, seat_number, parent_phone) VALUES
        (v_s1, v_school, v_class1, 'N1', 'Student One', 1, '0912 345 678'),
        (v_s2, v_school, v_class2, 'N2', 'Student Two', 1, '0912-345-111');
    INSERT INTO public.seating_layouts (school_id, name, boxes)
    VALUES (v_school, 'Layout', '[{"seat_label":"1","x_ratio":0.1,"y_ratio":0.1,"w_ratio":0.1,"h_ratio":0.1}]'::jsonb);

    -- 1. A phone number with spaces still matches on its last 4 digits
    v_result := public.query_student_attendance('SECT2', 'N1', '5678');
    IF NOT (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'FAIL: phone with spaces did not match';
    END IF;

    -- 2. 50 wrong guesses across different student numbers lock the whole school
    FOR i IN 1..50 LOOP
        PERFORM public.query_student_attendance('SECT2', 'GUESS' || i, '0000');
    END LOOP;
    v_result := public.query_student_attendance('SECT2', 'N1', '5678');
    IF (v_result->>'success')::boolean THEN
        RAISE EXCEPTION 'FAIL: school-wide lock did not apply';
    END IF;

    -- 3. Seating layout boxes must be a non-empty array
    BEGIN
        INSERT INTO public.seating_layouts (school_id, name, boxes) VALUES (v_school, 'Bad', '[]'::jsonb);
        RAISE EXCEPTION 'FAIL: empty layout was accepted';
    EXCEPTION WHEN check_violation THEN
        NULL; -- expected
    END;

    -- 4. Assigned teacher: can start a session, cannot add another class's student, cannot repeat the same period
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_teacher::text, true);
    SET LOCAL ROLE authenticated;

    INSERT INTO public.attendance_sessions (id, class_id, teacher_id, session_date, period)
    VALUES (v_session, v_class1, v_teacher, CURRENT_DATE, '1');

    BEGIN
        INSERT INTO public.attendance_records (session_id, student_id, status) VALUES (v_session, v_s2, 'present');
        RAISE EXCEPTION 'FAIL: record for another class student was accepted';
    EXCEPTION WHEN insufficient_privilege THEN
        NULL; -- expected: blocked by RLS
    END;

    INSERT INTO public.attendance_records (session_id, student_id, status) VALUES (v_session, v_s1, 'present');

    BEGIN
        PERFORM public.save_rollcall(v_class1, NULL, CURRENT_DATE, '1', NULL, '{}'::jsonb, '[]'::jsonb);
        RAISE EXCEPTION 'FAIL: same period was saved twice';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; -- expected: the duplicate message
    END;
    RESET ROLE;

    -- 5. A user from another school cannot read this school's layouts
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_outsider, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_outsider::text, true);
    SET LOCAL ROLE authenticated;
    SELECT COUNT(*) INTO v_count FROM public.seating_layouts WHERE school_id = v_school;
    IF v_count <> 0 THEN
        RAISE EXCEPTION 'FAIL: layouts of another school were readable';
    END IF;
    RESET ROLE;

    -- 6. Signed-out visitors can list school names and codes for the parent page
    SET LOCAL ROLE anon;
    SELECT COUNT(*) INTO v_count FROM public.list_schools_for_parent();
    IF v_count < 2 THEN
        RAISE EXCEPTION 'FAIL: anon could not list schools';
    END IF;
    RESET ROLE;
END $$;

-- Third block: self-service school opening (register_school_admin)
DO $$
DECLARE
    v_school UUID := gen_random_uuid();
    v_teacher UUID := gen_random_uuid();
    v_fresh UUID := gen_random_uuid();
    v_count INTEGER;
BEGIN
    INSERT INTO public.schools (id, name, code) VALUES (v_school, 'Test School 4', 'SECT4');
    INSERT INTO auth.users (id, email, aud, role) VALUES
        (v_teacher, 'sec-f@example.test', 'authenticated', 'authenticated'),
        (v_fresh, 'sec-g@example.test', 'authenticated', 'authenticated');
    UPDATE public.profiles SET school_id = v_school WHERE id = v_teacher;

    -- 1. A teacher cannot promote themselves with their own school's code, nor open another school
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_teacher, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_teacher::text, true);
    BEGIN
        PERFORM public.register_school_admin('Test School 4', 'SECT4', 'T');
        RAISE EXCEPTION 'FAIL: teacher promoted themselves to school admin';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; -- expected: rejected
    END;
    BEGIN
        PERFORM public.register_school_admin('Brand New', 'SECT5', 'T');
        RAISE EXCEPTION 'FAIL: bound teacher opened a new school';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; -- expected: rejected
    END;
    IF (SELECT role FROM public.profiles WHERE id = v_teacher) <> 'teacher' THEN
        RAISE EXCEPTION 'FAIL: teacher role changed';
    END IF;

    -- 2. A fresh account cannot take over an existing code, can open one school, and only one
    PERFORM set_config('request.jwt.claims', json_build_object('sub', v_fresh, 'role', 'authenticated')::text, true);
    PERFORM set_config('request.jwt.claim.sub', v_fresh::text, true);
    BEGIN
        PERFORM public.register_school_admin('Test School 4', 'SECT4', 'F');
        RAISE EXCEPTION 'FAIL: fresh account took over an existing school';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; -- expected: rejected
    END;
    PERFORM public.register_school_admin('Fresh School', 'SECT6', 'F');
    PERFORM public.register_school_admin('Fresh School', 'SECT6', 'F'); -- a retried submit stays allowed
    BEGIN
        PERFORM public.register_school_admin('Second School', 'SECT7', 'F');
        RAISE EXCEPTION 'FAIL: one account opened a second school';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM LIKE 'FAIL:%' THEN RAISE; END IF; -- expected: rejected
    END;
    SELECT COUNT(*) INTO v_count FROM public.schools WHERE code IN ('SECT5', 'SECT6', 'SECT7');
    IF v_count <> 1 THEN
        RAISE EXCEPTION 'FAIL: expected exactly one new school, found %', v_count;
    END IF;
END $$;

ROLLBACK;
