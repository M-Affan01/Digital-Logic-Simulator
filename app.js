// DLD Circuit Simulator - Interactive Application Logic

const canvas = document.getElementById('circuit-canvas');
const ctx = canvas.getContext('2d');

const circuit = new Circuit();

// Canvas pan and zoom state
let scale = 1.0;
let panX = 0;
let panY = 0;
let isPanning = false;
let startPanX = 0;
let startPanY = 0;

// Dragging & Interaction State
let selectedNode = null;
let dragNode = null;
let dragOffsetX = 0;
let dragOffsetY = 0;

let connectingPort = null; // { nodeId, portType: 'in'|'out', portIdx }
let mousePos = { x: 0, y: 0 };

// Clock configuration
let clockIntervalId = null;
let isClockActive = false;

// Initialize layout size
function resizeCanvas() {
    canvas.width = canvas.parentElement.clientWidth;
    canvas.height = canvas.parentElement.clientHeight;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Helper to convert screen coordinates to Canvas world space
function screenToWorld(x, y) {
    return {
        x: (x - panX) / scale,
        y: (y - panY) / scale
    };
}

// Convert world space to screen coordinates (useful for finding bounds)
function worldToScreen(x, y) {
    return {
        x: x * scale + panX,
        y: y * scale + panY
    };
}

// Custom alert banner
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.querySelector('.toast-text').innerText = message;
    toast.classList.remove('hidden');
    setTimeout(() => {
        toast.classList.add('hidden');
    }, 4000);
}

// Node Sizes and Colors configuration
const componentStyles = {
    NOT: { width: 95, height: 55, color: 'rgba(0, 242, 254, 0.1)', border: '#00f2fe', text: 'NOT' },
    AND: { width: 105, height: 65, color: 'rgba(0, 242, 254, 0.1)', border: '#00f2fe', text: 'AND' },
    OR: { width: 105, height: 65, color: 'rgba(0, 242, 254, 0.1)', border: '#00f2fe', text: 'OR' },
    NAND: { width: 105, height: 65, color: 'rgba(0, 242, 254, 0.1)', border: '#00f2fe', text: 'NAND' },
    NOR: { width: 105, height: 65, color: 'rgba(0, 242, 254, 0.1)', border: '#00f2fe', text: 'NOR' },
    XOR: { width: 105, height: 65, color: 'rgba(0, 242, 254, 0.1)', border: '#00f2fe', text: 'XOR' },
    INPUT: { width: 120, height: 45, color: 'rgba(148, 163, 184, 0.15)', border: '#94a3b8', text: 'IN' },
    CLOCK: { width: 120, height: 45, color: 'rgba(185, 117, 255, 0.15)', border: '#b975ff', text: 'CLK' },
    OUTPUT: { width: 120, height: 45, color: 'rgba(251, 191, 36, 0.15)', border: '#fbbf24', text: 'OUT' },
    HALF_ADDER: { width: 130, height: 90, color: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: 'HALF ADD' },
    FULL_ADDER: { width: 140, height: 110, color: 'rgba(16, 185, 129, 0.1)', border: '#10b981', text: 'FULL ADD' },
    MUX: { width: 120, height: 100, color: 'rgba(251, 191, 36, 0.1)', border: '#fbbf24', text: 'MUX 2:1' },
    DEMUX: { width: 120, height: 100, color: 'rgba(251, 191, 36, 0.1)', border: '#fbbf24', text: 'DEMUX' },
    SR_FLIPFLOP: { width: 130, height: 110, color: 'rgba(185, 117, 255, 0.1)', border: '#b975ff', text: 'SR FF' },
    D_FLIPFLOP: { width: 130, height: 90, color: 'rgba(185, 117, 255, 0.1)', border: '#b975ff', text: 'D FF' },
    JK_FLIPFLOP: { width: 130, height: 110, color: 'rgba(185, 117, 255, 0.1)', border: '#b975ff', text: 'JK FF' }
};

// Return node's port world positions
function getNodePortPos(node, type, idx) {
    const style = componentStyles[node.type];
    const w = style.width;
    const h = style.height;
    
    if (type === 'in') {
        const count = node.inputs.length;
        const spacing = h / (count + 1);
        return {
            x: node.x,
            y: node.y + spacing * (idx + 1)
        };
    } else {
        const count = node.outputs.length;
        const spacing = h / (count + 1);
        return {
            x: node.x + w,
            y: node.y + spacing * (idx + 1)
        };
    }
}

