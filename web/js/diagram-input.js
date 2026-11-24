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
      if (!previous?.item || !previous.started || previous.scene !== app.diagram.scene) return;
      const {item,section,position} = previous;
      if (cancelled) {
        app.session.selection = previous.selection;
        app.workspace.render();
        return;
      }
      if (position.x === previous.x && position.y === previous.y) return;
      const saved = app.store.edit(() => {
        if (previous.field) item.record[previous.field] = position;
        else Object.assign(item.record,position);
      },{saveError:'projectSaveFailed'});
      if (saved && previous.field) {
        const next = section ? app.diagram.sectionFor(item.type,item.id) : app.diagram.scene.byId.get(item.id);
        app.diagram.keepPosition(item,next);
        if (section) app.diagram.sectionButton(item.type,item.id)?.focus({preventScroll:true});
      }
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
      const button = target.closest('[data-node],[data-map-section]');
      const section = button?.dataset.mapSection;
      if (!touch && button && app.session.connectMode && event.button !== 1) return;
      const scene = app.diagram.scene;
      let item;
      if (button && !app.session.connectMode && event.button !== 1) {
        item = section ? app.diagram.sectionFor(section,button.dataset.mapId) : scene.byId.get(button.dataset.node);
      }
      const {x,y} = item?.position ?? app.diagram.view;
      drag = {pointer:event.pointerId,startX:event.clientX,startY:event.clientY,item,button,section,scene,
        field:app.session.positionField(),x,y,started:false};
      if (item) button.setPointerCapture(event.pointerId);
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
      if (drag.item && drag.scene !== app.diagram.scene) {
        finishDrag(true);
        return;
      }
      const dx = event.clientX - drag.startX, dy = event.clientY - drag.startY;
      if (!drag.started && Math.hypot(dx,dy) < 4) return;
      if (!drag.started) {
        drag.started = true;
        suppressClick = true;
        if (!drag.item) graph.setPointerCapture(event.pointerId);
        graph.classList.add('panning');
        if (drag.item) {
          drag.parts = app.diagram.dragParts(drag.item,drag.button);
          drag.selection = app.session.selection;
          if (!drag.section) {
            const previousCard = drag.selection && app.diagram.cardFor(drag.selection);
            if (previousCard && previousCard !== drag.button) {
              previousCard.classList.remove('selected');
              previousCard.setAttribute('aria-pressed','false');
            }
            // Keep the pointer target in the DOM throughout the drag.
            drag.button.classList.add('selected');
            drag.button.setAttribute('aria-pressed','true');
            app.session.selection = drag.item.id;
            app.storyBeats.renderInspector();
          }
        }
      }
      if (drag.item) {
        const {positionScale:scale} = drag.item;
        const zoom = app.diagram.view.zoom;
        drag.position = {x:Math.round(drag.x + dx/(zoom * scale.x)),y:Math.round(drag.y + dy/(zoom * scale.y))};
        const offsetX = (drag.position.x - drag.x) * scale.x, offsetY = (drag.position.y - drag.y) * scale.y;
        for (const {part,element,x,y} of drag.parts) {
          part.x = x + offsetX;
          part.y = y + offsetY;
          element.style.left = part.x + 'px';
          element.style.top = part.y + 'px';
        }
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
      if (event.target === graph || (drag?.item && event.target === drag.button)) finish(event,true);
    });
    graph.addEventListener('dragstart',event => {
      if (event.target.closest('[data-node],[data-map-section]')) event.preventDefault();
    });
    graph.addEventListener('click',event => {
      if (suppressClick && event.detail > 0) return;
      const card = event.target.closest('[data-node]');
      const edge = event.target.closest('[data-edge]');
      const section = event.target.closest('[data-map-section]');
      if (section) app.mapGrouping.toggle(section.dataset.mapSection,section.dataset.mapId);
      else if (card) activateCard(card.dataset.node,event.detail === 0);
      else if (edge && !app.session.connectMode) app.paths.edgeDialog(edge.dataset.edge);
      else if (event.target === graph && app.session.selection && !app.session.connectMode && !app.workspace.mapImageOnly()) {
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
