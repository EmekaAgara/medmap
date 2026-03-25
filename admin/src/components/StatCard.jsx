export default function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-nm-card border border-nm-border rounded-xl p-5 flex flex-col gap-1 hover:border-nm-muted/40 transition-colors">
      <p className="text-xs text-nm-muted font-medium uppercase tracking-wide">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-nm-text'}`}>{value ?? '—'}</p>
      {sub && <p className="text-xs text-nm-muted">{sub}</p>}
    </div>
  );
}
