Enredo.sampleProject = ((app) => {
  'use strict';

  const narrativeModel = 'journey-12';
  const openingBeat = 'radio';
  const {scene,artwork,portraits,coastalMap} = app.sampleImages;
  const illustrations = {[openingBeat]:scene,queda:artwork.farol,registro:artwork.log};
  const mapScale = 1.75;
  const mapSize = {width:1536 * mapScale,height:1024 * mapScale};
  // Positions are measured on the coastal illustration. Chapter and beat offsets are relative to their parent.
  const mapGroups = {warning:[224,37],rescue:[1089,42]};
  const mapChapters = {sinal:[229,85],farol:[1060,285],mare:[1090,131]};
  const mapBeatCenters = {
    radio:[263,250],chamado:[449,257],escolha:[484,327],voz:[792,404],costa:[748,608],encontro:[1136,569],
    porta:[1242,559],sirene:[1369,453],queda:[1431,585],registro:[1363,324],
    subida:[1288,157],transmissao:[1424,163],amanhecer:[277,431],silencio:[327,516]
  };

  function mapOffset([x,y],[originX,originY] = [0,0]) {
    return {x:(x - originX) * mapScale,y:(y - originY) * mapScale};
  }

  function create() {
    const {W,layoutNodeHeight,chapterContentOffset} = app.diagram;
    const pt = app.preferences.language === 'pt';
    const local = (en,br) => pt ? br : en;
    const textFields = fields => Object.fromEntries(Object.entries(fields).map(([key,values]) => [key,local(...values)]));
    const group = local('Harbor watch','Vigia do porto');
    const volunteers = local('Coastal rescue volunteers','Voluntários do resgate costeiro');
    const beacon = local('Lighthouse service','Serviço do farol');
    const chapterGroups = [
      {id:'warning',title:local('The warning','O aviso'),description:local(
        'A call interrupts Mara’s night shift and sends her toward the lighthouse.',
        'Uma chamada interrompe o turno de Mara e a leva ao farol.')},
      {id:'rescue',title:local('The rescue','O resgate'),description:local(
        'Inside the lighthouse, Mara and Bento look for a way to guide the boats home.',
        'Dentro do farol, Mara e Bento procuram uma forma de trazer os barcos de volta ao porto.')}
    ].map(group => ({...group,mapPosition:mapOffset(mapGroups[group.id])}));
    const chapters = [
      {id:'sinal',title:local('The last signal','O último sinal'),groupId:'warning',groupOrder:0},
      {id:'farol',title:local('Inside the lighthouse','Dentro do farol'),groupId:'rescue',groupOrder:0},
      {id:'mare',title:local('The tide rises','A maré sobe'),groupId:'rescue',groupOrder:1}
    ].map(chapter => ({...chapter,mapPosition:mapOffset(mapChapters[chapter.id],mapGroups[chapter.groupId])}));
    const mara = (en,br,phaseId = 'mara-watch') => ({characterId:'mara',phaseId,dramaticFunction:local(en,br)});
    const bento = (en,br) => ({characterId:'bento',phaseId:null,dramaticFunction:local(en,br)});
    const nodes = [];
    function beat(id,chapter,kind,stepId,x,y,title,notes,participants) {
      const image = illustrations[id]?.preview;
      const mapPosition = mapOffset(mapBeatCenters[id],mapChapters[chapter]);
      mapPosition.x -= W / 2;
      mapPosition.y -= chapterContentOffset + layoutNodeHeight({image}) / 2;
      nodes.push({id,chapter,kind,title:local(...title),notes:local(...notes),x,y,mapPosition,participants,
        ...(image ? {image} : {}),
        focalCharacterId:participants[0].characterId,narrativeStage:{modelId:narrativeModel,stepId}});
    }

    beat(openingBeat,'sinal','scene','ordinary-world',0,116,
      ['The night shift','O turno da noite'],
      ['At low tide, Mara logs the fishing boats from a harbor watch room. She keeps the spare radio off to save its battery.',
        'Na maré baixa, Mara registra os barcos de pesca na sala de vigia do porto. Ela deixa o rádio reserva desligado para poupar a bateria.'],
      [mara('Establishes the routine that the ending will revisit.','Apresenta a rotina que volta no desfecho.')]);
    beat('chamado','sinal','scene','call-to-adventure',272,152,
      ['A voice through the static','Uma voz na estática'],
      ['Bento reports a faulty tide gauge. Three boats are returning through a channel that will soon be unsafe. Mara grabs the spare radio.',
        'Bento avisa que o medidor de maré falhou. Três barcos estão voltando por um canal que logo ficará perigoso. Mara pega o rádio reserva.'],
      [mara('Receives the warning.','Recebe o aviso.'),bento('Calls for help from the lighthouse.','Pede ajuda do farol.')]);
    beat('escolha','sinal','decision','refusal-of-call',544,152,
      ['Which way to the lighthouse?','Por onde chegar ao farol?'],
      ['The official report says the channel is clear. Mara can follow Bento’s directions or verify the water level along the coast.',
        'O boletim oficial diz que o canal está livre. Mara pode seguir as instruções de Bento ou verificar o nível da água pela costa.'],
      [mara('Weighs the official report against the warning.','Pesa o boletim oficial e o aviso.')]);
    beat('voz','sinal','outcome','meeting-with-mentor',793,20,
      ['Follow the voice','Seguir a voz'],
      ['Bento guides Mara along the service road and teaches her to recognize the warning signal by its two short tones.',
        'Bento guia Mara pela estrada de serviço e ensina a reconhecer o sinal de alerta pelos dois toques curtos.'],
      [mara('Acts on Bento’s directions.','Segue as instruções de Bento.'),bento('Teaches the warning signal.','Ensina o sinal de alerta.')]);
    beat('costa','sinal','outcome','meeting-with-mentor',793,284,
      ['Check the coast','Verificar a costa'],
      ['The water covers the old tide marks. Bento answers Mara’s call and points her to the maintenance stairs.',
        'A água cobre as marcas antigas da maré. Bento atende ao chamado de Mara e indica a escada de manutenção.'],
      [mara('Checks the evidence on site.','Verifica a evidência no local.'),bento('Shows the way in.','Indica a entrada.')]);
    beat('encontro','sinal','merge','crossing-first-threshold',1042,152,
      ['At the lighthouse','Chegada ao farol'],
      ['Both routes reach the service door. Mara enters with either the warning signal or a firsthand measure of the tide.',
        'As duas rotas chegam à porta de serviço. Mara entra sabendo o sinal de alerta ou tendo visto de perto o nível da maré.'],
      [mara('Carries a different clue depending on the route.','Traz uma pista diferente conforme a rota.')]);

    beat('porta','farol','scene','tests-allies-enemies',0,94,
      ['The door ajar','A porta entreaberta'],
      ['Bento is waiting at the base of the stairs. They compare the harbor report with what each of them knows.',
        'Bento espera no pé da escada. Os dois comparam o boletim do porto com o que cada um descobriu.'],
      [mara('Compares the clues.','Compara as pistas.'),bento('Shows the failing equipment.','Mostra o equipamento com defeito.')]);
    beat('sirene','farol','scene','approach-hidden-cave',272,94,
      ['The siren stutters','A sirene falha'],
      ['Mara tests the emergency siren. After two weak tones, the lower floor loses power.',
        'Mara testa a sirene de emergência. Depois de dois toques fracos, o piso inferior perde energia.'],
      [mara('Tests the first way to reach the boats.','Testa a primeira forma de avisar os barcos.'),
        bento('Identifies the electrical failure.','Identifica a pane elétrica.')]);
    beat('queda','farol','scene','ordeal',544,94,
      ['Water at the stairs','Água na escada'],
      ['The sea floods the lower steps. Mara asks Bento to head uphill and take the rescue kit with him.',
        'O mar inunda os degraus inferiores. Mara pede que Bento suba a encosta e leve o kit de resgate.'],
      [mara('Asks for help before the tide cuts them off.','Pede ajuda antes que a maré corte a passagem.'),
        bento('Carries the rescue kit uphill.','Leva o kit de resgate para o alto.')]);
    beat('registro','farol','outcome','reward',816,94,
      ['The keeper’s log','O caderno do faroleiro'],
      ['A hand-drawn chart in Bento’s log shows a safe route east of the shoal. Mara takes the page upstairs.',
        'Uma carta desenhada no caderno de Bento mostra uma rota segura a leste do baixio. Mara leva a página para o andar de cima.'],
      [mara('Finds a route the boats can use.','Encontra uma rota que os barcos podem usar.')]);

    beat('subida','mare','scene','road-back',0,152,
      ['Above the tide','Acima da maré'],
      ['Mara reaches the lantern room with the chart. The spare radio can still reach the boats, and Bento calls from high ground.',
        'Mara chega à sala da lanterna com a carta. O rádio reserva ainda alcança os barcos, e Bento chama do alto da encosta.'],
      [mara('Prepares a warning from the lantern room.','Prepara um alerta na sala da lanterna.','mara-rescue'),
        bento('Reports that the evacuation path is clear.','Confirma que a passagem para evacuação está livre.')]);
    beat('transmissao','mare','decision','resurrection',272,152,
      ['One last transmission','Uma última transmissão'],
      ['The battery has one transmission left. Mara must decide whether to warn the fleet directly or ask harbor control for clearance.',
        'A bateria só aguenta mais uma transmissão. Mara precisa decidir se alerta a frota diretamente ou se pede autorização à central do porto.'],
      [mara('Decides who hears the last transmission.','Decide quem recebe a última transmissão.','mara-rescue')]);
    beat('amanhecer','mare','ending','return-with-elixir',552,20,
      ['The boats come home','Os barcos voltam'],
      ['Mara broadcasts the eastern route. At dawn she logs all three boats and starts a volunteer radio watch with Bento.',
        'Mara transmite a rota leste. Ao amanhecer, registra a chegada dos três barcos e monta com Bento uma vigia voluntária pelo rádio.'],
      [mara('Turns a rescue into a shared practice.','Transforma o resgate em uma prática coletiva.','mara-rescue'),
        bento('Joins the volunteer radio watch.','Entra na vigia voluntária pelo rádio.')]);
    beat('silencio','mare','ending','return-with-elixir',552,284,
      ['An empty berth','Um cais vazio'],
      ['The clearance arrives after the battery dies. Two boats turn back safely. At dawn, Mara files the warning and the third boat is still missing.',
        'A autorização chega depois que a bateria acaba. Dois barcos retornam em segurança. Ao amanhecer, Mara registra o aviso, e o terceiro barco segue desaparecido.'],
      [mara('Records the cost of waiting for clearance.','Registra o custo de esperar pela autorização.','mara-rescue')]);

    const edges = [
      ['radio-chamado',openingBeat,'chamado','Listen','Ouvir'],
      ['chamado-escolha','chamado','escolha','Check','Conferir'],
      ['escolha-voz','escolha','voz','Trust Bento','Confiar em Bento'],
      ['escolha-costa','escolha','costa','Read the tide','Ler a maré'],
      ['voz-encontro','voz','encontro','Take the service road','Seguir pela estrada'],
      ['costa-encontro','costa','encontro','Take the stairs','Subir pela escada'],
      ['encontro-porta','encontro','porta','Enter the lighthouse','Entrar no farol'],
      ['porta-sirene','porta','sirene','Test','Testar'],
      ['sirene-queda','sirene','queda','Evacuate','Evacuar'],
      ['queda-registro','queda','registro','Search','Procurar'],
      ['registro-subida','registro','subida','Take the chart upstairs','Subir com a carta'],
      ['subida-transmissao','subida','transmissao','Tune','Ajustar'],
      ['transmissao-amanhecer','transmissao','amanhecer','Warn the fleet','Alertar a frota'],
      ['transmissao-silencio','transmissao','silencio','Ask for clearance','Pedir autorização']
    ].map(([id,from,to,en,br]) => ({id,from,to,label:local(en,br)}));

    const characterRoles = [{id:'radio-operator',name:local('Radio operator','Operadora de rádio')}];
    const characters = [
      {
        id:'mara',name:'Mara Costa',portraitId:'mara',group,
        roleIds:['protagonist','radio-operator'],primaryRoleId:'protagonist',
        ...textFields({
          alias:['Mara on watch','Mara da vigia'],
          description:['A harbor radio technician who knows the fleet by the sound of its engines.','Técnica de rádio do porto que reconhece a frota pelo som dos motores.'],
          notes:['As the storm intensifies, shorten her transmissions. Repeat the opening boat log in both endings.',
            'Encurtar as transmissões conforme a tempestade piora. Retomar o registro dos barcos da abertura nos dois finais.']
        }),
        personality:textFields({
          dominantTraits:['Observant and methodical.','Observadora e metódica.'],
          strengths:['Reads weather and equipment by sound.','Interpreta o tempo e o equipamento pelo som.'],
          flaws:['Waits too long for permission.','Demora demais para agir sem autorização.'],
          beliefs:['Every warning needs someone to take responsibility for it.','Alguém precisa assumir a responsabilidade por cada alerta.'],
          fears:['Sending the fleet the wrong way.','Mandar a frota na direção errada.'],
          contradictions:['Trusts her instruments but doubts her judgment.','Confia nos instrumentos, mas duvida do próprio julgamento.'],
          vulnerabilities:['The fleet remembers a previous false alarm.','A frota se lembra de um alarme falso anterior.']
        }),
        motivation:textFields({
          goal:['Get all three boats safely to harbor.','Trazer os três barcos ao porto em segurança.'],
          need:['Trust her judgment and share responsibility.','Confiar no próprio julgamento e dividir a responsabilidade.'],
          reason:['Her shift is the fleet’s last point of contact.','Seu turno é o último ponto de contato da frota.'],
          obstacles:['Rising water, a broken gauge and a nearly flat battery.','Maré subindo, medidor quebrado e bateria quase descarregada.'],
          internalConflict:['She fears acting on incomplete information.','Tem medo de agir com informação incompleta.'],
          externalConflict:['Harbor control requires clearance for route changes.','A central do porto exige autorização para mudar rotas.'],
          cost:['Her final transmission uses the last charge.','A transmissão final consome a última carga.'],
          successConsequence:['The crew of each boat reaches shore.','As tripulações dos três barcos chegam à terra.'],
          failureConsequence:['A boat goes missing and Mara must account for the delay.','Um barco desaparece, e Mara precisa explicar a demora.']
        }),
        phases:[
          {
            id:'mara-watch',title:local('On harbor watch','Na vigia do porto'),group,
            alias:local('Night operator','Operadora da noite'),
            description:local('On duty with the harbor log and the official forecasts.','De plantão com o livro do porto e os boletins oficiais.'),
            notes:local('Uses the central portrait. The uniform identifies her shift.','Usa o retrato da ficha central. O uniforme identifica seu turno.'),
            personality:{beliefs:local('The official log usually has the last word.','O boletim oficial costuma ter a última palavra.')},
            motivation:{goal:local('Record every boat expected before dawn.','Registrar todos os barcos esperados antes do amanhecer.')}
          },
          {
            id:'mara-rescue',title:local('In the lantern room','Na sala da lanterna'),portraitId:'mara-rescue',group,
            alias:local('Lighthouse relay','Rádio do farol'),
            description:local('Soaked by the climb and holding the only working radio.','Encharcada pela subida e com o único rádio que ainda funciona.'),
            notes:local('Use this portrait for the last chapter. Keep the chart beside her radio.','Usar este retrato no último capítulo. Manter a carta ao lado do rádio.'),
            personality:{dominantTraits:local('Decisive under pressure.','Decidida sob pressão.')},
            motivation:{goal:local('Use the remaining charge to get the boats to safety.','Usar a carga restante para levar os barcos a um lugar seguro.'),
              cost:local('One call ends her ability to transmit.','Uma ligação encerra sua capacidade de transmitir.')}
          }
        ]
      },
      {
        id:'bento',name:'Bento Luz',portraitId:'bento',group:beacon,
        roleIds:['mentor','ally'],primaryRoleId:'mentor',phases:[],
        ...textFields({
          alias:['The keeper','O faroleiro'],
          description:['A keeper who records changes in the shallows by hand.','Faroleiro que anota à mão as mudanças nos baixios.'],
          notes:['Let him name a landmark whenever he gives directions.','Fazer Bento citar um ponto de referência sempre que orientar alguém.']
        }),
        personality:textFields({
          dominantTraits:['Patient and practical.','Paciente e prático.'],
          strengths:['Knows the coast in darkness and fog.','Conhece a costa no escuro e na neblina.'],
          flaws:['Keeps important observations to himself.','Guarda observações importantes para si.'],
          beliefs:['A chart goes out of date faster than people think.','Uma carta náutica envelhece mais depressa do que as pessoas pensam.'],
          fears:['Leaving the lighthouse without a reliable warning.','Deixar o farol sem um alerta confiável.'],
          contradictions:['Asks Mara for help but tries to carry everything alone.','Pede ajuda a Mara, mas tenta carregar tudo sozinho.'],
          vulnerabilities:['His knee slows him on wet stairs.','O joelho o torna mais lento nas escadas molhadas.']
        }),
        motivation:textFields({
          goal:['Get his chart into the hands of someone who can radio the fleet.','Entregar a carta a alguém que possa chamar a frota pelo rádio.'],
          need:['Teach others what he knows about the shoal.','Ensinar a outras pessoas o que sabe sobre o baixio.'],
          reason:['The official chart omits the eastern route.','A carta oficial omite a rota leste.'],
          obstacles:['The flooded stairway and failing lighthouse power.','A escada inundada e a falta de energia no farol.'],
          internalConflict:['Sharing the chart means trusting someone else with the warning.','Compartilhar a carta exige confiar o alerta a outra pessoa.'],
          externalConflict:['The tide leaves little time to guide Mara.','A maré deixa pouco tempo para orientar Mara.'],
          cost:['Evacuation means leaving his tools behind.','Evacuar significa deixar suas ferramentas para trás.'],
          successConsequence:['The harbor can use his chart during future storms.','O porto poderá usar sua carta em futuras tempestades.'],
          failureConsequence:['The fleet will rely on outdated information.','A frota dependerá de informações desatualizadas.']
        })
      }
    ];

    const relationshipKinds = [{id:'radio-partner',name:local('Radio partner','Parceria de rádio')}];
    const relationships = [
      {
        id:'mara-trusts-bento',fromCharacterId:'mara',toCharacterId:'bento',type:'trust',initialState:'strained',
        initialAttributes:{trust:'low',loyalty:'medium',hostility:'low'},
        notes:local('Mara wants to verify his warning before reporting it to the fleet.','Mara quer verificar o aviso dele antes de repassá-lo à frota.')
      },
      {
        id:'bento-calls-mara',fromCharacterId:'bento',toCharacterId:'mara',type:'custom',customTypeId:'radio-partner',initialState:'active',
        initialAttributes:{trust:'high',loyalty:'high',hostility:'low'},
        notes:local('Bento calls Mara first when the lighthouse instruments fail.','Bento chama Mara primeiro quando os instrumentos do farol falham.')
      }
    ];
    const arcPaths = [
      {id:'warn',edgeId:'transmissao-amanhecer',name:local('Warn the fleet','Alertar a frota')},
      {id:'clearance',edgeId:'transmissao-silencio',name:local('Ask for clearance','Pedir autorização')}
    ];
    const characterArcs = [
      {
        id:'mara-arc',characterId:'mara',phaseId:'mara-rescue',title:local('Who gets to give the warning?','Quem pode dar o alerta?'),
        initial:textFields({
          summary:['Mara starts the shift following harbor procedure.','Mara começa o turno seguindo o procedimento do porto.'],
          belief:['Authorization protects the fleet.','A autorização protege a frota.'],
          goal:['Get the three boats home before the channel floods.','Trazer os três barcos antes que o canal fique perigoso.'],
          need:['Accept the cost of making a decision under uncertainty.','Aceitar o custo de decidir em meio à incerteza.'],
          conflict:['The fastest warning may break harbor rules.','O alerta mais rápido pode violar as regras do porto.']
        }),
        events:[
          {
            id:'mara-asks-for-help',phase:'development',nodeId:'queda',edgeId:'sirene-queda',pathId:null,
            summary:local('Mara asks Bento to take the rescue kit to safety and trusts his chart.','Mara pede que Bento leve o kit de resgate a um lugar seguro e confia na carta dele.'),
            changes:{belief:local('Bento’s local knowledge is worth checking against the official report.',
              'O conhecimento de Bento merece ser levado em conta junto com o boletim oficial.')},
            relationshipChanges:[{relationshipId:'mara-trusts-bento',state:'active',attributes:{trust:'medium',loyalty:'high',hostility:'low'}}]
          },
          {
            id:'mara-warns',phase:'ending',nodeId:'amanhecer',edgeId:'transmissao-amanhecer',pathId:'warn',arcType:'positive',
            summary:local('Mara broadcasts the safe route and organizes a shared watch at dawn.','Mara transmite a rota segura e organiza uma vigia coletiva ao amanhecer.'),
            changes:{group:volunteers,belief:local('A warning is a responsibility we can share.','Avisar é uma responsabilidade que podemos dividir.'),fate:'alive',objectiveStatus:'achieved'},
            relationshipChanges:[{relationshipId:'mara-trusts-bento',state:'active',attributes:{trust:'high',loyalty:'high',hostility:'low'}}]
          },
          {
            id:'mara-waits',phase:'ending',nodeId:'silencio',edgeId:'transmissao-silencio',pathId:'clearance',arcType:'negative',
            summary:local('Mara waits for clearance and logs the missing boat after dawn.','Mara espera a autorização e registra o barco desaparecido depois do amanhecer.'),
            changes:{group,belief:local('Someone at the harbor office should have made the call.','A decisão deveria ter vindo da central do porto.'),fate:'alive',objectiveStatus:'failed'},
            relationshipChanges:[{relationshipId:'mara-trusts-bento',state:'strained',attributes:{trust:'low',loyalty:'medium',hostility:'low'}}]
          }
        ]
      },
      {
        id:'bento-arc',characterId:'bento',phaseId:null,title:local('Hand over the chart','Passar a carta adiante'),
        initial:textFields({
          summary:['Bento has kept his notes in the lighthouse for years.','Bento guarda suas anotações no farol há anos.'],
          belief:['The person who knows the coast should guide others.','Quem conhece a costa deve orientar os outros.'],
          goal:['Put the eastern route on the fleet’s radio.','Passar a rota leste pelo rádio da frota.'],
          need:['Trust another person to carry the knowledge forward.','Confiar que outra pessoa pode transmitir esse conhecimento.'],
          conflict:['He must evacuate before making sure the chart was heard.','Precisa evacuar antes de saber se a rota foi ouvida.']
        }),
        events:[
          {
            id:'bento-evacuates',phase:'development',nodeId:'queda',edgeId:'sirene-queda',pathId:null,
            summary:local('Bento shows Mara where he keeps the chart, then takes the rescue kit uphill.','Bento mostra a Mara onde guarda a carta e leva o kit de resgate para o alto.'),
            changes:{belief:local('Mara can explain the eastern route over the radio.','Mara consegue explicar a rota leste pelo rádio.')},
            relationshipChanges:[{relationshipId:'bento-calls-mara',state:'active',attributes:{trust:'high',loyalty:'high',hostility:'low'}}]
          },
          {
            id:'bento-teaches',phase:'ending',nodeId:'amanhecer',edgeId:'transmissao-amanhecer',pathId:'warn',arcType:'steady',
            summary:local('Bento uses his chart to train the volunteer watch.','Bento usa sua carta para treinar a vigia voluntária.'),
            changes:{group:volunteers,belief:local('The coast is safer when more people can read it.','A costa fica mais segura quando mais gente sabe interpretá-la.'),fate:'alive',objectiveStatus:'achieved'},
            relationshipChanges:[{relationshipId:'bento-calls-mara',state:'active',attributes:{trust:'high',loyalty:'high',hostility:'low'}}]
          }
        ]
      }
    ];

    const sprints = [
      {id:'outlining',title:local('Outline the coast','Esboçar a costa'),goal:local('Connect the chapter openings and both ways to reach the lighthouse.','Conectar as aberturas dos capítulos e as duas rotas até o farol.'),
        start:'2026-11-09',end:'2026-11-15',status:'completed'},
      {id:'drafting',title:local('Draft the lighthouse sequence','Escrever a sequência do farol'),goal:local('Draft the main decisions and check their consequences in both endings.','Escrever as decisões principais e conferir suas consequências nos dois finais.'),
        start:'2026-11-16',end:'2026-11-27',status:'active'},
      {id:'playtest',title:local('Playtest both endings','Testar os dois desfechos'),goal:local('Check that each branch supplies the clues needed to understand the ending.','Verificar se cada ramo dá as pistas necessárias para entender o desfecho.'),
        start:'2026-11-28',end:'2026-12-04',status:'planned'}
    ];
    const tasks = [
      ['wire-branches','Map the two approaches','Mapear as duas rotas',
        'Label both paths and connect them to the service door.','Rotular os dois caminhos e ligá-los à porta de serviço.',
        'done','normal','2026-11-10','2026-11-13','escolha','outlining'],
      ['write-opening','Write the night-shift scene','Escrever a cena do turno da noite',
        'Introduce the boat log and attach the radio reference image.','Apresentar o registro dos barcos e anexar a imagem de referência do rádio.',
        'done','low','2026-11-16','2026-11-18',openingBeat,'drafting'],
      ['draft-warning','Write Mara’s final warning','Escrever o alerta final de Mara',
        'Make it clear that the battery has one call left.','Deixar claro que a bateria só aguenta uma ligação.',
        'doing','high','2026-11-18','2026-11-24','transmissao','drafting'],
      ['review-clue','Review the keeper’s chart clue','Revisar a pista da carta do faroleiro',
        'Check whether the eastern route makes sense after either first-chapter branch.','Verificar se a rota leste faz sentido nos dois ramos do primeiro capítulo.',
        'review','normal','2026-11-20','2026-11-25','registro','drafting'],
      ['rewrite-berth','Revise the empty-berth ending','Revisar o desfecho do cais vazio',
        'Echo the opening boat log and show which boat is missing.','Retomar o registro da abertura e mostrar qual barco está desaparecido.',
        'todo','high','2026-11-24','2026-11-27','silencio','drafting'],
      ['test-rescue','Play through the rescue route','Testar a rota de resgate',
        'Record where a reader learns that the eastern route is safe.','Anotar onde o leitor descobre que a rota leste é segura.',
        'todo','normal','2026-11-30','2026-11-30','amanhecer','playtest'],
      ['backlog-sound','Collect harbor sound references','Reunir referências sonoras do porto',
        'Find examples of a weak siren, radio static and waves against a seawall.','Reunir exemplos de sirene fraca, estática de rádio e ondas batendo no quebra-mar.',
        'todo','low',null,null,'sirene',null]
    ].map(([id,titleEn,titlePt,notesEn,notesPt,status,priority,start,end,beatId,sprintId]) => ({
      id,title:local(titleEn,titlePt),notes:local(notesEn,notesPt),status,priority,start,end,beatId,sprintId
    }));

    return {
      id:app.dom.uid(),title:local('After the Signal','Depois do sinal'),narrativeModel,chapterGroups,chapters,nodes,edges,
      characters,characterRoles,characterArcs,arcPaths,relationships,relationshipKinds,
      portraits:Object.entries(portraits).map(([id,data]) => ({id,data})),tasks,sprints
    };
  }

  async function saveImages(project) {
    const {uid} = app.dom;
    const {imageFromBackup,saveOriginalImages,discardOriginalImages} = app.imageStore;
    const beats = project.nodes.filter(beat => illustrations[beat.id]).map(beat => ({beat,id:uid()}));
    const covers = [project,...project.chapterGroups,...project.chapters].map(target => ({
      target,image:artwork[target === project ? 'project' : target.id],id:'cover-' + uid()
    }));
    const mapId = uid();
    const map = imageFromBackup(coastalMap);
    await saveOriginalImages(
      beats.map(({beat,id}) => [id,imageFromBackup(illustrations[beat.id].original)]),
      [...covers.map(({image,id}) => [id,{source:imageFromBackup(image.original),thumbnail:imageFromBackup(image.preview)}]),
        [mapId,{source:map,thumbnail:map}]]
    );
    for (const {beat,id} of beats) beat.originalImageId = id;
    for (const {target,id} of covers) target.cover = {assetId:id,focusX:0.5,focusY:0.5};
    project.mapBackgroundId = mapId;
    project.mapBackgroundSize = {...mapSize};

    return () => {
      discardOriginalImages([...beats,...covers].map(({id}) => id).concat(mapId));
      for (const {beat} of beats) delete beat.originalImageId;
      for (const {target} of covers) delete target.cover;
      delete project.mapBackgroundId;
      delete project.mapBackgroundSize;
    };
  }

  return {create,saveImages};
})(Enredo);
