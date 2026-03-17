// ============================================================
// MOTOR DE PLANIFICACIÓN AUTOMÁTICA
// Soporta: MRP Clásico, Temporal, Probabilístico (Monte Carlo)
// ============================================================

/**
 * MRP CLÁSICO
 * Calcula necesidades netas de producción y materias primas
 * considerando inventario, capacidad y BOM.
 */
export function calcularMRPClasico(datos) {
  const {
    producto,
    demanda,        // array de números por periodo
    inventarioInicial,
    capacidadProduccion,
    tiempoProduccion, // horas/unidad
    materiasPrimas,   // array [{nombre, cantidadPorUnidad, inventario}]
    restricciones,
  } = datos;

  const periodos = demanda.length;
  const resultados = [];
  let inventarioActual = inventarioInicial;
  const alertas = [];
  let produccionTotal = 0;
  const horasDisponiblesPorPeriodo = capacidadProduccion * tiempoProduccion;

  // Tracking de materias primas
  const mpTracking = (materiasPrimas || []).map(mp => ({
    ...mp,
    inventarioActual: mp.inventario,
    necesidadTotal: 0,
  }));

  for (let i = 0; i < periodos; i++) {
    const periodo = `Semana ${i + 1}`;
    const demandaPeriodo = demanda[i];

    // Necesidad neta = demanda - inventario disponible
    let necesidadNeta = Math.max(0, demandaPeriodo - inventarioActual);

    // Ajustar por capacidad
    let produccionPlanificada = Math.min(necesidadNeta, capacidadProduccion);
    let limitadoPorCapacidad = necesidadNeta > capacidadProduccion;

    // Verificar horas necesarias
    const horasNecesarias = produccionPlanificada * tiempoProduccion;

    // Verificar materias primas
    let limitadoPorMP = false;
    const mpNecesidades = [];

    for (const mp of mpTracking) {
      const necesidad = produccionPlanificada * mp.cantidadPorUnidad;
      const deficit = necesidad - mp.inventarioActual;
      mpNecesidades.push({
        nombre: mp.nombre,
        necesidad: necesidad,
        disponible: mp.inventarioActual,
        deficit: deficit > 0 ? deficit : 0,
      });

      if (deficit > 0) {
        limitadoPorMP = true;
        // Ajustar producción a lo que permita la MP
        const maxPosible = Math.floor(mp.inventarioActual / mp.cantidadPorUnidad);
        produccionPlanificada = Math.min(produccionPlanificada, maxPosible);
        alertas.push({
          periodo,
          tipo: 'material',
          mensaje: `No hay suficiente ${mp.nombre} para cubrir la producción de la ${periodo}. Se requiere ${deficit.toFixed(1)} ${mp.nombre === 'unidades' ? 'unidades' : 'kg'} adicionales.`,
        });
      }
    }

    if (limitadoPorCapacidad) {
      alertas.push({
        periodo,
        tipo: 'capacidad',
        mensaje: `${periodo}: La demanda (${demandaPeriodo}) supera la capacidad de producción (${capacidadProduccion}). Producción limitada a ${produccionPlanificada} unidades.`,
      });
    }

    // Actualizar inventario
    const inventarioFinal = inventarioActual + produccionPlanificada - demandaPeriodo;

    if (inventarioFinal < 0) {
      alertas.push({
        periodo,
        tipo: 'deficit',
        mensaje: `${periodo}: Déficit de ${Math.abs(inventarioFinal)} unidades respecto a la demanda. Considerar aumentar capacidad o ajustar pedidos.`,
      });
    }

    // Actualizar inventario de materias primas
    for (const mp of mpTracking) {
      const consumo = produccionPlanificada * mp.cantidadPorUnidad;
      mp.inventarioActual = Math.max(0, mp.inventarioActual - consumo);
      mp.necesidadTotal += produccionPlanificada * mp.cantidadPorUnidad;
    }

    produccionTotal += produccionPlanificada;

    resultados.push({
      periodo,
      demanda: demandaPeriodo,
      inventarioInicial: inventarioActual,
      necesidadNeta,
      produccionPlanificada,
      inventarioFinal: Math.max(inventarioFinal, 0),
      deficit: inventarioFinal < 0 ? Math.abs(inventarioFinal) : 0,
      horasNecesarias: produccionPlanificada * tiempoProduccion,
      horasDisponibles: horasDisponiblesPorPeriodo,
      limitadoPorCapacidad,
      mpNecesidades,
    });

    inventarioActual = Math.max(inventarioFinal, 0);
  }

  // Necesidades totales de materias primas
  const necesidadesMateriales = mpTracking.map(mp => ({
    nombre: mp.nombre,
    necesidadTotal: mp.necesidadTotal,
    inventarioInicial: mp.inventario,
    inventarioFinal: mp.inventarioActual,
    deficit: Math.max(0, mp.necesidadTotal - mp.inventario),
  }));

  const inventarioFinalGlobal = resultados.length > 0
    ? resultados[resultados.length - 1].inventarioFinal - (resultados[resultados.length - 1].deficit || 0)
    : inventarioInicial;

  return {
    metodo: 'MRP Clásico',
    producto,
    periodos: resultados,
    alertas,
    necesidadesMateriales,
    resumen: {
      produccionTotal,
      inventarioInicial,
      inventarioFinal: inventarioFinalGlobal,
      deficitTotal: resultados.reduce((sum, r) => sum + r.deficit, 0),
      horasTotalesNecesarias: resultados.reduce((sum, r) => sum + r.horasNecesarias, 0),
    },
    restricciones,
  };
}

