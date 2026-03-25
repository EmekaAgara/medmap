export default function Pagination({ page, pages, onPage }) {
  if (pages <= 1) return null;
  return (
    <div className="flex items-center gap-2 justify-end mt-4">
      <button
        onClick={() => onPage(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 text-xs rounded-token border border-nm-border text-nm-muted hover:bg-nm-secondary disabled:opacity-40 transition-colors"
      >
        ← Prev
      </button>
      <span className="text-xs text-nm-muted">Page {page} of {pages}</span>
      <button
        onClick={() => onPage(page + 1)}
        disabled={page >= pages}
        className="px-3 py-1.5 text-xs rounded-token border border-nm-border text-nm-muted hover:bg-nm-secondary disabled:opacity-40 transition-colors"
      >
        Next →
      </button>
    </div>
  );
}
