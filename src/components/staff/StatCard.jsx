export default function StatCard({ icon: Icon, label, value, hint }) {
  return (
    <div className="rounded-[24px] border border-border bg-card p-5">
      <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider text-muted-foreground">
        <Icon className="h-4 w-4 text-accent" /> {label}
      </div>
      <p className="mt-3 font-heading text-3xl font-extrabold text-primary">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}