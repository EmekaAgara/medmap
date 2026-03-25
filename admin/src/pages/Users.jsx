import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { KycBadge } from '../components/Badge';
import Pagination from '../components/Pagination';
import { PageSpinner } from '../components/Spinner';
import { ui } from '../theme';

const STATUS_OPTS = [
  { value: '',             label: 'All users' },
  { value: 'kyc_pending',  label: 'KYC pending' },
  { value: 'kyc_approved', label: 'KYC approved' },
  { value: 'kyc_rejected', label: 'KYC rejected' },
  { value: 'banned',       label: 'Banned' },
];

function Avatar({ user }) {
  if (user.avatarUrl) {
    return <img src={user.avatarUrl} alt="" className="w-8 h-8 rounded-full object-cover" />;
  }
  const initials = user.fullName?.split(' ').map((p) => p[0]).join('').slice(0, 2).toUpperCase() || '?';
  return (
    <div className="w-8 h-8 rounded-full bg-nm-secondary border border-nm-border flex items-center justify-center text-xs font-semibold text-nm-muted">
      {initials}
    </div>
  );
}

export default function UsersPage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [search,  setSearch]  = useState('');
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);

  const fetchUsers = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page, limit: 20 });
    if (search) params.set('search', search);
    if (status) params.set('status', status);
    apiRequest(`/admin/users?${params}`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleSearch = (e) => { e.preventDefault(); setPage(1); fetchUsers(); };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className={ui.h1}>Users</h1>
          <p className={`${ui.caption} mt-0.5`}>
            {data?.total != null ? `${data.total.toLocaleString()} total` : ''}
          </p>
        </div>
      </div>

      {/* Filters */}
      <form onSubmit={handleSearch} className="flex flex-wrap gap-3">
        <input
          type="text"
          placeholder="Search name, email, phone…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className={`flex-1 min-w-48 ${ui.input}`}
        />
        <select
          value={status}
          onChange={(e) => { setStatus(e.target.value); setPage(1); }}
          className={ui.select}
        >
          {STATUS_OPTS.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
        <button type="submit" className={ui.btnSm}>
          Search
        </button>
      </form>

      {error && <div className={ui.errorBanner}>{error}</div>}

      {loading ? <PageSpinner /> : (
        <>
          <div className={ui.tableWrap}>
            <table className="w-full text-sm">
              <thead className={ui.thead}>
                <tr>
                  <th className={ui.th}>User</th>
                  <th className={ui.th}>Phone</th>
                  <th className={ui.th}>KYC</th>
                  <th className={ui.th}>Status</th>
                  <th className={ui.th}>Joined</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className={ui.tbody}>
                {data?.users?.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-nm-muted text-sm">
                      No users found
                    </td>
                  </tr>
                )}
                {data?.users?.map((u) => (
                  <tr key={u._id} className={ui.tr}>
                    <td className={ui.td}>
                      <div className="flex items-center gap-3">
                        <Avatar user={u} />
                        <div>
                          <p className="font-medium text-nm-text">{u.fullName}</p>
                          <p className="text-xs text-nm-muted">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className={`${ui.td} text-nm-muted`}>{u.phone}</td>
                    <td className={ui.td}><KycBadge status={u.kycStatus} /></td>
                    <td className={ui.td}>
                      {u.isBanned
                        ? <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">Banned</span>
                        : <span className="text-xs text-nm-muted">Active</span>}
                    </td>
                    <td className={`${ui.td} text-nm-muted text-xs`}>
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className={ui.td}>
                      <Link to={`/users/${u._id}`} className="text-gold hover:opacity-80 text-xs font-medium transition-opacity">
                        View →
                      </Link>
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
