import { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  AreaChart, Area, ComposedChart, Line, Cell,
} from 'recharts';
import { BarChart3, TrendingUp, Package, Clock, AlertTriangle, FileText } from 'lucide-react';

const TABS = [
  { id: 'plan', label: 'Plan de Producción', icon: BarChart3 },
  { id: 'inventario', label: 'Inventario', icon: Package },
  { id: 'materiales', label: 'Materiales', icon: FileText },
  { id: 'horas', label: 'Horas', icon: Clock },
  { id: 'alertas', label: 'Alertas', icon: AlertTriangle },
];

function ResultsPanel({ resultados }) {
  const [tab, setTab] = useState('plan');

  if (!resultados) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <div className="text-center text-slate-400">
          <BarChart3 size={48} className="mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium">Resultados de Planificación</p>
          <p className="text-xs mt-1">Completa el flujo del chatbot para ver los resultados aquí</p>
        </div>
      </div>
    );
  }

  const dataProduccion = resultados.periodos.map((p) => ({
    periodo: p.periodo.replace('Semana ', 'S'),
    demanda: p.demandaBase ?? p.demanda,
    produccion: p.produccionPlanificada,
    deficit: p.deficit,
    ...(p.demandaBuffer ? { demandaBuffer: p.demandaBuffer, buffer: p.buffer } : {}),
    ...(p.produccionNivelada ? { nivelada: p.produccionNivelada } : {}),
  }));

  const dataInventario = resultados.periodos.map((p) => ({
    periodo: p.periodo.replace('Semana ', 'S'),
    inventarioInicial: p.inventarioInicial,
    inventarioFinal: p.inventarioFinal,
    deficit: p.deficit > 0 ? -p.deficit : 0,
  }));

  const dataHoras = resultados.periodos.map((p) => ({
    periodo: p.periodo.replace('Semana ', 'S'),
    horasNecesarias: p.horasNecesarias,
    horasDisponibles: p.horasDisponibles,
  }));

  return (
    <div className="h-full flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold text-slate-800">
              {resultados.producto} — {resultados.metodo}
            </h2>
            <p className="text-xs text-slate-500">
              {resultados.periodos.length} periodos | Producción total: {resultados.resumen.produccionTotal} uds
            </p>
          </div>
          {resultados.resumen.deficitTotal > 0 && (
            <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded-full font-medium">
              Déficit: {resultados.resumen.deficitTotal} uds
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white border-b border-slate-200 px-4 flex gap-1 overflow-x-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isAlerta = t.id === 'alertas' && resultados.alertas.length > 0;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-b-2 transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-slate-500 hover:text-slate-700'
              }`}
            >
              <Icon size={14} />
              {t.label}
              {isAlerta && (
                <span className="bg-red-500 text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center">
                  {resultados.alertas.length}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Chart content */}
      <div className="flex-1 overflow-y-auto p-4">
        {tab === 'plan' && (
          <div className="space-y-4">
            <div className="bg-white rounded-xl p-4 border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-700 mb-3">Demanda vs Producción por Periodo</h3>
              <ResponsiveContainer width="100%" height={280}>
                <ComposedChart data={dataProduccion}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                  <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="demanda" name="Demanda" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="produccion" name="Producción" fill="#22c55e" radius={[4, 4, 0, 0]} />
                  {dataProduccion[0]?.demandaBuffer && (
                    <Bar dataKey="demandaBuffer" name="Demanda + Buffer" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  )}
                  {dataProduccion[0]?.deficit > 0 && (
                    <Bar dataKey="deficit" name="Déficit" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  )}
                </ComposedChart>
              </ResponsiveContainer>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-500">Producción Total</p>
                <p className="text-xl font-bold text-blue-600">{resultados.resumen.produccionTotal}</p>
                <p className="text-xs text-slate-400">unidades</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-500">Inventario Final</p>
                <p className={`text-xl font-bold ${resultados.resumen.inventarioFinal < 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resultados.resumen.inventarioFinal}
                </p>
                <p className="text-xs text-slate-400">unidades</p>
              </div>
              <div className="bg-white rounded-xl p-3 border border-slate-200 text-center">
                <p className="text-xs text-slate-500">Déficit Total</p>
                <p className={`text-xl font-bold ${resultados.resumen.deficitTotal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                  {resultados.resumen.deficitTotal}
                </p>
                <p className="text-xs text-slate-400">unidades</p>
              </div>
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-slate-600 font-semibold">Periodo</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-semibold">Demanda</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-semibold">Producción</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-semibold">Inv. Final</th>
                    <th className="px-3 py-2 text-right text-slate-600 font-semibold">Déficit</th>
                  </tr>
                </thead>
                <tbody>
                  {resultados.periodos.map((p, i) => (
                    <tr key={i} className="border-t border-slate-100">
                      <td className="px-3 py-2 font-medium text-slate-700">{p.periodo}</td>
                      <td className="px-3 py-2 text-right">{p.demandaBase ?? p.demanda}</td>
                      <td className="px-3 py-2 text-right text-green-700 font-medium">{p.produccionPlanificada}</td>
                      <td className="px-3 py-2 text-right">{p.inventarioFinal}</td>
                      <td className={`px-3 py-2 text-right font-medium ${p.deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {p.deficit > 0 ? `-${p.deficit}` : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'inventario' && (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Nivel de Inventario por Periodo</h3>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={dataInventario}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Area type="monotone" dataKey="inventarioInicial" name="Inv. Inicial" stroke="#3b82f6" fill="#dbeafe" />
                <Area type="monotone" dataKey="inventarioFinal" name="Inv. Final" stroke="#22c55e" fill="#dcfce7" />
                {dataInventario.some(d => d.deficit < 0) && (
                  <Area type="monotone" dataKey="deficit" name="Déficit" stroke="#ef4444" fill="#fee2e2" />
                )}
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {tab === 'materiales' && (
          <div className="space-y-4">
            {resultados.necesidadesMateriales && resultados.necesidadesMateriales.length > 0 ? (
              <>
                <div className="bg-white rounded-xl p-4 border border-slate-200">
                  <h3 className="text-sm font-semibold text-slate-700 mb-3">Necesidades de Materias Primas</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={resultados.necesidadesMateriales}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                      <XAxis dataKey="nombre" tick={{ fontSize: 12 }} />
                      <YAxis tick={{ fontSize: 12 }} />
                      <Tooltip />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="necesidadTotal" name="Necesidad Total" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="inventarioInicial" name="Inventario Disponible" fill="#22c55e" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="deficit" name="Déficit" fill="#ef4444" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50">
                      <tr>
                        <th className="px-3 py-2 text-left text-slate-600 font-semibold">Material</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-semibold">Necesidad</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-semibold">Disponible</th>
                        <th className="px-3 py-2 text-right text-slate-600 font-semibold">Déficit</th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultados.necesidadesMateriales.map((mp, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="px-3 py-2 font-medium text-slate-700">{mp.nombre}</td>
                          <td className="px-3 py-2 text-right">{mp.necesidadTotal.toFixed(1)}</td>
                          <td className="px-3 py-2 text-right">{mp.inventarioInicial}</td>
                          <td className={`px-3 py-2 text-right font-medium ${mp.deficit > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {mp.deficit > 0 ? mp.deficit.toFixed(1) : '0'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl p-8 border border-slate-200 text-center text-slate-400">
                <Package size={32} className="mx-auto mb-2 opacity-50" />
                <p className="text-sm">No se registraron materias primas</p>
              </div>
            )}
          </div>
        )}

        {tab === 'horas' && (
          <div className="bg-white rounded-xl p-4 border border-slate-200">
            <h3 className="text-sm font-semibold text-slate-700 mb-3">Horas de Producción vs Disponibles</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={dataHoras}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periodo" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="horasNecesarias" name="Horas Necesarias" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                <Bar dataKey="horasDisponibles" name="Horas Disponibles" fill="#06b6d4" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 text-xs text-slate-500">
              Total horas necesarias: <strong>{resultados.resumen.horasTotalesNecesarias}</strong> |
              Horas disponibles por periodo: <strong>{resultados.periodos[0]?.horasDisponibles}</strong>
            </div>
          </div>
        )}

        {tab === 'alertas' && (
          <div className="space-y-2">
            {resultados.alertas.length === 0 ? (
              <div className="bg-green-50 rounded-xl p-6 border border-green-200 text-center">
                <p className="text-green-700 font-medium text-sm">Sin alertas. La planificación es viable.</p>
              </div>
            ) : (
              resultados.alertas.map((a, i) => (
                <div
                  key={i}
                  className={`rounded-xl p-3 border text-sm ${
                    a.tipo === 'deficit'
                      ? 'bg-red-50 border-red-200 text-red-800'
                      : a.tipo === 'capacidad'
                      ? 'bg-amber-50 border-amber-200 text-amber-800'
                      : 'bg-orange-50 border-orange-200 text-orange-800'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                    <span>{a.mensaje}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default ResultsPanel;
