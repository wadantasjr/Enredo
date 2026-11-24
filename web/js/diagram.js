Enredo.diagram = ((app) => {
  'use strict';

  const { number, $, esc, icon } = app.dom;
  const { t, tx } = app.preferences;

  const W = 170, H = 96, imageCardHeight = 168;
  const thumbnailWidth = 144, thumbnailHeight = 68;
  const chapterContentOffset = 65;

  const layoutNodeHeight = node => node.image ? imageCardHeight : H;
  const nodeThumbnailScale = node => node.image ? app.preferences.thumbnailScale : 0;
  const nodeWidth = node => W + thumbnailWidth * Math.max(0,nodeThumbnailScale(node) - 1);
  const nodeHeight = node => {
    const scale = nodeThumbnailScale(node);
    return scale ? imageCardHeight + thumbnailHeight * (scale - 1) : H;
  };

  const view = {x:0,y:0,zoom:1};
  const defaultPositionScale = {x:1,y:1};
  let graphViewport = null;
  let scene = {nodes:[],edges:[],sections:[],groupRules:[],byId:new Map(),positionScale:defaultPositionScale};
  let miniBounds = null;

  function bounds(nodes) {
    if (!nodes.length) return {left:0,top:0,right:W,bottom:H};
    const box = {left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for (const n of nodes) {
      box.left = Math.min(box.left,n.x);
      box.top = Math.min(box.top,n.y);
      box.right = Math.max(box.right,n.x + n.width);
      box.bottom = Math.max(box.bottom,n.y + n.height);
    }
    return box;
  }

  function chapterPositionScale(nodes) {
    if (app.preferences.thumbnailScale > 1) {
      const imageNode = nodes.find(n => n.image);
      // Expand spacing in the view while keeping saved card positions in 1x coordinates.
      if (imageNode) return {x:nodeWidth(imageNode)/W,y:nodeHeight(imageNode)/imageCardHeight};
    }
    return defaultPositionScale;
  }

  function positionCards(nodes,scale,wholeStory = false) {
    return nodes.map(record => {
      const position = wholeStory ? record.mapPosition : record;
      return {...record,record,position,x:position.x * scale.x,y:position.y * scale.y,
        width:nodeWidth(record),height:nodeHeight(record),positionScale:scale};
    });
  }

  function wholeStoryLayout(project) {
    const nodes = [], sections = [], groupRules = [], representatives = new Map();
    const backgroundSize = project.mapBackgroundId ? project.mapBackgroundSize : null;
    const byChapter = new Map(project.chapters.map(c => [c.id,[]]));
    const chapterIndex = new Map(project.chapters.map((c,i) => [c.id,i]));
    const collapsed = app.mapGrouping.collapsedSections(project);
    for (const node of project.nodes) byChapter.get(node.chapter).push(node);
    const countText = app.workspace.countText;
    let offset = 0;

    function addSection(type,record,title,details,collapsed,suggested,parent) {
      const position = record.mapPosition ?? suggested;
      const section = {type,id:record.id,record,title,details,collapsed,position,positionScale:defaultPositionScale,
        x:(parent?.x ?? 0) + position.x,y:(parent?.y ?? 0) + position.y,width:250,height:collapsed ? H : 42,children:[]};
      parent?.children.push(section);
      sections.push(section);
      return section;
    }

    function placeChapter(chapter,x,parent) {
      const beats = byChapter.get(chapter.id);
      const closed = collapsed.chapters.has(chapter.id);
      const section = addSection('chapter',chapter,number(chapterIndex.get(chapter.id)) + '  ' + chapter.title,
        countText(beats.length,'countNode'),closed,{x,y:parent ? 66 : -65},parent);
      if (closed) {
        for (const beat of beats) representatives.set(beat.id,section);
        return section.width + 82;
      }
      const cards = positionCards(beats,backgroundSize ? defaultPositionScale : chapterPositionScale(beats),true);
      if (backgroundSize) {
        // Keep locations centered on the artwork as thumbnail sizes change.
        for (const card of cards) {
          card.x += (W - card.width) / 2;
          card.y += (layoutNodeHeight(card) - card.height) / 2;
        }
      }
      const box = bounds(cards);
      for (const card of cards) {
        card.x += section.x;
        card.y += section.y + chapterContentOffset;
        nodes.push(card);
        section.children.push(card);
      }
      return Math.max(section.width,box.right) + 138;
    }

    for (const group of project.chapterGroups ?? []) {
      const chapters = app.chapterGroups.groupChapters(project,group.id);
      const beats = chapters.reduce((count,chapter) => count + byChapter.get(chapter.id).length,0);
      const closed = collapsed.groups.has(group.id);
      const details = countText(chapters.length,'countChapter') + ' · ' + countText(beats,'countNode');
      const section = addSection('group',group,group.title,details,closed,{x:offset,y:-131});
      if (closed) {
        for (const chapter of chapters) {
          for (const beat of byChapter.get(chapter.id)) representatives.set(beat.id,section);
        }
        offset += section.width + 112;
      } else {
        let chapterOffset = 0;
        for (const chapter of chapters) chapterOffset += placeChapter(chapter,chapterOffset,section);
        if (chapters.length && !backgroundSize) {
          section.rule = {id:group.id,x:section.x,y:section.y + 51,width:chapterOffset - 72};
          groupRules.push(section.rule);
        }
        offset += Math.max(chapterOffset,section.width + 112) + 32;
      }
    }
    for (const chapter of app.chapterGroups.groupChapters(project,null)) offset += placeChapter(chapter,offset);
    return {nodes,sections,groupRules,representatives,backgroundSize};
  }

  function visibleEdges(edges,byId,representatives) {
    const outgoing = new Map();
    for (const edge of edges) {
      const visibleFrom = byId.get(edge.from), visibleTo = byId.get(edge.to);
      const from = visibleFrom ?? representatives.get(edge.from), to = visibleTo ?? representatives.get(edge.to);
      if (!from || !to || from === to) continue;
      if (!outgoing.has(from)) outgoing.set(from,new Map());
      const destinations = outgoing.get(from);
      if (!destinations.has(to)) destinations.set(to,[]);
      const parallel = destinations.get(to);
      const projected = !visibleFrom || !visibleTo;
      if (projected && parallel.length) parallel[0].count++;
      else parallel.push({from,to,edge:projected ? null : edge,label:edge.label,count:1});
    }
    const visible = [];
    for (const destinations of outgoing.values()) {
      for (const parallel of destinations.values()) {
        parallel.forEach((wire,index) => visible.push({...wire,index,bend:(index - (parallel.length - 1)/2) * 31}));
      }
    }
    return visible;
  }

  function buildScene() {
    const p = app.store.project();
    let positionScale = defaultPositionScale;
    let layout;
    if (app.session.isWholeStory()) {
      layout = wholeStoryLayout(p);
    } else {
      const chapterNodes = p.nodes.filter(n => n.chapter === app.store.chapter().id);
      positionScale = chapterPositionScale(chapterNodes);
      layout = {nodes:positionCards(chapterNodes,positionScale),sections:[],groupRules:[],representatives:new Map()};
    }
    const {nodes,sections,groupRules,representatives,backgroundSize} = layout;
    const byId = new Map(nodes.map(n => [n.id,n]));
    return {nodes,sections,groupRules,byId,positionScale,backgroundSize,edges:visibleEdges(p.edges,byId,representatives)};
  }

  function renderSection(section) {
    const {type,id,title,details,x,y,width,height,collapsed} = section;
    const name = t(type === 'group' ? 'mapGroupLabel' : 'mapChapterLabel',{name:title});
    const label = collapsed ? name + ' · ' + details : name;
    return '<button type="button" class="map-section ' + (collapsed ? 'node map-summary' : 'map-heading') +
      '" data-map-section="' + type + '" data-map-id="' + esc(id) + '" aria-expanded="' + !collapsed +
      '" aria-label="' + esc(label) + '" title="' + esc(name) + '" style="left:' + x + 'px;top:' + y +
      'px;width:' + width + 'px;height:' + height + 'px">' +
      '<span class="map-section-label">' + icon(type === 'group' ? 'folder' : 'book') + '<span class="' +
      (collapsed ? 'node-title' : 'clip') + '">' + esc(title) + '</span>' + icon(collapsed ? 'right' : 'chevron') + '</span>' +
      (collapsed ? '<span class="map-section-count">' + esc(details) + '</span><span class="port" aria-hidden="true"></span>' +
        '<span class="port out" aria-hidden="true"></span>' : '') + '</button>';
  }

  function renderCards() {
    const model = app.narrative.activeNarrativeModel(app.store.project());
    $('cards').innerHTML =
      scene.groupRules.map(rule => '<span class="map-group-rule" data-map-rule="' + esc(rule.id) + '" aria-hidden="true" style="left:' + rule.x + 'px;top:' + rule.y +
        'px;width:' + rule.width + 'px"></span>').join('') +
      scene.sections.map(renderSection).join('') +
      scene.nodes.map(n => {
        const title = esc(n.title || t('untitled'));
        const active = app.structure.activeNarrativeStage(n,model);
        const preserved = n.narrativeStage && !active;
        const stageName = active ? app.structure.narrativeText(active.name) :
          preserved ? t('preservedStage',{stage:app.structure.narrativeStageName(n.narrativeStage)}) : '';
        const badge = stageName ? '<span class="node-stage clip' + (preserved ? ' preserved' : '') + '">' + esc(stageName) + '</span>' : '';
        const scale = nodeThumbnailScale(n);
        const thumb = scale ? '<img class="node-thumb" src="' + esc(n.image) + '" height="' + (thumbnailHeight * scale) + '" alt="" draggable="false">' : '';
        return '<button class="node' + (n.id === app.session.selection ? ' selected' : '') + (badge ? ' has-narrative-stage' : '') +
          (thumb ? ' has-image' : '') +
          (n.id === app.session.source ? ' connection-source' : '') + '" data-node="' + esc(n.id) + '" aria-pressed="' + (n.id === app.session.selection) +
          '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + n.width + 'px;height:' + n.height + 'px" title="' + title +
          (badge ? ' · ' + esc(stageName) : '') + '">' + thumb + '<span class="tag" data-kind="' +
          n.kind + '">' + icon(n.kind) + tx(n.kind) + '</span><span class="node-title">' + title +
          '</span>' + badge + '<span class="port" aria-hidden="true"></span><span class="port out" aria-hidden="true"></span></button>';
      }).join('');
  }

  function sameRow(a,b) {
    return a.y < b.y + b.height + 10 && b.y < a.y + a.height + 10;
  }

  function renderWires() {
    const labels = [];
    const selected = scene.byId.get(app.session.selection);
    const fontScale = app.preferences.fontSize/100;
    const lines = scene.edges.map(({from,to,edge,label:originalLabel,count,index,bend}) => {
      const x1 = from.x + from.width + 4, x2 = to.x - 5, y1 = from.y + from.height / 2, y2 = to.y + to.height / 2;
      const adjacent = x2 - x1 > 16;
      const reach = Math.max(20,Math.min(130,(x2 - x1) * .55));
      const bypassCards = !adjacent && sameRow(from,to);
      const bypass = Math.min(from.y,to.y) - 35 - index*24;
      const startBend = bypassCards ? bypass : y1 + bend;
      const endBend = bypassCards ? bypass : y2 + bend;
      const d = adjacent ? 'M ' + x1 + ' ' + y1 + ' C ' + (x1+reach) + ' ' + (y1+bend) + ' ' + (x2-reach) + ' ' + (y2+bend) + ' ' + x2 + ' ' + y2 :
        'M ' + x1 + ' ' + y1 + ' C ' + (x1 + 30) + ' ' + y1 + ' ' + (x1 + 30) + ' ' + startBend + ' ' + (x1 + 14) + ' ' + startBend +
        ' L ' + (x2 - 14) + ' ' + endBend + ' C ' + (x2 - 30) + ' ' + endBend + ' ' + (x2-30) + ' ' + y2 + ' ' + x2 + ' ' + y2;
      const active = from === selected || to === selected;
      const id = edge ? ' data-edge="' + esc(edge.id) + '"' : '';
      const tip = active ? 'tip-active' : 'tip';
      const fullLabel = count > 1 ? app.workspace.countText(count,'countConnection') : originalLabel;
      if (fullLabel && (view.zoom >= .43 || active)) {
        const chars = [...fullLabel];
        const label = chars.length > 24 ? chars.slice(0,23).join('') + '…' : fullLabel;
        const width = Math.max(34,[...label].length * 7.3 + 13);
        const x = (x1 + x2) / 2;
        const routeY = bypassCards ? bypass : (y1 + y2)/2 + bend*(adjacent ? .75 : 1);
        const y = routeY - 10*fontScale - 7;
        labels.push('<g class="wire-label' + (edge ? '' : ' wire-summary-label') + '"' + id + ' transform="translate(' + x + ' ' + y + ') scale(' + fontScale + ')"><title>' + esc(fullLabel) +
          '</title><rect x="' + (-width/2) + '" y="-10" width="' + width + '" height="20" rx="6"/><text text-anchor="middle" y="4">' +
          esc(label) + '</text></g>');
      }
      return '<path class="wire' + (active ? ' active' : '') + (edge ? '' : ' wire-summary') + '" d="' + d + '" marker-end="url(#' + tip + ')"/>' +
        (edge ? '<path class="wire-hit"' + id + ' d="' + d + '"><title>' + tx('editConnection') + '</title></path>' : '');
    });
    // Give the paths a real SVG viewport so repaints do not depend on overflow from a 1px layer.
    const box = mapBounds(), padding = 140;
    const left = box.left - padding, top = box.top - padding;
    const width = box.right - box.left + 2 * padding, height = box.bottom - box.top + 2 * padding;
    const layer = $('wires');
    const wireStyle = app.preferences.diagramWires(app.session.isWholeStory() ? 'whole-story' : 'timeline');
    layer.style.setProperty('--diagram-wire-color',wireStyle.color ?? '');
    layer.style.setProperty('--diagram-wire-width',wireStyle.width === null ? '' : wireStyle.width + 'px');
    layer.style.left = left + 'px';
    layer.style.top = top + 'px';
    layer.setAttribute('width',width);
    layer.setAttribute('height',height);
    layer.setAttribute('viewBox',[left,top,width,height].join(' '));
    $('wirePaths').innerHTML = lines.join('') + labels.join('');
  }

  function mapBounds() {
    const b = bounds([...scene.nodes,...scene.sections]);
    if (scene.backgroundSize) {
      b.left = Math.min(b.left,0);
      b.top = Math.min(b.top,0);
      b.right = Math.max(b.right,scene.backgroundSize.width);
      b.bottom = Math.max(b.bottom,scene.backgroundSize.height);
    }
    for (const {from,to,index} of scene.edges) {
      if (to.x - from.x <= from.width + 25 && sameRow(from,to)) {
        b.top = Math.min(b.top,Math.min(from.y,to.y) - 35 - index*24);
      }
    }
    return b;
  }

  function renderMinimap() {
    const map = $('minimap');
    const cards = [...scene.nodes,...scene.sections.filter(section => section.collapsed)];
    map.hidden = cards.length < 2;
    if (map.hidden) return;
    const b = mapBounds();
    const scale = Math.min(110 / (b.right-b.left),60 / (b.bottom-b.top));
    const dx = (128 - (b.right-b.left)*scale)/2 - b.left * scale;
    const dy = (76 - (b.bottom-b.top)*scale)/2 - b.top * scale;
    miniBounds = {scale,dx,dy};
    const x = (-view.x/view.zoom)*scale+dx, y = (-view.y/view.zoom)*scale+dy;
    const w = $('graph').clientWidth*scale/view.zoom, h = $('graph').clientHeight*scale/view.zoom;
    const rect = (x,y,w,h,color,stroke = '') => '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h +
      '" rx="2" fill="' + color + '"' + (stroke ? ' stroke="' + stroke + '"' : '') + '/>';
    map.innerHTML = rect(x,y,w,h,'var(--minimap-viewport)','var(--minimap-viewport-line)') + cards.map(n => rect(n.x*scale+dx,n.y*scale+dy,n.width*scale,n.height*scale,
      n === scene.byId.get(app.session.selection) ? 'var(--minimap-selected)' : 'var(--minimap-node)')).join('');
  }

  function updateView() {
    $('world').style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.zoom + ')';
    $('graph').style.backgroundPosition = (view.x % 20) + 'px ' + (view.y % 20) + 'px';
    $('zoomLevel').textContent = Math.round(view.zoom*100) + '%';
    $('zoomIn').disabled = view.zoom >= 2.8;
    $('zoomOut').disabled = view.zoom <= .10;
    renderMinimap();
  }

  function keepPosition(previous,next) {
    if (!next || (previous.x === next.x && previous.y === next.y)) return;
    view.x += (previous.x - next.x) * view.zoom;
    view.y += (previous.y - next.y) * view.zoom;
    updateView();
    renderWires();
  }

  function fitMap() {
    const graph = $('graph'), b = mapBounds();
    const width = b.right - b.left, height = b.bottom - b.top;
    graphViewport = {width:graph.clientWidth,height:graph.clientHeight};
    view.zoom = Math.max(.10,Math.min(1,(graph.clientWidth - 42)/width,(graph.clientHeight - 110)/height));
    view.x = (graph.clientWidth-width*view.zoom)/2 - b.left*view.zoom;
    view.y = (graph.clientHeight-height*view.zoom)/2 - b.top*view.zoom - 8;
    updateView();
    renderWires();
  }

  function resizeGraph() {
    const {clientWidth:width,clientHeight:height} = $('graph');
    if (app.session.atHome || !app.session.hasMapView() || !app.store.chapter() || !width || !height || !graphViewport) return;
    if (width === graphViewport.width && height === graphViewport.height) return;
    view.x += (width - graphViewport.width)/2;
    view.y += (height - graphViewport.height)/2;
    graphViewport = {width,height};
    updateView();
  }

  function zoomAt(factor,x = $('graph').clientWidth/2,y = $('graph').clientHeight/2,previousX = x,previousY = y) {
    const previous = view.zoom;
    view.zoom = Math.max(.10,Math.min(previous*factor,2.8));
    view.x = x - (previousX-view.x)*view.zoom/previous;
    view.y = y - (previousY-view.y)*view.zoom/previous;
    updateView();
    if ((previous < .43) !== (view.zoom < .43)) renderWires();
  }

  function renderMode() {
    $('graph').classList.toggle('connecting',app.session.connectMode);
    $('connect').classList.toggle('on',app.session.connectMode);
    $('connect').setAttribute('aria-pressed',app.session.connectMode);
    $('connectNote').hidden = !app.session.connectMode;
    const prompts = app.platform.android ? ['touchChooseSource','touchChooseDestination'] : ['chooseSource','chooseDestination'];
    $('connectNote').textContent = t(prompts[app.session.source ? 1 : 0]);
  }

  function stopConnect() {
    app.session.connectMode = false;
    app.session.source = null;
    renderMode();
  }

  function reveal(id) {
    const n = scene.byId.get(id), graph = $('graph');
    if (!n) return;
    resizeGraph();
    const left = n.x * view.zoom + view.x, top = n.y * view.zoom + view.y;
    const {width,height} = n;
    if (left >= 13 && top >= 13 && left + width*view.zoom <= graph.clientWidth-13 &&
        top + height*view.zoom <= graph.clientHeight-55) return;
    view.x = graph.clientWidth/2 - (n.x + width/2)*view.zoom;
    view.y = graph.clientHeight/2 - (n.y + height/2)*view.zoom;
    updateView();
  }

  function cardFor(id) {
    return $('cards').querySelector('[data-node="' + CSS.escape(id) + '"]');
  }

  function sectionFor(type,id) {
    return scene.sections.find(section => section.type === type && section.id === id);
  }

  function sectionButton(type,id) {
    return $('cards').querySelector('[data-map-section="' + type + '"][data-map-id="' + CSS.escape(id) + '"]');
  }

  function dragParts(item,button) {
    const parts = [];
    const sections = new Set(scene.sections);
    function add(part,element) {
      if (element) parts.push({part,element,x:part.x,y:part.y});
    }
    function visit(part,element) {
      add(part,element);
      if (!sections.has(part)) return;
      if (part.rule) add(part.rule,$('cards').querySelector('[data-map-rule="' + CSS.escape(part.rule.id) + '"]'));
      for (const child of part.children) {
        visit(child,sections.has(child) ? sectionButton(child.type,child.id) : cardFor(child.id));
      }
    }
    visit(item,button);
    return parts;
  }

  function rebuildScene() {
    scene = buildScene();
  }

  function refreshThumbnailSize() {
    if (app.session.atHome || !app.store.chapter()) return;
    if (!app.session.hasMapView()) {
      app.session.mapNeedsFit = true;
      return;
    }
    const graph = $('graph');
    const x = (graph.clientWidth/2 - view.x)/view.zoom;
    const y = (graph.clientHeight/2 - view.y)/view.zoom;
    const distance = n => Math.hypot(n.x - x,n.y - y);
    const anchor = scene.nodes.reduce((closest,n) =>
      !closest || distance(n) < distance(closest) ? n : closest,null);
    rebuildScene();
    const next = scene.byId.get(anchor?.id);
    if (next) {
      view.x += (anchor.x - next.x) * view.zoom;
      view.y += (anchor.y - next.y) * view.zoom;
    }
    renderCards();
    renderWires();
    updateView();
  }

  function bindEvents() {
    $('minimap').addEventListener('click',event => {
      if (!miniBounds) return;
      const map = $('minimap').getBoundingClientRect(), graph = $('graph');
      const x = (event.clientX-map.left)*128/map.width, y = (event.clientY-map.top)*76/map.height;
      view.x = graph.clientWidth/2 - (x-miniBounds.dx)/miniBounds.scale*view.zoom;
      view.y = graph.clientHeight/2 - (y-miniBounds.dy)/miniBounds.scale*view.zoom;
      updateView();
    });
    new ResizeObserver(resizeGraph).observe($('graph'));
  }

  return {
    H,
    W,
    chapterContentOffset,
    bindEvents,
    cardFor,
    dragParts,
    fitMap,
    keepPosition,
    layoutNodeHeight,
    rebuildScene,
    refreshThumbnailSize,
    renderCards,
    renderMinimap,
    renderMode,
    renderWires,
    reveal,
    sectionButton,
    sectionFor,
    get scene() { return scene; },
    stopConnect,
    updateView,
    view,
    zoomAt
  };
})(Enredo);
