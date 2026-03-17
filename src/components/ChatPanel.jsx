import { useState, useRef, useEffect } from 'react';
import { Send, RotateCcw, Bot, User, AlertTriangle, CheckCircle, Edit3 } from 'lucide-react';
import { calcularMRPClasico, calcularTemporal, calcularMonteCarlo } from '../planningEngine';

const STEPS = [
  'bienvenida',
  'metodo',
  'producto',
  'demanda',
  'inventario',
  'capacidad',
  'tiempoProduccion',
  'materiasPrimas',
  'inventarioMP',
  'restricciones',
  'procesando',
  'completado',
];

const METODOS = {
  clasico: 'MRP Clásico',
  temporal: 'Planificación Temporal',
  probabilistico: 'Probabilístico (Monte Carlo)',
};

function ChatPanel({ onResultados }) {
  const [mensajes, setMensajes] = useState([
    {
      tipo: 'bot',
      texto: '¡Hola! Soy PlanBot, tu asistente de planificación automática de producción.\n\nPuedo ayudarte a generar planes de producción usando tres métodos:\n• **MRP Clásico**: Calcula necesidades de materiales y fechas de producción\n• **Temporal**: Planificación nivelada basada en cronogramas y capacidad\n• **Probabilístico (Monte Carlo)**: Considera incertidumbre y propone buffers de seguridad\n\n¿Qué método de planificación deseas usar?\nEscribe: **clásico**, **temporal** o **probabilístico**',
    },
  ]);
  const [input, setInput] = useState('');
  const [step, setStep] = useState('metodo');
  const [datos, setDatos] = useState({
    metodo: '',
    producto: '',
    demanda: [],
    inventarioInicial: 0,
    capacidadProduccion: 0,
    tiempoProduccion: 0,
    materiasPrimas: [],
    restricciones: '',
  });
  const [mpTemp, setMpTemp] = useState({ nombre: '', cantidadPorUnidad: 0 });
  const [mpList, setMpList] = useState([]);
  const [esperandoMasMP, setEsperandoMasMP] = useState(false);
  const chatRef = useRef(null);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [mensajes]);

  const addBot = (texto) => {
    setMensajes((prev) => [...prev, { tipo: 'bot', texto }]);
  };

  const addUser = (texto) => {
    setMensajes((prev) => [...prev, { tipo: 'user', texto }]);
  };

  const addAlerta = (texto) => {
    setMensajes((prev) => [...prev, { tipo: 'alerta', texto }]);
  };

  const addExito = (texto) => {
    setMensajes((prev) => [...prev, { tipo: 'exito', texto }]);
  };

  const procesarInput = () => {
    const valor = input.trim();
    if (!valor) return;

    addUser(valor);
    setInput('');

    switch (step) {
      case 'metodo': {
        const v = valor.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        if (v.includes('clasico') || v.includes('mrp')) {
          setDatos((d) => ({ ...d, metodo: 'clasico' }));
          addBot(`Has elegido **${METODOS.clasico}**.\n\n¿Cuál es el producto a planificar?\n(Ejemplo: "Galletas de chocolate", "Refresco de naranja")`);
          setStep('producto');
        } else if (v.includes('temporal')) {
          setDatos((d) => ({ ...d, metodo: 'temporal' }));
          addBot(`Has elegido **${METODOS.temporal}**.\n\n¿Cuál es el producto a planificar?\n(Ejemplo: "Galletas de chocolate", "Refresco de naranja")`);
          setStep('producto');
        } else if (v.includes('probabili') || v.includes('monte') || v.includes('carlo')) {
          setDatos((d) => ({ ...d, metodo: 'probabilistico' }));
          addBot(`Has elegido **${METODOS.probabilistico}**.\n\n¿Cuál es el producto a planificar?\n(Ejemplo: "Galletas de chocolate", "Refresco de naranja")`);
          setStep('producto');
        } else {
          addBot('Por favor, selecciona un método válido: **clásico**, **temporal** o **probabilístico**.');
        }
        break;
      }

      case 'producto': {
        if (valor.length < 2) {
          addBot('Por favor, ingresa un nombre de producto válido (al menos 2 caracteres).');
          return;
        }
        setDatos((d) => ({ ...d, producto: valor }));
        addBot(`Producto: **${valor}**\n\n¿Cuál es la demanda esperada por periodo?\n(Ejemplo: "500, 600, 450" o "Semana 1: 500, Semana 2: 600")`);
        setStep('demanda');
        break;
      }

      case 'demanda': {
        let demanda;
        // Formato "Semana 1: 500, Semana 2: 600" — extraer solo los valores después de ":"
        if (valor.match(/semana\s*\d+\s*:/i)) {
          const matches = [...valor.matchAll(/:\s*(\d+)/g)];
          if (matches.length === 0) {
            addBot('No se encontraron valores de demanda. Ejemplo: **Semana 1: 500, Semana 2: 600**');
            return;
          }
          demanda = matches.map(m => Number(m[1]));
        } else {
          // Formato simple "500, 600, 450"
          const numeros = valor.match(/\d+/g);
          if (!numeros || numeros.length === 0) {
            addBot('No se encontraron números. Ejemplo: **500, 600, 450** o **Semana 1: 500, Semana 2: 600**');
            return;
          }
          demanda = numeros.map(Number);
        }
        setDatos((d) => ({ ...d, demanda }));
        const detalle = demanda.map((d, i) => `Semana ${i + 1}: ${d} uds`).join(', ');
        addBot(`Demanda registrada: ${detalle}\n\n¿Cuál es el inventario actual de producto terminado?\n(Ejemplo: "200 unidades")`);
        setStep('inventario');
        break;
      }

      case 'inventario': {
        const num = parseInt(valor.match(/\d+/)?.[0]);
        if (isNaN(num) || num < 0) {
          addBot('Por favor, ingresa un número válido (≥ 0).');
          return;
        }
        setDatos((d) => ({ ...d, inventarioInicial: num }));
        addBot(`Inventario inicial: **${num} unidades**\n\n¿Cuál es la capacidad máxima de producción por periodo?\n(Ejemplo: "400 unidades/semana")`);
        setStep('capacidad');
        break;
      }

      case 'capacidad': {
        const num = parseInt(valor.match(/\d+/)?.[0]);
        if (isNaN(num) || num <= 0) {
          addBot('Por favor, ingresa un número positivo.');
          return;
        }
        setDatos((d) => ({ ...d, capacidadProduccion: num }));
        addBot(`Capacidad: **${num} unidades/periodo**\n\n¿Cuánto tiempo tarda producir una unidad?\n(Ejemplo: "2 horas/unidad")`);
        setStep('tiempoProduccion');
        break;
      }

      case 'tiempoProduccion': {
        const match = valor.match(/[\d.]+/);
        const num = parseFloat(match?.[0]);
        if (isNaN(num) || num <= 0) {
          addBot('Por favor, ingresa un número positivo (en horas/unidad).');
          return;
        }
        setDatos((d) => ({ ...d, tiempoProduccion: num }));
        addBot(`Tiempo de producción: **${num} horas/unidad**\n\nAhora necesito las materias primas. ¿Cuál es el nombre de la primera materia prima?\n(Ejemplo: "Harina", "Azúcar", "Chocolate")`);
        setStep('materiasPrimas');
        setMpList([]);
        break;
      }

      case 'materiasPrimas': {
        if (esperandoMasMP) {
          const v = valor.toLowerCase();
          if (v === 'sí' || v === 'si' || v === 's') {
            setEsperandoMasMP(false);
            addBot('¿Cuál es el nombre de la siguiente materia prima?');
          } else {
            setEsperandoMasMP(false);
            setDatos((d) => ({ ...d, materiasPrimas: mpList }));
            if (mpList.length > 0) {
              addBot(`Materias primas registradas.\n\nAhora, ¿cuál es el inventario disponible de cada materia prima?\nIngresa los valores separados por coma en el mismo orden:\n${mpList.map((mp) => `• ${mp.nombre}`).join('\n')}\n\n(Ejemplo: "100, 50, 30")`);
              setStep('inventarioMP');
            } else {
              addBot('¿Deseas agregar alguna prioridad o restricción? (Ejemplo: "Pedido urgente semana 2" o "No")')
              setStep('restricciones');
            }
          }
          return;
        }

        // Si no tenemos nombre aún para la MP actual
        if (!mpTemp.nombre) {
          setMpTemp({ nombre: valor, cantidadPorUnidad: 0 });
          addBot(`Materia prima: **${valor}**\n\n¿Cuánta cantidad de ${valor} se necesita por unidad de producto?\n(Ejemplo: "0.5 kg/unidad" o "2")`);
        } else {
          // Estamos recibiendo la cantidad por unidad
          const match = valor.match(/[\d.]+/);
          const num = parseFloat(match?.[0]);
          if (isNaN(num) || num <= 0) {
            addBot('Por favor, ingresa un número positivo.');
            return;
          }
          const nuevaMP = { nombre: mpTemp.nombre, cantidadPorUnidad: num, inventario: 0 };
          const nuevaLista = [...mpList, nuevaMP];
          setMpList(nuevaLista);
          setMpTemp({ nombre: '', cantidadPorUnidad: 0 });
          setEsperandoMasMP(true);
          addBot(`Registrado: **${nuevaMP.nombre}** — ${num} por unidad producida.\n\n¿Deseas agregar otra materia prima? (**sí** / **no**)`);
        }
        break;
      }

      case 'inventarioMP': {
        const numeros = valor.match(/[\d.]+/g);
        if (!numeros || numeros.length < mpList.length) {
          addBot(`Por favor, ingresa ${mpList.length} valores separados por coma.\n${mpList.map((mp) => `• ${mp.nombre}`).join('\n')}`);
          return;
        }
        const inventarios = numeros.map(Number);
        const mpActualizada = mpList.map((mp, i) => ({
          ...mp,
          inventario: inventarios[i] || 0,
        }));
        setMpList(mpActualizada);
        setDatos((d) => ({ ...d, materiasPrimas: mpActualizada }));
        const detalle = mpActualizada.map((mp) => `• ${mp.nombre}: ${mp.inventario} disponibles`).join('\n');
        addBot(`Inventario de materias primas:\n${detalle}\n\n¿Deseas agregar alguna prioridad o restricción?\n(Ejemplo: "Pedido urgente semana 2", "Mantenimiento semana 3" o **no**)`);
        setStep('restricciones');
        break;
      }

      case 'restricciones': {
        const v = valor.toLowerCase();
        const restricciones = (v === 'no' || v === 'n' || v === 'ninguna') ? 'Ninguna' : valor;
        setDatos((d) => ({ ...d, restricciones }));
        addBot(`Restricciones: **${restricciones}**\n\n⏳ Procesando tu plan de producción...`);
        setStep('procesando');

        // Procesar con un pequeño delay para la UX
        setTimeout(() => {
          ejecutarPlanificacion({ ...datos, restricciones, materiasPrimas: mpList.length > 0 ? mpList : datos.materiasPrimas });
        }, 800);
        break;
      }

      case 'completado': {
        const v = valor.toLowerCase();
        if (v.includes('ajust') || v.includes('modific') || v.includes('cambiar') || v.includes('editar')) {
          addBot('¿Qué dato deseas ajustar?\n1. Demanda\n2. Inventario\n3. Capacidad\n4. Tiempo de producción\n\nEscribe el número o nombre del dato a cambiar.');
          setStep('ajustar');
        } else if (v.includes('nueva') || v.includes('reiniciar') || v.includes('reset')) {
          reiniciar();
        } else {
          addBot('Planificación completada. Puedes:\n• Escribir **"ajustar"** para modificar parámetros\n• Escribir **"nueva"** para reiniciar la planificación');
        }
        break;
      }

      case 'ajustar': {
        const v = valor.toLowerCase();
        if (v.includes('1') || v.includes('demanda')) {
          addBot('Ingresa la nueva demanda por periodo:\n(Ejemplo: "500, 600, 450")');
          setStep('ajustar_demanda');
        } else if (v.includes('2') || v.includes('inventario')) {
          addBot('Ingresa el nuevo inventario inicial:');
          setStep('ajustar_inventario');
        } else if (v.includes('3') || v.includes('capacidad')) {
          addBot('Ingresa la nueva capacidad de producción por periodo:');
          setStep('ajustar_capacidad');
        } else if (v.includes('4') || v.includes('tiempo')) {
          addBot('Ingresa el nuevo tiempo de producción (horas/unidad):');
          setStep('ajustar_tiempo');
        } else {
          addBot('Opción no válida. Escribe 1, 2, 3 o 4.');
        }
        break;
      }

      case 'ajustar_demanda': {
        const numeros = valor.match(/\d+/g);
        if (!numeros) { addBot('Formato inválido.'); return; }
        const demanda = numeros.map(Number);
        setDatos((d) => ({ ...d, demanda }));
        addBot(`Demanda actualizada. ⏳ Recalculando...`);
        setTimeout(() => {
          ejecutarPlanificacion({ ...datos, demanda });
        }, 500);
        break;
      }
      case 'ajustar_inventario': {
        const num = parseInt(valor.match(/\d+/)?.[0]);
        if (isNaN(num)) { addBot('Número inválido.'); return; }
        setDatos((d) => ({ ...d, inventarioInicial: num }));
        addBot(`Inventario actualizado a ${num}. ⏳ Recalculando...`);
        setTimeout(() => {
          ejecutarPlanificacion({ ...datos, inventarioInicial: num });
        }, 500);
        break;
      }
      case 'ajustar_capacidad': {
        const num = parseInt(valor.match(/\d+/)?.[0]);
        if (isNaN(num)) { addBot('Número inválido.'); return; }
        setDatos((d) => ({ ...d, capacidadProduccion: num }));
        addBot(`Capacidad actualizada a ${num}. ⏳ Recalculando...`);
        setTimeout(() => {
          ejecutarPlanificacion({ ...datos, capacidadProduccion: num });
        }, 500);
        break;
      }
      case 'ajustar_tiempo': {
        const num = parseFloat(valor.match(/[\d.]+/)?.[0]);
        if (isNaN(num)) { addBot('Número inválido.'); return; }
        setDatos((d) => ({ ...d, tiempoProduccion: num }));
        addBot(`Tiempo actualizado a ${num} horas/unidad. ⏳ Recalculando...`);
        setTimeout(() => {
          ejecutarPlanificacion({ ...datos, tiempoProduccion: num });
        }, 500);
        break;
      }

      default:
        break;
    }
  };

  const ejecutarPlanificacion = (d) => {
    let resultado;
    try {
      switch (d.metodo) {
        case 'clasico':
          resultado = calcularMRPClasico(d);
          break;
        case 'temporal':
          resultado = calcularTemporal(d);
          break;
        case 'probabilistico':
          resultado = calcularMonteCarlo(d);
          break;
        default:
          resultado = calcularMRPClasico(d);
      }

      onResultados(resultado);

      // Mostrar plan de producción en el chat
      let planTexto = `✅ **¡Plan de producción generado con éxito!**\n\n`;
      planTexto += `📋 **Plan de producción sugerido — ${resultado.producto}:**\n`;
      resultado.periodos.forEach((p) => {
        planTexto += `• ${p.periodo}: producir **${p.produccionPlanificada} unidades**`;
        if (p.limitadoPorCapacidad) planTexto += ' _(limitado por capacidad)_';
        planTexto += '\n';
      });

      addExito(planTexto);

      // Mostrar necesidades de materiales
      if (resultado.necesidadesMateriales && resultado.necesidadesMateriales.length > 0) {
        let mpTexto = `🧱 **Necesidades de materiales:**\n`;
        resultado.necesidadesMateriales.forEach((mp) => {
          mpTexto += `• ${mp.nombre}: ${mp.necesidadTotal.toFixed(1)} necesarios`;
          if (mp.deficit > 0) {
            mpTexto += ` — ⚠️ Déficit de ${mp.deficit.toFixed(1)}`;
          }
          mpTexto += '\n';
        });
        addBot(mpTexto);
      }

      // Mostrar alertas
      if (resultado.alertas.length > 0) {
        let alertaTexto = `⚠️ **Alertas:**\n`;
        resultado.alertas.forEach((a) => {
          alertaTexto += `• ${a.mensaje}\n`;
        });
        addAlerta(alertaTexto);
      }

      // Resumen final
      const r = resultado.resumen;
      let resumenTexto = `📊 **Resumen final:**\n`;
      resumenTexto += `• Producción total: **${r.produccionTotal} unidades**\n`;
      resumenTexto += `• Inventario inicial: ${r.inventarioInicial} unidades\n`;
      resumenTexto += `• Inventario final proyectado: **${r.inventarioFinal} unidades**\n`;
      resumenTexto += `• Horas totales necesarias: ${r.horasTotalesNecesarias} horas\n`;
      if (r.deficitTotal > 0) {
        resumenTexto += `• ⚠️ Déficit total: **${r.deficitTotal} unidades** — posibles retrasos en entrega\n`;
      }
      if (r.bufferTotal) {
        resumenTexto += `• Buffer de seguridad total: ${r.bufferTotal} unidades (Monte Carlo P90)\n`;
      }
      if (resultado.restricciones && resultado.restricciones !== 'Ninguna') {
        resumenTexto += `• Restricciones consideradas: ${resultado.restricciones}\n`;
      }
      resumenTexto += `\n_Revisa los gráficos detallados en el panel derecho._\n\nPuedes escribir **"ajustar"** para modificar parámetros o **"nueva"** para reiniciar.`;
      addBot(resumenTexto);

      setStep('completado');
    } catch (err) {
      addAlerta(`Error al procesar: ${err.message}`);
      setStep('completado');
    }
  };

  const reiniciar = () => {
    setMensajes([
      {
        tipo: 'bot',
        texto: '¡Empecemos de nuevo! ¿Qué método de planificación deseas usar?\nEscribe: **clásico**, **temporal** o **probabilístico**',
      },
    ]);
    setStep('metodo');
    setDatos({
      metodo: '',
      producto: '',
      demanda: [],
      inventarioInicial: 0,
      capacidadProduccion: 0,
      tiempoProduccion: 0,
      materiasPrimas: [],
      restricciones: '',
    });
    setMpList([]);
    setMpTemp({ nombre: '', cantidadPorUnidad: 0 });
    setEsperandoMasMP(false);
    onResultados(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      procesarInput();
    }
  };

  const renderMarkdown = (texto) => {
    // Simple markdown rendering
    return texto
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/_(.*?)_/g, '<em>$1</em>')
      .replace(/\n/g, '<br/>');
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat messages */}
      <div ref={chatRef} className="flex-1 overflow-y-auto p-4 space-y-3 chat-scroll">
        {mensajes.map((msg, i) => (
          <div key={i} className={`flex ${msg.tipo === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`flex gap-2 max-w-[85%] ${msg.tipo === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.tipo !== 'user' && (
                <div className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-1 ${
                  msg.tipo === 'alerta' ? 'bg-amber-100' :
                  msg.tipo === 'exito' ? 'bg-green-100' :
                  'bg-blue-100'
                }`}>
                  {msg.tipo === 'alerta' ? <AlertTriangle size={14} className="text-amber-600" /> :
                   msg.tipo === 'exito' ? <CheckCircle size={14} className="text-green-600" /> :
                   <Bot size={14} className="text-blue-600" />}
                </div>
              )}
              {msg.tipo === 'user' && (
                <div className="shrink-0 w-7 h-7 rounded-full bg-blue-600 flex items-center justify-center mt-1">
                  <User size={14} className="text-white" />
                </div>
              )}
              <div
                className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                  msg.tipo === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : msg.tipo === 'alerta'
                    ? 'bg-amber-50 text-amber-900 border border-amber-200 rounded-bl-md'
                    : msg.tipo === 'exito'
                    ? 'bg-green-50 text-green-900 border border-green-200 rounded-bl-md'
                    : 'bg-slate-100 text-slate-800 rounded-bl-md'
                }`}
                dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.texto) }}
              />
            </div>
          </div>
        ))}
      </div>

      {/* Input area */}
      <div className="border-t border-slate-200 p-3 bg-white">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={step === 'procesando' ? 'Procesando...' : 'Escribe tu respuesta...'}
            disabled={step === 'procesando'}
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-slate-100"
          />
          <button
            onClick={procesarInput}
            disabled={step === 'procesando' || !input.trim()}
            className="bg-blue-600 text-white p-2.5 rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={18} />
          </button>
          <button
            onClick={reiniciar}
            className="bg-slate-200 text-slate-600 p-2.5 rounded-xl hover:bg-slate-300 transition-colors"
            title="Nueva planificación"
          >
            <RotateCcw size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatPanel;
