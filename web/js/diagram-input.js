Enredo.diagramInput = ((app) => {
  'use strict';

  const { $, bindActions } = app.dom;

  function toggleConnect() {
    if (app.session.isStructureView() || $('connect').disabled) return;
    if (app.session.connectMode) app.diagram.stopConnect();
    else {
      app.session.connectMode = true;
      app.session.source = app.diagram.scene.byId.has(app.session.selection) ? app.session.selection : null;
    }
    app.diagram.renderMode();
    app.diagram.renderCards();
  }

  function activateCard(id,keyboard) {
    if (!app.session.connectMode) {
      app.workspace.inspect(id,keyboard);
      if (keyboard) app.diagram.cardFor(id)?.focus({preventScroll:true});
      return;
    }
    if (!app.session.source || app.session.source === id) {
      app.session.source = id;
      app.diagram.renderMode();
      app.diagram.renderCards();
      if (keyboard) app.diagram.cardFor(id)?.focus({preventScroll:true});
      return;
    }
    const from = app.store.nodeById(app.session.source), to = app.store.nodeById(id);
    app.diagram.stopConnect();
    app.diagram.renderCards();
    app.paths.editPath(from,null,to);
  }

  function setupGraph() {
    const graph = $('graph');
    const touches = new Map();
    let drag = null, pinch = null, suppressClick = false;

    function touchSpan() {
      const [first,second] = touches.values();
      const rect = graph.getBoundingClientRect();
      return {x:(first.x + second.x)/2 - rect.left,y:(first.y + second.y)/2 - rect.top,
        distance:Math.max(1,Math.hypot(first.x - second.x,first.y - second.y))};
    }

    function finishDrag(cancelled) {
      const previous = drag;
      drag = null;
      graph.classList.remove('panning');
      if (!previous?.n || !previous.started) return;
      if (cancelled) {
        Object.assign(previous.n,{x:previous.x,y:previous.y});
        app.session.selection = previous.selection;
      } else {
        if (previous.n.x !== previous.x || previous.n.y !== previous.y) app.store.remember(previous.before);
        app.store.save();
      }
      app.workspace.render();
    }

    graph.addEventListener('pointerdown',event => {
      const touch = event.pointerType === 'touch';
      if (event.button !== 0 && event.button !== 1) return;
      if ((!touch && touches.size) || (drag?.started && !touches.size)) return;
      if (!touches.size) suppressClick = false;
      const target = event.target;
      const control = target.closest('.graph-controls,.minimap,.empty-canvas');
      if (touch) {
        if (control && !touches.size) return;
        touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if (touches.size >= 2) {
          // A second finger turns the gesture into a map zoom, discarding any partial card move.
          if (drag) finishDrag(true);
          pinch = touchSpan();
          suppressClick = true;
          graph.classList.add('panning');
          for (const pointer of touches.keys()) graph.setPointerCapture(pointer);
          return;
        }
      }
      if (control || (!touch && target.closest('[data-edge]'))) return;
      const card = target.closest('[data-node]');
      if (!touch && card && (app.session.isWholeStory() || app.session.connectMode) && event.button !== 1) return;
      const n = card && !app.session.isWholeStory() && !app.session.connectMode && event.button !== 1 ? app.store.nodeById(card.dataset.node) : null;
      drag = {pointer:event.pointerId,startX:event.clientX,startY:event.clientY,n,
        x:n?.x ?? app.diagram.view.x,y:n?.y ?? app.diagram.view.y,started:false};
      if (event.button === 1) event.preventDefault();
    });

    graph.addEventListener('pointermove',event => {
      if (touches.has(event.pointerId)) {
        touches.set(event.pointerId,{x:event.clientX,y:event.clientY});
        if (pinch) {
          const next = touchSpan();
          app.diagram.zoomAt(next.distance/pinch.distance,next.x,next.y,pinch.x,pinch.y);
          pinch = next;
          return;
        }
      }
      if (drag?.pointer !== event.pointerId) return;
      if (event.pointerType !== 'touch' && event.buttons === 0) {
        finishDrag(true);
        return;
      }
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      if (!drag.started && Math.hypot(dx,dy) < 4) return;
      if (!drag.started) {
        drag.started = true;
        suppressClick = true;
        graph.setPointerCapture(event.pointerId);
        graph.classList.add('panning');
        if (drag.n) {
          drag.before = JSON.stringify(app.store.state);
          drag.selection = app.session.selection;
          app.session.selection = drag.n.id;
          app.storyBeats.renderInspector();
          app.diagram.renderCards();
          drag.card = app.diagram.cardFor(app.session.selection);
        }
      }
      if (drag.n) {
        const node = drag.n;
        const {positionScale,byId} = app.diagram.scene;
        const zoom = app.diagram.view.zoom;
        node.x = Math.round(drag.x + dx/(zoom * positionScale.x));
        node.y = Math.round(drag.y + dy/(zoom * positionScale.y));
        const displayed = byId.get(node.id);
        displayed.x = node.x * positionScale.x;
        displayed.y = node.y * positionScale.y;
        drag.card.style.left = displayed.x + 'px';
        drag.card.style.top = displayed.y + 'px';
        app.diagram.renderWires();
        app.diagram.renderMinimap();
      } else {
        app.diagram.view.x = drag.x + dx;
        app.diagram.view.y = drag.y + dy;
        app.diagram.updateView();
      }
    });

    function finish(event,cancelled = false) {
      if (touches.delete(event.pointerId) && pinch) {
        pinch = touches.size >= 2 ? touchSpan() : null;
        if (touches.size === 1) {
          const [[pointer,point]] = touches;
          drag = {pointer,startX:point.x,startY:point.y,x:app.diagram.view.x,y:app.diagram.view.y,started:true};
        }
      } else if (drag?.pointer === event.pointerId) {
        finishDrag(cancelled);
      }
    }
    graph.addEventListener('pointerup',finish);
    graph.addEventListener('pointercancel',event => finish(event,true));
    graph.addEventListener('lostpointercapture',event => {
      if (event.target === graph) finish(event,true);
    });
    graph.addEventListener('click',event => {
      if (suppressClick && event.detail > 0) return;
      const card = event.target.closest('[data-node]');
      const edge = event.target.closest('[data-edge]');
      if (card) activateCard(card.dataset.node,event.detail === 0);
      else if (edge && !app.session.connectMode) app.paths.edgeDialog(edge.dataset.edge);
      else if (event.target === graph && app.session.selection && !app.session.connectMode) {
        app.session.selection = null;
        app.workspace.render();
      }
    });
    graph.addEventListener('wheel',event => {
      if (event.target.closest('.graph-controls')) return;
      event.preventDefault();
      if (event.ctrlKey || event.metaKey) {
        const rect = graph.getBoundingClientRect();
        const delta = event.deltaY * (event.deltaMode === 1 ? 16 : 1);
        app.diagram.zoomAt(Math.exp(-delta*.003),event.clientX-rect.left,event.clientY-rect.top);
      } else {
        const scale = event.deltaMode === 1 ? 16 : 1;
        app.diagram.view.x -= event.deltaX*scale + (event.shiftKey ? event.deltaY*scale : 0);
        app.diagram.view.y -= event.shiftKey ? 0 : event.deltaY*scale;
        app.diagram.updateView();
      }
    },{passive:false});
    graph.addEventListener('keydown',event => {
      if (event.target !== graph || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'ArrowLeft') app.diagram.view.x += 45;
      if (event.key === 'ArrowRight') app.diagram.view.x -= 45;
      if (event.key === 'ArrowUp') app.diagram.view.y += 45;
      if (event.key === 'ArrowDown') app.diagram.view.y -= 45;
      app.diagram.updateView();
    });
  }

  function bindEvents() {
    bindActions({connect:toggleConnect,layout:app.diagramLayout.autoLayout,zoomIn:() => app.diagram.zoomAt(1.22),zoomOut:() => app.diagram.zoomAt(1/1.22),fit:app.diagram.fitMap});
    setupGraph();
  }

  return {
    bindEvents,
    toggleConnect
  };
})(Enredo);