// Find if mouse is hovering over any port of any node
function getPortAt(worldX, worldY) {
    const radius = 8;
    for (const node of circuit.nodes.values()) {
        // Inputs
        for (let i = 0; i < node.inputs.length; i++) {
            const pos = getNodePortPos(node, 'in', i);
            const dist = Math.hypot(pos.x - worldX, pos.y - worldY);
            if (dist <= radius) {
                return { nodeId: node.id, type: 'in', idx: i };
            }
        }
        // Outputs
        for (let i = 0; i < node.outputs.length; i++) {
            const pos = getNodePortPos(node, 'out', i);
            const dist = Math.hypot(pos.x - worldX, pos.y - worldY);
            if (dist <= radius) {
                return { nodeId: node.id, type: 'out', idx: i };
            }
        }
    }
    return null;
}

// Find if mouse is hovering over a node box
function getNodeAt(worldX, worldY) {
    for (const node of circuit.nodes.values()) {
        const style = componentStyles[node.type];
        if (worldX >= node.x && worldX <= node.x + style.width &&
            worldY >= node.y && worldY <= node.y + style.height) {
            return node;
        }
    }
    return null;
}

// Find if mouse is near a wire (for double-click delete)
function getWireAt(worldX, worldY) {
    const threshold = 6;
    for (let i = 0; i < circuit.wires.length; i++) {
        const w = circuit.wires[i];
        const fromNode = circuit.nodes.get(w.fromNodeId);
        const toNode = circuit.nodes.get(w.toNodeId);
        if (!fromNode || !toNode) continue;
        
        const p1 = getNodePortPos(fromNode, 'out', w.fromPortIdx);
        const p2 = getNodePortPos(toNode, 'in', w.toPortIdx);
        
        // Check distance to bezier curve approximation or straight line seg
        const midX = (p1.x + p2.x) / 2;
        const dist = Math.hypot(midX - worldX, ((p1.y + p2.y) / 2) - worldY);
        if (dist <= threshold + 20) {
            // Simplified check: bounding box or mid points
            return i;
        }
    }
    return -1;
}