/**
 * PLANIFICACIÓN TEMPORAL
 * Basada en cronogramas y capacidad por tiempo.
 * Intenta nivelar la producción a lo largo de los periodos.
 */
export function calcularTemporal(datos) {
  const {
    producto,
    demanda,
    inventarioInicial,
    capacidadProduccion,
    tiempoProduccion,
    materiasPrimas,
    restricciones,
  } = datos;

  const periodos = demanda.length;
  const demandaTotal = demanda.reduce((s, d) => s + d, 0);
  const necesidadNetaTotal = Math.max(0, demandaTotal - inventarioInicial);
  const produccionNivelada = Math.min(
    Math.ceil(necesidadNetaTotal / periodos),
    capacidadProduccion
  );

  const resultados = [];
  let inventarioActual = inventarioInicial;
  const alertas = [];
  let produccionTotal = 0;

  const mpTracking = (materiasPrimas || []).map(mp => ({
    ...mp,
    inventarioActual: mp.inventario,
    necesidadTotal: 0,
  }));

  for (let i = 0; i < periodos; i++) {
    const periodo = `Semana ${i + 1}`;
    const demandaPeriodo = demanda[i];

    // Producción nivelada ajustada
    let produccionPlanificada = produccionNivelada;

    // Si el inventario ya cubre la demanda restante, reducir producción
    const demandaRestante = demanda.slice(i).reduce((s, d) => s + d, 0);
    const necesidadRestante = Math.max(0, demandaRestante - inventarioActual);
    if (necesidadRestante === 0) produccionPlanificada = 0;

    produccionPlanificada = Math.min(produccionPlanificada, capacidadProduccion);

    // Verificar materias primas
    const mpNecesidades = [];
    for (const mp of mpTracking) {
      const necesidad = produccionPlanificada * mp.cantidadPorUnidad;
      const deficit = necesidad - mp.inventarioActual;
      mpNecesidades.push({
        nombre: mp.nombre,
        necesidad,
        disponible: mp.inventarioActual,
        deficit: deficit > 0 ? deficit : 0,
      });
      if (deficit > 0) {
        const maxPosible = Math.floor(mp.inventarioActual / mp.cantidadPorUnidad);
        produccionPlanificada = Math.min(produccionPlanificada, maxPosible);
        alertas.push({
          periodo,
          tipo: 'material',
          mensaje: `No hay suficiente ${mp.nombre} para la ${periodo}. Se requiere ${deficit.toFixed(1)} kg adicionales.`,
        });
      }
    }

    const inventarioFinal = inventarioActual + produccionPlanificada - demandaPeriodo;

    if (inventarioFinal < 0) {
      alertas.push({
        periodo,
        tipo: 'deficit',
        mensaje: `${periodo}: Déficit de ${Math.abs(inventarioFinal)} unidades. La producción nivelada (${produccionNivelada}/semana) no cubre la demanda.`,
      });
    }

    for (const mp of mpTracking) {
      const consumo = produccionPlanificada * mp.cantidadPorUnidad;
      mp.inventarioActual = Math.max(0, mp.inventarioActual - consumo);
      mp.necesidadTotal += produccionPlanificada * mp.cantidadPorUnidad;
    }

    produccionTotal += produccionPlanificada;

    resultados.push({
      periodo,
      demanda: demandaPeriodo,
      inventarioInicial: inventarioActual,
      necesidadNeta: Math.max(0, demandaPeriodo - inventarioActual),
      produccionPlanificada,
      produccionNivelada,
      inventarioFinal: Math.max(inventarioFinal, 0),
      deficit: inventarioFinal < 0 ? Math.abs(inventarioFinal) : 0,
      horasNecesarias: produccionPlanificada * tiempoProduccion,
      horasDisponibles: capacidadProduccion * tiempoProduccion,
      mpNecesidades,
    });

    inventarioActual = Math.max(inventarioFinal, 0);
  }

  const necesidadesMateriales = mpTracking.map(mp => ({
    nombre: mp.nombre,
    necesidadTotal: mp.necesidadTotal,
    inventarioInicial: mp.inventario,
    inventarioFinal: mp.inventarioActual,
    deficit: Math.max(0, mp.necesidadTotal - mp.inventario),
  }));

  const inventarioFinalGlobal = resultados.length > 0
    ? resultados[resultados.length - 1].inventarioFinal - (resultados[resultados.length - 1].deficit || 0)
    : inventarioInicial;

  return {
    metodo: 'Planificación Temporal',
    producto,
    periodos: resultados,
    alertas,
    necesidadesMateriales,
    resumen: {
      produccionTotal,
      produccionNivelada,
      inventarioInicial,
      inventarioFinal: inventarioFinalGlobal,
      deficitTotal: resultados.reduce((sum, r) => sum + r.deficit, 0),
      horasTotalesNecesarias: resultados.reduce((sum, r) => sum + r.horasNecesarias, 0),
    },
    restricciones,
  };
}

