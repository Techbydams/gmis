// ============================================================
// GMIS — Utility / Helper Functions
// ============================================================

// ── SUBDOMAIN DETECTION ───────────────────────────────────

// Subdomains that are NOT tenant slugs — treated as main platform
const RESERVED_SUBDOMAINS = new Set(['www', 'app', 'api', 'admin', 'mail', 'smtp', 'ftp', 'cpanel'])

/**
 * Gets the school slug from the current URL subdomain.
 *
 * Examples:
 *   estam.gmis.app       → "estam"
 *   unilag.gmis.app      → "unilag"
 *   www.gmis.app         → null  (reserved, treated as main platform)
 *   gmis.app             → null  (main platform, no school)
 *   localhost:5173        → null  (local dev, use VITE_DEV_TENANT_SLUG instead)
 */
export const getTenantSlug = (): string | null => {
  const hostname = window.location.hostname

  // Local development — read from .env for testing a specific school
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return import.meta.env.VITE_DEV_TENANT_SLUG || null
  }

  const parts = hostname.split('.')

  // gmis.app has 2 parts → no subdomain → main platform
  // estam.gmis.app has 3 parts → "estam" is the slug
  if (parts.length >= 3) {
    const slug = parts[0].toLowerCase()
    // Ignore reserved subdomains — treat as main platform
    if (RESERVED_SUBDOMAINS.has(slug)) return null
    return slug
  }

  return null
}

/**
 * Checks if we're on the main platform (gmis.app)
 * vs a school's subdomain (estam.gmis.app)
 */
export const isMainPlatform = (): boolean => {
  return getTenantSlug() === null
}

/**
 * Builds a school's full portal URL from its slug
 */
export const getTenantUrl = (slug: string): string => {
  const hostname = window.location.hostname

  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    return `http://localhost:5173`
  }

  const protocol = window.location.protocol
  const domain = 'gmis.app'
  return `${protocol}//${slug}.${domain}`
}

/**
 * Redirects user to their school's portal
 */
export const redirectToTenant = (slug: string): void => {
  const url = getTenantUrl(slug)
  window.location.href = url
}

// ── STRING HELPERS ────────────────────────────────────────

export const nameToSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/university of |polytechnic of /g, '')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
}

export const titleCase = (str: string): string => {
  return str.replace(/\w\S*/g, (txt) =>
    txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase()
  )
}

// ── NUMBER/CURRENCY HELPERS ───────────────────────────────

export const formatNaira = (amount: number): string => {
  return `₦${amount.toLocaleString('en-NG')}`
}

export const formatGPA = (gpa: number): string => {
  return gpa.toFixed(2)
}

export const getHonourClass = (cgpa: number): string => {
  if (cgpa >= 4.5) return 'First Class Honours'
  if (cgpa >= 3.5) return 'Second Class Upper'
  if (cgpa >= 2.5) return 'Second Class Lower'
  if (cgpa >= 1.5) return 'Third Class'
  return 'Pass'
}

export const scoreToGrade = (total: number): { grade: string; points: number } => {
  if (total >= 70) return { grade: 'A', points: 5.0 }
  if (total >= 60) return { grade: 'B', points: 4.0 }
  if (total >= 50) return { grade: 'C', points: 3.0 }
  if (total >= 45) return { grade: 'D', points: 2.0 }
  if (total >= 40) return { grade: 'E', points: 1.0 }
  return { grade: 'F', points: 0.0 }
}

// ── DATE HELPERS ──────────────────────────────────────────

export const formatDate = (iso: string): string => {
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })
}

export const timeAgo = (iso: string): string => {
  const diff = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)

  if (minutes < 1) return 'Just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return formatDate(iso)
}

// ── VALIDATION HELPERS ────────────────────────────────────

export const isValidEmail = (email: string): boolean => {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export const isValidMatric = (matric: string): boolean => {
  return matric.trim().length >= 5
}

export const isValidPassword = (password: string): boolean => {
  return password.length >= 8
}

export const isValidSlug = (slug: string): boolean => {
  return /^[a-z0-9]{2,30}$/.test(slug)
}

// ── LOCAL STORAGE HELPERS ─────────────────────────────────

export const storage = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(key)
      return item ? JSON.parse(item) : null
    } catch {
      return null
    }
  },
  set: (key: string, value: unknown) => {
    try {
      localStorage.setItem(key, JSON.stringify(value))
    } catch {
      console.error('Failed to save to localStorage')
    }
  },
  remove: (key: string) => {
    localStorage.removeItem(key)
  },
}