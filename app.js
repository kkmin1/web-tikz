let nodes = [];
        let edges = [];
        let beziers = [];
        let quadratics = [];
        let quartics = [];
        let plots = [];
        let currentTool = 'select';
        let selectedId = null;
        let selectedType = null;
        let canvasW = 800;
        let canvasH = 600;

        let history = [];
        let historyIndex = -1;

        let isDrawing = false;
        let isMoving = false;
        let isResizing = false;
        let activeHandle = null;
        let startX, startY;
        let originalObj = null;

        const canvas = document.getElementById('canvas');
        const svgLayer = document.getElementById('svg-layer');
        const guideBox = document.getElementById('guide-box');
        const guideLine = document.getElementById('guide-line');
        const eraseBox = document.getElementById('erase-box');
        const output = document.getElementById('tikz-output');
        const propsPanel = document.getElementById('properties-panel');

        function resizeCanvas() {
            canvasW = parseInt(document.getElementById('canvas-w').value) || 800;
            canvasH = parseInt(document.getElementById('canvas-h').value) || 600;
            canvas.style.width = canvasW + 'px';
            canvas.style.height = canvasH + 'px';
            render();
            saveHistory();
        }

        function saveHistory() {
            const state = JSON.stringify({ nodes, edges, beziers, quadratics, quartics, plots, canvasW, canvasH });
            if (historyIndex < history.length - 1) {
                history = history.slice(0, historyIndex + 1);
            }
            history.push(state);
            if (history.length > 50) history.shift();
            else historyIndex++;
        }

        function undo() {
            if (historyIndex > 0) {
                historyIndex--;
                applyState(JSON.parse(history[historyIndex]));
            }
        }

        function redo() {
            if (historyIndex < history.length - 1) {
                historyIndex++;
                applyState(JSON.parse(history[historyIndex]));
            }
        }

        function applyState(state) {
            nodes = state.nodes || [];
            edges = state.edges || [];
            beziers = state.beziers || [];
            quadratics = state.quadratics || [];
            quartics = state.quartics || [];
            plots = state.plots || [];
            canvasW = state.canvasW || 800;
            canvasH = state.canvasH || 600;
            document.getElementById('canvas-w').value = canvasW;
            document.getElementById('canvas-h').value = canvasH;
            canvas.style.width = canvasW + 'px';
            canvas.style.height = canvasH + 'px';
            if (!findSelectedObj()) {
                selectedId = null;
                selectedType = null;
            }
            selectElement(selectedId, selectedType);
        }

        function setTool(tool) {
            currentTool = tool;
            document.querySelectorAll('header button').forEach(btn => {
                btn.classList.remove('active-tool', 'active-tool-eraser');
            });
            const targetBtn = document.getElementById('tool-' + tool);
            if (targetBtn) {
                if (tool === 'eraser') targetBtn.classList.add('active-tool-eraser');
                else targetBtn.classList.add('active-tool');
            }
            if (tool !== 'select') {
                selectElement(null, null);
            }
        }

        canvas.onmousedown = (e) => {
            const rect = canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            startX = mouseX;
            startY = mouseY;

            if (currentTool === 'select') {
                if (e.target.classList.contains('handle') || e.target.classList.contains('control-handle')) {
                    isResizing = true;
                    activeHandle = e.target.dataset.handle;
                    const obj = findSelectedObj();
                    originalObj = JSON.parse(JSON.stringify(obj));
                    return;
                }

                const targetNode = e.target.closest('.node-element');
                const targetLine = e.target.closest('.connection-line');
                const targetBezier = e.target.closest('.bezier-path:not(.plot-path):not(.quad-path):not(.quartic-path)');
                const targetQuad = e.target.closest('.quad-path');
                const targetQuartic = e.target.closest('.quartic-path');
                const targetPlot = e.target.closest('.plot-path');
                
                if (targetNode) {
                    const node = nodes.find(n => n.id === targetNode.id);
                    selectElement(node.id, 'node');
                    isMoving = true;
                    originalObj = JSON.parse(JSON.stringify(node));
                } else if (targetPlot) {
                    const plot = plots.find(p => p.id === targetPlot.dataset.id);
                    selectElement(plot.id, 'plot');
                    isMoving = true;
                    originalObj = JSON.parse(JSON.stringify(plot));
                } else if (targetLine) {
                    const edge = edges.find(ed => ed.id === targetLine.dataset.id);
                    selectElement(edge.id, 'edge');
                    isMoving = true;
                    originalObj = JSON.parse(JSON.stringify(edge));
                } else if (targetBezier) {
                    const bezier = beziers.find(b => b.id === targetBezier.dataset.id);
                    selectElement(bezier.id, 'bezier');
                    isMoving = true;
                    originalObj = JSON.parse(JSON.stringify(bezier));
                } else if (targetQuad) {
                    const quad = quadratics.find(q => q.id === targetQuad.dataset.id);
                    selectElement(quad.id, 'quad');
                    isMoving = true;
                    originalObj = JSON.parse(JSON.stringify(quad));
                } else if (targetQuartic) {
                    const quartic = quartics.find(q => q.id === targetQuartic.dataset.id);
                    selectElement(quartic.id, 'quartic');
                    isMoving = true;
                    originalObj = JSON.parse(JSON.stringify(quartic));
                } else {
                    selectElement(null, null);
                }
            } else {
                isDrawing = true;
                if (currentTool === 'eraser') eraseBox.style.display = 'block';
                else if (currentTool === 'line' || currentTool === 'bezier' || currentTool === 'quad' || currentTool === 'quartic') {
                    guideLine.style.display = 'block';
                    guideLine.style.left = startX + 'px';
                    guideLine.style.top = startY + 'px';
                } else {
                    guideBox.style.display = 'block';
                    guideBox.style.borderRadius = currentTool === 'circle' ? '50%' : '0px';
                }
            }
        };

        window.onmousemove = (e) => {
            const rect = canvas.getBoundingClientRect();
            const curX = e.clientX - rect.left;
            const curY = e.clientY - rect.top;

            if (isDrawing) {
                if (currentTool === 'eraser') {
                    updateBox(eraseBox, startX, startY, curX, curY);
                } else if (currentTool === 'line' || currentTool === 'bezier' || currentTool === 'quad' || currentTool === 'quartic') {
                    const len = Math.sqrt(Math.pow(curX - startX, 2) + Math.pow(curY - startY, 2));
                    const ang = Math.atan2(curY - startY, curX - startX) * 180 / Math.PI;
                    guideLine.style.width = len + 'px';
                    guideLine.style.transform = `rotate(${ang}deg)`;
                } else {
                    updateBox(guideBox, startX, startY, curX, curY);
                }
            } else if (isMoving) {
                const obj = findSelectedObj();
                const dx = curX - startX;
                const dy = curY - startY;
                
                if (selectedType === 'node' || selectedType === 'plot') {
                    obj.x = originalObj.x + dx;
                    obj.y = originalObj.y + dy;
                } else if (selectedType === 'edge') {
                    obj.x1 = originalObj.x1 + dx; obj.y1 = originalObj.y1 + dy;
                    obj.x2 = originalObj.x2 + dx; obj.y2 = originalObj.y2 + dy;
                } else if (selectedType === 'bezier') {
                    obj.x1 = originalObj.x1 + dx; obj.y1 = originalObj.y1 + dy;
                    obj.x2 = originalObj.x2 + dx; obj.y2 = originalObj.y2 + dy;
                    obj.cp1x = originalObj.cp1x + dx; obj.cp1y = originalObj.cp1y + dy;
                    obj.cp2x = originalObj.cp2x + dx; obj.cp2y = originalObj.cp2y + dy;
                } else if (selectedType === 'quad') {
                    obj.x1 = originalObj.x1 + dx; obj.y1 = originalObj.y1 + dy;
                    obj.x2 = originalObj.x2 + dx; obj.y2 = originalObj.y2 + dy;
                    obj.cpx = originalObj.cpx + dx; obj.cpy = originalObj.cpy + dy;
                } else if (selectedType === 'quartic') {
                    obj.x1 = originalObj.x1 + dx; obj.y1 = originalObj.y1 + dy;
                    obj.x2 = originalObj.x2 + dx; obj.y2 = originalObj.y2 + dy;
                    obj.cp1x = originalObj.cp1x + dx; obj.cp1y = originalObj.cp1y + dy;
                    obj.cp2x = originalObj.cp2x + dx; obj.cp2y = originalObj.cp2y + dy;
                    obj.cp3x = originalObj.cp3x + dx; obj.cp3y = originalObj.cp3y + dy;
                }
                render();
            } else if (isResizing) {
                const obj = findSelectedObj();
                if (selectedType === 'node') {
                    if (activeHandle === 'br') { obj.width = Math.max(10, curX - obj.x); obj.height = Math.max(10, curY - obj.y); }
                    else if (activeHandle === 'tl') { 
                        const nw = originalObj.width + (originalObj.x - curX);
                        const nh = originalObj.height + (originalObj.y - curY);
                        if (nw > 10) { obj.x = curX; obj.width = nw; }
                        if (nh > 10) { obj.y = curY; obj.height = nh; }
                    }
                } else if (selectedType === 'edge') {
                    if (activeHandle === 'start') { obj.x1 = curX; obj.y1 = curY; }
                    else { obj.x2 = curX; obj.y2 = curY; }
                } else if (selectedType === 'bezier') {
                    if (activeHandle === 'start') { obj.x1 = curX; obj.y1 = curY; }
                    else if (activeHandle === 'end') { obj.x2 = curX; obj.y2 = curY; }
                    else if (activeHandle === 'cp1') { obj.cp1x = curX; obj.cp1y = curY; }
                    else if (activeHandle === 'cp2') { obj.cp2x = curX; obj.cp2y = curY; }
                } else if (selectedType === 'quad') {
                    if (activeHandle === 'start') { obj.x1 = curX; obj.y1 = curY; }
                    else if (activeHandle === 'end') { obj.x2 = curX; obj.y2 = curY; }
                    else if (activeHandle === 'cp') { obj.cpx = curX; obj.cpy = curY; }
                } else if (selectedType === 'quartic') {
                    if (activeHandle === 'start') { obj.x1 = curX; obj.y1 = curY; }
                    else if (activeHandle === 'end') { obj.x2 = curX; obj.y2 = curY; }
                    else if (activeHandle === 'cp1') { obj.cp1x = curX; obj.cp1y = curY; }
                    else if (activeHandle === 'cp2') { obj.cp2x = curX; obj.cp2y = curY; }
                    else if (activeHandle === 'cp3') { obj.cp3x = curX; obj.cp3y = curY; }
                }
                render();
            }
        };

        window.onmouseup = (e) => {
            if (isDrawing) {
                const rect = canvas.getBoundingClientRect();
                const endX = e.clientX - rect.left;
                const endY = e.clientY - rect.top;

                if (currentTool === 'eraser') {
                    performAreaErase(Math.min(startX, endX), Math.min(startY, endY), Math.abs(endX - startX), Math.abs(endY - startY));
                } else if (currentTool === 'line') {
                    if (dist(startX, startY, endX, endY) > 5) {
                        const id = 'edge-' + Date.now();
                        edges.push({ id, x1: startX, y1: startY, x2: endX, y2: endY, style: 'solid', arrow: true, arrowCount: 1, arrowMode: 'forward', arrowFlipPoints: '0.5', color: '#64748b', thickness: 2 });
                        selectElement(id, 'edge');
                        saveHistory();
                    }
                } else if (currentTool === 'bezier') {
                    if (dist(startX, startY, endX, endY) > 5) {
                        const id = 'bezier-' + Date.now();
                        beziers.push({ 
                            id, x1: startX, y1: startY, x2: endX, y2: endY, 
                            cp1x: startX + (endX - startX) * 0.3, cp1y: startY + (endY - startY) * 0.3 - 50,
                            cp2x: startX + (endX - startX) * 0.7, cp2y: startY + (endY - startY) * 0.7 - 50,
                            color: '#64748b', thickness: 2, style: 'solid', arrow: true, arrowCount: 1, arrowMode: 'forward', arrowFlipPoints: '0.5'
                        });
                        selectElement(id, 'bezier');
                        saveHistory();
                    }
                } else if (currentTool === 'quad') {
                    if (dist(startX, startY, endX, endY) > 5) {
                        const id = 'quad-' + Date.now();
                        quadratics.push({ 
                            id, x1: startX, y1: startY, x2: endX, y2: endY, 
                            cpx: startX + (endX - startX) * 0.5, cpy: startY + (endY - startY) * 0.5 - 50,
                            color: '#64748b', thickness: 2, style: 'solid', arrow: true, arrowCount: 1, arrowMode: 'forward', arrowFlipPoints: '0.5'
                        });
                        selectElement(id, 'quad');
                        saveHistory();
                    }
                } else if (currentTool === 'quartic') {
                    if (dist(startX, startY, endX, endY) > 5) {
                        const id = 'quartic-' + Date.now();
                        const dx = endX - startX, dy = endY - startY;
                        quartics.push({ 
                            id, x1: startX, y1: startY, x2: endX, y2: endY, 
                            cp1x: startX + dx * 0.25, cp1y: startY + dy * 0.25 - 50,
                            cp2x: startX + dx * 0.5, cp2y: startY + dy * 0.5 + 50,
                            cp3x: startX + dx * 0.75, cp3y: startY + dy * 0.75 - 50,
                            color: '#64748b', thickness: 2, style: 'solid', arrow: true, arrowCount: 1, arrowMode: 'forward', arrowFlipPoints: '0.5'
                        });
                        selectElement(id, 'quartic');
                        saveHistory();
                    }
                } else if (currentTool === 'plot') {
                    const id = 'plot-' + Date.now();
                    plots.push({
                        id, x: startX, y: startY,
                        jsExpr: 'Math.sin(x)', tikzExpr: 'sin(\\x r)',
                        domainMin: -5, domainMax: 5, samples: 100,
                        color: '#ef4444', thickness: 2, style: 'solid'
                    });
                    selectElement(id, 'plot');
                    saveHistory();
                } else {
                    const w = Math.abs(endX - startX), h = Math.abs(endY - startY);
                    if (w > 5 && h > 5) {
                        const id = 'node-' + Date.now();
                        nodes.push({ id, type: currentTool, x: Math.min(startX, endX), y: Math.min(startY, endY), width: w, height: h, text: 'Node', color: '#64748b', fill: '#ffffff', opacity: 100, textColor: '#000000', fontSize: 14, thickness: 1, lineStyle: 'solid' });
                        selectElement(id, 'node');
                        saveHistory();
                    }
                }
            } else if (isMoving || isResizing) saveHistory();
            
            isDrawing = isMoving = isResizing = false;
            guideBox.style.display = guideLine.style.display = eraseBox.style.display = 'none';
            render();
        };

        function dist(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2)); }
        function updateBox(el, x1, y1, x2, y2) {
            el.style.left = Math.min(x1, x2) + 'px';
            el.style.top = Math.min(y1, y2) + 'px';
            el.style.width = Math.abs(x2 - x1) + 'px';
            el.style.height = Math.abs(y2 - y1) + 'px';
        }

        function findSelectedObj() {
            if (selectedType === 'node') return nodes.find(n => n.id === selectedId);
            if (selectedType === 'edge') return edges.find(e => e.id === selectedId);
            if (selectedType === 'bezier') return beziers.find(b => b.id === selectedId);
            if (selectedType === 'quad') return quadratics.find(q => q.id === selectedId);
            if (selectedType === 'quartic') return quartics.find(q => q.id === selectedId);
            if (selectedType === 'plot') return plots.find(p => p.id === selectedId);
            return null;
        }

        function performAreaErase(ex, ey, ew, eh) {
            const initialLen = nodes.length + edges.length + beziers.length + quadratics.length + quartics.length + plots.length;
            nodes = nodes.filter(n => !(n.x < ex + ew && n.x + n.width > ex && n.y < ey + eh && n.y + n.height > ey));
            edges = edges.filter(e => !((e.x1 >= ex && e.x1 <= ex+ew && e.y1 >= ey && e.y1 <= ey+eh) || (e.x2 >= ex && e.x2 <= ex+ew && e.y2 >= ey && e.y2 <= ey+eh)));
            beziers = beziers.filter(b => !((b.x1 >= ex && b.x1 <= ex+ew && b.y1 >= ey && b.y1 <= ey+eh) || (b.x2 >= ex && b.x2 <= ex+ew && b.y2 >= ey && b.y2 <= ey+eh)));
            quadratics = quadratics.filter(q => !((q.x1 >= ex && q.x1 <= ex+ew && q.y1 >= ey && q.y1 <= ey+eh) || (q.x2 >= ex && q.x2 <= ex+ew && q.y2 >= ey && q.y2 <= ey+eh)));
            quartics = quartics.filter(q => !((q.x1 >= ex && q.x1 <= ex+ew && q.y1 >= ey && q.y1 <= ey+eh) || (q.x2 >= ex && q.x2 <= ex+ew && q.y2 >= ey && q.y2 <= ey+eh)));
            plots = plots.filter(p => !(p.x >= ex && p.x <= ex+ew && p.y >= ey && p.y <= ey+eh));
            if (nodes.length + edges.length + beziers.length + quadratics.length + quartics.length + plots.length < initialLen) { saveHistory(); selectElement(null, null); }
        }

        function getArrowFlip(mode, t, ptsStr) {
            if (mode === 'forward') return false;
            if (mode === 'backward') return true;
            
            const pts = (ptsStr || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)).sort((a,b) => a-b);
            let flip = (mode === 'outward');
            for (let p of pts) { if (t > p) flip = !flip; }
            return flip;
        }

        function createArrowMarker(markerId, color) {
            const defs = svgLayer.querySelector('defs') || svgLayer.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "defs"));
            if (!document.getElementById(markerId)) {
                const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
                marker.setAttribute("id", markerId);
                marker.setAttribute("viewBox", "0 0 10 10");
                marker.setAttribute("refX", "9");
                marker.setAttribute("refY", "5");
                marker.setAttribute("markerWidth", "6");
                marker.setAttribute("markerHeight", "6");
                marker.setAttribute("orient", "auto-start-reverse");
                const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
                p.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
                p.setAttribute("fill", color);
                marker.appendChild(p);
                defs.appendChild(marker);
            }
        }

        function render() {
            canvas.querySelectorAll('.node-element, .connection-line, .handle, .control-handle').forEach(el => el.remove());
            svgLayer.innerHTML = '';

            edges.forEach(edge => {
                const len = dist(edge.x1, edge.y1, edge.x2, edge.y2), ang = Math.atan2(edge.y2-edge.y1, edge.x2-edge.x1)*180/Math.PI;
                const line = document.createElement('div');
                line.className = `connection-line ${selectedId === edge.id ? 'selected' : ''}`;
                line.dataset.id = edge.id;
                line.style.cssText = `width:${len}px;left:${edge.x1}px;top:${edge.y1}px;transform:rotate(${ang}deg);border-top:${edge.thickness}px ${edge.style} ${edge.color};`;
                if (edge.arrow) {
                    const count = edge.arrowCount || 1, mode = edge.arrowMode || 'forward', pts = edge.arrowFlipPoints || '0.5';
                    for (let i = 1; i <= count; i++) {
                        const arrow = document.createElement('div'), posRaw = i / count, pos = posRaw * 100;
                        arrow.className = 'arrow-head'; arrow.style.color = edge.color; arrow.style.borderLeftColor = edge.color;
                        arrow.style.left = `calc(${pos}% - 2px)`;
                        const flip = getArrowFlip(mode, posRaw, pts);
                        arrow.style.transform = `translateY(-50%) ${flip ? 'rotate(180deg)' : ''}`;
                        line.appendChild(arrow);
                    }
                }
                canvas.appendChild(line);
                if (selectedId === edge.id) { createHandle(edge.x1, edge.y1, 'start'); createHandle(edge.x2, edge.y2, 'end'); }
            });

            beziers.forEach(b => {
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", `M ${b.x1} ${b.y1} C ${b.cp1x} ${b.cp1y}, ${b.cp2x} ${b.cp2y}, ${b.x2} ${b.y2}`);
                path.setAttribute("stroke", b.color);
                path.setAttribute("stroke-width", b.thickness);
                path.setAttribute("stroke-dasharray", b.style === 'dashed' ? '5,5' : (b.style === 'dotted' ? '2,2' : 'none'));
                path.setAttribute("class", `bezier-path ${selectedId === b.id ? 'selected' : ''}`);
                path.dataset.id = b.id;
                
                if (b.arrow) {
                    const count = b.arrowCount || 1, mode = b.arrowMode || 'forward', pts = b.arrowFlipPoints || '0.5';
                    const markerId = `arrow-${b.id}`;
                    createArrowMarker(markerId, b.color);
                    
                    if (count === 1 && mode === 'forward' && !pts) {
                        path.setAttribute("marker-end", `url(#${markerId})`);
                    } else {
                        setTimeout(() => {
                          const totalLen = path.getTotalLength();
                          for (let i = 1; i <= count; i++) {
                              const posRaw = i / count, pos = posRaw * totalLen;
                              const point = path.getPointAtLength(pos), prevPoint = path.getPointAtLength(Math.max(0, pos - 1));
                              let angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * 180 / Math.PI;
                              if (getArrowFlip(mode, posRaw, pts)) angle += 180;

                              const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
                              arrow.setAttribute("d", "M -10 -5 L 0 0 L -10 5 z");
                              arrow.setAttribute("fill", b.color);
                              arrow.setAttribute("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);
                              arrow.setAttribute("class", "marker-arrow");
                              svgLayer.appendChild(arrow);
                          }
                        }, 0);
                    }
                }
                
                svgLayer.appendChild(path);

                if (selectedId === b.id) {
                    createHandle(b.x1, b.y1, 'start');
                    createHandle(b.x2, b.y2, 'end');
                    createControlHandle(b.cp1x, b.cp1y, 'cp1', b.x1, b.y1);
                    createControlHandle(b.cp2x, b.cp2y, 'cp2', b.x2, b.y2);
                }
            });

            quadratics.forEach(q => {
                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("d", `M ${q.x1} ${q.y1} Q ${q.cpx} ${q.cpy}, ${q.x2} ${q.y2}`);
                path.setAttribute("stroke", q.color);
                path.setAttribute("stroke-width", q.thickness);
                path.setAttribute("stroke-dasharray", q.style === 'dashed' ? '5,5' : (q.style === 'dotted' ? '2,2' : 'none'));
                path.setAttribute("class", `quad-path bezier-path ${selectedId === q.id ? 'selected' : ''}`);
                path.dataset.id = q.id;
                
                if (q.arrow) {
                    const count = q.arrowCount || 1, mode = q.arrowMode || 'forward', pts = q.arrowFlipPoints || '0.5';
                    const markerId = `arrow-${q.id}`;
                    createArrowMarker(markerId, q.color);
                    
                    if (count === 1 && mode === 'forward' && !pts) {
                        path.setAttribute("marker-end", `url(#${markerId})`);
                    } else {
                        setTimeout(() => {
                            const totalLen = path.getTotalLength();
                            for (let i = 1; i <= count; i++) {
                                const posRaw = i / count, pos = posRaw * totalLen;
                                const point = path.getPointAtLength(pos), prevPoint = path.getPointAtLength(Math.max(0, pos - 1));
                                let angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * 180 / Math.PI;
                                if (getArrowFlip(mode, posRaw, pts)) angle += 180;

                                const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                arrow.setAttribute("d", "M -10 -5 L 0 0 L -10 5 z");
                                arrow.setAttribute("fill", q.color);
                                arrow.setAttribute("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);
                                arrow.setAttribute("class", "marker-arrow");
                                svgLayer.appendChild(arrow);
                            }
                        }, 0);
                    }
                }
                
                svgLayer.appendChild(path);

                if (selectedId === q.id) {
                    createHandle(q.x1, q.y1, 'start');
                    createHandle(q.x2, q.y2, 'end');
                    createControlHandle(q.cpx, q.cpy, 'cp', q.x1, q.y1);
                    const line2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    line2.setAttribute("x1", q.cpx); line2.setAttribute("y1", q.cpy);
                    line2.setAttribute("x2", q.x2); line2.setAttribute("y2", q.y2);
                    line2.setAttribute("class", "control-line");
                    svgLayer.appendChild(line2);
                }
            });

            quartics.forEach(q => {
                let pathStr = '';
                for (let i = 0; i <= 40; i++) {
                    const t = i / 40;
                    const u = 1 - t;
                    const b0 = u*u*u*u, b1 = 4*u*u*u*t, b2 = 6*u*u*t*t, b3 = 4*u*t*t*t, b4 = t*t*t*t;
                    const px = b0*q.x1 + b1*q.cp1x + b2*q.cp2x + b3*q.cp3x + b4*q.x2;
                    const py = b0*q.y1 + b1*q.cp1y + b2*q.cp2y + b3*q.cp3y + b4*q.y2;
                    if (i === 0) pathStr += `M ${px} ${py} `;
                    else pathStr += `L ${px} ${py} `;
                }

                const pathObj = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pathObj.setAttribute("d", pathStr);
                pathObj.setAttribute("stroke", q.color);
                pathObj.setAttribute("stroke-width", q.thickness);
                pathObj.setAttribute("stroke-dasharray", q.style === 'dashed' ? '5,5' : (q.style === 'dotted' ? '2,2' : 'none'));
                pathObj.setAttribute("fill", "none");
                pathObj.setAttribute("class", `quartic-path bezier-path ${selectedId === q.id ? 'selected' : ''}`);
                pathObj.dataset.id = q.id;

                if (q.arrow) {
                    const count = q.arrowCount || 1, mode = q.arrowMode || 'forward', pts = q.arrowFlipPoints || '0.5';
                    const markerId = `arrow-${q.id}`;
                    createArrowMarker(markerId, q.color);
                    
                    if (count === 1 && mode === 'forward' && !pts) {
                        pathObj.setAttribute("marker-end", `url(#${markerId})`);
                    } else {
                        setTimeout(() => {
                            const totalLen = pathObj.getTotalLength();
                            for (let i = 1; i <= count; i++) {
                                const posRaw = i / count, pos = posRaw * totalLen;
                                const point = pathObj.getPointAtLength(pos), prevPoint = pathObj.getPointAtLength(Math.max(0, pos - 1));
                                let angle = Math.atan2(point.y - prevPoint.y, point.x - prevPoint.x) * 180 / Math.PI;
                                if (getArrowFlip(mode, posRaw, pts)) angle += 180;

                                const arrow = document.createElementNS("http://www.w3.org/2000/svg", "path");
                                arrow.setAttribute("d", "M -10 -5 L 0 0 L -10 5 z");
                                arrow.setAttribute("fill", q.color);
                                arrow.setAttribute("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);
                                arrow.setAttribute("class", "marker-arrow");
                                svgLayer.appendChild(arrow);
                            }
                        }, 0);
                    }
                }

                svgLayer.appendChild(pathObj);

                if (selectedId === q.id) {
                    createHandle(q.x1, q.y1, 'start');
                    createHandle(q.x2, q.y2, 'end');
                    createControlHandle(q.cp1x, q.cp1y, 'cp1', q.x1, q.y1);
                    createControlHandle(q.cp2x, q.cp2y, 'cp2', q.cp1x, q.cp1y);
                    createControlHandle(q.cp3x, q.cp3y, 'cp3', q.cp2x, q.cp2y);
                    const lineEnd = document.createElementNS("http://www.w3.org/2000/svg", "line");
                    lineEnd.setAttribute("x1", q.cp3x); lineEnd.setAttribute("y1", q.cp3y);
                    lineEnd.setAttribute("x2", q.x2); lineEnd.setAttribute("y2", q.y2);
                    lineEnd.setAttribute("class", "control-line");
                    svgLayer.appendChild(lineEnd);
                }
            });

            plots.forEach(p => {
                let pathStr = '';
                try {
                    const f = new Function('x', 'return ' + p.jsExpr);
                    const step = (p.domainMax - p.domainMin) / Math.max(1, p.samples);
                    let first = true;
                    for (let x = p.domainMin; x <= p.domainMax; x += step) {
                        const y = f(x);
                        if (isNaN(y) || !isFinite(y)) continue;
                        const px = p.x + x * 40;
                        const py = p.y - y * 40;
                        if (first) { pathStr += `M ${px} ${py} `; first = false; }
                        else { pathStr += `L ${px} ${py} `; }
                    }
                } catch (e) {}

                if (pathStr) {
                    const pathObj = document.createElementNS("http://www.w3.org/2000/svg", "path");
                    pathObj.setAttribute("d", pathStr);
                    pathObj.setAttribute("stroke", p.color);
                    pathObj.setAttribute("stroke-width", p.thickness);
                    pathObj.setAttribute("stroke-dasharray", p.style === 'dashed' ? '5,5' : (p.style === 'dotted' ? '2,2' : 'none'));
                    pathObj.setAttribute("fill", "none");
                    pathObj.setAttribute("class", `plot-path bezier-path ${selectedId === p.id ? 'selected' : ''}`);
                    pathObj.dataset.id = p.id;
                    svgLayer.appendChild(pathObj);
                }
                
                if (selectedId === p.id) {
                    createHandle(p.x, p.y, 'start');
                }
            });

            nodes.forEach(n => {
                const div = document.createElement('div');
                div.id = n.id;
                div.className = `node-element ${selectedId === n.id ? 'selected' : ''}`;
                div.style.cssText = `left:${n.x}px;top:${n.y}px;width:${n.width}px;height:${n.height}px;border-radius:${n.type==='circle'?'50%':'2px'};border:${n.thickness}px ${n.lineStyle} ${n.color};background-color:${n.fill};opacity:${n.opacity/100};color:${n.textColor};font-size:${n.fontSize}px;`;
                div.innerHTML = `<span>${n.text}</span>`;
                canvas.appendChild(div);
                if (selectedId === n.id) { createHandle(n.x, n.y, 'tl'); createHandle(n.x+n.width, n.y+n.height, 'br'); }
            });

            if (window.MathJax && window.MathJax.typesetPromise) MathJax.typesetPromise();
            generateTikZ();
        }

        function createHandle(x, y, type) {
            const h = document.createElement('div');
            h.className = 'handle';
            h.dataset.handle = type;
            h.style.left = (x-6)+'px'; h.style.top = (y-6)+'px';
            canvas.appendChild(h);
        }

        function createControlHandle(x, y, type, px, py) {
            const h = document.createElement('div');
            h.className = 'control-handle';
            h.dataset.handle = type;
            h.style.left = (x-5)+'px'; h.style.top = (y-5)+'px';
            canvas.appendChild(h);
            const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
            line.setAttribute("x1", px); line.setAttribute("y1", py);
            line.setAttribute("x2", x); line.setAttribute("y2", y);
            line.setAttribute("class", "control-line");
            svgLayer.appendChild(line);
        }

        function selectElement(id, type) {
            selectedId = id; selectedType = type;
            updatePropsPanel(findSelectedObj());
            render();
        }

        function updatePropsPanel(el) {
            if (!el) { propsPanel.innerHTML = `<div class="text-center py-10 text-slate-400 italic">Select an object to edit properties</div>`; return; }
            let common = `
                <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Color</label><input type="color" value="${el.color}" oninput="updateObj('color', this.value)" onchange="saveHistory()"></div>
                <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Thickness</label><input type="number" value="${el.thickness}" oninput="updateObj('thickness', parseInt(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Style</label><select onchange="updateObj('style', this.value); saveHistory();" class="w-full border p-1 rounded">
                    <option value="solid" ${el.style==='solid'?'selected':''}>Solid</option>
                    <option value="dashed" ${el.style==='dashed'?'selected':''}>Dashed</option>
                    <option value="dotted" ${el.style==='dotted'?'selected':''}>Dotted</option>
                </select></div>`;
            
            let html = '';
            if (selectedType === 'plot') {
                html = `<div class="grid grid-cols-2 gap-3">
                    <div class="col-span-2"><label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Preview Math (JS)</label><input type="text" value="${el.jsExpr}" oninput="updateObj('jsExpr', this.value)" onchange="saveHistory()" class="w-full border p-1 rounded font-mono text-xs"></div>
                    <div class="col-span-2"><label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Export Math (TikZ)</label><input type="text" value="${el.tikzExpr}" oninput="updateObj('tikzExpr', this.value)" onchange="saveHistory()" class="w-full border p-1 rounded font-mono text-xs"></div>
                    <div><label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Domain Min</label><input type="number" step="0.1" value="${el.domainMin}" oninput="updateObj('domainMin', parseFloat(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    <div><label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Domain Max</label><input type="number" step="0.1" value="${el.domainMax}" oninput="updateObj('domainMax', parseFloat(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    <div><label class="block text-[10px] font-bold uppercase text-slate-400 mb-1">Samples</label><input type="number" value="${el.samples}" oninput="updateObj('samples', parseInt(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    ${common}
                </div>`;
            } else if (selectedType === 'node') {
                html = `<div class="grid grid-cols-2 gap-3">
                    <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Text</label><input type="text" value="${el.text}" oninput="updateObj('text', this.value)" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Text Color</label><input type="color" value="${el.textColor}" oninput="updateObj('textColor', this.value)" onchange="saveHistory()"></div>
                    <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Font Size</label><input type="number" value="${el.fontSize}" oninput="updateObj('fontSize', parseInt(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Fill</label><input type="color" value="${el.fill}" oninput="updateObj('fill', this.value)" onchange="saveHistory()"></div>
                    <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Opacity</label><input type="number" value="${el.opacity}" oninput="updateObj('opacity', parseInt(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    ${common}
                </div>`;
            } else {
                html = `<div class="grid grid-cols-2 gap-3">
                    <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Arrow</label><input type="checkbox" ${el.arrow?'checked':''} onchange="updateObj('arrow', this.checked); saveHistory();" class="w-5 h-5"></div>
                    <div><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Count</label><input type="number" min="1" max="10" value="${el.arrowCount || 1}" oninput="updateObj('arrowCount', parseInt(this.value))" onchange="saveHistory()" class="w-full border p-1 rounded"></div>
                    <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Direction Mode</label>
                        <select onchange="updateObj('arrowMode', this.value); saveHistory();" class="w-full border p-1 rounded">
                            <option value="forward" ${el.arrowMode==='forward'?'selected':''}>Forward (Starts >)</option>
                            <option value="backward" ${el.arrowMode==='backward'?'selected':''}>Backward (Starts <)</option>
                            <option value="inward" ${el.arrowMode==='inward'?'selected':''}>Inward (Converge At First Flip)</option>
                            <option value="outward" ${el.arrowMode==='outward'?'selected':''}>Outward (Diverge At First Flip)</option>
                        </select>
                    </div>
                    <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Flip Points (comma separated, 0~1)</label>
                        <input type="text" value="${el.arrowFlipPoints || '0.5'}" oninput="updateObj('arrowFlipPoints', this.value)" onchange="saveHistory()" class="w-full border p-1 rounded font-mono text-xs" placeholder="e.g. 0.5 OR 0.3, 0.7">
                    </div>
                    <div class="col-span-2"><label class="block text-xs font-bold uppercase text-slate-400 mb-1">Quick Adj (0~1)</label><input type="range" min="0" max="1" step="0.01" value="${(el.arrowFlipPoints || '0.5').split(',')[0]}" oninput="updateObj('arrowFlipPoints', this.value)" onchange="saveHistory()" class="w-full"></div>
                    ${common}
                </div>`;
            }
            propsPanel.innerHTML = html + `<button onclick="deleteSelected()" class="w-full mt-4 py-2 bg-red-50 text-red-500 rounded border hover:bg-red-500 hover:text-white transition-all text-xs font-bold">DELETE</button>`;
        }

        function updateObj(k, v) { const obj = findSelectedObj(); if(obj) { obj[k] = v; render(); } }
        function deleteSelected() {
            if (selectedType === 'node') nodes = nodes.filter(n => n.id !== selectedId);
            else if (selectedType === 'edge') edges = edges.filter(e => e.id !== selectedId);
            else if (selectedType === 'bezier') beziers = beziers.filter(b => b.id !== selectedId);
            else if (selectedType === 'quad') quadratics = quadratics.filter(q => q.id !== selectedId);
            else if (selectedType === 'quartic') quartics = quartics.filter(q => q.id !== selectedId);
            else if (selectedType === 'plot') plots = plots.filter(p => p.id !== selectedId);
            selectElement(null, null); saveHistory();
        }

        function generateTikZ() {
            let needsMarkings = edges.some(e => e.arrow && e.arrowCount > 1) || 
                               beziers.some(b => b.arrow && b.arrowCount > 1) ||
                               quadratics.some(q => q.arrow && q.arrowCount > 1) ||
                               quartics.some(q => q.arrow && q.arrowCount > 1);
            
            let code = "";
            if (needsMarkings) {
                code += "% 선 내부에 여러 화살표를 그리려면 아래 라이브러리 추가가 필요합니다:\n";
                code += "% \\usetikzlibrary{decorations.markings}\n\n";
            }
            code += `\\begin{tikzpicture}\n`;
            nodes.forEach(n => {
                const tx = (n.x / 40).toFixed(2), ty = ((canvasH - n.y) / 40).toFixed(2);
                code += `  \\node[draw=${n.color}, fill=${n.fill}, ${n.type}, minimum width=${(n.width/40).toFixed(2)}cm, minimum height=${(n.height/40).toFixed(2)}cm, text=${n.textColor}, font=\\fontsize{${n.fontSize}}{${n.fontSize+2}}\\selectfont${n.opacity<100?', opacity='+(n.opacity/100):''}${n.lineStyle!=='solid'?', '+n.lineStyle:''}] at (${tx}, ${ty}) {${n.text}};\n`;
            });
            edges.forEach(e => {
                const x1 = (e.x1 / 40).toFixed(2), y1 = ((canvasH - e.y1) / 40).toFixed(2), x2 = (e.x2 / 40).toFixed(2), y2 = ((canvasH - e.y2) / 40).toFixed(2);
                let arrowStyle = e.arrow ? (e.arrowCount > 1 || e.arrowMode !== 'forward' || e.arrowFlipPoints ? '' : '->') : '-';
                let decoration = '';
                if (e.arrow && (e.arrowCount > 1 || e.arrowMode !== 'forward' || e.arrowFlipPoints)) {
                    let marks = [];
                    for (let i = 1; i <= e.arrowCount; i++) {
                        const posRaw = i / e.arrowCount;
                        const flip = getArrowFlip(e.arrowMode, posRaw, e.arrowFlipPoints);
                        marks.push(`mark=at position ${posRaw.toFixed(2)} with {\\arrow{${flip?'<':'>'}}}`);
                    }
                    decoration = `, postaction={decorate}, decoration={markings, ${marks.join(', ')}}`;
                }
                code += `  \\draw[${arrowStyle}, draw=${e.color}, line width=${(e.thickness/1.5).toFixed(1)}pt${e.style!=='solid'?', '+e.style:''}${decoration}] (${x1}, ${y1}) -- (${x2}, ${y2});\n`;
            });
            beziers.forEach(b => {
                const x1 = (b.x1 / 40).toFixed(2), y1 = ((canvasH - b.y1) / 40).toFixed(2), x2 = (b.x2 / 40).toFixed(2), y2 = ((canvasH - b.y2) / 40).toFixed(2);
                const c1x = (b.cp1x / 40).toFixed(2), c1y = ((canvasH - b.cp1y) / 40).toFixed(2), c2x = (b.cp2x / 40).toFixed(2), c2y = ((canvasH - b.cp2y) / 40).toFixed(2);
                let arrowStyle = b.arrow ? (b.arrowCount > 1 || b.arrowMode !== 'forward' || b.arrowFlipPoints ? '' : '->') : '-';
                let decoration = '';
                if (b.arrow && (b.arrowCount > 1 || b.arrowMode !== 'forward' || b.arrowFlipPoints)) {
                    let marks = [];
                    for (let i = 1; i <= b.arrowCount; i++) {
                        const posRaw = i / b.arrowCount;
                        const flip = getArrowFlip(b.arrowMode, posRaw, b.arrowFlipPoints);
                        marks.push(`mark=at position ${posRaw.toFixed(2)} with {\\arrow{${flip?'<':'>'}}}`);
                    }
                    decoration = `, postaction={decorate}, decoration={markings, ${marks.join(', ')}}`;
                }
                code += `  \\draw[${arrowStyle}, draw=${b.color}, line width=${(b.thickness/1.5).toFixed(1)}pt${b.style!=='solid'?', '+b.style:''}${decoration}] (${x1}, ${y1}) .. controls (${c1x}, ${c1y}) and (${c2x}, ${c2y}) .. (${x2}, ${y2});\n`;
            });
            quadratics.forEach(q => {
                const x1 = (q.x1 / 40).toFixed(2), y1 = ((canvasH - q.y1) / 40).toFixed(2), x2 = (q.x2 / 40).toFixed(2), y2 = ((canvasH - q.y2) / 40).toFixed(2);
                const cx = (q.cpx / 40).toFixed(2), cy = ((canvasH - q.cpy) / 40).toFixed(2);
                let arrowStyle = q.arrow ? (q.arrowCount > 1 || q.arrowMode !== 'forward' || q.arrowFlipPoints ? '' : '->') : '-';
                let decoration = '';
                if (q.arrow && (q.arrowCount > 1 || q.arrowMode !== 'forward' || q.arrowFlipPoints)) {
                    let marks = [];
                    for (let i = 1; i <= q.arrowCount; i++) {
                        const posRaw = i / q.arrowCount;
                        const flip = getArrowFlip(q.arrowMode, posRaw, q.arrowFlipPoints);
                        marks.push(`mark=at position ${posRaw.toFixed(2)} with {\\arrow{${flip?'<':'>'}}}`);
                    }
                    decoration = `, postaction={decorate}, decoration={markings, ${marks.join(', ')}}`;
                }
                code += `  \\draw[${arrowStyle}, draw=${q.color}, line width=${(q.thickness/1.5).toFixed(1)}pt${q.style!=='solid'?', '+q.style:''}${decoration}] (${x1}, ${y1}) .. controls (${cx}, ${cy}) .. (${x2}, ${y2});\n`;
            });
            quartics.forEach(q => {
                const x1 = (q.x1 / 40).toFixed(2), y1 = ((canvasH - q.y1) / 40).toFixed(2), x2 = (q.x2 / 40).toFixed(2), y2 = ((canvasH - q.y2) / 40).toFixed(2);
                const c1x = (q.cp1x / 40).toFixed(2), c1y = ((canvasH - q.cp1y) / 40).toFixed(2);
                const c2x = (q.cp2x / 40).toFixed(2), c2y = ((canvasH - q.cp2y) / 40).toFixed(2);
                const c3x = (q.cp3x / 40).toFixed(2), c3y = ((canvasH - q.cp3y) / 40).toFixed(2);

                let styleConfig = `draw=${q.color}, line width=${(q.thickness/1.5).toFixed(1)}pt`;
                if (q.style !== 'solid') styleConfig += `, ${q.style}`;
                
                let arrowStyle = q.arrow ? (q.arrowCount > 1 || q.arrowMode !== 'forward' || q.arrowFlipPoints ? '' : '->') : '-';
                let decoration = '';
                if (q.arrow && (q.arrowCount > 1 || q.arrowMode !== 'forward' || q.arrowFlipPoints)) {
                    let marks = [];
                    for (let i = 1; i <= q.arrowCount; i++) {
                        const posRaw = i / q.arrowCount;
                        const flip = getArrowFlip(q.arrowMode, posRaw, q.arrowFlipPoints);
                        marks.push(`mark=at position ${posRaw.toFixed(2)} with {\\arrow{${flip?'<':'>'}}}`);
                    }
                    decoration = `, postaction={decorate}, decoration={markings, ${marks.join(', ')}}`;
                }

                code += `  \\draw[${styleConfig}${arrowStyle!=='->'?'':', ->'}${decoration}] plot[domain=0:1, samples=40, variable=\\t] ( { (1-\\t)^4*(${x1}) + 4*(1-\\t)^3*\\t*(${c1x}) + 6*(1-\\t)^2*\\t^2*(${c2x}) + 4*(1-\\t)*\\t^3*(${c3x}) + \\t^4*(${x2}) }, { (1-\\t)^4*(${y1}) + 4*(1-\\t)^3*\\t*(${c1y}) + 6*(1-\\t)^2*\\t^2*(${c2y}) + 4*(1-\\t)*\\t^3*(${c3y}) + \\t^4*(${y2}) } );\n`;
            });
            plots.forEach(p => {
                const tx = (p.x / 40).toFixed(2), ty = ((canvasH - p.y) / 40).toFixed(2);
                let styleConfig = `draw=${p.color}, line width=${(p.thickness/1.5).toFixed(1)}pt`;
                if (p.style !== 'solid') styleConfig += `, ${p.style}`;
                code += `  \\begin{scope}[shift={(${tx}, ${ty})}]\n`;
                code += `    \\draw[${styleConfig}] plot[domain=${p.domainMin}:${p.domainMax}, samples=${p.samples}] (\\x, {${p.tikzExpr}});\n`;
                code += `  \\end{scope}\n`;
            });
            code += `\\end{tikzpicture}`;
            output.innerText = code;
        }

        async function saveToFile() {
            const data = JSON.stringify({ nodes, edges, beziers, quadratics, quartics, plots, canvasW, canvasH }, null, 2);
            try {
                if (window.showSaveFilePicker) {
                    const handle = await window.showSaveFilePicker({
                        suggestedName: `tikz_design_${Date.now()}.json`,
                        types: [{ description: 'JSON Files', accept: { 'application/json': ['.json'] } }]
                    });
                    const writable = await handle.createWritable();
                    await writable.write(data);
                    await writable.close();
                } else {
                    let fileName = prompt("파일 이름을 입력하세요 (확장자 제외):", `tikz_design_${Date.now()}`);
                    if (fileName === null) return;
                    if (!fileName.trim()) fileName = `tikz_design_${Date.now()}`;
                    const blob = new Blob([data], { type: 'application/json' });
                    const a = document.createElement('a'); 
                    a.href = URL.createObjectURL(blob); 
                    a.download = `${fileName}.json`; 
                    a.click();
                }
            } catch (error) {
                console.log('Save cancelled or failed:', error);
            }
        }

        function triggerFileLoad() { document.getElementById('file-input').click(); }
        function loadFromFile(event) {
            const file = event.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = (e) => { applyState(JSON.parse(e.target.result)); saveHistory(); };
            reader.readAsText(file);
        }

        function copyCode() {
            const el = document.createElement('textarea'); el.value = output.innerText; document.body.appendChild(el); el.select(); document.execCommand('copy'); document.body.removeChild(el);
        }

        window.addEventListener('keydown', (e) => {
            // 입력창(input, textarea)에서 타이핑 중일 때는 단축키를 무시
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return; 
            
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'z' && !e.shiftKey) { // Ctrl + Z
                    e.preventDefault();
                    undo();
                } else if (e.key === 'y' || (e.key === 'z' && e.shiftKey) || (e.key === 'Z' && e.shiftKey)) { // Ctrl + Y or Ctrl + Shift + Z
                    e.preventDefault();
                    redo();
                }
            } else if (e.key === 'Delete' || e.key === 'Backspace') { // Delete/Backspace
                if (selectedId) {
                    e.preventDefault();
                    deleteSelected();
                }
            }
        });

        window.addEventListener('load', () => {
            if (typeof lucide !== 'undefined') {
                lucide.createIcons();
            }
            saveHistory();
            render();
        });