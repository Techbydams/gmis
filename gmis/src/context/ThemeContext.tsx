// ============================================================
// GMIS — Theme Context (Dark / Light Mode)
// FIXED: Dark class applied synchronously before first paint
//        to prevent flash of unstyled light mode content
// ============================================================

import { createContext, useContext, useState, useEffect, ReactNode } from 'react'

interface ThemeContextType {
  dark: boolean
  toggleTheme: () => void
}

const ThemeContext = createContext<ThemeContextType>({
  dark: true,
  toggleTheme: () => {},
})

// Read the saved theme preference immediately (synchronously)
// so we can apply the class before React hydrates
function getInitialDark(): boolean {
  try {
    const saved = localStorage.getItem('gmis-theme')
    if (saved !== null) return saved === 'dark'
  } catch {
    // localStorage not available (SSR or privacy mode)
  }
  return true // default to dark
}

// Apply the class to <html> immediately — called once at module load
// This prevents the flash of light mode before useEffect fires
;(function applyInitialTheme() {
  if (typeof document === 'undefined') return
  if (getInitialDark()) {
    document.documentElement.classList.add('dark')
  } else {
    document.documentElement.classList.remove('dark')
  }
})()

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  const [dark, setDark] = useState<boolean>(getInitialDark)

  useEffect(() => {
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    try {
      localStorage.setItem('gmis-theme', dark ? 'dark' : 'light')
    } catch {
      // ignore
    }
  }, [dark])

  const toggleTheme = () => setDark((d) => !d)

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)