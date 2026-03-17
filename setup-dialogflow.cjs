/**
 * Script para crear automáticamente los intents de PlanBot en Dialogflow ES.
 * Uso: node setup-dialogflow.cjs
 */

const dialogflow = require('@google-cloud/dialogflow');

const PROJECT_ID = 'planbot-490500';
const CREDENTIALS_PATH = '/Users/juanpablotovar/Downloads/planbot-490500-ad336af9fe36.json';

process.env.GOOGLE_APPLICATION_CREDENTIALS = CREDENTIALS_PATH;

const intentsClient = new dialogflow.IntentsClient();

const intents = [
  {
    displayName: 'seleccionar.metodo',
    trainingPhrases: [
      'clásico',
      'método clásico',
      'mrp clásico',
      'quiero usar el método clásico',
      'temporal',
      'planificación temporal',
      'quiero el método temporal',
      'probabilístico',
      'monte carlo',
      'método probabilístico',
      'quiero usar monte carlo',
      'probabilistico',
      'metodo clasico',
      'metodo temporal',
    ],
    messages: ['Perfecto. ¿Cuál es el nombre del producto que deseas planificar?'],
  },
  {
    displayName: 'ingresar.producto',
    trainingPhrases: [
      'el producto es sillas',
      'mesas',
      'quiero planificar tornillos',
      'producto bicicletas',
      'galletas de chocolate',
      'refresco de naranja',
      'el producto es pan',
      'voy a planificar camisetas',
      'zapatos',
      'botellas de agua',
    ],
    messages: ['¿Cuál es la demanda esperada por período? (ejemplo: 500, 600, 700)'],
  },
  {
    displayName: 'ingresar.demanda',
    trainingPhrases: [
      '500, 600, 700',
      'la demanda es 100, 200, 300',
      '200 300 400 500',
      'demanda 1000, 1500, 2000',
      '300, 400, 350, 500',
      '100, 150, 200',
      'semana 1: 500, semana 2: 600, semana 3: 700',
      '800, 900, 1000, 1100',
    ],
    messages: ['¿Cuál es el inventario inicial disponible de producto terminado?'],
  },
  {
    displayName: 'ingresar.inventario',
    trainingPhrases: [
      '100',
      'inventario de 50',
      'tengo 200 unidades',
      'inventario inicial 300',
      '0 unidades',
      'disponible 150',
      'hay 500 en stock',
      '250',
    ],
    messages: ['¿Cuál es la capacidad máxima de producción por período?'],
  },
  {
    displayName: 'ingresar.capacidad',
    trainingPhrases: [
      'capacidad de 500',
      'puedo producir 300',
      '400 unidades',
      'máximo 600',
      'capacidad 200 por semana',
      '350 unidades por periodo',
      '1000',
      'la capacidad es de 450',
    ],
    messages: ['¿Cuántas horas toma producir una unidad? (ejemplo: 2 horas por unidad)'],
  },
  {
    displayName: 'ingresar.tiempo',
    trainingPhrases: [
      '2 horas',
      '1.5 horas por unidad',
      'tarda 3 horas',
      '0.5',
      '2 horas por unidad',
      '1 hora',
      '4 horas/unidad',
      '0.75 horas',
    ],
    messages: ['Datos recibidos. Procesando tu plan de producción... Los resultados aparecerán en el panel derecho.'],
  },
];

async function createIntents() {
  const agentPath = intentsClient.projectAgentPath(PROJECT_ID);

  console.log('Conectando con Dialogflow...');
  console.log(`Proyecto: ${PROJECT_ID}\n`);

  for (const intent of intents) {
    const trainingPhrases = intent.trainingPhrases.map((phrase) => ({
      type: 'EXAMPLE',
      parts: [{ text: phrase }],
    }));

    const messages = intent.messages.map((msg) => ({
      text: { text: [msg] },
    }));

    const request = {
      parent: agentPath,
      intent: {
        displayName: intent.displayName,
        trainingPhrases,
        messages,
      },
    };

    try {
      const [response] = await intentsClient.createIntent(request);
      console.log(`  Intent creado: ${response.displayName}`);
    } catch (err) {
      if (err.code === 6) {
        // ALREADY_EXISTS
        console.log(`  Intent ya existe: ${intent.displayName} (omitido)`);
      } else {
        console.error(`  Error creando ${intent.displayName}:`, err.message);
      }
    }
  }

  console.log('\n¡Configuración completada!');
}

createIntents().catch(console.error);
