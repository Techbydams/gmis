// ============================================================
// GMIS — Grading Utility
// CA = 40, Exam = 60, Total = 100
// Grade scale:
//   70–100 → A (5.0) Excellent
//   60–69  → B (4.0) Very Good
//   50–59  → C (3.0) Good
//   45–49  → D (2.0) Pass
//   40–44  → E (1.0) Pass
//   0–39   → F (0.0) Fail
// ============================================================

export const CA_MAX   = 40
export const EXAM_MAX = 60
export const TOTAL_MAX = 100

export interface GradeResult {
  grade:   string
  points:  number
  remark:  string
  label:   string
}

export function calcGrade(ca: number, exam: number): GradeResult {
  const total = (ca || 0) + (exam || 0)
  if (total >= 70) return { grade: 'A', points: 5.0, remark: 'pass', label: 'Excellent' }
  if (total >= 60) return { grade: 'B', points: 4.0, remark: 'pass', label: 'Very Good' }
  if (total >= 50) return { grade: 'C', points: 3.0, remark: 'pass', label: 'Good' }
  if (total >= 45) return { grade: 'D', points: 2.0, remark: 'pass', label: 'Pass' }
  if (total >= 40) return { grade: 'E', points: 1.0, remark: 'pass', label: 'Pass' }
  return             { grade: 'F', points: 0.0, remark: 'fail', label: 'Fail' }
}

export function gradeColor(grade: string): string {
  return { A: '#4ade80', B: '#60a5fa', C: '#fbbf24', D: '#fb923c', E: '#f97316', F: '#f87171' }[grade] || '#7a8bbf'
}

export interface ResultRow {
  credit_units: number
  grade_point:  number
}

/** GPA for a single semester */
export function calcGPA(rows: ResultRow[]): number {
  const valid = rows.filter(r => r.grade_point != null && r.credit_units > 0)
  if (!valid.length) return 0
  const totalPoints = valid.reduce((s, r) => s + r.grade_point * r.credit_units, 0)
  const totalUnits  = valid.reduce((s, r) => s + r.credit_units, 0)
  return totalUnits > 0 ? Math.round((totalPoints / totalUnits) * 100) / 100 : 0
}

/** CGPA across all semesters */
export function calcCGPA(allRows: ResultRow[]): number {
  return calcGPA(allRows)
}

export function formatGPA(gpa: number): string {
  return gpa.toFixed(2)
}

export function getHonourClass(cgpa: number): string {
  if (cgpa >= 4.50) return 'First Class Honours'
  if (cgpa >= 3.50) return 'Second Class Upper'
  if (cgpa >= 2.40) return 'Second Class Lower'
  if (cgpa >= 1.50) return 'Third Class'
  if (cgpa >= 1.00) return 'Pass'
  return 'Fail'
}