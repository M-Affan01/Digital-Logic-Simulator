// DLD Circuit Simulator Logic Engine

class ComponentType {
    static INPUT = 'INPUT';
    static CLOCK = 'CLOCK';
    static OUTPUT = 'OUTPUT';
    static AND = 'AND';
    static OR = 'OR';
    static NOT = 'NOT';
    static NAND = 'NAND';
    static NOR = 'NOR';
    static XOR = 'XOR';
    static HALF_ADDER = 'HALF_ADDER';
    static FULL_ADDER = 'FULL_ADDER';
    static MUX = 'MUX';
    static DEMUX = 'DEMUX';
    static SR_FLIPFLOP = 'SR_FLIPFLOP';
    static D_FLIPFLOP = 'D_FLIPFLOP';
    static JK_FLIPFLOP = 'JK_FLIPFLOP';
}

class CircuitNode {
    constructor(id, type, x, y) {
        this.id = id;
        this.type = type;
        this.x = x;
        this.y = y;
        this.inputs = [];  // Array of input port values (0, 1, or null)
        this.outputs = []; // Array of output port values (0, 1, or null)
        this.state = {};   // For internal states (e.g. flip-flop Q/Q_bar, clock state, toggle state)
        
        this.initPorts();
    }

    initPorts() {
        switch (this.type) {
            case ComponentType.INPUT:
                this.inputs = [];
                this.outputs = [0];
                this.state.value = 0; // Default off
                break;
            case ComponentType.CLOCK:
                this.inputs = [];
                this.outputs = [0];
                this.state.value = 0;
                this.state.lastTick = Date.now();
                break;
            case ComponentType.OUTPUT:
                this.inputs = [0];
                this.outputs = [];
                break;
            case ComponentType.NOT:
                this.inputs = [0];
                this.outputs = [1];
                break;
            case ComponentType.AND:
            case ComponentType.OR:
            case ComponentType.NAND:
            case ComponentType.NOR:
            case ComponentType.XOR:
                this.inputs = [0, 0];
                this.outputs = [0];
                break;
            case ComponentType.HALF_ADDER:
                this.inputs = [0, 0]; // A, B
                this.outputs = [0, 0]; // Sum, Carry
                break;
            case ComponentType.FULL_ADDER:
                this.inputs = [0, 0, 0]; // A, B, Cin
                this.outputs = [0, 0]; // Sum, Cout
                break;
            case ComponentType.MUX:
                this.inputs = [0, 0, 0]; // I0, I1, S (Select)
                this.outputs = [0];
                break;
            case ComponentType.DEMUX:
                this.inputs = [0, 0]; // I, S (Select)
                this.outputs = [0, 0]; // Y0, Y1
                break;
            case ComponentType.SR_FLIPFLOP:
                this.inputs = [0, 0, 0]; // S, R, Clk
                this.outputs = [0, 1]; // Q, ~Q
                this.state.q = 0;
                this.state.prevClk = 0;
                break;
            case ComponentType.D_FLIPFLOP:
                this.inputs = [0, 0]; // D, Clk
                this.outputs = [0, 1]; // Q, ~Q
                this.state.q = 0;
                this.state.prevClk = 0;
                break;
            case ComponentType.JK_FLIPFLOP:
                this.inputs = [0, 0, 0]; // J, K, Clk
                this.outputs = [0, 1]; // Q, ~Q
                this.state.q = 0;
                this.state.prevClk = 0;
                break;
        }
    }

