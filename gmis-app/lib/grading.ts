// ============================================================
// GMIS — Grading Helpers
// Grading: CA/40 + Exam/60 = Total/100
// A(5.0)=70+  B(4.0)=60-69  C(3.0)=50-59
// D(2.0)=45-49  E(1.0)=40-44  F(0.0)=0-39
// ============================================================

/* · · · · · · · · · · · · · · · · · · · · · · · · · · · · ·
   GMIS · A product of DAMS Technologies · gmis.app
   · · · · · · · · · · · · · · · · · · · · · · · · · · · · · */

export const CA_MAX   = 40;
export const EXAM_MAX = 60;

// ── Grade from total score ─────────────────────────────────
export function calcGrade(total: number): string {
  if (total >= 70) return "A";
  if (total >= 60) return "B";
  if (total >= 50) return "C";
  if (total >= 45) return "D";
  if (total >= 40) return "E";
  return "F";
}

// ── Grade points ───────────────────────────────────────────
export const GRADE_POINTS: Record<string, number> = {
  A: 5, B: 4, C: 3, D: 2, E: 1, F: 0,
};

export function gradePoint(grade: string): number {
  return GRADE_POINTS[grade] ?? 0;
}

// ── Grade colour for display ───────────────────────────────
export function gradeColor(grade: string, isDark = true): string {
  const dark: Record<string, string> = {
    A: "#4ade80", B: "#60a5fa", C: "#fbbf24",
    D: "#fb923c", E: "#f97316", F: "#f87171",
  };
  const light: Record<string, string> = {
    A: "#16a34a", B: "#2563eb", C: "#b45309",
    D: "#c2410c", E: "#9a3412", F: "#dc2626",
  };
  return (isDark ? dark : light)[grade] ?? "#7a8bbf";
}

// ── GPA for a single semester ──────────────────────────────
export interface GradeRow {
  credit_units: number;
  grade:        string;
}

export function calcGPA(rows: GradeRow[]): number {
  const totalUnits  = rows.reduce((s, r) => s + (r.credit_units ?? 0), 0);
  const totalPoints = rows.reduce((s, r) => s + gradePoint(r.grade) * (r.credit_units ?? 0), 0);
  return totalUnits > 0 ? totalPoints / totalUnits : 0;
}

// ── CGPA across multiple semesters ────────────────────────
export function calcCGPA(allRows: GradeRow[]): number {
  return calcGPA(allRows);
}

// ── Format to 2dp ─────────────────────────────────────────
export function formatGPA(gpa: number): string {
  if (!gpa || gpa < 0) return "0.00";
  return Math.min(gpa, 5).toFixed(2);
}

// ── Honour class ──────────────────────────────────────────
export function getHonourClass(gpa: number): string {
  if (gpa >= 4.5) return "First Class Honours";
  if (gpa >= 3.5) return "Second Class (Upper)";
  if (gpa >= 2.5) return "Second Class (Lower)";
  if (gpa >= 1.5) return "Third Class";
  if (gpa >= 1.0) return "Pass";
  return "Fail";
}
