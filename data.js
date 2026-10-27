/* Catálogo de ejercicios, plantillas de planes y mapa muscular de Howserfit. */
(function () {
  // Modalidades: g = gimnasio, c = calistenia, x = crossfit, h = casa
  // Tipos: w = peso × repeticiones, bw = peso corporal (reps, lastre opcional), t = tiempo (segundos)
  const MUSCLES = {
    chest: 'Pecho', shoulders: 'Hombros', biceps: 'Bíceps', triceps: 'Tríceps', forearms: 'Antebrazos',
    abs: 'Abdomen', obliques: 'Oblicuos', traps: 'Trapecio', lats: 'Dorsales', upperback: 'Espalda alta',
    lowerback: 'Lumbares', glutes: 'Glúteos', quads: 'Cuádriceps', hamstrings: 'Isquiotibiales', calves: 'Pantorrillas'
  };
  const GROUPS = ['Pecho', 'Espalda', 'Piernas', 'Glúteos', 'Hombros', 'Brazos', 'Core', 'Cardio'];
  const MODS = [['g', 'Gimnasio'], ['c', 'Calistenia'], ['x', 'CrossFit'], ['h', 'Casa']];

  const L = [];
  function E(id, name, mods, group, primary, secondary, equip, type, inc, tips) {
    L.push({ id, name, mods, group, primary, secondary, equip, type: type || 'w', inc: inc || 2.5, tips: tips || null });
  }

  // Pecho
  E('press_banca', 'Press banca con barra', 'g', 'Pecho', ['chest'], ['shoulders', 'triceps'], 'Barra · Banco plano', 'w', 2.5,
    ['Escápulas juntas y pies firmes en el suelo.', 'Baja la barra a la línea del pezón, codos a ~45°.', 'Empuja en línea recta, sin rebotar en el pecho.']);
  E('press_banca_mancuernas', 'Press banca con mancuernas', 'gh', 'Pecho', ['chest'], ['shoulders', 'triceps'], 'Mancuernas · Banco', 'w', 2,
    ['Baja hasta sentir estiramiento en el pecho.', 'Junta las mancuernas arriba sin chocarlas.']);
  E('press_inclinado_barra', 'Press inclinado con barra', 'g', 'Pecho', ['chest'], ['shoulders', 'triceps'], 'Barra · Banco inclinado', 'w', 2.5,
    ['Banco a 30°, no más alto.', 'Baja la barra a la parte alta del pecho.']);
  E('press_inclinado_mancuernas', 'Press inclinado con mancuernas', 'gh', 'Pecho', ['chest'], ['shoulders', 'triceps'], 'Mancuernas · Banco inclinado', 'w', 2,
    ['Banco a 30°.', 'Codos ligeramente por debajo de los hombros.']);
  E('press_declinado', 'Press declinado con barra', 'g', 'Pecho', ['chest'], ['triceps'], 'Barra · Banco declinado');
  E('press_pecho_maquina', 'Press de pecho en máquina', 'g', 'Pecho', ['chest'], ['shoulders', 'triceps'], 'Máquina');
  E('aperturas_mancuernas', 'Aperturas con mancuernas', 'gh', 'Pecho', ['chest'], ['shoulders'], 'Mancuernas · Banco', 'w', 1,
    ['Codos ligeramente flexionados todo el recorrido.', 'Abre hasta sentir estiramiento, sin dolor en el hombro.']);
  E('cruce_poleas', 'Cruce de poleas', 'g', 'Pecho', ['chest'], ['shoulders'], 'Polea doble', 'w', 1,
    ['Da un paso al frente e inclínate un poco.', 'Junta las manos delante del pecho y aprieta 1 segundo.']);
  E('pec_deck', 'Pec deck (contractor)', 'g', 'Pecho', ['chest'], [], 'Máquina', 'w', 2.5);
  E('flexiones', 'Flexiones', 'ch', 'Pecho', ['chest'], ['triceps', 'shoulders', 'abs'], 'Suelo', 'bw', 2.5,
    ['Cuerpo en línea recta de cabeza a talones.', 'Codos a ~45°, pecho casi al suelo.']);
  E('flexiones_inclinadas', 'Flexiones inclinadas', 'ch', 'Pecho', ['chest'], ['triceps'], 'Banco o barra baja', 'bw');
  E('flexiones_declinadas', 'Flexiones declinadas', 'ch', 'Pecho', ['chest'], ['shoulders', 'triceps'], 'Pies elevados', 'bw');
  E('flexiones_arquero', 'Flexiones arquero', 'c', 'Pecho', ['chest'], ['triceps', 'shoulders'], 'Suelo · Avanzado', 'bw');
  E('fondos_paralelas', 'Fondos en paralelas', 'gc', 'Pecho', ['chest', 'triceps'], ['shoulders'], 'Paralelas', 'bw', 2.5,
    ['Inclina el torso adelante para enfatizar pecho.', 'Baja hasta que el hombro quede a la altura del codo.']);

  // Espalda
  E('dominadas', 'Dominadas pronas', 'gcx', 'Espalda', ['lats'], ['biceps', 'upperback', 'forearms'], 'Barra fija', 'bw', 2.5,
    ['Empieza colgado con brazos estirados.', 'Lleva el pecho hacia la barra, no solo la barbilla.']);
  E('dominadas_supinas', 'Dominadas supinas (chin-up)', 'gc', 'Espalda', ['lats', 'biceps'], ['upperback'], 'Barra fija', 'bw');
  E('dominadas_asistidas', 'Dominadas asistidas', 'gc', 'Espalda', ['lats'], ['biceps', 'upperback'], 'Máquina o banda', 'w', 5);
  E('remo_australiano', 'Remo australiano', 'ch', 'Espalda', ['upperback', 'lats'], ['biceps'], 'Barra baja o mesa', 'bw');
  E('jalon_pecho', 'Jalón al pecho', 'g', 'Espalda', ['lats'], ['biceps', 'upperback'], 'Polea alta', 'w', 2.5,
    ['Saca el pecho y lleva la barra a la clavícula.', 'Controla la subida, sin balancearte.']);
  E('jalon_estrecho', 'Jalón agarre estrecho', 'g', 'Espalda', ['lats'], ['biceps'], 'Polea alta · Triángulo');
  E('remo_barra', 'Remo con barra', 'g', 'Espalda', ['upperback', 'lats'], ['biceps', 'lowerback'], 'Barra', 'w', 2.5,
    ['Torso a ~45°, espalda neutra.', 'Lleva la barra al ombligo apretando las escápulas.']);
  E('remo_mancuerna', 'Remo con mancuerna a una mano', 'gh', 'Espalda', ['lats', 'upperback'], ['biceps'], 'Mancuerna · Banco', 'w', 2,
    ['Apoya rodilla y mano en el banco.', 'Lleva el codo hacia la cadera.']);
  E('remo_polea', 'Remo en polea baja', 'g', 'Espalda', ['upperback', 'lats'], ['biceps'], 'Polea baja');
  E('remo_maquina', 'Remo en máquina con pecho apoyado', 'g', 'Espalda', ['upperback', 'lats'], ['biceps'], 'Máquina');
  E('pullover_polea', 'Pullover en polea', 'g', 'Espalda', ['lats'], [], 'Polea alta · Cuerda', 'w', 2.5);
  E('peso_muerto', 'Peso muerto', 'gx', 'Espalda', ['hamstrings', 'glutes', 'lowerback'], ['traps', 'quads', 'forearms'], 'Barra', 'w', 5,
    ['Barra pegada a las piernas todo el recorrido.', 'Espalda neutra, empuja el suelo con los pies.', 'Bloquea con glúteos, sin hiperextender.']);
  E('face_pull', 'Face pull', 'g', 'Hombros', ['shoulders', 'upperback'], ['traps'], 'Polea · Cuerda', 'w', 2.5,
    ['Tira hacia la frente separando la cuerda.', 'Codos altos, aprieta 1 segundo atrás.']);
  E('encogimientos', 'Encogimientos de hombros', 'gh', 'Espalda', ['traps'], ['forearms'], 'Mancuernas o barra');
  E('hiperextensiones', 'Hiperextensiones', 'g', 'Espalda', ['lowerback'], ['glutes', 'hamstrings'], 'Banco romano', 'bw');
  E('superman', 'Superman', 'h', 'Espalda', ['lowerback'], ['glutes'], 'Suelo', 'bw');
  E('remo_banda', 'Remo con banda elástica', 'h', 'Espalda', ['upperback', 'lats'], ['biceps'], 'Banda elástica', 'bw');
  E('dead_hang', 'Colgado activo', 'c', 'Espalda', ['forearms', 'lats'], ['shoulders'], 'Barra fija', 't');
  E('muscle_up', 'Muscle-up', 'cx', 'Espalda', ['lats', 'chest', 'triceps'], ['biceps', 'shoulders'], 'Barra fija · Avanzado', 'bw');
  E('front_lever', 'Front lever agrupado', 'c', 'Espalda', ['lats', 'abs'], ['upperback'], 'Barra fija · Avanzado', 't');

  // Piernas
  E('sentadilla', 'Sentadilla trasera', 'gx', 'Piernas', ['quads', 'glutes'], ['hamstrings', 'lowerback', 'abs'], 'Barra · Rack', 'w', 5,
    ['Barra sobre trapecios, pies a la anchura de hombros.', 'Rodillas en dirección de las puntas.', 'Baja al menos hasta que el muslo quede paralelo.']);
  E('sentadilla_frontal', 'Sentadilla frontal', 'gx', 'Piernas', ['quads'], ['glutes', 'abs', 'upperback'], 'Barra · Rack', 'w', 2.5);
  E('sentadilla_goblet', 'Sentadilla goblet', 'gh', 'Piernas', ['quads', 'glutes'], ['abs'], 'Mancuerna o kettlebell', 'w', 2,
    ['Mancuerna pegada al pecho.', 'Codos por dentro de las rodillas al bajar.']);
  E('sentadilla_libre', 'Sentadilla con peso corporal', 'ch', 'Piernas', ['quads', 'glutes'], ['hamstrings'], 'Suelo', 'bw');
  E('prensa', 'Prensa de piernas 45°', 'g', 'Piernas', ['quads', 'glutes'], ['hamstrings'], 'Máquina', 'w', 5,
    ['Espalda baja pegada al respaldo.', 'Baja hasta 90° de rodilla sin despegar la cadera.']);
  E('hack_squat', 'Sentadilla hack', 'g', 'Piernas', ['quads'], ['glutes'], 'Máquina', 'w', 5);
  E('extension_cuadriceps', 'Extensión de cuádriceps', 'g', 'Piernas', ['quads'], [], 'Máquina', 'w', 2.5,
    ['Sube controlado y aprieta 1 segundo arriba.']);
  E('curl_femoral_tumbado', 'Curl femoral tumbado', 'g', 'Piernas', ['hamstrings'], ['calves'], 'Máquina', 'w', 2.5);
  E('curl_femoral_sentado', 'Curl femoral sentado', 'g', 'Piernas', ['hamstrings'], [], 'Máquina', 'w', 2.5);
  E('peso_muerto_rumano', 'Peso muerto rumano', 'gh', 'Piernas', ['hamstrings', 'glutes'], ['lowerback'], 'Barra o mancuernas', 'w', 2.5,
    ['Rodillas apenas flexionadas.', 'Lleva la cadera atrás hasta sentir estiramiento en isquios.']);
  E('zancadas', 'Zancadas con mancuernas', 'gch', 'Piernas', ['quads', 'glutes'], ['hamstrings'], 'Mancuernas', 'w', 2);
  E('bulgara', 'Sentadilla búlgara', 'gch', 'Piernas', ['quads', 'glutes'], ['hamstrings'], 'Banco · Mancuernas opcional', 'w', 2,
    ['Pie trasero apoyado en el banco.', 'Torso ligeramente inclinado, baja vertical.']);
  E('pistol', 'Pistol squat', 'c', 'Piernas', ['quads', 'glutes'], ['abs'], 'Suelo · Avanzado', 'bw');
  E('nordic', 'Curl nórdico', 'c', 'Piernas', ['hamstrings'], [], 'Anclaje para pies', 'bw');
  E('talones_pie', 'Elevación de talones de pie', 'gch', 'Piernas', ['calves'], [], 'Máquina o escalón', 'w', 5);
  E('talones_sentado', 'Elevación de talones sentado', 'g', 'Piernas', ['calves'], [], 'Máquina', 'w', 2.5);

  // Glúteos
  E('hip_thrust', 'Hip thrust con barra', 'g', 'Glúteos', ['glutes'], ['hamstrings'], 'Barra · Banco', 'w', 5,
    ['Espalda alta apoyada en el banco.', 'Mentón al pecho y aprieta glúteos arriba 1 segundo.']);
  E('puente_gluteo', 'Puente de glúteo', 'ch', 'Glúteos', ['glutes'], ['hamstrings'], 'Suelo', 'bw');
  E('patada_polea', 'Patada de glúteo en polea', 'g', 'Glúteos', ['glutes'], [], 'Polea baja · Tobillera', 'w', 1);
  E('abductores', 'Abductores en máquina', 'g', 'Glúteos', ['glutes'], [], 'Máquina');
  E('kb_swing', 'Kettlebell swing', 'xh', 'Glúteos', ['glutes', 'hamstrings'], ['lowerback', 'shoulders'], 'Kettlebell', 'w', 4);

  // Hombros
  E('press_militar', 'Press militar con barra', 'gx', 'Hombros', ['shoulders'], ['triceps', 'upperback'], 'Barra', 'w', 2.5,
    ['De pie, glúteos y abdomen apretados.', 'Saca la cabeza hacia delante cuando la barra pase.']);
  E('press_hombro_mancuernas', 'Press de hombro con mancuernas', 'gh', 'Hombros', ['shoulders'], ['triceps'], 'Mancuernas · Banco', 'w', 2);
  E('press_hombro_maquina', 'Press de hombro en máquina', 'g', 'Hombros', ['shoulders'], ['triceps'], 'Máquina');
  E('press_arnold', 'Press Arnold', 'gh', 'Hombros', ['shoulders'], ['triceps'], 'Mancuernas', 'w', 2);
  E('elevaciones_laterales', 'Elevaciones laterales', 'gh', 'Hombros', ['shoulders'], ['traps'], 'Mancuernas', 'w', 1,
    ['Sube hasta la altura del hombro, no más.', 'Codos ligeramente flexionados, lidera con el codo.']);
  E('laterales_polea', 'Elevación lateral en polea', 'g', 'Hombros', ['shoulders'], [], 'Polea baja', 'w', 1);
  E('laterales_banda', 'Elevaciones laterales con banda', 'h', 'Hombros', ['shoulders'], [], 'Banda elástica', 'bw');
  E('pajaros', 'Pájaros (deltoide posterior)', 'gh', 'Hombros', ['shoulders'], ['upperback'], 'Mancuernas o máquina', 'w', 1);
  E('remo_menton', 'Remo al mentón', 'g', 'Hombros', ['shoulders', 'traps'], ['biceps'], 'Barra Z o polea');
  E('pike', 'Pike push-up', 'ch', 'Hombros', ['shoulders'], ['triceps'], 'Suelo', 'bw');
  E('hspu', 'Flexiones en pino (HSPU)', 'cx', 'Hombros', ['shoulders', 'triceps'], ['traps'], 'Pared · Avanzado', 'bw');
  E('push_press', 'Push press', 'x', 'Hombros', ['shoulders'], ['triceps', 'quads'], 'Barra', 'w', 2.5);

  // Brazos
  E('curl_barra', 'Curl con barra', 'g', 'Brazos', ['biceps'], ['forearms'], 'Barra', 'w', 2.5,
    ['Codos pegados al cuerpo.', 'Baja completo y controlado, sin balanceo.']);
  E('curl_z', 'Curl con barra Z', 'g', 'Brazos', ['biceps'], ['forearms'], 'Barra Z');
  E('curl_mancuernas', 'Curl alterno con mancuernas', 'gh', 'Brazos', ['biceps'], ['forearms'], 'Mancuernas', 'w', 1);
  E('curl_martillo', 'Curl martillo', 'gh', 'Brazos', ['biceps', 'forearms'], [], 'Mancuernas', 'w', 1);
  E('curl_predicador', 'Curl en banco predicador', 'g', 'Brazos', ['biceps'], [], 'Barra Z · Banco Scott');
  E('curl_polea', 'Curl en polea', 'g', 'Brazos', ['biceps'], ['forearms'], 'Polea baja', 'w', 2.5);
  E('curl_banda', 'Curl con banda elástica', 'h', 'Brazos', ['biceps'], [], 'Banda elástica', 'bw');
  E('triceps_polea', 'Extensión de tríceps en polea', 'g', 'Brazos', ['triceps'], [], 'Polea alta · Cuerda', 'w', 2.5,
    ['Codos fijos a los costados.', 'Abre la cuerda al final del recorrido.']);
  E('press_frances', 'Press francés', 'g', 'Brazos', ['triceps'], [], 'Barra Z · Banco', 'w', 2.5);
  E('triceps_cabeza', 'Extensión de tríceps sobre la cabeza', 'gh', 'Brazos', ['triceps'], [], 'Mancuerna o polea', 'w', 2);
  E('press_cerrado', 'Press banca agarre cerrado', 'g', 'Brazos', ['triceps'], ['chest', 'shoulders'], 'Barra · Banco', 'w', 2.5);
  E('fondos_banco', 'Fondos en banco', 'gh', 'Brazos', ['triceps'], ['chest', 'shoulders'], 'Banco o silla', 'bw');
  E('flexiones_diamante', 'Flexiones diamante', 'ch', 'Brazos', ['triceps'], ['chest'], 'Suelo', 'bw');
  E('curl_muneca', 'Curl de muñeca', 'gh', 'Brazos', ['forearms'], [], 'Mancuernas o barra', 'w', 1);

  // Core
  E('plancha', 'Plancha', 'gch', 'Core', ['abs'], ['obliques', 'shoulders'], 'Suelo', 't', 5,
    ['Codos bajo los hombros.', 'Aprieta glúteos y abdomen; no hundas la cadera.']);
  E('plancha_lateral', 'Plancha lateral', 'gch', 'Core', ['obliques'], ['abs'], 'Suelo', 't', 5);
  E('crunch_polea', 'Crunch en polea', 'g', 'Core', ['abs'], [], 'Polea alta · Cuerda', 'w', 2.5);
  E('elevacion_piernas', 'Elevación de piernas colgado', 'gcx', 'Core', ['abs'], ['obliques', 'forearms'], 'Barra fija', 'bw');
  E('toes_to_bar', 'Toes to bar', 'cx', 'Core', ['abs'], ['lats', 'forearms'], 'Barra fija', 'bw');
  E('rueda', 'Rueda abdominal', 'gh', 'Core', ['abs'], ['lats', 'shoulders'], 'Rueda', 'bw');
  E('pallof', 'Pallof press', 'g', 'Core', ['obliques'], ['abs'], 'Polea o banda', 'w', 1);
  E('russian_twist', 'Russian twist', 'gh', 'Core', ['obliques'], ['abs'], 'Disco o mancuerna', 'bw');
  E('hollow', 'Hollow hold', 'ch', 'Core', ['abs'], [], 'Suelo', 't', 5);
  E('l_sit', 'L-sit', 'c', 'Core', ['abs'], ['triceps', 'quads'], 'Paralelas', 't', 5);
  E('dragon_flag', 'Dragon flag', 'c', 'Core', ['abs'], ['obliques'], 'Banco · Avanzado', 'bw');
  E('mountain_climbers', 'Mountain climbers', 'chx', 'Core', ['abs'], ['shoulders', 'quads'], 'Suelo', 't', 5);

  // CrossFit
  E('thruster', 'Thruster', 'x', 'Piernas', ['quads', 'shoulders'], ['glutes', 'triceps'], 'Barra o mancuernas', 'w', 2.5);
  E('clean_jerk', 'Clean & jerk', 'x', 'Hombros', ['shoulders', 'quads', 'glutes'], ['traps', 'triceps', 'hamstrings'], 'Barra olímpica', 'w', 2.5);
  E('power_clean', 'Power clean', 'x', 'Piernas', ['glutes', 'hamstrings', 'traps'], ['quads', 'shoulders'], 'Barra olímpica', 'w', 2.5);
  E('snatch', 'Snatch', 'x', 'Hombros', ['shoulders', 'glutes', 'hamstrings'], ['traps', 'quads'], 'Barra olímpica', 'w', 2.5);
  E('overhead_squat', 'Sentadilla overhead', 'x', 'Piernas', ['quads', 'shoulders'], ['glutes', 'abs'], 'Barra', 'w', 2.5);
  E('sdhp', 'Sumo deadlift high pull', 'x', 'Espalda', ['traps', 'glutes'], ['shoulders', 'hamstrings'], 'Barra o kettlebell', 'w', 2.5);
  E('wall_ball', 'Wall ball', 'x', 'Piernas', ['quads', 'shoulders'], ['glutes'], 'Balón medicinal', 'bw');
  E('burpee', 'Burpee', 'chx', 'Cardio', ['chest', 'quads'], ['shoulders', 'abs'], 'Peso corporal', 'bw');
  E('box_jump', 'Salto al cajón', 'x', 'Piernas', ['quads', 'glutes'], ['calves'], 'Cajón', 'bw');
  E('double_unders', 'Saltos dobles a la comba', 'xh', 'Cardio', ['calves'], ['shoulders'], 'Comba', 'bw');

  // Cardio
  E('cinta_inclinada', 'Caminata en cinta inclinada', 'g', 'Cardio', ['calves', 'glutes'], ['hamstrings'], 'Cinta', 't', 60);
  E('bicicleta', 'Bicicleta estática', 'g', 'Cardio', ['quads'], ['calves'], 'Bicicleta', 't', 60);
  E('eliptica', 'Elíptica', 'g', 'Cardio', ['quads', 'glutes'], [], 'Elíptica', 't', 60);
  E('remo_ergometro', 'Remo ergómetro', 'gx', 'Cardio', ['upperback', 'quads'], ['lats', 'biceps'], 'Remo', 't', 60);
  E('assault_bike', 'Assault bike', 'x', 'Cardio', ['quads'], ['shoulders'], 'Bicicleta de aire', 't', 60);

  const EX = {};
  L.forEach((e) => { EX[e.id] = e; });

  // Plantillas de planes. it(ejercicio, series, repsMin, repsMax, descanso s)
  const it = (ex, sets, rmin, rmax, rest) => ({ ex, sets, rmin, rmax, rest: rest || 90 });
  const TEMPLATES = [
    { id: 'ppl', name: 'Push · Pull · Legs', goal: 'Hipertrofia', level: 'Intermedio', place: 'g', perWeek: '5–6 días', minutes: 60,
      desc: 'Hipertrofia con doble progresión: sube reps y luego peso.',
      days: [
        { name: 'Empuje A', focus: 'Pecho · hombro · tríceps', items: [it('press_banca', 4, 6, 10, 150), it('press_inclinado_mancuernas', 3, 8, 12, 120), it('press_hombro_mancuernas', 3, 8, 12, 120), it('elevaciones_laterales', 4, 12, 15, 60), it('triceps_polea', 3, 10, 15, 60), it('fondos_paralelas', 2, 8, 15, 90)] },
        { name: 'Tirón A', focus: 'Espalda · bíceps', items: [it('dominadas', 4, 5, 10, 150), it('remo_barra', 3, 8, 10, 120), it('jalon_estrecho', 3, 10, 12, 90), it('face_pull', 3, 12, 15, 60), it('curl_barra', 3, 8, 12, 75), it('curl_martillo', 2, 10, 15, 60)] },
        { name: 'Pierna A', focus: 'Cuádriceps · glúteo · femoral', items: [it('sentadilla', 4, 6, 10, 180), it('peso_muerto_rumano', 3, 8, 10, 150), it('prensa', 3, 10, 12, 120), it('curl_femoral_tumbado', 3, 10, 15, 75), it('talones_pie', 4, 10, 15, 60), it('plancha', 3, 30, 60, 60)] },
        { name: 'Empuje B', focus: 'Hombro · pecho alto', items: [it('press_militar', 4, 6, 10, 150), it('press_inclinado_barra', 3, 8, 10, 120), it('cruce_poleas', 3, 12, 15, 60), it('laterales_polea', 3, 12, 15, 60), it('press_frances', 3, 8, 12, 75), it('triceps_cabeza', 2, 10, 15, 60)] },
        { name: 'Tirón B', focus: 'Espalda ancha · bíceps', items: [it('jalon_pecho', 4, 8, 12, 120), it('remo_mancuerna', 3, 8, 12, 90), it('remo_polea', 3, 10, 12, 90), it('pajaros', 3, 12, 15, 60), it('curl_predicador', 3, 8, 12, 75), it('encogimientos', 3, 10, 15, 60)] },
        { name: 'Pierna B', focus: 'Glúteo · femoral', items: [it('hip_thrust', 4, 8, 12, 120), it('bulgara', 3, 8, 12, 90), it('hack_squat', 3, 10, 12, 120), it('curl_femoral_sentado', 3, 10, 15, 75), it('extension_cuadriceps', 3, 12, 15, 60), it('elevacion_piernas', 3, 8, 15, 60)] }
      ] },
    { id: 'ul', name: 'Torso / Pierna', goal: 'Hipertrofia', level: 'Principiante–Intermedio', place: 'g', perWeek: '4 días', minutes: 60,
      desc: 'Cada músculo dos veces por semana con descanso suficiente.',
      days: [
        { name: 'Torso A', focus: 'Fuerza', items: [it('press_banca', 4, 5, 8, 150), it('remo_barra', 4, 6, 10, 150), it('press_militar', 3, 6, 10, 120), it('jalon_pecho', 3, 8, 12, 90), it('curl_barra', 2, 8, 12, 60), it('triceps_polea', 2, 10, 15, 60)] },
        { name: 'Pierna A', focus: 'Fuerza', items: [it('sentadilla', 4, 5, 8, 180), it('peso_muerto_rumano', 3, 6, 10, 150), it('prensa', 3, 10, 12, 120), it('curl_femoral_tumbado', 3, 10, 12, 75), it('talones_pie', 4, 10, 15, 60)] },
        { name: 'Torso B', focus: 'Hipertrofia', items: [it('press_inclinado_mancuernas', 4, 8, 12, 120), it('remo_mancuerna', 4, 8, 12, 90), it('elevaciones_laterales', 4, 12, 15, 60), it('cruce_poleas', 3, 12, 15, 60), it('curl_martillo', 3, 10, 15, 60), it('triceps_cabeza', 3, 10, 15, 60)] },
        { name: 'Pierna B', focus: 'Hipertrofia', items: [it('hip_thrust', 4, 8, 12, 120), it('bulgara', 3, 8, 12, 90), it('extension_cuadriceps', 3, 12, 15, 60), it('curl_femoral_sentado', 3, 10, 15, 60), it('elevacion_piernas', 3, 8, 15, 60)] }
      ] },
    { id: 'fb', name: 'Cuerpo completo', goal: 'Hipertrofia', level: 'Principiante', place: 'g', perWeek: '2–3 días', minutes: 50,
      desc: 'Aprende los básicos con técnica y cargas conservadoras.',
      days: [
        { name: 'Full body A', focus: 'Básicos + accesorios', items: [it('sentadilla_goblet', 3, 8, 12, 120), it('press_banca_mancuernas', 3, 8, 12, 120), it('jalon_pecho', 3, 8, 12, 90), it('peso_muerto_rumano', 3, 8, 12, 120), it('elevaciones_laterales', 2, 12, 15, 60), it('plancha', 3, 20, 45, 60)] },
        { name: 'Full body B', focus: 'Variantes + accesorios', items: [it('prensa', 3, 10, 12, 120), it('press_pecho_maquina', 3, 8, 12, 90), it('remo_polea', 3, 8, 12, 90), it('hip_thrust', 3, 8, 12, 90), it('curl_mancuernas', 2, 10, 15, 60), it('triceps_polea', 2, 10, 15, 60)] },
        { name: 'Full body C', focus: 'Volumen ligero', items: [it('bulgara', 3, 8, 12, 90), it('press_hombro_mancuernas', 3, 8, 12, 90), it('remo_mancuerna', 3, 8, 12, 90), it('curl_femoral_sentado', 3, 10, 15, 60), it('crunch_polea', 3, 10, 15, 60)] }
      ] },
    { id: 'fuerza', name: 'Fuerza en básicos', goal: 'Fuerza', level: 'Intermedio', place: 'g', perWeek: '4 días', minutes: 70,
      desc: 'Mueve más peso en sentadilla, banca, peso muerto y press.',
      days: [
        { name: 'Sentadilla', focus: 'Pesado + accesorios', items: [it('sentadilla', 5, 3, 5, 210), it('sentadilla_frontal', 3, 5, 8, 150), it('curl_femoral_tumbado', 3, 8, 12, 90), it('plancha', 3, 30, 60, 60)] },
        { name: 'Banca', focus: 'Pesado + accesorios', items: [it('press_banca', 5, 3, 5, 210), it('press_cerrado', 3, 5, 8, 150), it('remo_barra', 4, 6, 10, 120), it('face_pull', 3, 12, 15, 60)] },
        { name: 'Peso muerto', focus: 'Pesado + accesorios', items: [it('peso_muerto', 4, 2, 5, 240), it('peso_muerto_rumano', 3, 6, 8, 150), it('dominadas', 4, 4, 8, 150), it('hiperextensiones', 3, 10, 15, 60)] },
        { name: 'Press militar', focus: 'Pesado + accesorios', items: [it('press_militar', 5, 3, 5, 180), it('press_inclinado_mancuernas', 3, 8, 10, 120), it('jalon_pecho', 3, 8, 12, 90), it('elevaciones_laterales', 3, 12, 15, 60)] }
      ] },
    { id: 'grasa', name: 'Fuerza + cardio', goal: 'Pérdida de grasa', level: 'Todos', place: 'g', perWeek: '3–4 días', minutes: 55,
      desc: 'Pierde grasa conservando músculo; cardio en zona 2.',
      days: [
        { name: 'Cuerpo completo A', focus: 'Fuerza · 20 min zona 2', items: [it('sentadilla_goblet', 3, 10, 12, 75), it('press_banca_mancuernas', 3, 10, 12, 75), it('jalon_pecho', 3, 10, 12, 75), it('hip_thrust', 3, 10, 12, 75), it('cinta_inclinada', 1, 1200, 1500, 0)] },
        { name: 'Circuito', focus: 'Metabólico', items: [it('kb_swing', 4, 12, 15, 45), it('remo_mancuerna', 3, 10, 12, 45), it('zancadas', 3, 10, 12, 45), it('burpee', 3, 8, 12, 45), it('mountain_climbers', 3, 30, 45, 45)] },
        { name: 'Cuerpo completo B', focus: 'Fuerza · 20 min zona 2', items: [it('prensa', 3, 10, 12, 75), it('press_hombro_mancuernas', 3, 10, 12, 75), it('remo_polea', 3, 10, 12, 75), it('peso_muerto_rumano', 3, 10, 12, 75), it('bicicleta', 1, 1200, 1500, 0)] },
        { name: 'Cardio largo', focus: 'Zona 2 · core', items: [it('cinta_inclinada', 1, 2400, 2700, 0), it('plancha', 3, 30, 60, 45), it('pallof', 3, 10, 12, 45)] }
      ] },
    { id: 'cali', name: 'Calistenia progresiva', goal: 'Calistenia', level: 'Principiante–Intermedio', place: 'c', perWeek: '3 días', minutes: 45,
      desc: 'Progresiones en barra y suelo hasta tus primeras dominadas y fondos.',
      days: [
        { name: 'Empuje', focus: 'Flexiones · fondos · pike', items: [it('flexiones', 4, 8, 15, 90), it('fondos_paralelas', 3, 5, 12, 120), it('pike', 3, 6, 12, 90), it('flexiones_diamante', 3, 6, 12, 75), it('hollow', 3, 20, 40, 60)] },
        { name: 'Tirón', focus: 'Dominadas · remo', items: [it('dominadas', 4, 3, 8, 150), it('remo_australiano', 4, 8, 15, 90), it('dominadas_supinas', 3, 3, 8, 120), it('dead_hang', 3, 20, 45, 60), it('elevacion_piernas', 3, 6, 12, 60)] },
        { name: 'Piernas y core', focus: 'Unilateral · core', items: [it('bulgara', 3, 8, 12, 90), it('sentadilla_libre', 3, 15, 25, 60), it('nordic', 3, 3, 8, 120), it('puente_gluteo', 3, 12, 20, 60), it('l_sit', 3, 10, 20, 60)] }
      ] },
    { id: 'casa', name: 'En casa con mancuernas', goal: 'Hipertrofia', level: 'Todos', place: 'h', perWeek: '3 días', minutes: 45,
      desc: 'Rutina completa con mancuernas, bandas y peso corporal.',
      days: [
        { name: 'Casa A', focus: 'Pierna · empuje', items: [it('sentadilla_goblet', 4, 10, 15, 90), it('press_banca_mancuernas', 4, 8, 12, 90), it('bulgara', 3, 8, 12, 75), it('press_hombro_mancuernas', 3, 8, 12, 75), it('plancha', 3, 30, 60, 45)] },
        { name: 'Casa B', focus: 'Tirón · glúteo', items: [it('peso_muerto_rumano', 4, 8, 12, 90), it('remo_mancuerna', 4, 8, 12, 75), it('puente_gluteo', 3, 12, 20, 60), it('curl_martillo', 3, 10, 15, 60), it('superman', 3, 12, 15, 45)] },
        { name: 'Casa C', focus: 'Completo', items: [it('zancadas', 3, 10, 12, 75), it('flexiones', 4, 8, 20, 75), it('remo_banda', 3, 12, 20, 60), it('elevaciones_laterales', 3, 12, 15, 45), it('triceps_cabeza', 3, 10, 15, 45), it('russian_twist', 3, 12, 20, 45)] }
      ] },
    { id: 'cross', name: 'Acondicionamiento CrossFit', goal: 'Rendimiento', level: 'Intermedio', place: 'x', perWeek: '3 días', minutes: 60,
      desc: 'Fuerza olímpica más trabajo metabólico.',
      days: [
        { name: 'Fuerza + metcon A', focus: 'Sentadilla · thruster', items: [it('sentadilla_frontal', 5, 3, 5, 150), it('thruster', 4, 8, 12, 90), it('toes_to_bar', 4, 8, 12, 60), it('wall_ball', 4, 15, 20, 60), it('double_unders', 4, 30, 50, 45)] },
        { name: 'Fuerza + metcon B', focus: 'Olímpicos', items: [it('power_clean', 5, 3, 5, 150), it('push_press', 4, 5, 8, 120), it('kb_swing', 4, 15, 20, 60), it('burpee', 4, 10, 15, 60), it('remo_ergometro', 1, 600, 900, 0)] },
        { name: 'Fuerza + metcon C', focus: 'Tirón · gimnásticos', items: [it('peso_muerto', 4, 3, 5, 180), it('dominadas', 4, 5, 10, 90), it('box_jump', 4, 8, 12, 60), it('sdhp', 4, 10, 12, 60), it('assault_bike', 1, 600, 900, 0)] }
      ] }
  ];

  // Sustituciones por molestia: ejercicio -> alternativa
  const AVOID = {
    Rodilla: { sentadilla: 'hip_thrust', sentadilla_frontal: 'prensa', bulgara: 'puente_gluteo', zancadas: 'peso_muerto_rumano', hack_squat: 'curl_femoral_sentado', pistol: 'puente_gluteo', box_jump: 'kb_swing', sentadilla_goblet: 'hip_thrust', thruster: 'push_press', wall_ball: 'kb_swing', nordic: 'curl_femoral_sentado' },
    Hombro: { press_militar: 'press_hombro_maquina', fondos_paralelas: 'press_pecho_maquina', press_banca: 'press_banca_mancuernas', press_inclinado_barra: 'press_inclinado_mancuernas', remo_menton: 'pajaros', hspu: 'press_hombro_maquina', pike: 'flexiones_inclinadas', snatch: 'power_clean', push_press: 'press_hombro_mancuernas', muscle_up: 'dominadas', overhead_squat: 'sentadilla_goblet' },
    'Espalda baja': { peso_muerto: 'hip_thrust', remo_barra: 'remo_maquina', sentadilla: 'prensa', peso_muerto_rumano: 'curl_femoral_tumbado', hiperextensiones: 'puente_gluteo', power_clean: 'kb_swing', sdhp: 'remo_maquina', superman: 'puente_gluteo' },
    'Muñeca': { flexiones: 'press_pecho_maquina', flexiones_diamante: 'triceps_polea', sentadilla_frontal: 'sentadilla_goblet', curl_barra: 'curl_martillo', press_frances: 'triceps_polea', fondos_banco: 'triceps_polea', l_sit: 'plancha' }
  };

  // Mapa muscular: [músculo, vista, forma]
  const BODY = [
    ['', 'f', '<circle cx="110" cy="22" r="13"/>'], ['', 'f', '<rect x="105" y="34" width="10" height="9" rx="3"/>'],
    ['shoulders', 'f', '<ellipse cx="80" cy="54" rx="10" ry="11"/><ellipse cx="140" cy="54" rx="10" ry="11"/>'],
    ['chest', 'f', '<ellipse cx="97" cy="60" rx="15" ry="11"/><ellipse cx="123" cy="60" rx="15" ry="11"/>'],
    ['abs', 'f', '<rect x="97" y="74" width="26" height="40" rx="6"/>'],
    ['obliques', 'f', '<rect x="86" y="75" width="9" height="34" rx="4"/><rect x="125" y="75" width="9" height="34" rx="4"/>'],
    ['biceps', 'f', '<rect x="66" y="64" width="12" height="32" rx="6"/><rect x="142" y="64" width="12" height="32" rx="6"/>'],
    ['forearms', 'f', '<rect x="62" y="99" width="11" height="32" rx="5"/><rect x="147" y="99" width="11" height="32" rx="5"/>'],
    ['', 'f', '<rect x="88" y="117" width="44" height="15" rx="6"/>'],
    ['quads', 'f', '<rect x="88" y="135" width="20" height="52" rx="8"/><rect x="112" y="135" width="20" height="52" rx="8"/>'],
    ['calves', 'f', '<rect x="90" y="191" width="15" height="40" rx="6"/><rect x="115" y="191" width="15" height="40" rx="6"/>'],
    ['', 'b', '<circle cx="280" cy="22" r="13"/>'],
    ['traps', 'b', '<path d="M262 42H298L280 62Z"/>'],
    ['shoulders', 'b', '<ellipse cx="250" cy="54" rx="10" ry="11"/><ellipse cx="310" cy="54" rx="10" ry="11"/>'],
    ['upperback', 'b', '<rect x="259" y="60" width="42" height="12" rx="5"/>'],
    ['lats', 'b', '<rect x="256" y="74" width="22" height="27" rx="8"/><rect x="282" y="74" width="22" height="27" rx="8"/>'],
    ['triceps', 'b', '<rect x="236" y="64" width="12" height="32" rx="6"/><rect x="312" y="64" width="12" height="32" rx="6"/>'],
    ['forearms', 'b', '<rect x="232" y="99" width="11" height="32" rx="5"/><rect x="317" y="99" width="11" height="32" rx="5"/>'],
    ['lowerback', 'b', '<rect x="268" y="103" width="24" height="13" rx="5"/>'],
    ['glutes', 'b', '<ellipse cx="269" cy="126" rx="12" ry="10"/><ellipse cx="291" cy="126" rx="12" ry="10"/>'],
    ['hamstrings', 'b', '<rect x="258" y="139" width="20" height="48" rx="8"/><rect x="282" y="139" width="20" height="48" rx="8"/>'],
    ['calves', 'b', '<rect x="260" y="191" width="15" height="40" rx="6"/><rect x="285" y="191" width="15" height="40" rx="6"/>']
  ];

  window.HF_DATA = { MUSCLES, GROUPS, MODS, EXERCISES: L, EX, TEMPLATES, AVOID, BODY };
})();
