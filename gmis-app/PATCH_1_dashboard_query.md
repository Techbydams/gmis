// ============================================================
// GMIS — Dashboard student query PATCH
// 
// REPLACE the entire load() function's student query block
// with the version below. Removes avatar_url which does not
// exist in the tenant DB schema.
// ============================================================

// FIND this in dashboard.tsx and REPLACE:
//
//   const { data: s, error: sErr } = await db
//     .from("students")
//     .select("id, first_name, last_name, matric_number, level, status, gpa, cgpa, avatar_url, department_id")
//     .eq("supabase_uid", user.id)
//     .maybeSingle();
//
// REPLACE WITH:
//
//   const { data: s, error: sErr } = await db
//     .from("students")
//     .select("id, first_name, last_name, matric_number, level, status, gpa, cgpa, department_id")
//     .eq("supabase_uid", user.id)
//     .maybeSingle();
//
// Also REMOVE avatar_url from the Student interface:
// REMOVE:  avatar_url?: string | null;
// REMOVE:  avatarUrl: student?.avatar_url,  (in shellUser)
