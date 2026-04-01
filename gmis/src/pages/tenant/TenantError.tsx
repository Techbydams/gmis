// TenantError.tsx — shown when school slug is not found or locked
interface Props { message: string }

export default function TenantError({ message }: Props) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-5 bg-slate-50 dark:bg-navy-950 p-6 text-center">
      <div className="text-6xl">🏫</div>
      <h1 className="font-display font-bold text-2xl text-slate-800 dark:text-slate-200">School not found</h1>
      <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md">{message}</p>
      <a href="https://gmis.app/find" className="text-blue-600 text-sm font-medium hover:underline">
        ← Find your institution on GMIS
      </a>
    </div>
  )
}
