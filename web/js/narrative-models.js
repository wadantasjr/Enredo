Enredo.narrative = (() => {
  const defaultModelId = 'free';
  const bilingual = ([en, pt]) => ({ en, pt });

  function stage(id, kind, name, summary, purpose, questions) {
    return {
      id, kind, parentId: null, name: bilingual(name), summary: bilingual(summary),
      purpose: bilingual(purpose), questions: questions.map(bilingual)
    };
  }

  function act(parent, stages) {
    return [parent, ...stages.map(child => ({ ...child, parentId: parent.id }))];
  }

  function model(id, name, summary, stages = []) {
    return {
      id, name: bilingual(name), summary: bilingual(summary),
      stages: stages.map((entry, index) => {
        const order = index + 1;
        return id === 'beats-15' ? { ...entry, order, suggestedPosition: order } : { ...entry, order };
      })
    };
  }

  const models = [
    model('free', ['Free Structure', 'Estrutura Livre'],
      ['Plan with chapters and story beats at your own pace.', 'Planeje com capítulos e situações no seu ritmo.']),
    model('three-acts', ['Three-Act Structure', 'Estrutura em Três Atos'],
      ['Group setup, confrontation and resolution into acts, sequences and milestones.',
       'Organize apresentação, confrontação e resolução em atos, sequências e marcos.'], [
      ...act(stage('act-1', 'act', ['Act I — Presentation', 'Ato I — Apresentação'],
        ['The world, characters and initial conflict take shape.', 'O mundo, os personagens e o conflito inicial ganham forma.'],
        ['Give the player enough context to understand the first major choice.', 'Dê ao jogador o contexto da primeira grande escolha.'], [
          ['What does the player need to understand before the conflict grows?', 'O que o jogador precisa entender antes de o conflito crescer?']
        ]), [
        stage('act-1-universe', 'sequence', ['Introducing the World', 'Apresentação do universo'],
          ['Show places, rules and habits through early situations.', 'Mostre lugares, regras e hábitos nas primeiras situações.'],
          ['Establish what the player can expect from this world.', 'Mostre o que o jogador pode esperar deste mundo.'], [
            ['What can the player learn by exploring?', 'O que o jogador pode descobrir ao explorar?']
          ]),
        stage('act-1-characters', 'sequence', ['Introducing the Characters', 'Introdução dos personagens'],
          ['Introduce the people who shape the first choices.', 'Apresente quem influencia as primeiras escolhas.'],
          ['Make goals and relationships clear through action.', 'Mostre objetivos e relações por meio de ações.'], [
            ['Which action reveals what each person wants?', 'Qual ação revela o que cada pessoa quer?']
          ]),
        stage('act-1-dramatic-situation', 'sequence', ['Establishing the Dramatic Situation', 'Estabelecimento da situação dramática'],
          ['Frame a goal, an opposing force and what could be lost.', 'Mostre um objetivo, uma força contrária e o que se pode perder.'],
          ['Give the decisions that follow a clear reason to matter.', 'Dê um motivo para as próximas decisões importarem.'], [
            ['Who wants what, and what stands in the way?', 'Quem quer o quê e o que está no caminho?']
          ]),
        stage('act-1-initial-conflict', 'sequence', ['Developing the Initial Conflict', 'Desenvolvimento do conflito inicial'],
          ['Show the first attempts to deal with the problem.', 'Mostre as primeiras tentativas de lidar com o problema.'],
          ['Reveal the cost of acting or letting the tension grow.', 'Revele o custo de agir ou de deixar a tensão crescer.'], [
            ['What changes after the first attempt?', 'O que muda depois da primeira tentativa?']
          ]),
        stage('act-1-turning-point', 'milestone', ['First Turning Point', 'Primeiro ponto de virada'],
          ['An event or choice sends a path in a new direction.', 'Um evento ou uma escolha dá um novo rumo ao caminho.'],
          ['Carry the initial conflict into a more demanding situation.', 'Leve o conflito inicial a uma situação mais exigente.'], [
            ['What opens or closes because of this turn?', 'O que se abre ou se fecha com essa virada?']
          ])
      ]),
      ...act(stage('act-2', 'act', ['Act II — Confrontation', 'Ato II — Confrontação'],
        ['Opposition grows as the characters pursue their goals.', 'A oposição cresce enquanto os personagens buscam seus objetivos.'],
        ['Let the results of earlier actions shape later choices.', 'Faça os resultados das ações anteriores pesarem nas próximas escolhas.'], [
          ['Which earlier decision creates new pressure on this path?', 'Qual decisão anterior cria pressão neste caminho?']
        ]), [
        stage('act-2-obstacles', 'sequence', ['Progression of Obstacles', 'Progressão dos obstáculos'],
          ['Put barriers between a character and a goal.', 'Coloque barreiras entre um personagem e seu objetivo.'],
          ['Give each route a distinct way to respond to resistance.', 'Dê a cada rota uma forma própria de reagir à resistência.'], [
            ['How can the player get past this obstacle?', 'Como o jogador pode superar este obstáculo?']
          ]),
        stage('act-2-complications', 'sequence', ['Escalating Complications', 'Complicações crescentes'],
          ['Let the outcome of an attempt create another problem.', 'Faça o resultado de uma tentativa criar outro problema.'],
          ['Increase pressure through effects of earlier actions.', 'Aumente a pressão com os efeitos de ações anteriores.'], [
            ['Which success or mistake makes the next choice harder?', 'Qual acerto ou erro torna a próxima escolha mais difícil?']
          ]),
        stage('act-2-conflicts', 'sequence', ['Conflict Development', 'Desenvolvimento dos conflitos'],
          ['Bring competing goals and commitments together.', 'Coloque objetivos e compromissos incompatíveis frente a frente.'],
          ['Make the player weigh who benefits from each path.', 'Mostre quem ganha ou perde com cada caminho.'], [
            ['Which goals can no longer be met together?', 'Quais objetivos deixaram de poder coexistir?']
          ]),
        stage('act-2-turning-point', 'milestone', ['Second Turning Point', 'Segundo ponto de virada'],
          ['A choice, setback or discovery defines the final approach.', 'Uma escolha, perda ou descoberta define a direção final.'],
          ['Turn the accumulated pressure into a clear direction for the ending.', 'Transforme a pressão acumulada em uma direção clara para o desfecho.'], [
            ['What gives this path a chance to resolve the central conflict?', 'O que permite a este caminho resolver o conflito central?']
          ])
      ]),
      ...act(stage('act-3', 'act', ['Act III — Resolution', 'Ato III — Resolução'],
        ['The central conflict reaches its result on this path.', 'O conflito central chega ao seu resultado neste caminho.'],
        ['Connect the ending to the choices and costs that preceded it.', 'Ligue o desfecho às escolhas e aos custos anteriores.'], [
          ['What should the player understand about their choices by the end?', 'O que o jogador deve entender sobre suas escolhas no final?']
        ]), [
        stage('act-3-decisive-confrontation', 'sequence', ['Decisive Confrontation', 'Confrontação decisiva'],
          ['Bring the forces in conflict together for the final attempt.', 'Reúna as forças em conflito para a tentativa final.'],
          ['Put the route’s choices and commitments to use.', 'Ponha em prática as escolhas e os compromissos da rota.'], [
            ['How do earlier choices affect this attempt?', 'Como as escolhas anteriores afetam esta tentativa?']
          ]),
        stage('act-3-climax', 'milestone', ['Climax', 'Clímax'],
          ['An action or result settles what is most at stake.', 'Uma ação ou um resultado decide o que mais importa no conflito.'],
          ['Answer the central dramatic question for this path.', 'Responda à questão central deste caminho.'], [
            ['Which moment makes the outcome clear?', 'Qual momento torna o resultado claro?']
          ]),
        stage('act-3-consequences', 'sequence', ['Consequences', 'Consequências'],
          ['Show the immediate effects of the decisive result.', 'Mostre os efeitos imediatos do resultado decisivo.'],
          ['Give the choices visible effects on people or places.', 'Mostre como as escolhas afetam pessoas ou lugares.'], [
            ['Who feels the result first, and how?', 'Quem sente o resultado primeiro e de que forma?']
          ]),
        stage('act-3-resolution', 'sequence', ['Resolution', 'Resolução'],
          ['Show how life settles after this path ends.', 'Mostre como fica a vida após o fim deste caminho.'],
          ['Clarify what changed and what remains open.', 'Deixe claro o que mudou e o que ficou em aberto.'], [
            ['What is the new normal after this ending?', 'Qual é a nova rotina depois deste desfecho?']
          ])
        ])
    ]),
    model('journey-12', ['12-Stage Journey', 'Jornada em 12 Etapas'],
      ['Trace how a character faces change, learns and carries its effects into the ending.',
       'Acompanhe como um personagem enfrenta mudanças, aprende e leva os efeitos ao desfecho.'], [
      stage('ordinary-world', 'stage', ['Ordinary World', 'Mundo Comum'],
        ['Show the routine and relationships in place before the change.', 'Mostre a rotina e as relações antes da mudança.'],
        ['Give the player a baseline for noticing what changes later.', 'Dê ao jogador uma referência para perceber o que muda depois.'], [
          ['What does the character take for granted?', 'O que o personagem tem como certo?'],
          ['Which tension already exists in this routine?', 'Qual tensão já existe nessa rotina?'],
          ['What can the player do to learn how this world works?', 'O que o jogador pode fazer para entender como este mundo funciona?']
        ]),
      stage('call-to-adventure', 'stage', ['Call to Adventure', 'Chamado à Aventura'],
        ['A problem or opportunity makes a response necessary.', 'Um problema ou uma oportunidade exige uma resposta.'],
        ['Make the stakes and possible directions of the journey clear.', 'Mostre o que está em jogo e as direções possíveis da jornada.'], [
          ['What interrupts the routine?', 'O que interrompe a rotina?'],
          ['Who or what brings the news?', 'Quem ou o que traz a novidade?'],
          ['What can happen if the player ignores it?', 'O que pode acontecer se o jogador ignorar o chamado?']
        ]),
      stage('refusal-of-call', 'stage', ['Refusal of the Call', 'Recusa do Chamado'],
        ['Show hesitation, doubt or a reason to turn down the challenge.', 'Mostre a hesitação, a dúvida ou um motivo para recusar o desafio.'],
        ['Reveal what the character risks by accepting.', 'Revele o que o personagem arrisca se aceitar.'], [
          ['What makes staying seem safer?', 'O que faz ficar parecer mais seguro?'],
          ['Does refusal open a different route?', 'A recusa abre outro caminho?'],
          ['Which event could change the answer?', 'Qual evento poderia mudar a resposta?']
        ]),
      stage('meeting-with-mentor', 'stage', ['Meeting with the Mentor', 'Encontro com o Mentor'],
        ['A person, clue or experience offers guidance.', 'Uma pessoa, pista ou experiência oferece orientação.'],
        ['Prepare the character to face a choice with new knowledge or support.', 'Prepare o personagem para uma escolha com novo conhecimento ou apoio.'], [
          ['What does the character learn here?', 'O que o personagem aprende aqui?'],
          ['Can different routes offer different guidance?', 'Caminhos diferentes podem oferecer orientações diferentes?'],
          ['What remains for the player to decide?', 'O que ainda cabe ao jogador decidir?']
        ]),
      stage('crossing-first-threshold', 'stage', ['Crossing the First Threshold', 'Travessia do Primeiro Limiar'],
        ['A commitment takes the character into an unfamiliar situation.', 'Um compromisso leva o personagem a uma situação desconhecida.'],
        ['Show the first effect of committing to the journey.', 'Mostre o primeiro efeito de assumir o compromisso.'], [
          ['Which choice marks the crossing?', 'Qual escolha marca a travessia?'],
          ['Which familiar option becomes harder to return to?', 'A qual opção conhecida fica mais difícil voltar?'],
          ['How can the player recognize the new rules?', 'Como o jogador percebe as novas regras?']
        ]),
      stage('tests-allies-enemies', 'stage', ['Tests, Allies and Enemies', 'Testes, Aliados e Inimigos'],
        ['Trials introduce the rules of the new situation and who may help or oppose the character.',
         'As provas mostram as novas regras e quem pode ajudar ou fazer oposição.'],
        ['Let the player learn which tools, people and choices matter on this route.', 'Mostre quais recursos, pessoas e escolhas pesam nesta rota.'], [
          ['What does each test teach?', 'O que cada prova ensina?'],
          ['Who becomes an ally because of a choice?', 'Quem vira aliado por causa de uma escolha?'],
          ['Can the same person oppose the player on another route?', 'A mesma pessoa pode se opor ao jogador em outra rota?']
        ]),
      stage('approach-hidden-cave', 'stage', ['Approach to the Hidden Cave', 'Aproximação da Caverna Oculta'],
        ['The character prepares to face a place, person or fear at the center of the conflict.',
         'O personagem se prepara para enfrentar um lugar, uma pessoa ou um medo no centro do conflito.'],
        ['Build anticipation and give earlier preparations a purpose.', 'Crie expectativa e dê uma função aos preparativos anteriores.'], [
          ['What needs to be ready before the confrontation?', 'O que precisa estar pronto antes do confronto?'],
          ['Which risk becomes clear during the approach?', 'Qual risco fica claro na aproximação?'],
          ['Which preparations differ across routes?', 'Quais preparativos mudam entre as rotas?']
        ]),
      stage('ordeal', 'stage', ['Ordeal', 'Provação'],
        ['The character faces a central fear, loss or threat to the goal.', 'O personagem enfrenta um medo, uma perda ou uma ameaça central ao objetivo.'],
        ['Force a choice under pressure and make its cost visible.', 'Exija uma escolha sob pressão e mostre seu custo.'], [
          ['What is at risk in this confrontation?', 'O que está em risco neste confronto?'],
          ['Which earlier decision changes the result?', 'Qual decisão anterior muda o resultado?'],
          ['What changes even if the character succeeds?', 'O que muda mesmo se o personagem tiver sucesso?']
        ]),
      stage('reward', 'stage', ['Reward', 'Recompensa'],
        ['The ordeal yields a discovery, gain or partial victory.', 'A provação gera uma descoberta, um ganho ou uma vitória parcial.'],
        ['Show what the character can do or understand after the ordeal.', 'Mostre o que o personagem pode fazer ou entender após a provação.'], [
          ['What did the character earn or learn?', 'O que o personagem ganhou ou aprendeu?'],
          ['Does each path lead to the same reward?', 'Cada caminho leva à mesma recompensa?'],
          ['What cost remains after the gain?', 'Qual custo permanece depois do ganho?']
        ]),
      stage('road-back', 'stage', ['Road Back', 'Caminho de Volta'],
        ['The character heads toward a new goal or a return as the ordeal’s effects follow.',
         'O personagem segue para um novo objetivo ou para o retorno, sob os efeitos da provação.'],
        ['Show how the gain changes the way to the ending.', 'Mostre como o ganho muda o caminho até o desfecho.'], [
          ['What makes returning difficult now?', 'O que dificulta o retorno agora?'],
          ['Which consequence follows the character?', 'Qual consequência acompanha o personagem?'],
          ['Which route is open because of the reward?', 'Qual rota se abriu por causa da recompensa?']
        ]),
      stage('resurrection', 'stage', ['Resurrection', 'Ressurreição'],
        ['A final test puts the character’s change into action.', 'Uma prova final coloca em prática a mudança do personagem.'],
        ['Make the change, its limits and its cost visible in a decisive choice.', 'Mostre a mudança, seus limites e seu custo em uma escolha decisiva.'], [
          ['How does the character act differently now?', 'Como o personagem age de outro modo agora?'],
          ['What can the player lose at this point?', 'O que o jogador pode perder neste ponto?'],
          ['How can one route show a change that another route avoids?', 'Como uma rota pode mostrar uma mudança ausente em outra?']
        ]),
      stage('return-with-elixir', 'stage', ['Return with the Elixir', 'Retorno com o Elixir'],
        ['The character brings back a lesson, resource or change.', 'O personagem traz de volta uma lição, um recurso ou uma mudança.'],
        ['Show who benefits from the journey and what it leaves behind.', 'Mostre a quem a jornada beneficia e o que ela deixa.'], [
          ['Who receives the benefit of the return?', 'Quem recebe o benefício do retorno?'],
          ['What changed in the world the player first saw?', 'O que mudou no mundo que o jogador viu no início?'],
          ['How does the result differ across endings?', 'Como o resultado muda entre os desfechos?']
        ])
    ]),
    model('beats-15', ['15-Beat Structure', 'Estrutura em 15 Marcos'],
      ['Use turning points, changes in pressure and echoes between the opening and ending.',
       'Organize viradas, mudanças de pressão e relações entre a abertura e o desfecho.'], [
      stage('opening-image', 'milestone', ['Opening Image', 'Imagem de Abertura'],
        ['The first situation gives a sense of tone and of the starting conditions.', 'A primeira situação mostra o tom e as condições de partida.'],
        ['Give the ending a starting point to echo or contrast with.', 'Crie uma referência que o desfecho possa retomar ou contrastar.'], [
          ['What does the player see or do first?', 'O que o jogador vê ou faz primeiro?'],
          ['What does this reveal about the world?', 'O que isso revela sobre o mundo?'],
          ['Which detail could gain a new meaning at the end?', 'Qual detalhe pode ganhar outro sentido no final?']
        ]),
      stage('stated-theme', 'milestone', ['Stated Theme', 'Tema Declarado'],
        ['A question, action or remark puts a central idea in play.', 'Uma pergunta, ação ou fala coloca em jogo uma ideia central.'],
        ['Give later choices a common question to explore.', 'Dê às próximas escolhas uma questão em comum.'], [
          ['What idea should the player reflect on?', 'Sobre qual ideia o jogador pode refletir?'],
          ['Who puts that idea into words or action?', 'Quem expressa essa ideia por meio de fala ou ação?'],
          ['Can different routes offer different answers?', 'Rotas diferentes podem dar respostas diferentes?']
        ]),
      stage('setup', 'milestone', ['Setup', 'Apresentação'],
        ['Introduce the people, goals and conditions that matter later.', 'Apresente as pessoas, os objetivos e as condições que importam depois.'],
        ['Give later events enough context to feel like consequences of the story.', 'Dê contexto para o jogador entender as consequências posteriores.'], [
          ['What should the player know before choosing?', 'O que o jogador precisa saber antes de escolher?'],
          ['Which detail can pay off later?', 'Qual detalhe pode produzir um efeito mais tarde?'],
          ['What shows the current state of the conflict?', 'O que mostra o estado atual do conflito?']
        ]),
      stage('catalyst', 'milestone', ['Catalyst', 'Catalisador'],
        ['An event changes the conditions and demands a response.', 'Um evento muda as condições e exige uma resposta.'],
        ['Turn the opening context into a problem the player can act on.', 'Transforme o contexto inicial em um problema sobre o qual o jogador pode agir.'], [
          ['What breaks the initial balance?', 'O que rompe o equilíbrio inicial?'],
          ['Who has to respond?', 'Quem precisa responder?'],
          ['Which options become available or disappear?', 'Quais opções surgem ou desaparecem?']
        ]),
      stage('debate', 'milestone', ['Debate', 'Debate'],
        ['The character weighs possible responses and their costs.', 'O personagem avalia possíveis respostas e seus custos.'],
        ['Make uncertainty meaningful before a commitment.', 'Mostre por que a decisão é difícil antes do compromisso.'], [
          ['Which options look reasonable from here?', 'Quais opções parecem viáveis neste ponto?'],
          ['What can the character learn before deciding?', 'O que o personagem pode descobrir antes de decidir?'],
          ['What makes delay costly?', 'O que torna caro adiar a decisão?']
        ]),
      stage('break-into-two', 'milestone', ['Break into Two', 'Entrada no Segundo Ato'],
        ['A commitment starts a new phase of the conflict.', 'Um compromisso inicia uma nova fase do conflito.'],
        ['Link a clear choice to a change in what the player must do.', 'Ligue uma escolha clara a uma mudança no que o jogador precisa fazer.'], [
          ['Which action commits this route?', 'Qual ação define esta rota?'],
          ['What changes as soon as it takes effect?', 'O que muda assim que a ação produz efeito?'],
          ['How might another route enter this phase differently?', 'Como outra rota pode entrar nesta fase de outro modo?']
        ]),
      stage('secondary-story', 'milestone', ['Secondary Story', 'História Secundária'],
        ['A relationship or parallel goal develops alongside the main conflict.', 'Uma relação ou um objetivo paralelo se desenvolve junto ao conflito principal.'],
        ['Explore the theme from another angle and create consequences of its own.', 'Explore o tema por outro ponto de vista e gere consequências próprias.'], [
          ['Whose perspective does this story add?', 'Que ponto de vista essa história acrescenta?'],
          ['What choice matters specifically to this thread?', 'Qual escolha importa para esta linha da história?'],
          ['Where can its effects reach the main conflict?', 'Onde seus efeitos podem alcançar o conflito principal?']
        ]),
      stage('premise-exploration', 'milestone', ['Premise Exploration', 'Exploração da Premissa'],
        ['Situations let the player experience the central idea in action.', 'As situações permitem ao jogador viver a ideia central na prática.'],
        ['Show what changes when the player tries different approaches.', 'Mostre o que muda quando o jogador tenta abordagens diferentes.'], [
          ['Which situations best express the premise?', 'Quais situações melhor expressam a premissa?'],
          ['What can the player try here?', 'O que o jogador pode tentar aqui?'],
          ['What do different approaches reveal about the world?', 'O que abordagens diferentes revelam sobre o mundo?']
        ]),
      stage('midpoint', 'milestone', ['Midpoint', 'Ponto Médio'],
        ['A success, setback or revelation changes how the conflict looks.', 'Um sucesso, uma perda ou uma revelação muda a leitura do conflito.'],
        ['Raise the stakes or change what the path is trying to achieve.', 'Aumente o que está em jogo ou mude o objetivo do caminho.'], [
          ['What seemed true before this event?', 'O que parecia verdadeiro antes deste evento?'],
          ['Which outcome might be more fragile than it looks?', 'Qual resultado pode ser mais frágil do que parece?'],
          ['What must the player rethink now?', 'O que o jogador precisa repensar agora?']
        ]),
      stage('pressure-rises', 'milestone', ['Rising Pressure', 'Aumento da Pressão'],
        ['Opposition strengthens, resources shrink or relationships strain.', 'A oposição cresce, os recursos diminuem ou as relações se desgastam.'],
        ['Make earlier actions matter as options become harder to sustain.', 'Mostre o peso das ações anteriores à medida que as opções se reduzem.'], [
          ['Which pressure comes from earlier choices?', 'Qual pressão vem de escolhas anteriores?'],
          ['What becomes more difficult to protect?', 'O que fica mais difícil proteger?'],
          ['Where do paths face different risks?', 'Onde os caminhos enfrentam riscos diferentes?']
        ]),
      stage('all-is-lost', 'milestone', ['All Is Lost', 'Tudo Está Perdido'],
        ['A loss makes the current plan appear unworkable.', 'Uma perda faz o plano atual parecer inviável.'],
        ['Show how far the existing approach can take the character.', 'Mostre o limite da estratégia que o personagem vinha usando.'], [
          ['What does this route lose?', 'O que esta rota perde?'],
          ['Which plan can no longer continue?', 'Qual plano não pode mais seguir?'],
          ['What, if anything, remains available?', 'O que ainda está ao alcance do personagem?']
        ]),
      stage('inner-crisis', 'milestone', ['Inner Crisis', 'Crise Interior'],
        ['The character faces the meaning and cost of the setback.', 'O personagem encara o sentido e o custo da perda.'],
        ['Give a later change of direction an emotional cause.', 'Dê uma causa emocional à próxima mudança de direção.'], [
          ['What belief does the loss put in doubt?', 'Qual crença a perda põe em dúvida?'],
          ['How does the character respond when the old plan fails?', 'Como o personagem reage quando o plano falha?'],
          ['What might another route have taught by now?', 'O que outra rota pode ter ensinado até aqui?']
        ]),
      stage('break-into-three', 'milestone', ['Break into Three', 'Entrada no Terceiro Ato'],
        ['An insight or alliance makes a final approach possible.', 'Uma descoberta ou aliança permite uma tentativa final.'],
        ['Use what the path has taught the character to set up the resolution.', 'Use o que o caminho ensinou ao personagem para preparar a resolução.'], [
          ['What makes the final approach possible?', 'O que torna possível a tentativa final?'],
          ['Can a secondary story contribute to that plan?', 'Uma história secundária pode ajudar nesse plano?'],
          ['Which choice turns the insight into action?', 'Qual escolha leva a descoberta à prática?']
        ]),
      stage('final-resolution', 'milestone', ['Final Resolution', 'Resolução Final'],
        ['The route puts its final approach into practice and reaches an outcome.', 'A rota coloca a tentativa final em prática e chega a um resultado.'],
        ['Show how the central conflict and its immediate effects are settled on this route.', 'Mostre como o conflito central se resolve e quais efeitos surgem nesta rota.'], [
          ['Which action decides the result?', 'Qual ação decide o resultado?'],
          ['How do earlier choices change what is possible?', 'Como escolhas anteriores mudam o que é possível?'],
          ['What cost remains after the resolution?', 'Qual custo permanece após a resolução?']
        ]),
      stage('final-image', 'milestone', ['Final Image', 'Imagem Final'],
        ['The last situation reveals the state of the world or the character after the outcome.',
         'A última situação revela o estado do mundo ou do personagem após o desfecho.'],
        ['Make the route’s lasting change visible.', 'Mostre a mudança que permanece após o fim da rota.'], [
          ['What does the player see or do last?', 'O que o jogador vê ou faz por último?'],
          ['What detail recalls or contrasts with the opening?', 'Qual detalhe retoma ou contrasta com a abertura?'],
          ['How can each ending leave a different final impression?', 'Como cada desfecho pode deixar uma impressão final diferente?']
        ])
    ])
  ];

  const byModelId = new Map(models.map(entry => [entry.id, entry]));
  const getNarrativeModel = id => byModelId.get(id);
  const getNarrativeStage = (modelId, stepId) => getNarrativeModel(modelId)?.stages.find(entry => entry.id === stepId);
  const activeNarrativeModel = project => getNarrativeModel(project.narrativeModel) ?? getNarrativeModel(defaultModelId);
  function narrativeUsage(project) {
    const model = activeNarrativeModel(project);
    const byStage = new Map(model.stages.map(entry => [entry.id, []]));
    const preserved = [];
    let associated = 0;
    for (const node of project.nodes) {
      const stage = node.narrativeStage;
      if (!stage) continue;
      const group = stage.modelId === model.id ? byStage.get(stage.stepId) : undefined;
      if (group) {
        group.push(node);
        associated += 1;
      } else {
        preserved.push(node);
      }
    }
    const used = [...byStage.values()].filter(nodes => nodes.length > 0).length;
    const total = model.stages.length;
    return { model, byStage, preserved, total, used, unused: total - used,
      associated, unassociated: project.nodes.length - associated };
  }

  return { models, defaultModelId, getNarrativeModel, getNarrativeStage, activeNarrativeModel,
    narrativeUsage };
})();