    // Evaluate outputs based on inputs
    evaluate() {
        const inVal = (idx) => this.inputs[idx] || 0;

        switch (this.type) {
            case ComponentType.INPUT:
                this.outputs[0] = this.state.value;
                break;
            case ComponentType.CLOCK:
                this.outputs[0] = this.state.value;
                break;
            case ComponentType.OUTPUT:
                // No outputs to write, just reads inputs[0]
                break;
            case ComponentType.NOT:
                this.outputs[0] = inVal(0) === 0 ? 1 : 0;
                break;
            case ComponentType.AND:
                this.outputs[0] = (inVal(0) && inVal(1)) ? 1 : 0;
                break;
            case ComponentType.OR:
                this.outputs[0] = (inVal(0) || inVal(1)) ? 1 : 0;
                break;
            case ComponentType.NAND:
                this.outputs[0] = (inVal(0) && inVal(1)) ? 0 : 1;
                break;
            case ComponentType.NOR:
                this.outputs[0] = (inVal(0) || inVal(1)) ? 0 : 1;
                break;
            case ComponentType.XOR:
                this.outputs[0] = (inVal(0) !== inVal(1)) ? 1 : 0;
                break;
            case ComponentType.HALF_ADDER: {
                const a = inVal(0);
                const b = inVal(1);
                this.outputs[0] = a ^ b; // Sum
                this.outputs[1] = a & b; // Carry
                break;
            }
            case ComponentType.FULL_ADDER: {
                const a = inVal(0);
                const b = inVal(1);
                const cin = inVal(2);
                this.outputs[0] = a ^ b ^ cin; // Sum
                this.outputs[1] = (a & b) | (cin & (a ^ b)); // Cout
                break;
            }
            case ComponentType.MUX: {
                const i0 = inVal(0);
                const i1 = inVal(1);
                const s = inVal(2);
                this.outputs[0] = s === 0 ? i0 : i1;
                break;
            }
            case ComponentType.DEMUX: {
                const i = inVal(0);
                const s = inVal(1);
                this.outputs[0] = s === 0 ? i : 0; // Y0
                this.outputs[1] = s === 1 ? i : 0; // Y1
                break;
            }
            case ComponentType.SR_FLIPFLOP: {
                const s = inVal(0);
                const r = inVal(1);
                const clk = inVal(2);
                // Positive edge trigger
                if (clk === 1 && this.state.prevClk === 0) {
                    if (s === 1 && r === 0) {
                        this.state.q = 1;
                    } else if (s === 0 && r === 1) {
                        this.state.q = 0;
                    } else if (s === 1 && r === 1) {
                        // Invalid state: SR both 1 in standard latch causes instability, let's toggle or set error (represented here as Q=1, ~Q=1 or toggle)
                        this.state.q = Math.random() > 0.5 ? 1 : 0;
                    }
                }
                this.state.prevClk = clk;
                this.outputs[0] = this.state.q;
                this.outputs[1] = this.state.q === 1 ? 0 : 1;
                break;
            }
            case ComponentType.D_FLIPFLOP: {
                const d = inVal(0);
                const clk = inVal(1);
                if (clk === 1 && this.state.prevClk === 0) {
                    this.state.q = d;
                }
                this.state.prevClk = clk;
                this.outputs[0] = this.state.q;
                this.outputs[1] = this.state.q === 1 ? 0 : 1;
                break;
            }
            case ComponentType.JK_FLIPFLOP: {
                const j = inVal(0);
                const k = inVal(1);
                const clk = inVal(2);
                if (clk === 1 && this.state.prevClk === 0) {
                    if (j === 1 && k === 0) {
                        this.state.q = 1;
                    } else if (j === 0 && k === 1) {
                        this.state.q = 0;
                    } else if (j === 1 && k === 1) {
                        this.state.q = this.state.q === 1 ? 0 : 1; // Toggle
                    }
                }
                this.state.prevClk = clk;
                this.outputs[0] = this.state.q;
                this.outputs[1] = this.state.q === 1 ? 0 : 1;
                break;
            }
        }
    }
}

class Circuit {
    constructor() {
        this.nodes = new Map(); // id -> CircuitNode
        this.wires = []; // Array of { fromNodeId, fromPortIdx, toNodeId, toPortIdx, value }
    }

    addNode(type, x, y) {
        const id = 'node_' + Math.random().toString(36).substr(2, 9);
        const node = new CircuitNode(id, type, x, y);
        this.nodes.set(id, node);
        return node;
    }

    deleteNode(id) {
        this.nodes.delete(id);
        this.wires = this.wires.filter(w => w.fromNodeId !== id && w.toNodeId !== id);
    }

