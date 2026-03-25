import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import Pagination from '../components/Pagination';
import { PageSpinner } from '../components/Spinner';
import { ui } from '../theme';

function relativeTime(dateStr) {
  const diff  = Date.now() - new Date(dateStr).getTime();
  const mins  = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days  = Math.floor(diff / 86400000);
  if (mins  < 1)  return 'just now';
  if (mins  < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days  < 7)  return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(1);

  const load = useCallback(() => {
    setLoading(true);
    apiRequest(`/admin/activity?page=${page}&limit=30`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className={ui.h1}>Login Activity</h1>
        <p className={`${ui.caption} mt-0.5`}>All login events across the platform.</p>
      </div>

      {error && <div className={ui.errorBanner}>{error}</div>}

      {loading ? <PageSpinner /> : (
        <>
          <div className={ui.tableWrap}>
            <table className="w-full text-sm">
              <thead className={ui.thead}>
                <tr>
                  <th className={ui.th}>User</th>
                  <th className={ui.th}>Event</th>
                  <th className={ui.th}>Device</th>
                  <th className={ui.th}>IP address</th>
                  <th className={ui.th}>When</th>
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {data?.events?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-nm-muted text-sm">
                      No events found
                    </td>
                  </tr>
                )}
                {data?.events?.map((e) => (
                  <tr
                    key={e._id}
                    className={`transition-colors ${
                      e.eventType === 'login_failed'
                        ? 'bg-red-500/5 hover:bg-red-500/10'
                        : 'hover:bg-nm-surface'
                    }`}
                  >
                    <td className={ui.td}>
                      {e.user
                        ? <Link to={`/users/${e.user._id}`} className="font-medium text-gold hover:opacity-80 transition-opacity">{e.user.fullName}</Link>
                        : <span className="text-nm-muted text-xs">Deleted user</span>
                      }
                      {e.user && <p className="text-xs text-nm-muted">{e.user.email}</p>}
                    </td>
                    <td className={ui.td}>
                      {e.eventType === 'login_failed'
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">⚠ Failed</span>
                        : <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-500/10 text-green-500 border border-green-500/20">✓ Login</span>
                      }
                    </td>
                    <td className={`${ui.td} text-xs text-nm-muted`}>
                      {e.deviceModel || '—'}{e.deviceOs ? ` · ${e.deviceOs}` : ''}
                    </td>
                    <td className={`${ui.td} text-xs font-mono text-nm-muted`}>{e.ip || '—'}</td>
                    <td className={`${ui.td} text-xs text-nm-muted`}>{relativeTime(e.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}