// Render loop
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    
    // Apply pan and zoom
    ctx.translate(panX, panY);
    ctx.scale(scale, scale);

    // 1. Draw Wires (Edges)
    circuit.wires.forEach((w, idx) => {
        const fromNode = circuit.nodes.get(w.fromNodeId);
        const toNode = circuit.nodes.get(w.toNodeId);
        if (!fromNode || !toNode) return;

        const p1 = getNodePortPos(fromNode, 'out', w.fromPortIdx);
        const p2 = getNodePortPos(toNode, 'in', w.toPortIdx);

        // Neon Glow effect for high voltage wires
        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.bezierCurveTo(p1.x + 40, p1.y, p2.x - 40, p2.y, p2.x, p2.y);
        
        const isHigh = w.value === 1;
        ctx.strokeStyle = isHigh ? '#00f2fe' : '#334155';
        ctx.lineWidth = isHigh ? 3 : 2;
        
        if (isHigh) {
            ctx.shadowColor = 'rgba(0, 242, 254, 0.4)';
            ctx.shadowBlur = 8;
        } else {
            ctx.shadowBlur = 0;
        }
        ctx.stroke();
        ctx.shadowBlur = 0; // Reset shadow
    });

    // Draw active connecting wire (if user is dragging standard connection)
    if (connectingPort) {
        const startNode = circuit.nodes.get(connectingPort.nodeId);
        if (startNode) {
            const p1 = getNodePortPos(startNode, connectingPort.type, connectingPort.idx);
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.bezierCurveTo(p1.x + (connectingPort.type === 'out' ? 40 : -40), p1.y, mousePos.x, mousePos.y, mousePos.x, mousePos.y);
            ctx.strokeStyle = '#b975ff';
            ctx.lineWidth = 2.5;
            ctx.setLineDash([4, 4]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }

    // 2. Draw Nodes (Logic Gates & Blocks)
    for (const node of circuit.nodes.values()) {
        const style = componentStyles[node.type];
        const w = style.width;
        const h = style.height;

        // Custom styling if selected
        const isSelected = selectedNode === node;
        ctx.shadowColor = isSelected ? '#00f2fe' : 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = isSelected ? 12 : 8;

        // Glassmorphic Body
        const gradient = ctx.createLinearGradient(node.x, node.y, node.x, node.y + h);
        gradient.addColorStop(0, 'rgba(30, 41, 59, 0.85)');
        gradient.addColorStop(1, 'rgba(15, 23, 42, 0.95)');
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.roundRect(node.x, node.y, w, h, 8);
        ctx.fill();

        // Accent Borders
        ctx.strokeStyle = isSelected ? '#00f2fe' : style.border;
        ctx.lineWidth = isSelected ? 2 : 1.2;
        ctx.stroke();
        ctx.shadowBlur = 0; // reset shadow

        // Label / Text inside Gate
        ctx.fillStyle = isSelected ? '#00f2fe' : '#f1f5f9';
        ctx.font = 'bold 11px "Outfit"';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        
        let label = style.text;
        if (node.type === ComponentType.INPUT) {
            label = node.state.value === 1 ? 'SWITCH: 1' : 'SWITCH: 0';
        } else if (node.type === ComponentType.OUTPUT) {
            label = (node.inputs[0] || 0) === 1 ? '💡 LED: ON' : '💡 LED: OFF';
        } else if (node.type === ComponentType.CLOCK) {
            label = `CLK (${node.state.value})`;
        }
        
        ctx.fillText(label, node.x + w / 2, node.y + h / 2);

        // Render Input / Output Port Terminals
        const radius = 5;

        // Input Ports (drawn on left side of standard gates)
        node.inputs.forEach((inVal, idx) => {
            const pos = getNodePortPos(node, 'in', idx);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = inVal === 1 ? '#00f2fe' : '#1e293b';
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Port Label helpers for advanced circuits
            ctx.fillStyle = '#64748b';
            ctx.font = '8px "Space Grotesk"';
            ctx.textAlign = 'left';
            
            let pLabel = '';
            if (node.type === ComponentType.HALF_ADDER) {
                pLabel = idx === 0 ? 'A' : 'B';
            } else if (node.type === ComponentType.FULL_ADDER) {
                pLabel = idx === 0 ? 'A' : idx === 1 ? 'B' : 'Cin';
            } else if (node.type === ComponentType.MUX) {
                pLabel = idx === 0 ? 'I0' : idx === 1 ? 'I1' : 'S';
            } else if (node.type === ComponentType.DEMUX) {
                pLabel = idx === 0 ? 'I' : 'S';
            } else if (node.type === ComponentType.SR_FLIPFLOP) {
                pLabel = idx === 0 ? 'S' : idx === 1 ? 'R' : 'C';
            } else if (node.type === ComponentType.D_FLIPFLOP) {
                pLabel = idx === 0 ? 'D' : 'C';
            } else if (node.type === ComponentType.JK_FLIPFLOP) {
                pLabel = idx === 0 ? 'J' : idx === 1 ? 'K' : 'C';
            }
            if (pLabel) {
                ctx.fillText(pLabel, pos.x + 8, pos.y);
            }
        });

        // Output Ports (drawn on right side of standard gates)
        node.outputs.forEach((outVal, idx) => {
            const pos = getNodePortPos(node, 'out', idx);
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, radius, 0, Math.PI * 2);
            ctx.fillStyle = outVal === 1 ? '#00f2fe' : '#1e293b';
            ctx.fill();
            ctx.strokeStyle = '#94a3b8';
            ctx.lineWidth = 1.2;
            ctx.stroke();

            // Port Label helpers for advanced outputs
            ctx.fillStyle = '#64748b';
            ctx.font = '8px "Space Grotesk"';
            ctx.textAlign = 'right';

            let pLabel = '';
            if (node.type === ComponentType.HALF_ADDER || node.type === ComponentType.FULL_ADDER) {
                pLabel = idx === 0 ? 'S' : 'C';
            } else if (node.type === ComponentType.DEMUX) {
                pLabel = idx === 0 ? 'Y0' : 'Y1';
            } else if (node.type === ComponentType.SR_FLIPFLOP || node.type === ComponentType.D_FLIPFLOP || node.type === ComponentType.JK_FLIPFLOP) {
                pLabel = idx === 0 ? 'Q' : '~Q';
            }
            if (pLabel) {
                ctx.fillText(pLabel, pos.x - 8, pos.y);
            }
        });
    }

    ctx.restore();
    requestAnimationFrame(draw);
}

