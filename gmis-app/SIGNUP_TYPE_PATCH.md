// ============================================================
// PATCH for signup.tsx — fix Department type
// Replace the existing Department interface with this one.
// The faculties join returns an ARRAY from Supabase, not a
// single object, so type it as array and access [0] safely.
// ============================================================

// FIND this in signup.tsx and REPLACE:
//
// interface Department {
//   id:        string;
//   name:      string;
//   code:      string;
//   faculties: { name: string } | null;
// }
//
// REPLACE WITH:
//
// interface Department {
//   id:        string;
//   name:      string;
//   code:      string;
//   faculties: { name: string }[] | null;   // ← array, not single object
// }
//
// THEN find the deptOptions map and update it:
//
// FIND:
//   d.name + (d.faculties?.name ? ` — ${d.faculties.name}` : ""),
//
// REPLACE WITH:
//   d.name + (d.faculties?.[0]?.name ? ` — ${d.faculties[0].name}` : ""),
