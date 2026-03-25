import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../lib/api';
import StatCard from '../components/StatCard';
import { PageSpinner } from '../components/Spinner';
import { ui } from '../theme';

export default function DashboardPage() {
  const [stats,   setStats]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');

  useEffect(() => {
    apiRequest('/admin/dashboard')
      .then((r) => setStats(r.data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <PageSpinner />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className={ui.h1}>Dashboard</h1>
        <p className={`${ui.caption} mt-0.5`}>Platform overview at a glance.</p>
      </div>

      {error && <div className={ui.errorBanner}>{error}</div>}

      {/* Users */}
      <section>
        <h2 className={`${ui.h3} mb-3`}>Users</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Total users"      value={stats?.users?.total?.toLocaleString()} />
          <StatCard label="New this month"   value={stats?.users?.newThisMonth?.toLocaleString()} color="text-gold" />
          <StatCard label="Banned"           value={stats?.users?.banned?.toLocaleString()} color="text-red-500" />
          <StatCard label="Logins / 30 days" value={stats?.activity?.loginsThisMonth?.toLocaleString()} />
        </div>
        <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link to="/account-type-requests">
            <StatCard
              label="Account type change requests"
              value={stats?.users?.accountTypeChangePending?.toLocaleString()}
              color="text-yellow-500"
              sub="Click to review →"
            />
          </Link>
        </div>
      </section>

      {/* KYC */}
      <section>
        <h2 className={`${ui.h3} mb-3`}>KYC</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Link to="/kyc">
            <StatCard label="Pending review" value={stats?.kyc?.pending?.toLocaleString()} color="text-yellow-500" sub="Click to review →" />
          </Link>
          <StatCard label="Approved" value={stats?.kyc?.approved?.toLocaleString()} color="text-green-500" />
          <StatCard label="Rejected" value={stats?.kyc?.rejected?.toLocaleString()} color="text-red-500" />
        </div>
      </section>

      {/* Providers */}
      <section>
        <h2 className={`${ui.h3} mb-3`}>Providers</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <Link to="/providers">
            <StatCard
              label="Pending moderation"
              value={stats?.providers?.pending?.toLocaleString()}
              color="text-yellow-500"
              sub="Click to review →"
            />
          </Link>
          <StatCard
            label="Approved providers"
            value={stats?.providers?.approved?.toLocaleString()}
            color="text-green-500"
          />
        </div>
      </section>

      {/* Finance */}
      <section>
        <h2 className={`${ui.h3} mb-3`}>Finance</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard label="Total loans"          value={stats?.loans?.total?.toLocaleString()} />
          <StatCard label="Active loans"         value={stats?.loans?.active?.toLocaleString()} color="text-gold" />
          <StatCard label="Total wallet balance" value={`₦${(stats?.wallet?.totalBalance ?? 0).toLocaleString()}`} color="text-green-500" />
        </div>
      </section>
    </div>
  );
}