// 3. User Mouse / Touch Events
canvas.addEventListener('mousedown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Left click interactions
    if (e.button === 0) {
        // A. Port clicks to wire connect
        const port = getPortAt(world.x, world.y);
        if (port) {
            connectingPort = port;
            return;
        }

        // B. Node clicks to toggle inputs or drag
        const node = getNodeAt(world.x, world.y);
        if (node) {
            selectedNode = node;
            
            // Toggle click if toggle Switch
            if (node.type === ComponentType.INPUT) {
                node.state.value = node.state.value === 1 ? 0 : 1;
                circuit.tick();
            } else {
                dragNode = node;
                dragOffsetX = world.x - node.x;
                dragOffsetY = world.y - node.y;
            }
            return;
        }

        // C. Fallback: Pan viewport
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
    }
});

canvas.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    
    mousePos = screenToWorld(screenX, screenY);

    if (isPanning) {
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
    } else if (dragNode) {
        dragNode.x = mousePos.x - dragOffsetX;
        dragNode.y = mousePos.y - dragOffsetY;
    }
});

window.addEventListener('mouseup', (e) => {
    isPanning = false;
    dragNode = null;

    if (connectingPort) {
        const rect = canvas.getBoundingClientRect();
        const screenX = e.clientX - rect.left;
        const screenY = e.clientY - rect.top;
        const world = screenToWorld(screenX, screenY);
        
        const targetPort = getPortAt(world.x, world.y);
        
        if (targetPort && targetPort.nodeId !== connectingPort.nodeId) {
            // Confirm we are matching Input-to-Output correctly
            const isOutToIn = connectingPort.type === 'out' && targetPort.type === 'in';
            const isInToOut = connectingPort.type === 'in' && targetPort.type === 'out';

            if (isOutToIn || isInToOut) {
                const fromNode = isOutToIn ? connectingPort.nodeId : targetPort.nodeId;
                const fromPort = isOutToIn ? connectingPort.idx : targetPort.idx;
                const toNode = isOutToIn ? targetPort.nodeId : connectingPort.nodeId;
                const toPort = isOutToIn ? targetPort.idx : connectingPort.idx;

                try {
                    circuit.connect(fromNode, fromPort, toNode, toPort);
                    circuit.tick();
                } catch (err) {
                    showToast(err.message);
                }
            }
        }
        connectingPort = null;
    }
});

// Double click to delete nodes or wires
canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    // Try deleting node
    const node = getNodeAt(world.x, world.y);
    if (node) {
        circuit.deleteNode(node.id);
        selectedNode = null;
        circuit.tick();
        return;
    }

    // Try deleting wire
    const wireIndex = getWireAt(world.x, world.y);
    if (wireIndex !== -1) {
        circuit.disconnect(wireIndex);
        circuit.tick();
    }
});

// Keypress to delete selected component
window.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNode) {
        circuit.deleteNode(selectedNode.id);
        selectedNode = null;
        circuit.tick();
    }
});

// Drag and drop HTML components to spawn in canvas
canvas.addEventListener('dragover', (e) => {
    e.preventDefault();
});

canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const screenX = e.clientX - rect.left;
    const screenY = e.clientY - rect.top;
    const world = screenToWorld(screenX, screenY);

    const type = e.dataTransfer.getData('text/plain');
    if (type && componentStyles[type]) {
        circuit.addNode(type, world.x - componentStyles[type].width / 2, world.y - componentStyles[type].height / 2);
        circuit.tick();
    }
});

// Bind drag event on elements
document.querySelectorAll('.gate-item').forEach(item => {
    item.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', item.dataset.type);
    });
});

// 4. Action Buttons Control Handlers
document.getElementById('btn-play').addEventListener('click', () => {
    circuit.tick();
    showToast("Simulation running real-time propagation.");
});

