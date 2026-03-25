import { useEffect, useState } from 'react';
import { apiRequest } from '../lib/api';
import { ui } from '../theme';

export default function ProvidersModerationPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  const load = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiRequest('/providers/admin/pending');
      setItems(res.data?.items || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const moderate = async (providerId, action) => {
    const reason =
      action === 'reject' ? window.prompt('Enter rejection reason') || '' : undefined;
    if (action === 'reject' && !reason.trim()) return;

    try {
      await apiRequest(`/providers/admin/${providerId}/moderate`, {
        method: 'POST',
        body: { action, reason },
      });
      await load();
    } catch (e) {
      setError(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className={ui.h1}>Provider Moderation</h1>
        <p className={`${ui.caption} mt-1`}>Approve, reject, and process claim requests.</p>
      </div>

      {error ? <div className={ui.errorBanner}>{error}</div> : null}
      {loading ? <div className={ui.caption}>Loading...</div> : null}
      {!loading && items.length === 0 ? (
        <div className={ui.caption}>No pending provider moderation items.</div>
      ) : null}

      <div className="space-y-3">
        {items.map((item) => (
          <div key={item._id} className="bg-nm-card border border-nm-border rounded-token p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className={ui.h3}>{item.name}</h3>
                <p className={ui.caption}>
                  {item.providerType} • {item.city || 'Unknown city'}
                </p>
                <p className={`${ui.caption} mt-1`}>
                  Owner: {item.ownerUser?.fullName || 'Unassigned'} | Claim: {item.claimRequestedBy?.fullName || 'None'}
                </p>
                {item.workingHours ? (
                  <p className={`${ui.caption} mt-1`}>Hours: {item.workingHours}</p>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => moderate(item._id, 'approve')}
                  className="px-3 py-2 rounded-token border border-green-500/40 text-green-500 text-sm"
                >
                  Approve
                </button>
                <button
                  onClick={() => moderate(item._id, 'reject')}
                  className="px-3 py-2 rounded-token border border-red-500/40 text-red-500 text-sm"
                >
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
