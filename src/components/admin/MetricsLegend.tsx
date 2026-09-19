import type { MetricNote } from '../../lib/metricsCopy';

export function MetricsLegend({
  title,
  notes,
}: {
  title: string;
  notes: MetricNote[];
}) {
  return (
    <section
      className="rounded-2xl p-4 space-y-3"
      style={{ background: '#2A211D', border: '1px solid rgba(255,255,255,0.06)' }}
    >
      <h3 className="text-[11px] font-800 uppercase tracking-[0.16em]" style={{ color: '#F2D8A7' }}>
        {title}
      </h3>
      <dl className="space-y-3">
        {notes.map((note) => (
          <div key={note.term}>
            <dt className="text-[12px] font-800 text-white">{note.term}</dt>
            <dd className="text-[12px] font-500 leading-relaxed mt-0.5" style={{ color: '#A39B98' }}>
              {note.text}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