document.getElementById('btn-clear').addEventListener('click', () => {
    circuit.nodes.clear();
    circuit.wires = [];
    selectedNode = null;
    circuit.tick();
    showToast("Canvas cleared.");
});

// Save & Load
document.getElementById('btn-save').addEventListener('click', () => {
    const data = {
        nodes: Array.from(circuit.nodes.values()),
        wires: circuit.wires
    };
    localStorage.setItem('quantum_circuit_save', JSON.stringify(data));
    showToast("Circuit saved to local storage.");
});

document.getElementById('btn-load').addEventListener('click', () => {
    const raw = localStorage.getItem('quantum_circuit_save');
    if (!raw) {
        showToast("No saved circuit state found.");
        return;
    }
    const data = JSON.parse(raw);
    circuit.nodes.clear();
    circuit.wires = [];

    data.nodes.forEach(n => {
        const node = circuit.addNode(n.type, n.x, n.y);
        node.id = n.id;
        node.state = n.state;
    });
    
    // Re-verify and rebuild wiring structures
    data.wires.forEach(w => {
        try {
            circuit.connect(w.fromNodeId, w.fromPortIdx, w.toNodeId, w.toPortIdx);
        } catch (err) {
            console.warn(err);
        }
    });

    circuit.tick();
    showToast("Circuit successfully loaded.");
});

// Zoom Controls
document.getElementById('zoom-in').addEventListener('click', () => { scale = Math.min(scale + 0.1, 2.5); });
document.getElementById('zoom-out').addEventListener('click', () => { scale = Math.max(scale - 0.1, 0.4); });
document.getElementById('zoom-reset').addEventListener('click', () => { scale = 1.0; panX = 0; panY = 0; });

// Clock pulser ticking
document.getElementById('btn-clock').addEventListener('click', () => {
    isClockActive = !isClockActive;
    const btn = document.getElementById('btn-clock');
    if (isClockActive) {
        btn.classList.add('active');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Clock Ticking';
        clockIntervalId = setInterval(() => {
            for (const node of circuit.nodes.values()) {
                if (node.type === ComponentType.CLOCK) {
                    node.state.value = node.state.value === 1 ? 0 : 1;
                }
            }
            circuit.tick();
        }, 1000);
    } else {
        btn.classList.remove('active');
        btn.innerHTML = '<i class="fa-solid fa-clock"></i> Toggle Clock';
        clearInterval(clockIntervalId);
    }
});

// 5. Drawer Tab Handling
document.querySelectorAll('.drawer-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        document.querySelectorAll('.drawer-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));

        tab.classList.add('active');
        document.getElementById(tab.dataset.target).classList.add('active');
    });
});