    connect(fromNodeId, fromPortIdx, toNodeId, toPortIdx) {
        // Validate connections:
        // 1. Target port must not already be connected (no short circuit/multi-drive)
        const alreadyConnected = this.wires.some(w => w.toNodeId === toNodeId && w.toPortIdx === toPortIdx);
        if (alreadyConnected) {
            throw new Error("Target input port is already connected. Use a logic gate to combine inputs.");
        }

        // 2. Prevent self-connection (or simple immediate loops unless they are sequential flip-flops/clocks)
        if (fromNodeId === toNodeId) {
            throw new Error("Cannot connect a component's output to its own input directly.");
        }

        const wire = { fromNodeId, fromPortIdx, toNodeId, toPortIdx, value: 0 };
        this.wires.push(wire);
        return wire;
    }

    disconnect(wireIndex) {
        this.wires.splice(wireIndex, 1);
    }

    // Check for combinational cycle detection using DFS
    hasCombinationalCycle() {
        const adj = new Map();
        for (const [id, node] of this.nodes) {
            adj.set(id, []);
        }
        for (const w of this.wires) {
            const fromNode = this.nodes.get(w.fromNodeId);
            const toNode = this.nodes.get(w.toNodeId);
            // Flip-flops have memory and act as registers (they break direct combinational cycles at the Clock edge)
            const isSequential = [
                ComponentType.SR_FLIPFLOP, 
                ComponentType.D_FLIPFLOP, 
                ComponentType.JK_FLIPFLOP
            ].includes(toNode.type);

            if (!isSequential) {
                adj.get(w.fromNodeId).push(w.toNodeId);
            }
        }

        const visited = new Set();
        const recStack = new Set();

        const dfs = (curr) => {
            if (recStack.has(curr)) return true;
            if (visited.has(curr)) return false;

            visited.add(curr);
            recStack.add(curr);

            const neighbors = adj.get(curr) || [];
            for (const neighbor of neighbors) {
                if (dfs(neighbor)) return true;
            }

            recStack.delete(curr);
            return false;
        };

        for (const id of this.nodes.keys()) {
            if (dfs(id)) return true;
        }
        return false;
    }

    // Propagate simulation
    tick() {
        // Clear all inputs of non-driven gates
        for (const node of this.nodes.values()) {
            node.inputs.fill(0);
        }

        // Run multiple propagation cycles to let signals settle (especially for feedforward or basic loops)
        const maxIterations = 20;
        let changed = true;
        let iteration = 0;

        while (changed && iteration < maxIterations) {
            changed = false;
            
            // 1. Push outputs to inputs across wires
            for (const wire of this.wires) {
                const fromNode = this.nodes.get(wire.fromNodeId);
                const toNode = this.nodes.get(wire.toNodeId);
                if (fromNode && toNode) {
                    const outVal = fromNode.outputs[wire.fromPortIdx] || 0;
                    if (toNode.inputs[wire.toPortIdx] !== outVal) {
                        toNode.inputs[wire.toPortIdx] = outVal;
                        wire.value = outVal;
                        changed = true;
                    }
                }
            }

            // 2. Evaluate all nodes
            for (const node of this.nodes.values()) {
                const prevOutputs = [...node.outputs];
                node.evaluate();
                for (let i = 0; i < node.outputs.length; i++) {
                    if (node.outputs[i] !== prevOutputs[i]) {
                        changed = true;
                    }
                }
            }

            iteration++;
        }
    }

