// ============================================================
// GMIS — Theme Context (Dark / Light Mode)
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

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
  // Start with dark mode as default (matches our design)
  const [dark, setDark] = useState<boolean>(() => {
    const saved = localStorage.getItem('gmis-theme')
    if (saved !== null) return saved === 'dark'
    return true // default to dark
  })

  useEffect(() => {
    // Apply dark class to <html> element for Tailwind dark mode
    if (dark) {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
    localStorage.setItem('gmis-theme', dark ? 'dark' : 'light')
  }, [dark])

  const toggleTheme = () => setDark((d) => !d)

  return (
    <ThemeContext.Provider value={{ dark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export const useTheme = () => useContext(ThemeContext)
