Enredo.storyData = ((app) => {
  'use strict';

  const { uid } = app.dom;

  const kinds = ['scene','decision','outcome','merge','ending'];

  const storageKey = 'enredo.story-planner.v1';

  function sample() {
    const choose = (english,portuguese) => app.preferences.language === 'pt' ? portuguese : english;
    const chapters = [
      {id:'sinal',title:choose('The last signal','O último sinal')},
      {id:'farol',title:choose('Inside the lighthouse','Dentro do farol')},
      {id:'mare',title:choose('The tide rises','A maré sobe')}
    ];
    const nodes = [
      ['radio','sinal','scene',choose('The broadcast','A transmissão'),0,147,
        choose('An old radio comes back to life. A voice on the other end points the way to the lighthouse.','Um rádio antigo volta a funcionar. Do outro lado, uma voz indica o caminho para o farol.')],
      ['escolha','sinal','decision',choose('Which way to go?','Qual caminho seguir?'),204,147,
        choose('Mara hears a voice on the radio. She can trust the message or follow the coast to the lighthouse.','Mara ouve uma voz no rádio. Ela pode confiar na mensagem ou seguir pela costa até o farol.')],
      ['voz','sinal','outcome',choose('Follow the voice','Seguir a voz'),423,0,
        choose('Mara takes the road she was told to follow and meets someone who knows where the signal came from.','Mara segue pela estrada indicada e encontra alguém que conhece a origem do sinal.')],
      ['costa','sinal','outcome',choose('Take the coast','Cruzar a costa'),423,294,
        choose('Mara skirts the rocks and finds the service entrance.','Mara contorna as rochas e encontra a entrada de serviço.')],
      ['encontro','sinal','merge',choose('At the lighthouse','Chegada ao farol'),627,147,
        choose('Both paths lead to the lighthouse. What Mara knows when she arrives depends on her route.','Os dois caminhos levam ao farol. O que Mara sabe ao chegar depende da rota.')],
      ['porta','farol','scene',choose('The door ajar','A porta entreaberta'),0,106,
        choose('The lighthouse is lit and the door is open.','O farol está ligado e a porta está aberta.')],
      ['fonte','farol','decision',choose('Where is the signal coming from?','De onde vem o sinal?'),219,106,
        choose('Inspect the equipment or look for the person who sent the broadcast.','Investigar o equipamento ou procurar a pessoa que fez a transmissão.')],
      ['registro','farol','outcome',choose('The secret log','O registro secreto'),438,106,
        choose('The log shows when the next broadcast is due.','O registro indica quando a próxima transmissão deve acontecer.')],
      ['sirene','mare','scene',choose('The evacuation warning','O aviso de evacuação'),0,106,
        choose('The tide rises, and a siren interrupts the broadcast.','A maré sobe e a sirene interrompe a transmissão.')],
      ['amanhecer','mare','ending',choose('After the storm','Depois da tempestade'),219,106,
        choose('Mara leaves with what she discovered at the lighthouse.','Mara leva consigo o que descobriu no farol.')]
    ].map(([id,chapter,kind,title,x,y,notes]) => ({id,chapter,kind,title,x,y,notes,narrativeStage:null}));
    const edges = [
      ['radio','escolha',''], ['escolha','voz',choose('Trust','Confiar')], ['escolha','costa',choose('Go around','Contornar')],
      ['voz','encontro',''], ['costa','encontro',''], ['encontro','porta',''],
      ['porta','fonte',''], ['fonte','registro',choose('Investigate','Investigar')], ['registro','sirene',''], ['sirene','amanhecer','']
    ].map(([from,to,label]) => ({id:uid(),from,to,label}));
    return {id:'exemplo',title:choose('After the Signal','Depois do sinal'),
      chapters,nodes,edges,narrativeModel:app.narrative.defaultModelId};
  }

  function validProject(p) {
    const string = value => typeof value === 'string';
    if (!p || !string(p.id) || !string(p.title) || !Array.isArray(p.chapters) ||
        !Array.isArray(p.nodes) || !Array.isArray(p.edges)) return false;
    if (!p.chapters.every(c => c && string(c.id) && string(c.title))) return false;
    const chapterIds = new Set(p.chapters.map(c => c.id));
    if (chapterIds.size !== p.chapters.length) return false;
    if (!p.nodes.every(n => n && string(n.id) && chapterIds.has(n.chapter) &&
        kinds.includes(n.kind) && string(n.title) && string(n.notes) &&
        Number.isFinite(n.x) && Number.isFinite(n.y))) return false;
    const nodeIds = new Set(p.nodes.map(n => n.id));
    if (nodeIds.size !== p.nodes.length) return false;
    return p.edges.every(e => e && string(e.id) && nodeIds.has(e.from) &&
      nodeIds.has(e.to) && e.from !== e.to && string(e.label)) &&
      new Set(p.edges.map(e => e.id)).size === p.edges.length;
  }

  const hasId = value => typeof value === 'string' && value.trim().length > 0;

  function normalizeProject(project) {
    return {
      ...project,
      narrativeModel: hasId(project.narrativeModel) ? project.narrativeModel : app.narrative.defaultModelId,
      nodes: project.nodes.map(node => {
        const {image,originalImageId,...fields} = node;
        const stage = node.narrativeStage;
        return { ...fields, narrativeStage: hasId(stage?.modelId) && hasId(stage?.stepId) ? { ...stage } : null,
          ...(app.imageStore.validNodeImage(image) ? {image,...(app.imageStore.validOriginalImageId(originalImageId) ? {originalImageId} : {})} : {}) };
      })
    };
  }

  function normalizeState(state) {
    return { ...state, projects: state.projects.map(normalizeProject) };
  }

  return {
    kinds,
    normalizeProject,
    normalizeState,
    sample,
    storageKey,
    validProject
  };
})(Enredo);
