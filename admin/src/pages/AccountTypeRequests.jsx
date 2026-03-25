import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import Pagination from '../components/Pagination';
import { PageSpinner } from '../components/Spinner';
import { ui } from '../theme';

function formatType(value = '') {
  return String(value).split('_').map((s) => s.charAt(0).toUpperCase() + s.slice(1)).join(' ');
}

export default function AccountTypeRequestsPage() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [busyUserId, setBusyUserId] = useState('');

  const load = useCallback(() => {
    setLoading(true);
    apiRequest(`/admin/users/account-type/pending?page=${page}&limit=20`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const review = async (userId, action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Enter rejection reason') || '';
      if (!reason.trim()) return;
    }
    try {
      setBusyUserId(userId);
      await apiRequest(`/admin/users/${userId}/account-type/review`, {
        method: 'POST',
        body: { action, reason },
      });
      await load();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusyUserId('');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className={ui.h1}>Account Type Requests</h1>
        <p className={`${ui.caption} mt-0.5`}>
          {data?.total != null ? `${data.total.toLocaleString()} pending requests` : ''}
        </p>
      </div>

      {error && <div className={ui.errorBanner}>{error}</div>}
      {loading ? <PageSpinner /> : (
        <>
          <div className={ui.tableWrap}>
            <table className="w-full text-sm">
              <thead className={ui.thead}>
                <tr>
                  <th className={ui.th}>User</th>
                  <th className={ui.th}>Current type</th>
                  <th className={ui.th}>Requested type</th>
                  <th className={ui.th}>Requested at</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {data?.users?.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-nm-muted text-sm">
                      No pending account type requests
                    </td>
                  </tr>
                )}
                {data?.users?.map((u) => (
                  <tr key={u._id} className={ui.tr}>
                    <td className={ui.td}>
                      <div>
                        <p className="font-medium text-nm-text">{u.fullName}</p>
                        <p className="text-xs text-nm-muted">{u.email}</p>
                      </div>
                    </td>
                    <td className={`${ui.td} text-nm-muted`}>{formatType(u.accountType)}</td>
                    <td className={`${ui.td} text-gold font-medium`}>{formatType(u.pendingAccountType)}</td>
                    <td className={`${ui.td} text-nm-muted text-xs`}>
                      {u.updatedAt ? new Date(u.updatedAt).toLocaleString() : '—'}
                    </td>
                    <td className={ui.td}>
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => review(u._id, 'approve')}
                          disabled={busyUserId === u._id}
                          className={ui.btnSmSuccess}
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => review(u._id, 'reject')}
                          disabled={busyUserId === u._id}
                          className={ui.btnSmDanger}
                        >
                          Reject
                        </button>
                        <Link to={`/users/${u._id}`} className="text-gold hover:opacity-80 text-xs font-medium transition-opacity">
                          View →
                        </Link>
                      </div>
                    </td>
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
