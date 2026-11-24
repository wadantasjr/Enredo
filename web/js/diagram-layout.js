Enredo.diagramLayout = ((app) => {
  'use strict';

  function autoLayout() {
    const p = app.store.project();
    if (app.session.isStructureView() || !app.store.chapter()) return;
    const wholeStory = app.session.isWholeStory();
    const targets = wholeStory ? p.chapters : [app.store.chapter()];
    const position = node => wholeStory ? node.mapPosition : node;
    app.store.edit(() => {
      for (const c of targets) layoutChapter(p,c.id,position);
    },{fit:true});
  }

  function layoutChapter(p,chapterId,position) {
    const nodes = p.nodes.filter(n => n.chapter === chapterId);
    if (nodes.length < 2) return;
    const ids = new Set(nodes.map(n => n.id));
    const edges = p.edges.filter(e => ids.has(e.from) && ids.has(e.to));
    const outgoing = new Map(nodes.map(n => [n.id,[]]));
    const incoming = new Map(nodes.map(n => [n.id,0]));
    for (const e of edges) {
      outgoing.get(e.from).push(e.to);
      incoming.set(e.to,incoming.get(e.to)+1);
    }
    const rank = new Map(nodes.map(n => [n.id,0]));
    const remaining = new Set(ids);
    const queue = nodes.filter(n => incoming.get(n.id) === 0).map(n => n.id);
    let index = 0;
    while (remaining.size) {
      // Start another group when a cycle leaves the queue empty.
      const id = index < queue.length ? queue[index++] : remaining.values().next().value;
      if (!remaining.delete(id)) continue;
      for (const to of outgoing.get(id)) {
        if (!remaining.has(to)) continue;
        rank.set(to,Math.max(rank.get(to),rank.get(id)+1));
        const count = incoming.get(to)-1;
        incoming.set(to,count);
        if (count === 0) queue.push(to);
      }
    }
    const columns = new Map();
    nodes.sort((a,b) => position(a).y - position(b).y || position(a).x - position(b).x);
    for (const n of nodes) {
      const level = rank.get(n.id);
      if (!columns.has(level)) columns.set(level,[]);
      columns.get(level).push(n);
    }
    const gap = 58;
    const heights = new Map([...columns].map(([level,column]) => [
      level,column.reduce((height,n) => height + app.diagram.layoutNodeHeight(n),0) + gap * (column.length - 1)
    ]));
    const tallest = Math.max(...heights.values());
    for (const [level,column] of columns) {
      let y = (tallest - heights.get(level)) / 2;
      for (const n of column) {
        Object.assign(position(n),{x:level * (app.diagram.W + 80),y});
        y += app.diagram.layoutNodeHeight(n) + gap;
      }
    }
  }

  return {
    autoLayout
  };
})(Enredo);
