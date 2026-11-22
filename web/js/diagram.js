Enredo.diagram = ((app) => {
  'use strict';

  const { number, $, esc, icon } = app.dom;
  const { t, tx } = app.preferences;

  const W = 170, H = 96, imageCardHeight = 168;
  const thumbnailWidth = 144, thumbnailHeight = 68;

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
  let scene = {nodes:[],edges:[],headings:[],byId:new Map(),positionScale:defaultPositionScale};
  let miniBounds = null;

  function bounds(nodes) {
    if (!nodes.length) return {left:0,top:0,right:W,bottom:H};
    const box = {left:Infinity,top:Infinity,right:-Infinity,bottom:-Infinity};
    for (const n of nodes) {
      box.left = Math.min(box.left,n.x);
      box.top = Math.min(box.top,n.y);
      box.right = Math.max(box.right,n.x + nodeWidth(n));
      box.bottom = Math.max(box.bottom,n.y + nodeHeight(n));
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

  function positionCards(nodes,scale) {
    return nodes.map(n => ({...n,x:n.x * scale.x,y:n.y * scale.y}));
  }

  function buildScene() {
    const p = app.store.project(), headings = [];
    let nodes;
    let positionScale = defaultPositionScale;
    if (app.session.isWholeStory()) {
      nodes = [];
      const byChapter = new Map(p.chapters.map(c => [c.id,[]]));
      p.nodes.forEach(n => byChapter.get(n.chapter).push(n));
      let offset = 0;
      p.chapters.forEach((c,i) => {
        const chapterNodes = byChapter.get(c.id);
        const group = positionCards(chapterNodes,chapterPositionScale(chapterNodes));
        const box = bounds(group);
        headings.push({text:number(i) + '  ' + c.title,x:offset,y:-52});
        for (const n of group) {
          n.x += offset - box.left;
          n.y -= box.top;
          nodes.push(n);
        }
        offset += Math.max(box.right - box.left,250) + 138;
      });
    } else {
      const chapterNodes = p.nodes.filter(n => n.chapter === app.store.chapter().id);
      positionScale = chapterPositionScale(chapterNodes);
      nodes = positionCards(chapterNodes,positionScale);
    }
    const byId = new Map(nodes.map(n => [n.id,n]));
    return {nodes,headings,byId,positionScale,edges:p.edges.filter(e => byId.has(e.from) && byId.has(e.to))};
  }

  function renderCards() {
    const model = app.narrative.activeNarrativeModel(app.store.project());
    $('cards').innerHTML =
      scene.headings.map(c => '<span class="world-label" style="left:' + c.x + 'px;top:' + c.y + 'px">' + esc(c.text) + '</span>').join('') +
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
          '" style="left:' + n.x + 'px;top:' + n.y + 'px;width:' + nodeWidth(n) + 'px;height:' + nodeHeight(n) + 'px" title="' + title +
          (badge ? ' · ' + esc(stageName) : '') + '">' + thumb + '<span class="tag" data-kind="' +
          n.kind + '">' + icon(n.kind) + tx(n.kind) + '</span><span class="node-title">' + title +
          '</span>' + badge + '<span class="port" aria-hidden="true"></span><span class="port out" aria-hidden="true"></span></button>';
      }).join('');
  }

  function sameRow(a,b) {
    return a.y < b.y + nodeHeight(b) + 10 && b.y < a.y + nodeHeight(a) + 10;
  }

  function renderWires() {
    const arrows = '<defs><marker id="tip" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1l6 3-6 3" fill="none" stroke="var(--wire)" stroke-width="1.1"/></marker>' +
      '<marker id="tip-active" viewBox="0 0 8 8" refX="8" refY="4" markerWidth="6" markerHeight="6" orient="auto"><path d="M1 1l6 3-6 3" fill="none" stroke="var(--wire-active)" stroke-width="1.1"/></marker></defs>';
    const labels = [], groups = new Map();
    for (const edge of scene.edges) {
      const key = JSON.stringify([edge.from,edge.to]);
      if (!groups.has(key)) groups.set(key,[]);
      groups.get(key).push(edge);
    }
    const lines = scene.edges.map(e => {
      const from = scene.byId.get(e.from), to = scene.byId.get(e.to);
      const x1 = from.x + nodeWidth(from) + 4, x2 = to.x - 5, y1 = from.y + nodeHeight(from) / 2, y2 = to.y + nodeHeight(to) / 2;
      const adjacent = x2 - x1 > 16;
      const reach = Math.max(20,Math.min(130,(x2 - x1) * .55));
      const bypassCards = !adjacent && sameRow(from,to);
      const group = groups.get(JSON.stringify([e.from,e.to]));
      const index = group.indexOf(e);
      const bend = (index - (group.length - 1)/2) * 31;
      const bypass = Math.min(from.y,to.y) - 35 - index*24;
      const startBend = bypassCards ? bypass : y1 + bend;
      const endBend = bypassCards ? bypass : y2 + bend;
      const d = adjacent ? 'M ' + x1 + ' ' + y1 + ' C ' + (x1+reach) + ' ' + (y1+bend) + ' ' + (x2-reach) + ' ' + (y2+bend) + ' ' + x2 + ' ' + y2 :
        'M ' + x1 + ' ' + y1 + ' C ' + (x1 + 30) + ' ' + y1 + ' ' + (x1 + 30) + ' ' + startBend + ' ' + (x1 + 14) + ' ' + startBend +
        ' L ' + (x2 - 14) + ' ' + endBend + ' C ' + (x2 - 30) + ' ' + endBend + ' ' + (x2-30) + ' ' + y2 + ' ' + x2 + ' ' + y2;
      const active = from.id === app.session.selection || to.id === app.session.selection;
      const id = ' data-edge="' + esc(e.id) + '"';
      const tip = active ? 'tip-active' : 'tip';
      if (e.label && (view.zoom >= .43 || active)) {
        const chars = [...e.label];
        const label = chars.length > 24 ? chars.slice(0,23).join('') + '…' : e.label;
        const width = Math.max(34,[...label].length * 7.3 + 13);
        const x = (x1 + x2) / 2, y = bypassCards ? bypass : (y1 + y2)/2 + bend*(adjacent ? .75 : 1);
        labels.push('<g class="wire-label"' + id + ' transform="translate(' + x + ' ' + y + ') scale(' + app.preferences.fontSize/100 + ')"><title>' + esc(e.label) +
          '</title><rect x="' + (-width/2) + '" y="-10" width="' + width + '" height="20" rx="6"/><text text-anchor="middle" y="4">' +
          esc(label) + '</text></g>');
      }
      return '<path class="wire' + (active ? ' active' : '') + '" d="' + d + '" marker-end="url(#' + tip + ')"/>' +
        '<path class="wire-hit"' + id + ' d="' + d + '"><title>' + tx('editConnection') + '</title></path>';
    });
    $('wires').innerHTML = arrows + lines.join('') + labels.join('');
  }

  function mapBounds() {
    const b = bounds(scene.nodes);
    if (scene.headings.length) {
      b.left = Math.min(b.left,scene.headings[0].x);
      const last = scene.headings.at(-1);
      b.right = Math.max(b.right,last.x + 170);
      b.top = Math.min(b.top,-52);
    }
    if (scene.edges.some(e => {
      const a = scene.byId.get(e.from), b = scene.byId.get(e.to);
      return b.x - a.x <= nodeWidth(a) + 25 && sameRow(a,b);
    })) b.top -= 35;
    return b;
  }

  function renderMinimap() {
    const map = $('minimap');
    map.hidden = scene.nodes.length < 2;
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
    map.innerHTML = rect(x,y,w,h,'var(--minimap-viewport)','var(--minimap-viewport-line)') + scene.nodes.map(n => rect(n.x*scale+dx,n.y*scale+dy,nodeWidth(n)*scale,nodeHeight(n)*scale,
      n.id === app.session.selection ? 'var(--minimap-selected)' : 'var(--minimap-node)')).join('');
  }

  function updateView() {
    $('world').style.transform = 'translate(' + view.x + 'px,' + view.y + 'px) scale(' + view.zoom + ')';
    $('graph').style.backgroundPosition = (view.x % 20) + 'px ' + (view.y % 20) + 'px';
    $('zoomLevel').textContent = Math.round(view.zoom*100) + '%';
    $('zoomIn').disabled = view.zoom >= 2.8;
    $('zoomOut').disabled = view.zoom <= .10;
    renderMinimap();
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
    $('graph').classList.toggle('overview',app.session.isWholeStory());
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
    const width = nodeWidth(n), height = nodeHeight(n);
    if (left >= 13 && top >= 13 && left + width*view.zoom <= graph.clientWidth-13 &&
        top + height*view.zoom <= graph.clientHeight-55) return;
    view.x = graph.clientWidth/2 - (n.x + width/2)*view.zoom;
    view.y = graph.clientHeight/2 - (n.y + height/2)*view.zoom;
    updateView();
  }

  function cardFor(id) {
    return $('cards').querySelector('[data-node="' + CSS.escape(id) + '"]');
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
    if (anchor) {
      const next = scene.byId.get(anchor.id);
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
    bindEvents,
    cardFor,
    fitMap,
    layoutNodeHeight,
    rebuildScene,
    refreshThumbnailSize,
    renderCards,
    renderMinimap,
    renderMode,
    renderWires,
    reveal,
    get scene() { return scene; },
    stopConnect,
    updateView,
    view,
    zoomAt
  };
})(Enredo);