    // Build Boolean expression of a node recursively
    getExpressionOfNode(node, inputNames) {
        if (!node) return '0';
        if (node.type === ComponentType.INPUT) {
            return inputNames.get(node.id) || 'IN';
        }
        if (node.type === ComponentType.CLOCK) {
            return 'CLK';
        }
        
        // Find inputs driving this node
        const incomingWires = this.wires.filter(w => w.toNodeId === node.id);
        
        // Sort incoming by input port index to preserve order
        incomingWires.sort((a, b) => a.toPortIdx - b.toPortIdx);
        
        const subExprs = [];
        for (let i = 0; i < node.inputs.length; i++) {
            const wire = incomingWires.find(w => w.toPortIdx === i);
            if (wire) {
                const parentNode = this.nodes.get(wire.fromNodeId);
                subExprs.push(this.getExpressionOfNode(parentNode, inputNames));
            } else {
                subExprs.push('0'); // unconnected
            }
        }
        
        switch (node.type) {
            case ComponentType.NOT:
                return `NOT ${subExprs[0]}`;
            case ComponentType.AND:
                return `(${subExprs[0]} AND ${subExprs[1]})`;
            case ComponentType.OR:
                return `(${subExprs[0]} OR ${subExprs[1]})`;
            case ComponentType.NAND:
                return `(${subExprs[0]} NAND ${subExprs[1]})`;
            case ComponentType.NOR:
                return `(${subExprs[0]} NOR ${subExprs[1]})`;
            case ComponentType.XOR:
                return `(${subExprs[0]} XOR ${subExprs[1]})`;
            case ComponentType.OUTPUT: {
                const wire = incomingWires[0];
                if (wire) {
                    const parentNode = this.nodes.get(wire.fromNodeId);
                    return this.getExpressionOfNode(parentNode, inputNames);
                }
                return '0';
            }
            default:
                return node.type;
        }
    }

    // Generate complete Truth Table of current combinational circuit
    generateTruthTable() {
        // 1. Identify all primary INPUT nodes and OUTPUT nodes
        const inputNodes = [];
        let outputNodes = [];
        for (const node of this.nodes.values()) {
            if (node.type === ComponentType.INPUT) {
                inputNodes.push(node);
            } else if (node.type === ComponentType.OUTPUT) {
                outputNodes.push(node);
            }
        }

        // Fallback: If no explicit LED output bulbs are added, treat leaf gate nodes (no outgoing wires) as outputs
        if (outputNodes.length === 0) {
            const nodesWithOutgoing = new Set(this.wires.map(w => w.fromNodeId));
            for (const node of this.nodes.values()) {
                if (node.type !== ComponentType.INPUT && node.type !== ComponentType.CLOCK && !nodesWithOutgoing.has(node.id)) {
                    outputNodes.push(node);
                }
            }
        }

        if (inputNodes.length === 0) {
            return { error: "Add at least one Input Switch to generate a Truth Table." };
        }
        if (outputNodes.length === 0) {
            return { error: "Add at least one Logic Gate or Output LED bulb." };
        }
        if (inputNodes.length > 5) {
            return { error: "Truth Table supports up to 5 inputs for performance and readability." };
        }

        // Map inputs to letters (A, B, C...)
        const inputNames = new Map();
        inputNodes.forEach((n, idx) => {
            inputNames.set(n.id, String.fromCharCode(65 + idx));
        });

        const headers = [];
        inputNodes.forEach((n, i) => {
            headers.push(String.fromCharCode(65 + i)); // "A", "B", "C"
        });
        outputNodes.forEach((n, i) => {
            headers.push(this.getExpressionOfNode(n, inputNames));
        });

        const rows = [];

        // Save current input states
        const savedStates = inputNodes.map(n => n.state.value);

        const numCombinations = Math.pow(2, inputNodes.length);
        for (let i = 0; i < numCombinations; i++) {
            // Apply combination
            const rowValues = [];
            for (let j = 0; j < inputNodes.length; j++) {
                // MSB first
                const bitVal = (i >> (inputNodes.length - 1 - j)) & 1;
                inputNodes[j].state.value = bitVal;
                rowValues.push(bitVal);
            }

            // Tick circuit to stabilize
            this.tick();

            // Read output values
            for (const outNode of outputNodes) {
                if (outNode.type === ComponentType.OUTPUT) {
                    rowValues.push(outNode.inputs[0] || 0);
                } else {
                    rowValues.push(outNode.outputs[0] || 0);
                }
            }
            rows.push(rowValues);
        }

        // Restore original inputs
        inputNodes.forEach((n, idx) => {
            n.state.value = savedStates[idx];
        });
        this.tick();

        return { headers, rows };
    }
}
