// A responsive viewport around Brython's SVG, without changing the drawing.
(() => {
  'use strict';
  const panel = document.getElementById('turtlePanel');
  const stage = document.getElementById('turtlediv');
  const dialog = document.getElementById('turtleDialog');
  const expand = document.getElementById('expandTurtle');
  const label = expand.querySelector('span');
  const rightPane = panel.closest('.pane');
  const anchor = document.createComment('Turtle panel');
  panel.before(anchor);
  let scene = null;
  let bounds = null;
  let view = null;
  let dragging = null;

  function drawView() {
    if (scene && view) scene.setAttribute('viewBox', `${view.x} ${view.y} ${view.width} ${view.height}`);
  }

  function drawingBounds(svg) {
    const width = Number(svg.getAttribute('width')) || 500;
    const height = Number(svg.getAttribute('height')) || 500;
    // Measure final positions on a detached copy so the live animation keeps playing.
    const copy = svg.cloneNode(true);
    for (const animation of copy.querySelectorAll('animate, set')) {
      const attribute = animation.getAttribute('attributeName');
      const value = animation.getAttribute('to');
      if (attribute && value !== null) {
        if (animation.getAttribute('attributeType') === 'CSS') {
          animation.parentElement.style.setProperty(attribute, value);
        } else {
          animation.parentElement.setAttribute(attribute, value);
        }
      }
    }
    for (const animation of copy.querySelectorAll('animate, animateMotion, animateTransform, set')) animation.remove();
    copy.removeAttribute('id');
    copy.removeAttribute('viewBox');
    for (const node of copy.querySelectorAll('[id]')) node.removeAttribute('id');
    copy.setAttribute('aria-hidden', 'true');
    copy.style.cssText = `position:fixed;left:-100000px;top:0;visibility:hidden;width:${width}px;height:${height}px;pointer-events:none`;
    document.body.append(copy);
    try {
      const box = copy.getBBox();
      const x = Math.min(0, box.x) - 24;
      const y = Math.min(0, box.y) - 24;
      return {x, y, width: Math.max(width, box.x + box.width) - x + 24,
        height: Math.max(height, box.y + box.height) - y + 24};
    } finally {
      copy.remove();
    }
  }

  function fit() {
    if (!scene) return;
    bounds = drawingBounds(scene);
    view = {...bounds};
    drawView();
  }

  function zoom(factor) {
    if (!view || !bounds) return;
    const width = view.width * factor;
    if (width < bounds.width / 20 || width > bounds.width * 20) return;
    view = {x: view.x + (view.width - width) / 2,
      y: view.y + (view.height - view.height * factor) / 2,
      width, height: view.height * factor};
    drawView();
  }

  function expandLabel() {
    const key = dialog.open ? 'pyTurtleReduce' : 'pyTurtleExpand';
    label.dataset.i18n = key;
    const lang = document.documentElement.lang || 'fr';
    label.textContent = translations[lang]?.[key] || translations.fr[key];
  }

  expand.addEventListener('click', () => {
    if (dialog.open) {
      dialog.close();
    } else {
      dialog.append(panel);
      dialog.showModal();
      expandLabel();
      expand.focus();
    }
  });
  dialog.addEventListener('close', () => {
    anchor.after(panel);
    expandLabel();
    expand.focus();
  });
  document.getElementById('fitTurtle').addEventListener('click', fit);
  document.getElementById('zoomInTurtle').addEventListener('click', () => zoom(0.8));
  document.getElementById('zoomOutTurtle').addEventListener('click', () => zoom(1.25));

  stage.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !view) return;
    const rect = stage.getBoundingClientRect();
    dragging = {x: event.clientX, y: event.clientY, view: {...view},
      scale: Math.max(view.width / rect.width, view.height / rect.height)};
    stage.setPointerCapture(event.pointerId);
    stage.classList.add('is-panning');
  });
  stage.addEventListener('pointermove', event => {
    if (!dragging) return;
    view.x = dragging.view.x - (event.clientX - dragging.x) * dragging.scale;
    view.y = dragging.view.y - (event.clientY - dragging.y) * dragging.scale;
    drawView();
  });
  function stopPanning() {
    dragging = null;
    stage.classList.remove('is-panning');
  }
  stage.addEventListener('pointerup', stopPanning);
  stage.addEventListener('pointercancel', stopPanning);
  stage.addEventListener('lostpointercapture', stopPanning);

  new MutationObserver(() => {
    const svg = stage.querySelector('svg');
    if (svg === scene) return;
    scene = svg;
    panel.hidden = !scene;
    rightPane.classList.toggle('has-turtle', Boolean(scene));
    if (!scene) {
      if (dialog.open) dialog.close();
      view = bounds = null;
      return;
    }
    scene.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    fit();
  }).observe(stage, {childList: true});
})();
