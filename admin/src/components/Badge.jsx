const VARIANTS = {
  green:  'bg-green-500/10 text-green-500 border border-green-500/20',
  yellow: 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20',
  red:    'bg-red-500/10 text-red-500 border border-red-500/20',
  blue:   'bg-blue-500/10 text-blue-500 border border-blue-500/20',
  gray:   'bg-nm-secondary text-nm-muted border border-nm-border',
  gold:   'bg-gold/10 text-gold border border-gold/20',
};

export default function Badge({ children, variant = 'gray' }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${VARIANTS[variant]}`}>
      {children}
    </span>
  );
}

export function KycBadge({ status }) {
  const map = {
    approved: ['green',  'Verified'],
    pending:  ['yellow', 'Pending'],
    rejected: ['red',    'Rejected'],
    none:     ['gray',   'Not started'],
  };
  const [variant, label] = map[status] || ['gray', status ?? '—'];
  return <Badge variant={variant}>{label}</Badge>;
}
