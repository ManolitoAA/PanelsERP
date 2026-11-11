import React from 'react';

const CHART_HEIGHT = 180;
const fmt = (v, unit) => `${v.toLocaleString('es-ES')}${unit}`;

function EmptyChart() {
  return <p className="text-sm text-slate-600 py-10 text-center">Sin datos</p>;
}

// Columnas con eje en el 0: positivas hacia arriba, negativas hacia abajo (rojo),
// valor 0 = marca fina sobre el eje, sin datos = aviso vacío.
export function BarChart({ name, data, unit = '' }) {
  if (!data.length) return <EmptyChart />;
  const maxPos = Math.max(0, ...data.map(d => d.value));
  const maxNeg = Math.max(0, ...data.map(d => -d.value));
  const total = maxPos + maxNeg || 1;
  const topH = (CHART_HEIGHT * maxPos) / total;
  const bottomH = (CHART_HEIGHT * maxNeg) / total;

  return (
    <div className="overflow-x-auto">
      <ul className="flex gap-2 min-w-full">
        {data.map(d => {
          const kind = d.value > 0 ? 'positive' : d.value < 0 ? 'negative' : 'zero';
          return (
            <li key={d.label} className="group flex flex-col items-stretch min-w-[56px] flex-1" title={`${d.label}: ${fmt(d.value, unit)}`}>
              <div className="flex flex-col justify-end items-center" style={{ height: topH }}>
                {kind === 'positive' && (
                  <div data-testid={`bar-${name}-${d.label}`} data-kind={kind}
                    className="w-full max-w-[44px] rounded-t-lg bg-gradient-to-t from-accent-600 to-accent-400 transition-[filter] group-hover:brightness-110"
                    style={{ height: (d.value / maxPos) * topH }} />
                )}
              </div>
              <div data-testid={`zero-line-${name}`} className="h-px bg-night/20" />
              <div className="flex flex-col items-center" style={{ height: bottomH }}>
                {kind === 'zero' && (
                  <div data-testid={`bar-${name}-${d.label}`} data-kind={kind} className="w-full max-w-[44px] bg-slate-400" style={{ height: 3 }} />
                )}
                {kind === 'negative' && (
                  <div data-testid={`bar-${name}-${d.label}`} data-kind={kind}
                    className="w-full max-w-[44px] rounded-b-lg bg-gradient-to-b from-red-500 to-red-400"
                    style={{ height: (-d.value / maxNeg) * bottomH }} />
                )}
              </div>
              <span className={`mt-2 text-center text-xs font-mono tabular-nums ${d.value < 0 ? 'text-red-600 font-medium' : 'text-night'}`}>{fmt(d.value, unit)}</span>
              <span className="text-center text-[11px] text-slate-600">{d.label}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
