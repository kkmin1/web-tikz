/**
 * WTikZ Viewer Library
 * Use this to render .wtikz files in any web page.
 */

window.wtikz = {
    render: function(containerId, data) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const { nodes = [], edges = [], beziers = [], quadratics = [], quartics = [], plots = [], canvasW = 800, canvasH = 600 } = data;

        container.style.position = 'relative';
        container.style.width = canvasW + 'px';
        container.style.height = canvasH + 'px';
        container.style.overflow = 'hidden';
        container.classList.add('wtikz-container');

        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("width", "100%");
        svg.setAttribute("height", "100%");
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.pointerEvents = 'none';
        container.appendChild(svg);

        const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
        svg.appendChild(defs);

        function createArrowMarker(id, color) {
            if (document.getElementById(id)) return;
            const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
            marker.setAttribute("id", id);
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

        function getArrowFlip(mode, t, ptsStr) {
            if (mode === 'forward') return false;
            if (mode === 'backward') return true;
            const pts = (ptsStr || '').split(',').map(s => parseFloat(s.trim())).filter(n => !isNaN(n)).sort((a,b) => a-b);
            let flip = (mode === 'outward');
            for (let p of pts) { if (t > p) flip = !flip; }
            return flip;
        }

        function dist(x1, y1, x2, y2) { return Math.sqrt(Math.pow(x2-x1, 2) + Math.pow(y2-y1, 2)); }

        // Render Edges (Lines)
        edges.forEach(edge => {
            const len = dist(edge.x1, edge.y1, edge.x2, edge.y2), ang = Math.atan2(edge.y2-edge.y1, edge.x2-edge.x1)*180/Math.PI;
            const line = document.createElement('div');
            line.style.cssText = `position:absolute;width:${len}px;left:${edge.x1}px;top:${edge.y1}px;transform-origin:0 0;transform:rotate(${ang}deg);border-top:${edge.thickness}px ${edge.style} ${edge.color};`;
            if (edge.arrow) {
                const count = edge.arrowCount || 1, mode = edge.arrowMode || 'forward', pts = edge.arrowFlipPoints || '0.5';
                for (let i = 1; i <= count; i++) {
                    const arrow = document.createElement('div');
                    const posRaw = i / count, pos = posRaw * 100;
                    arrow.style.cssText = `position:absolute;width:0;height:0;border-top:5px solid transparent;border-bottom:5px solid transparent;border-left:8px solid ${edge.color};left:calc(${pos}% - 2px);top:50%;`;
                    const flip = getArrowFlip(mode, posRaw, pts);
                    arrow.style.transform = `translateY(-50%) ${flip ? 'rotate(180deg)' : ''}`;
                    line.appendChild(arrow);
                }
            }
            container.appendChild(line);
        });

        // Helper for SVG paths
        function renderPath(type, obj) {
            const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
            let d = '';
            if (type === 'bezier') d = `M ${obj.x1} ${obj.y1} C ${obj.cp1x} ${obj.cp1y}, ${obj.cp2x} ${obj.cp2y}, ${obj.x2} ${obj.y2}`;
            else if (type === 'quad') d = `M ${obj.x1} ${obj.y1} Q ${obj.cpx} ${obj.cpy}, ${obj.x2} ${obj.y2}`;
            else if (type === 'quartic') {
                for (let i = 0; i <= 40; i++) {
                    const t = i / 40, u = 1 - t;
                    const b0 = u*u*u*u, b1 = 4*u*u*u*t, b2 = 6*u*u*t*t, b3 = 4*u*t*t*t, b4 = t*t*t*t;
                    const px = b0*obj.x1 + b1*obj.cp1x + b2*obj.cp2x + b3*obj.cp3x + b4*obj.x2;
                    const py = b0*obj.y1 + b1*obj.cp1y + b2*obj.cp2y + b3*obj.cp3y + b4*obj.y2;
                    if (i === 0) d += `M ${px} ${py} `; else d += `L ${px} ${py} `;
                }
            }
            path.setAttribute("d", d);
            path.setAttribute("stroke", obj.color);
            path.setAttribute("stroke-width", obj.thickness);
            path.setAttribute("fill", "none");
            path.setAttribute("stroke-dasharray", obj.style === 'dashed' ? '5,5' : (obj.style === 'dotted' ? '2,2' : 'none'));
            
            if (obj.arrow) {
                const count = obj.arrowCount || 1, mode = obj.arrowMode || 'forward', pts = obj.arrowFlipPoints || '0.5';
                const markerId = `arrow-${Math.random().toString(36).substr(2, 9)}`;
                createArrowMarker(markerId, obj.color);
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
                            arrow.setAttribute("fill", obj.color);
                            arrow.setAttribute("transform", `translate(${point.x}, ${point.y}) rotate(${angle})`);
                            svg.appendChild(arrow);
                        }
                    }, 0);
                }
            }
            svg.appendChild(path);
        }

        beziers.forEach(b => renderPath('bezier', b));
        quadratics.forEach(q => renderPath('quad', q));
        quartics.forEach(q => renderPath('quartic', q));

        // Plots
        plots.forEach(p => {
            let pathStr = '';
            try {
                const f = new Function('x', 'return ' + p.jsExpr);
                const step = (p.domainMax - p.domainMin) / Math.max(1, p.samples);
                for (let x = p.domainMin; x <= p.domainMax; x += step) {
                    const y = f(x);
                    if (isNaN(y) || !isFinite(y)) continue;
                    const px = p.x + x * 40, py = p.y - y * 40;
                    if (pathStr === '') pathStr += `M ${px} ${py} `; else pathStr += `L ${px} ${py} `;
                }
            } catch (e) {}
            if (pathStr) {
                const pathObj = document.createElementNS("http://www.w3.org/2000/svg", "path");
                pathObj.setAttribute("d", pathStr);
                pathObj.setAttribute("stroke", p.color);
                pathObj.setAttribute("stroke-width", p.thickness);
                pathObj.setAttribute("fill", "none");
                pathObj.setAttribute("stroke-dasharray", p.style === 'dashed' ? '5,5' : (p.style === 'dotted' ? '2,2' : 'none'));
                svg.appendChild(pathObj);
            }
        });

        // Nodes
        nodes.forEach(n => {
            const div = document.createElement('div');
            div.style.cssText = `position:absolute;left:${n.x}px;top:${n.y}px;width:${n.width}px;height:${n.height}px;border-radius:${n.type==='circle'?'50%':'2px'};border:${n.thickness}px ${n.lineStyle} ${n.color};background-color:${n.fill};opacity:${n.opacity/100};color:${n.textColor};font-size:${n.fontSize}px;display:flex;align-items:center;justify-content:center;`;
            div.innerHTML = `<span>${n.text}</span>`;
            container.appendChild(div);
        });

        if (window.MathJax && window.MathJax.typesetPromise) MathJax.typesetPromise([container]);
    },
    
    loadAndRender: function(containerId, url) {
        fetch(url)
            .then(res => res.json())
            .then(data => this.render(containerId, data))
            .catch(err => console.error("WTikZ Load Error:", err));
    }
};

// --- Custom Web Component ---
class WTikZImage extends HTMLElement {
    constructor() {
        super();
    }
    connectedCallback() {
        const src = this.getAttribute('src');
        const width = this.getAttribute('width') || '100%';
        const height = this.getAttribute('height') || '400px';
        
        // Setup initial container style
        this.style.display = 'block';
        this.style.width = width;
        this.style.height = height;
        this.style.overflow = 'hidden';
        this.style.border = this.getAttribute('border') || 'none';
        
        if (!this.id) this.id = 'wtikz-' + Math.random().toString(36).substr(2, 9);
        
        if (src) {
            wtikz.loadAndRender(this.id, src);
        }
    }
    static get observedAttributes() { return ['src']; }
    attributeChangedCallback(name, oldVal, newVal) {
        if (name === 'src' && oldVal !== newVal && this.isConnected) {
            this.innerHTML = ''; // Clear previous
            wtikz.loadAndRender(this.id, newVal);
        }
    }
}
customElements.define('wtikz-image', WTikZImage);
