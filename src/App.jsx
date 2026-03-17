import { useState, useEffect, useRef } from 'react';
import ChatPanel from './components/ChatPanel';
import ResultsPanel from './components/ResultsPanel';
import { Bot, MessageSquare } from 'lucide-react';
import { calcularMRPClasico, calcularTemporal, calcularMonteCarlo } from './planningEngine';

function App() {
  const [resultados, setResultados] = useState(null);
  const [dfCollected, setDfCollected] = useState([]);
  const datosRef = useRef({
    metodo: '',
    producto: '',
    demanda: [],
    inventarioInicial: 0,
    capacidadProduccion: 0,
    tiempoProduccion: 0,
    materiasPrimas: [],
    restricciones: 'Ninguna',
  });

  useEffect(() => {
    const handleDfResponse = (event) => {
      const queryResult = event?.detail?.response?.queryResult;
      if (!queryResult) return;

      const intentName = queryResult.intent?.displayName || '';
      const queryText = queryResult.queryText || '';
      const d = datosRef.current;

      switch (intentName) {
        case 'seleccionar.metodo': {
          const v = queryText.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
          let metodo = 'clasico';
          if (v.includes('temporal')) metodo = 'temporal';
          else if (v.includes('probabili') || v.includes('monte') || v.includes('carlo')) metodo = 'probabilistico';
          datosRef.current = { ...d, metodo };
          setDfCollected((prev) => [...prev, `Metodo: ${metodo}`]);
          break;
        }
        case 'ingresar.producto': {
          const producto = queryText.replace(/^(el producto es|quiero planificar|producto)\s*/i, '').trim() || queryText;
          datosRef.current = { ...d, producto };
          setDfCollected((prev) => [...prev, `Producto: ${producto}`]);
          break;
        }
        case 'ingresar.demanda': {
          const numeros = queryText.match(/\d+/g);
          if (numeros) {
            const demanda = numeros.map(Number);
            datosRef.current = { ...d, demanda };
            setDfCollected((prev) => [...prev, `Demanda: ${demanda.join(', ')}`]);
          }
          break;
        }
        case 'ingresar.inventario': {
          const num = parseInt(queryText.match(/\d+/)?.[0]);
          if (!isNaN(num)) {
            datosRef.current = { ...d, inventarioInicial: num };
            setDfCollected((prev) => [...prev, `Inventario: ${num}`]);
          }
          break;
        }
        case 'ingresar.capacidad': {
          const num = parseInt(queryText.match(/\d+/)?.[0]);
          if (!isNaN(num)) {
            datosRef.current = { ...d, capacidadProduccion: num };
            setDfCollected((prev) => [...prev, `Capacidad: ${num}`]);
          }
          break;
        }
        case 'ingresar.tiempo': {
          const num = parseFloat(queryText.match(/[\d.]+/)?.[0]);
          if (!isNaN(num)) {
            datosRef.current = { ...d, tiempoProduccion: num };
            setDfCollected((prev) => [...prev, `Tiempo: ${num}h/ud`]);
            // All basic data collected — run planning
            setTimeout(() => {
              const datos = datosRef.current;
              let resultado;
              try {
                switch (datos.metodo) {
                  case 'temporal':
                    resultado = calcularTemporal(datos);
                    break;
                  case 'probabilistico':
                    resultado = calcularMonteCarlo(datos);
                    break;
                  default:
                    resultado = calcularMRPClasico(datos);
                }
                setResultados(resultado);
                setDfCollected((prev) => [...prev, 'Plan generado']);
              } catch (err) {
                console.error('Error Dialogflow planning:', err);
              }
            }, 500);
          }
          break;
        }
        default:
          break;
      }
    };

    // Wait for df-messenger to be ready, then attach listener
    const tryAttach = () => {
      const dfMessenger = document.querySelector('df-messenger');
      if (dfMessenger) {
        dfMessenger.addEventListener('df-response-received', handleDfResponse);
        return true;
      }
      return false;
    };

    if (!tryAttach()) {
      const interval = setInterval(() => {
        if (tryAttach()) clearInterval(interval);
      }, 500);
      return () => clearInterval(interval);
    }

    return () => {
      const dfMessenger = document.querySelector('df-messenger');
      if (dfMessenger) {
        dfMessenger.removeEventListener('df-response-received', handleDfResponse);
      }
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-slate-100">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 px-6 py-3 flex items-center gap-3 shrink-0">
        <div className="bg-blue-600 text-white p-2 rounded-lg">
          <Bot size={24} />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-800 leading-tight">PlanBot</h1>
          <p className="text-xs text-slate-500">Chatbot de Planificacion Automatica de Produccion</p>
        </div>
        <div className="ml-auto flex gap-2 items-center">
          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">MRP Clasico</span>
          <span className="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-medium">Temporal</span>
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">Monte Carlo</span>
          <span className="mx-2 h-5 w-px bg-slate-300" />
          <div className="flex items-center gap-1.5 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
            <MessageSquare size={12} className="text-green-600" />
            <span className="text-xs text-green-700 font-medium">Dialogflow Integrado</span>
          </div>
        </div>
      </header>

      {/* Dialogflow data collection indicator */}
      {dfCollected.length > 0 && (
        <div className="bg-blue-50 border-b border-blue-200 px-6 py-2 flex items-center gap-3">
          <span className="text-xs font-medium text-blue-700">Dialogflow:</span>
          <div className="flex flex-wrap gap-1">
            {dfCollected.map((item, i) => (
              <span key={i} className={`text-xs px-2 py-0.5 rounded-full ${
                item === 'Plan generado'
                  ? 'bg-green-100 text-green-700'
                  : 'bg-blue-100 text-blue-700'
              }`}>
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-1 overflow-hidden">
        <div className="w-1/2 border-r border-slate-200">
          <ChatPanel onResultados={setResultados} />
        </div>
        <div className="w-1/2">
          <ResultsPanel resultados={resultados} />
        </div>
      </div>
    </div>
  );
}

export default App;
