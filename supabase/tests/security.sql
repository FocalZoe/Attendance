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
    v_student2 UUID := gen_random_uuid();
    v_count INTEGER;
    v_result JSONB;
BEGIN
    -- Fixtures (the auth.users trigger creates the profiles as unbound teachers)
    INSERT INTO public.schools (id, name, code) VALUES (v_school, 'Test School', 'SECTEST');
    INSERT INTO public.classes (id, school_id, name) VALUES (v_class1, v_school, 'C1'), (v_class2, v_school, 'C2');
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
    RESET ROLE;
END $$;

ROLLBACK;
