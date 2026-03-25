import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import Pagination from '../components/Pagination';
import { PageSpinner } from '../components/Spinner';
import { ui } from '../theme';

function DocThumb({ url, label }) {
  if (!url) return <span className="text-xs text-nm-muted">—</span>;
  return (
    <a href={url} target="_blank" rel="noreferrer" className="text-gold hover:opacity-80 text-xs transition-opacity">
      {label}
    </a>
  );
}

function InfoCell({ label, value }) {
  return (
    <div className="bg-nm-surface border border-nm-border rounded-token p-3">
      <p className="text-xs text-nm-muted mb-0.5">{label}</p>
      <p className="text-xs text-nm-text font-medium">{value}</p>
    </div>
  );
}

export default function KycQueuePage() {
  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [page,    setPage]    = useState(1);

  const [action,   setAction]   = useState({});
  const [reason,   setReason]   = useState({});
  const [decision, setDecision] = useState({});

  const load = useCallback(() => {
    setLoading(true);
    apiRequest(`/admin/kyc/pending?page=${page}&limit=15`)
      .then((r) => setData(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [page]);

  useEffect(() => { load(); }, [load]);

  const submit = async (userId) => {
    const status = decision[userId] || 'approved';
    const rejectionReason = reason[userId] || '';
    if (status === 'rejected' && !rejectionReason.trim()) return;
    try {
      setAction((a) => ({ ...a, [userId]: 'saving' }));
      await apiRequest(`/admin/users/${userId}/kyc-status`, {
        method: 'PUT',
        body: { status, rejectionReason },
      });
      setData((d) => ({ ...d, users: d.users.filter((u) => u._id !== userId), total: d.total - 1 }));
    } catch (e) {
      setError(e.message);
    } finally {
      setAction((a) => ({ ...a, [userId]: null }));
    }
  };

  const idTypeLabels = {
    national_id:     'National ID',
    passport:        'Passport',
    drivers_license: "Driver's Lic.",
    voters_card:     "Voter's Card",
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className={ui.h1}>KYC Review Queue</h1>
        <p className={`${ui.caption} mt-0.5`}>
          {data?.total != null ? `${data.total} pending submission${data.total !== 1 ? 's' : ''}` : ''}
        </p>
      </div>

      {error && <div className={ui.errorBanner}>{error}</div>}

      {loading ? <PageSpinner /> : (
        <>
          {data?.users?.length === 0 && (
            <div className="bg-nm-card border border-nm-border rounded-xl p-12 text-center">
              <p className="text-3xl mb-3">🎉</p>
              <p className="font-semibold text-nm-text">All caught up!</p>
              <p className={`${ui.caption} mt-1`}>No pending KYC submissions.</p>
            </div>
          )}

          <div className="space-y-4">
            {data?.users?.map((u) => (
              <div key={u._id} className="bg-nm-card border border-nm-border rounded-xl p-5">
                {/* User header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div className="flex items-center gap-3">
                    {u.avatarUrl
                      ? <img src={u.avatarUrl} className="w-10 h-10 rounded-full object-cover" alt="" />
                      : <div className="w-10 h-10 rounded-full bg-nm-secondary border border-nm-border flex items-center justify-center text-nm-muted font-bold">{u.fullName?.[0]}</div>
                    }
                    <div>
                      <p className="font-semibold text-nm-text">{u.fullName}</p>
                      <p className="text-xs text-nm-muted">{u.email} · {u.phone}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-nm-muted">Submitted</p>
                    <p className="text-xs text-nm-text font-medium">
                      {u.kycSubmittedAt
                        ? new Date(u.kycSubmittedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                        : '—'}
                    </p>
                  </div>
                </div>

                {/* Info grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                  <InfoCell label="BVN"      value={u.bvn ? '••' + u.bvn.slice(-5) : '—'} />
                  <InfoCell label="ID type"  value={idTypeLabels[u.kycDocuments?.idType] || '—'} />
                  <InfoCell label="ID number" value={u.kycDocuments?.idNumber || '—'} />
                  <InfoCell label="Bank"     value={u.bankAccounts?.[0]?.bankName || '—'} />
                </div>

                {/* Documents */}
                <div className="flex gap-4 mb-5">
                  <DocThumb url={u.kycDocuments?.idFrontUrl} label="ID front ↗" />
                  <DocThumb url={u.kycDocuments?.idBackUrl}  label="ID back ↗" />
                  <DocThumb url={u.kycDocuments?.selfieUrl}  label="Selfie ↗" />
                  <Link to={`/users/${u._id}`} className="text-xs text-nm-muted hover:text-gold ml-auto transition-colors">
                    Full profile →
                  </Link>
                </div>

                {/* Action row */}
                <div className="border-t border-nm-border pt-4 flex flex-wrap items-end gap-3">
                  <div>
                    <label className={ui.label}>Decision</label>
                    <select
                      value={decision[u._id] || 'approved'}
                      onChange={(e) => setDecision((d) => ({ ...d, [u._id]: e.target.value }))}
                      className={ui.select}
                    >
                      <option value="approved">✅ Approve</option>
                      <option value="rejected">❌ Reject</option>
                    </select>
                  </div>
                  {(decision[u._id] || 'approved') === 'rejected' && (
                    <div className="flex-1 min-w-48">
                      <label className={ui.label}>Rejection reason</label>
                      <input
                        type="text"
                        placeholder="Required for rejection"
                        value={reason[u._id] || ''}
                        onChange={(e) => setReason((r) => ({ ...r, [u._id]: e.target.value }))}
                        className={ui.input}
                      />
                    </div>
                  )}
                  <button
                    onClick={() => submit(u._id)}
                    disabled={action[u._id] === 'saving' || ((decision[u._id] || 'approved') === 'rejected' && !reason[u._id]?.trim())}
                    className={ui.btnSm}
                  >
                    {action[u._id] === 'saving' ? 'Saving…' : 'Submit decision'}
                  </button>
                </div>
              </div>
            ))}
          </div>

          <Pagination page={data?.page ?? 1} pages={data?.pages ?? 1} onPage={setPage} />
        </>
      )}
    </div>
  );
}
