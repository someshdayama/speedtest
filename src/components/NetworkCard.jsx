/**
 * @file NetworkCard.jsx
 * Displays detected network provider, connection type, and IP address.
 * Values are pre-sanitised by useNetworkInfo — safe to render directly.
 */

import { memo } from 'react';
import { Globe, Wifi, ArrowDown, Server } from 'lucide-react';

/**
 * @param {{ label: string, icon: React.ReactNode, value: string }} props
 */
const Row = memo(({ label, icon, value }) => (
  <div className="network-row">
    <div className="network-row-label">
      <span aria-hidden="true">{icon}</span>
      {label}
    </div>
    <div className="network-row-value">{value}</div>
  </div>
));
Row.displayName = 'NetworkRow';

/**
 * @param {{ info: import('../hooks/useNetworkInfo.js').NetworkInfo }} props
 */
const NetworkCard = memo(({ info }) => (
  <section className="network-card" aria-label="Network information">
    <div className="network-card-header">
      <Globe size={12} aria-hidden="true" /> Network Info
    </div>
    <div className="network-rows">
      <Row icon={<Server size={13} />}    label="Provider"   value={info.provider} />
      <Row icon={<Wifi size={13} />}      label="Connection" value={info.type} />
      <Row icon={<ArrowDown size={13} />} label="Est. Downlink" value={info.downlink} />
      <Row icon={<Globe size={13} />}     label="IP Address" value={info.ip} />
    </div>
  </section>
));

NetworkCard.displayName = 'NetworkCard';

export default NetworkCard;