/**
 * PLANIFICACIÓN PROBABILÍSTICA (MONTE CARLO)
 * Simula múltiples escenarios de demanda y propone buffers de seguridad.
 */
export function calcularMonteCarlo(datos, numSimulaciones = 1000) {
  const {
    producto,
    demanda,
    inventarioInicial,
    capacidadProduccion,
    tiempoProduccion,
    materiasPrimas,
    restricciones,
  } = datos;

  const periodos = demanda.length;

  // Simular variaciones de demanda (±20% desviación)
  const simulaciones = [];
  for (let s = 0; s < numSimulaciones; s++) {
    const demandaSimulada = demanda.map(d => {
      const variacion = (Math.random() - 0.5) * 0.4 * d; // ±20%
      return Math.max(0, Math.round(d + variacion));
    });
    simulaciones.push(demandaSimulada);
  }

  // Calcular estadísticas por periodo
  const estadisticas = [];
  for (let i = 0; i < periodos; i++) {
    const valores = simulaciones.map(s => s[i]).sort((a, b) => a - b);
    const media = valores.reduce((s, v) => s + v, 0) / valores.length;
    const p10 = valores[Math.floor(valores.length * 0.1)];
    const p50 = valores[Math.floor(valores.length * 0.5)];
    const p90 = valores[Math.floor(valores.length * 0.9)];
    const min = valores[0];
    const max = valores[valores.length - 1];
    const varianza = valores.reduce((s, v) => s + (v - media) ** 2, 0) / valores.length;
    const desviacion = Math.sqrt(varianza);

    estadisticas.push({ media, p10, p50, p90, min, max, desviacion });
  }

  // Buffer de seguridad: usar percentil 90 para planificar
  const demandaConBuffer = estadisticas.map(e => Math.ceil(e.p90));
  const buffers = demandaConBuffer.map((d, i) => d - demanda[i]);

  // Calcular plan con demanda buffered usando MRP base
  const resultados = [];
  let inventarioActual = inventarioInicial;
  const alertas = [];
  let produccionTotal = 0;

  const mpTracking = (materiasPrimas || []).map(mp => ({
    ...mp,
    inventarioActual: mp.inventario,
    necesidadTotal: 0,
  }));

  for (let i = 0; i < periodos; i++) {
    const periodo = `Semana ${i + 1}`;
    const demandaBase = demanda[i];
    const demandaBuffer = demandaConBuffer[i];
    const buffer = buffers[i];

    let necesidadNeta = Math.max(0, demandaBuffer - inventarioActual);
    let produccionPlanificada = Math.min(necesidadNeta, capacidadProduccion);
    let limitadoPorCapacidad = necesidadNeta > capacidadProduccion;

    const mpNecesidades = [];
    for (const mp of mpTracking) {
      const necesidad = produccionPlanificada * mp.cantidadPorUnidad;
      const deficit = necesidad - mp.inventarioActual;
      mpNecesidades.push({
        nombre: mp.nombre,
        necesidad,
        disponible: mp.inventarioActual,
        deficit: deficit > 0 ? deficit : 0,
      });
      if (deficit > 0) {
        const maxPosible = Math.floor(mp.inventarioActual / mp.cantidadPorUnidad);
        produccionPlanificada = Math.min(produccionPlanificada, maxPosible);
        alertas.push({
          periodo,
          tipo: 'material',
          mensaje: `No hay suficiente ${mp.nombre} para la ${periodo}. Se requiere ${deficit.toFixed(1)} kg adicionales.`,
        });
      }
    }

    if (limitadoPorCapacidad) {
      alertas.push({
        periodo,
        tipo: 'capacidad',
        mensaje: `${periodo}: Capacidad insuficiente. Demanda con buffer: ${demandaBuffer}, capacidad: ${capacidadProduccion}.`,
      });
    }

    const inventarioFinal = inventarioActual + produccionPlanificada - demandaBase;

    if (inventarioFinal < 0) {
      alertas.push({
        periodo,
        tipo: 'deficit',
        mensaje: `${periodo}: Déficit de ${Math.abs(inventarioFinal)} unidades incluso con buffer de seguridad.`,
      });
    }

    for (const mp of mpTracking) {
      const consumo = produccionPlanificada * mp.cantidadPorUnidad;
      mp.inventarioActual = Math.max(0, mp.inventarioActual - consumo);
      mp.necesidadTotal += produccionPlanificada * mp.cantidadPorUnidad;
    }

    produccionTotal += produccionPlanificada;

    resultados.push({
      periodo,
      demandaBase,
      demandaBuffer,
      buffer,
      estadisticas: estadisticas[i],
      inventarioInicial: inventarioActual,
      necesidadNeta,
      produccionPlanificada,
      inventarioFinal: Math.max(inventarioFinal, 0),
      deficit: inventarioFinal < 0 ? Math.abs(inventarioFinal) : 0,
      horasNecesarias: produccionPlanificada * tiempoProduccion,
      horasDisponibles: capacidadProduccion * tiempoProduccion,
      limitadoPorCapacidad,
      mpNecesidades,
    });

    inventarioActual = Math.max(inventarioFinal, 0);
  }

  const necesidadesMateriales = mpTracking.map(mp => ({
    nombre: mp.nombre,
    necesidadTotal: mp.necesidadTotal,
    inventarioInicial: mp.inventario,
    inventarioFinal: mp.inventarioActual,
    deficit: Math.max(0, mp.necesidadTotal - mp.inventario),
  }));

  const inventarioFinalGlobal = resultados.length > 0
    ? resultados[resultados.length - 1].inventarioFinal - (resultados[resultados.length - 1].deficit || 0)
    : inventarioInicial;

  // Distribución de demanda total simulada
  const demandaTotalSimulada = simulaciones.map(s => s.reduce((sum, v) => sum + v, 0));
  demandaTotalSimulada.sort((a, b) => a - b);

  return {
    metodo: 'Probabilístico (Monte Carlo)',
    producto,
    periodos: resultados,
    alertas,
    necesidadesMateriales,
    estadisticas,
    distribucionDemanda: {
      valores: demandaTotalSimulada,
      media: demandaTotalSimulada.reduce((s, v) => s + v, 0) / demandaTotalSimulada.length,
      p10: demandaTotalSimulada[Math.floor(demandaTotalSimulada.length * 0.1)],
      p50: demandaTotalSimulada[Math.floor(demandaTotalSimulada.length * 0.5)],
      p90: demandaTotalSimulada[Math.floor(demandaTotalSimulada.length * 0.9)],
    },
    resumen: {
      produccionTotal,
      inventarioInicial,
      inventarioFinal: inventarioFinalGlobal,
      deficitTotal: resultados.reduce((sum, r) => sum + r.deficit, 0),
      bufferTotal: buffers.reduce((s, b) => s + b, 0),
      numSimulaciones,
      horasTotalesNecesarias: resultados.reduce((sum, r) => sum + r.horasNecesarias, 0),
    },
    restricciones,
  };
}
