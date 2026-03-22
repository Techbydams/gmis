// TenantLoading.tsx — shown while detecting school from subdomain
export default function TenantLoading() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-slate-50 dark:bg-navy-950">
      <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-600 to-indigo-600 flex items-center justify-center text-white font-black text-2xl font-display shadow-lg shadow-blue-600/30 animate-pulse">
        G
      </div>
      <div className="w-8 h-8 border-2 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      <p className="text-sm text-slate-400">Loading your school portal...</p>
    </div>
  )
}
