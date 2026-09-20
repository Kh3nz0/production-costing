export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh items-center justify-center bg-surface-sunken px-4 py-9">
      <main className="w-full max-w-form-sm rounded-panel border border-border-strong bg-surface p-7 shadow-card">
        {children}
      </main>
    </div>
  );
}