// Dynamic Truth Table Generator Trigger
document.getElementById('btn-generate-table').addEventListener('click', () => {
    const res = circuit.generateTruthTable();
    const container = document.getElementById('truth-table-container');
    
    if (res.error) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>${res.error}</p></div>`;
        return;
    }

    let html = '<table class="truth-table"><thead><tr>';
    res.headers.forEach(h => {
        html += `<th>${h}</th>`;
    });
    html += '</tr></thead><tbody>';

    res.rows.forEach(row => {
        html += '<tr>';
        row.forEach(val => {
            const glowClass = val === 1 ? 'val-high' : 'val-low';
            html += `<td><span class="${glowClass}">${val}</span></td>`;
        });
        html += '</tr>';
    });

    html += '</tbody></table>';
    container.innerHTML = html;
});

// Dynamic K-Map Generator Trigger
document.getElementById('btn-generate-kmap').addEventListener('click', () => {
    // Collect Inputs and evaluate a simple 2-variable mapping A & B
    const inputNodes = [];
    const outputNodes = [];
    for (const node of circuit.nodes.values()) {
        if (node.type === ComponentType.INPUT) inputNodes.push(node);
        if (node.type === ComponentType.OUTPUT) outputNodes.push(node);
    }

    const container = document.getElementById('kmap-container');

    if (inputNodes.length < 2) {
        container.innerHTML = `<div class="empty-state"><i class="fa-solid fa-triangle-exclamation"></i><p>Requires at least 2 Input Switches to render a K-Map.</p></div>`;
        return;
    }

    // Render 2x2 K-Map (2-inputs A & B)
    // Row: Input A, Col: Input B
    const savedStates = inputNodes.map(n => n.state.value);
    
    let html = '<div class="kmap-grid">';
    html += '<p style="font-size: 0.7rem; color: var(--text-secondary); margin-bottom: 0.5rem;">Rows: In A (0, 1) | Cols: In B (0, 1)</p>';
    
    for (let aVal = 0; aVal <= 1; aVal++) {
        html += '<div class="kmap-row">';
        for (let bVal = 0; bVal <= 1; bVal++) {
            inputNodes[0].state.value = aVal;
            inputNodes[1].state.value = bVal;
            circuit.tick();

            const outputValue = outputNodes.length > 0 ? (outputNodes[0].inputs[0] || 0) : 0;
            const glowClass = outputValue === 1 ? 'val-high' : 'val-low';
            const isActiveGroup = outputValue === 1 ? 'active-group' : '';

            html += `
                <div class="kmap-cell ${isActiveGroup}">
                    <span class="cell-val ${glowClass}">${outputValue}</span>
                    <span class="cell-coord">${aVal}${bVal}</span>
                </div>
            `;
        }
        html += '</div>';
    }
    html += '</div>';

    // Restore original inputs
    inputNodes.forEach((n, idx) => {
        n.state.value = savedStates[idx];
    });
    circuit.tick();

    container.innerHTML = html;
});

// 6. Sub-circuit Spawning Presets
document.getElementById('preset-half-adder').addEventListener('click', () => {
    circuit.nodes.clear();
    circuit.wires = [];

    const inA = circuit.addNode('INPUT', 50, 100);
    const inB = circuit.addNode('INPUT', 50, 200);

    const xorG = circuit.addNode('XOR', 200, 80);
    const andG = circuit.addNode('AND', 200, 220);

    const sumLED = circuit.addNode('OUTPUT', 380, 90);
    const carryLED = circuit.addNode('OUTPUT', 380, 230);

    // Make Connections
    circuit.connect(inA.id, 0, xorG.id, 0);
    circuit.connect(inB.id, 0, xorG.id, 1);

    circuit.connect(inA.id, 0, andG.id, 0);
    circuit.connect(inB.id, 0, andG.id, 1);

    circuit.connect(xorG.id, 0, sumLED.id, 0);
    circuit.connect(andG.id, 0, carryLED.id, 0);

    circuit.tick();
    showToast("Half Adder preset spawned.");
});

document.getElementById('preset-full-adder').addEventListener('click', () => {
    circuit.nodes.clear();
    circuit.wires = [];

    const fa = circuit.addNode('FULL_ADDER', 200, 120);
    const inA = circuit.addNode('INPUT', 50, 80);
    const inB = circuit.addNode('INPUT', 50, 150);
    const cin = circuit.addNode('INPUT', 50, 220);

    const sumLED = circuit.addNode('OUTPUT', 400, 100);
    const carryLED = circuit.addNode('OUTPUT', 400, 180);

    circuit.connect(inA.id, 0, fa.id, 0);
    circuit.connect(inB.id, 0, fa.id, 1);
    circuit.connect(cin.id, 0, fa.id, 2);

    circuit.connect(fa.id, 0, sumLED.id, 0);
    circuit.connect(fa.id, 1, carryLED.id, 0);

    circuit.tick();
    showToast("Full Adder preset block spawned.");
});

document.getElementById('preset-sr-latch').addEventListener('click', () => {
    circuit.nodes.clear();
    circuit.wires = [];

    const ff = circuit.addNode('SR_FLIPFLOP', 250, 100);
    const s = circuit.addNode('INPUT', 80, 80);
    const r = circuit.addNode('INPUT', 80, 150);
    const clk = circuit.addNode('CLOCK', 80, 220);

    const q = circuit.addNode('OUTPUT', 420, 90);
    const q_bar = circuit.addNode('OUTPUT', 420, 180);

    circuit.connect(s.id, 0, ff.id, 0);
    circuit.connect(r.id, 0, ff.id, 1);
    circuit.connect(clk.id, 0, ff.id, 2);

    circuit.connect(ff.id, 0, q.id, 0);
    circuit.connect(ff.id, 1, q_bar.id, 0);

    circuit.tick();
    showToast("SR Flip-Flop Circuit preset spawned.");
});

// Run
draw();
