import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export default function SpeedChart({ data, type }) {
  if (!data || data.length === 0) return null;

  // type is 'download' or 'upload'
  const color = type === 'download' ? '#6366f1' : '#8b5cf6'; // Indigo for DL, Violet for UL

  return (
    <div style={{ width: '100%', height: 120, marginTop: '20px' }}>
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 5, right: 0, left: 0, bottom: 5 }}>
          <defs>
            <linearGradient id={`color${type}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.8}/>
              <stop offset="95%" stopColor={color} stopOpacity={0}/>
            </linearGradient>
          </defs>
          <XAxis dataKey="time" hide />
          <YAxis hide domain={['auto', 'auto']} />
          <Tooltip 
            contentStyle={{ backgroundColor: 'rgba(10, 10, 12, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '8px' }}
            itemStyle={{ color: '#fff' }}
            labelStyle={{ display: 'none' }}
          />
          <Area 
            type="monotone" 
            dataKey="speed" 
            stroke={color} 
            strokeWidth={3}
            fillOpacity={1} 
            fill={`url(#color${type})`}
            isAnimationActive={false} // Disable Recharts default animation for real-time data to avoid jumping
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
