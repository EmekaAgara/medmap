import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import { KycBadge } from '../components/Badge';
import { PageSpinner } from '../components/Spinner';
import { ui } from '../theme';

function InfoRow({ label, value }) {
  return (
    <div className="flex justify-between py-2.5 border-b border-nm-border last:border-0">
      <span className="text-xs text-nm-muted">{label}</span>
      <span className="text-xs text-nm-text font-medium text-right max-w-[60%] break-all">{value || '—'}</span>
    </div>
  );
}

function DocImage({ label, url }) {
  if (!url) return (
    <div className="rounded-xl border-2 border-dashed border-nm-border p-6 flex flex-col items-center justify-center gap-2 text-nm-muted">
      <span className="text-3xl">🖼</span>
      <span className="text-xs">{label} — not uploaded</span>
    </div>
  );
  return (
    <div>
      <p className="text-xs font-medium text-nm-muted mb-2">{label}</p>
      <a href={url} target="_blank" rel="noreferrer">
        <img
          src={url}
          alt={label}
          className="rounded-xl border border-nm-border object-cover w-full max-h-52 hover:opacity-90 transition-opacity cursor-zoom-in"
        />
      </a>
    </div>
  );
}

export default function UserDetailPage() {
  const { id }       = useParams();
  const navigate     = useNavigate();
  const [user,    setUser]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  const [kycModal,  setKycModal]  = useState(false);
  const [kycStatus, setKycStatus] = useState('approved');
  const [kycReason, setKycReason] = useState('');
  const [kycSaving, setKycSaving] = useState(false);
  const [kycError,  setKycError]  = useState('');

  const [banModal,  setBanModal]  = useState(false);
  const [banReason, setBanReason] = useState('');
  const [banSaving, setBanSaving] = useState(false);
  const [typeReviewSaving, setTypeReviewSaving] = useState(false);

  const load = () => {
    setLoading(true);
    apiRequest(`/admin/users/${id}`)
      .then((r) => setUser(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const saveKyc = async () => {
    setKycError('');
    if (kycStatus === 'rejected' && !kycReason.trim()) {
      setKycError('Rejection reason is required.');
      return;
    }
    try {
      setKycSaving(true);
      const res = await apiRequest(`/admin/users/${id}/kyc-status`, {
        method: 'PUT',
        body: { status: kycStatus, rejectionReason: kycReason },
      });
      setUser((u) => ({ ...u, kycStatus: res.data.kycStatus, kycRejectionReason: res.data.kycRejectionReason }));
      setKycModal(false);
    } catch (e) { setKycError(e.message); } finally { setKycSaving(false); }
  };

  const saveBan = async () => {
    try {
      setBanSaving(true);
      if (user.isBanned) {
        await apiRequest(`/admin/users/${id}/unban`, { method: 'POST' });
        setUser((u) => ({ ...u, isBanned: false }));
      } else {
        if (!banReason.trim()) return;
        await apiRequest(`/admin/users/${id}/ban`, { method: 'POST', body: { reason: banReason } });
        setUser((u) => ({ ...u, isBanned: true, bannedReason: banReason }));
      }
      setBanModal(false);
      setBanReason('');
    } catch (e) { setError(e.message); } finally { setBanSaving(false); }
  };

  const reviewTypeChange = async (action) => {
    let reason = '';
    if (action === 'reject') {
      reason = window.prompt('Enter rejection reason') || '';
      if (!reason.trim()) return;
    }
    try {
      setTypeReviewSaving(true);
      const res = await apiRequest(`/admin/users/${id}/account-type/review`, {
        method: 'POST',
        body: { action, reason },
      });
      setUser((u) => ({ ...u, ...res.data }));
    } catch (e) {
      setError(e.message);
    } finally {
      setTypeReviewSaving(false);
    }
  };

  if (loading) return <PageSpinner />;
  if (error) return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="text-sm text-gold hover:opacity-80">← Back</button>
      <div className={ui.errorBanner}>{error}</div>
    </div>
  );

  const idTypeLabels = {
    national_id:      'National ID',
    passport:         'Passport',
    drivers_license:  "Driver's Licence",
    voters_card:      "Voter's Card",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <button
            onClick={() => navigate(-1)}
            className="text-xs text-nm-muted hover:text-gold mb-2 block transition-colors"
          >
            ← Back to users
          </button>
          <div className="flex items-center gap-3">
            {user.avatarUrl
              ? <img src={user.avatarUrl} alt="" className="w-12 h-12 rounded-full object-cover border-2 border-nm-border" />
              : <div className="w-12 h-12 rounded-full bg-nm-secondary border border-nm-border flex items-center justify-center text-nm-text font-bold text-lg">{user.fullName?.[0]}</div>
            }
            <div>
              <h1 className={ui.h1}>{user.fullName}</h1>
              <div className="flex items-center gap-2 mt-0.5">
                <KycBadge status={user.kycStatus} />
                {user.isBanned && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-500 border border-red-500/20">Banned</span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-2 shrink-0">
          {user.kycStatus !== 'approved' && (
            <button
              onClick={() => { setKycModal(true); setKycStatus('approved'); setKycReason(''); setKycError(''); }}
              className={ui.btnSm}
            >
              Review KYC
            </button>
          )}
          <button
            onClick={() => setBanModal(true)}
            className={user.isBanned ? ui.btnSmSuccess : ui.btnSmDanger}
          >
            {user.isBanned ? 'Unban user' : 'Ban user'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left — profile */}
        <div className="lg:col-span-1 space-y-4">
          <div className={`${ui.section}`}>
            <h3 className={`${ui.h3} mb-3`}>Account</h3>
            <InfoRow label="Email"  value={user.email} />
            <InfoRow label="Phone"  value={user.phone} />
            <InfoRow label="Joined" value={new Date(user.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <InfoRow label="Role"   value={user.roles?.join(', ')} />
            <InfoRow label="Profile type" value={user.accountType ? user.accountType.replace('_', ' ') : null} />
            <InfoRow label="Type change status" value={user.accountTypeChangeStatus} />
            <InfoRow label="Requested type" value={user.pendingAccountType ? user.pendingAccountType.replace('_', ' ') : null} />
            {user.accountTypeChangeReason ? (
              <InfoRow label="Type change rejection reason" value={user.accountTypeChangeReason} />
            ) : null}
            {user.accountTypeChangeStatus === 'pending' ? (
              <div className="flex justify-end gap-2 pt-3">
                <button
                  onClick={() => reviewTypeChange('approve')}
                  disabled={typeReviewSaving}
                  className={ui.btnSmSuccess}
                >
                  Approve type
                </button>
                <button
                  onClick={() => reviewTypeChange('reject')}
                  disabled={typeReviewSaving}
                  className={ui.btnSmDanger}
                >
                  Reject type
                </button>
              </div>
            ) : null}
          </div>
          <div className={ui.section}>
            <h3 className={`${ui.h3} mb-3`}>Profile</h3>
            <InfoRow label="Address"       value={user.address} />
            <InfoRow label="City"          value={user.city} />
            <InfoRow label="Country"       value={user.country} />
            <InfoRow label="Date of birth" value={user.dateOfBirth ? new Date(user.dateOfBirth).toLocaleDateString() : null} />
            <InfoRow label="Bio"           value={user.bio} />
          </div>
          {user.isBanned && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4">
              <p className="text-xs font-semibold text-red-500 mb-1">Ban reason</p>
              <p className="text-xs text-red-400">{user.bannedReason || '—'}</p>
            </div>
          )}
        </div>

        {/* Right — KYC */}
        <div className="lg:col-span-2 space-y-4">
          <div className={ui.section}>
            <h3 className={`${ui.h3} mb-3`}>KYC — Identity</h3>
            <InfoRow label="BVN"        value={user.bvn ? '••••••' + user.bvn.slice(-5) : null} />
            <InfoRow label="ID type"    value={idTypeLabels[user.kycDocuments?.idType] || user.kycDocuments?.idType} />
            <InfoRow label="ID number"  value={user.kycDocuments?.idNumber} />
            <InfoRow label="Submitted"  value={user.kycSubmittedAt ? new Date(user.kycSubmittedAt).toLocaleString() : null} />
            <InfoRow label="Reviewed"   value={user.kycReviewedAt  ? new Date(user.kycReviewedAt).toLocaleString()  : null} />
            {user.kycRejectionReason && <InfoRow label="Rejection reason" value={user.kycRejectionReason} />}
          </div>

          <div className={ui.section}>
            <h3 className={`${ui.h3} mb-4`}>KYC — Documents</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <DocImage label="ID — front" url={user.kycDocuments?.idFrontUrl} />
              <DocImage label="ID — back"  url={user.kycDocuments?.idBackUrl} />
              <DocImage label="Selfie"     url={user.kycDocuments?.selfieUrl} />
            </div>
          </div>

          {user.bankAccounts?.length > 0 && (
            <div className={ui.section}>
              <h3 className={`${ui.h3} mb-3`}>Bank accounts</h3>
              {user.bankAccounts.map((b, i) => (
                <div key={i} className="flex justify-between py-2.5 border-b border-nm-border last:border-0">
                  <span className="text-xs text-nm-muted">{b.bankName}</span>
                  <span className="text-xs text-nm-text font-medium">{b.accountNumber} — {b.accountName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* KYC modal */}
      {kycModal && (
        <Modal title="Set KYC status" onClose={() => setKycModal(false)}>
          <div className="space-y-4">
            {kycError && <div className={ui.errorBanner}>{kycError}</div>}
            <div>
              <label className={ui.label}>Decision</label>
              <select
                value={kycStatus}
                onChange={(e) => setKycStatus(e.target.value)}
                className={`w-full ${ui.select}`}
              >
                <option value="approved">✅ Approve</option>
                <option value="rejected">❌ Reject</option>
              </select>
            </div>
            {kycStatus === 'rejected' && (
              <div>
                <label className={ui.label}>Rejection reason (required)</label>
                <textarea
                  rows={3}
                  value={kycReason}
                  onChange={(e) => setKycReason(e.target.value)}
                  placeholder="Explain why the KYC is being rejected…"
                  className={ui.textarea}
                />
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setKycModal(false)} className={ui.btnSmOutline}>Cancel</button>
              <button onClick={saveKyc} disabled={kycSaving} className={ui.btnSm}>
                {kycSaving ? 'Saving…' : 'Confirm'}
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Ban modal */}
      {banModal && (
        <Modal title={user.isBanned ? 'Unban user' : 'Ban user'} onClose={() => setBanModal(false)}>
          <div className="space-y-4">
            {!user.isBanned && (
              <div>
                <label className={ui.label}>Ban reason (required)</label>
                <textarea
                  rows={3}
                  value={banReason}
                  onChange={(e) => setBanReason(e.target.value)}
                  placeholder="Reason for banning this user…"
                  className={ui.textarea}
                />
              </div>
            )}
            {user.isBanned && (
              <p className="text-sm text-nm-muted">
                This will unban <strong className="text-nm-text">{user.fullName}</strong> and restore their access.
              </p>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setBanModal(false)} className={ui.btnSmOutline}>Cancel</button>
              <button
                onClick={saveBan}
                disabled={banSaving || (!user.isBanned && !banReason.trim())}
                className={user.isBanned ? ui.btnSmSuccess : ui.btnSmDanger}
              >
                {banSaving ? 'Saving…' : user.isBanned ? 'Unban' : 'Ban user'}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4">
      <div className="bg-nm-card border border-nm-border rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-nm-text">{title}</h3>
          <button onClick={onClose} className="text-nm-muted hover:text-nm-text text-xl leading-none transition-colors">&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
