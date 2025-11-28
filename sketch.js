// ===== SIMULATION CONFIGURATION =====
const GRID_SIZE = 200;
const CELL_SCALE = 3;
const SOLVER_ITERATIONS = 4;

let fluidSimulation;
let renderBuffer;

// ===== SIMULATION PARAMETERS =====
const parameters = {
    // Fluid physics properties
    viscosity: 0.0000001,
    diffusion: 0.0000,
    dyeAmount: 250,
    mouseForce: 0.5,
    
    // Fire-specific physics
    buoyancy: 0.0,
    coolingRate: 0.99,
    turbulenceStrength: 0.5,
    
    // User interaction
    brushRadius: 3,
    
    // Simulation modes
    isFireMode: false,
    
    // Visual settings
    fluidColor: [200, 100, 255],
    showVelocityVectors: false,
    velocityVectorScale: 10,
    
    // Utility functions
    resetSimulation: function() {
        fluidSimulation = new Fluid(0.2, 0, 0.0000001);
    }
};

function setup() {
    const canvasSize = GRID_SIZE * CELL_SCALE;
    createCanvas(canvasSize, canvasSize);
    noStroke();
    frameRate(60);
    
    fluidSimulation = new Fluid(0.2, parameters.diffusion, parameters.viscosity);
    renderBuffer = createImage(GRID_SIZE, GRID_SIZE);
    
    initializeGUI();
}

let gui; // Make GUI accessible globally for updates

function initializeGUI() {
    gui = new dat.GUI();
    
    // Behavior controls
    const behaviorFolder = gui.addFolder('Behavior');
    behaviorFolder.add(parameters, 'isFireMode')
        .name("🔥 Fire Mode")
        .onChange(switchSimulationMode);
    behaviorFolder.add(parameters, 'buoyancy', 0, 0.10)
        .name("Buoyancy")
        .step(0.001)
        .listen();
    behaviorFolder.add(parameters, 'coolingRate', 0.80, 1.0)
        .name("Cooling")
        .step(0.01)
        .listen();
    behaviorFolder.add(parameters, 'turbulenceStrength', 0, 2.0)
        .name("Wind/Chaos")
        .step(0.1);
    behaviorFolder.open();

    // Interaction controls
    const interactionFolder = gui.addFolder('Interaction');
    interactionFolder.add(parameters, 'dyeAmount', 100, 1000)
        .name("Ink Amount");
    interactionFolder.add(parameters, 'brushRadius', 1, 10)
        .name("Brush Size")
        .step(1);
    interactionFolder.add(parameters, 'mouseForce', 0.1, 3.0)
        .name("Mouse Force");
    interactionFolder.open();

    // Visual controls
    const visualFolder = gui.addFolder('Visuals');
    visualFolder.addColor(parameters, 'fluidColor')
        .name("Fluid Color");
    visualFolder.add(parameters, 'showVelocityVectors')
        .name("Show Vectors");
    visualFolder.add(parameters, 'velocityVectorScale', 0, 100)
        .name("Arrow Size")
        .listen();
    
    gui.add(parameters, 'resetSimulation').name("Reset Fluid");
}

function switchSimulationMode() {
    if (parameters.isFireMode) {
        // Fire mode: hot, fast-moving, chaotic
        parameters.buoyancy = 0.08;
        parameters.coolingRate = 0.90;
        parameters.velocityVectorScale = 10;
        parameters.turbulenceStrength = 1.0;
    } else {
        // Fluid mode: calm, lingering, smooth
        parameters.buoyancy = 0.0;
        parameters.coolingRate = 0.99;
        parameters.velocityVectorScale = 50;
        parameters.turbulenceStrength = 0.0;
    }
    
    // Force GUI to update all controllers in all folders
    gui.__folders.Behavior.__controllers.forEach(controller => {
        controller.updateDisplay();
    });
    gui.__folders.Visuals.__controllers.forEach(controller => {
        controller.updateDisplay();
    });
}

function draw() {
    background(0);
    
    syncParametersToSimulation();
    
    if (parameters.turbulenceStrength > 0) {
        applyTurbulence();
    }
    
    processMouseInput();
    fluidSimulation.step();
    
    renderFluidDensity();
    
    if (parameters.showVelocityVectors) {
        renderVelocityField();
    }
    
    displayFrameRate();
}

function syncParametersToSimulation() {
    fluidSimulation.viscosity = parameters.viscosity;
    fluidSimulation.diffusion = parameters.diffusion;
    fluidSimulation.buoyancy = parameters.buoyancy;
    fluidSimulation.coolingRate = parameters.coolingRate;
}

function processMouseInput() {
    if (!mouseIsPressed) return;
    
    const gridX = floor(mouseX / CELL_SCALE);
    const gridY = floor(mouseY / CELL_SCALE);
    const radius = parameters.brushRadius;
    
    // Apply forces in a circular brush pattern
    for (let offsetX = -radius; offsetX <= radius; offsetX++) {
        for (let offsetY = -radius; offsetY <= radius; offsetY++) {
            const cellX = gridX + offsetX;
            const cellY = gridY + offsetY;
            
            // Check grid bounds and circular shape
            const isInsideGrid = cellX > 0 && cellX < GRID_SIZE - 1 && 
                                cellY > 0 && cellY < GRID_SIZE - 1;
            const isInsideCircle = offsetX * offsetX + offsetY * offsetY <= radius * radius;
            
            if (isInsideGrid && isInsideCircle) {
                const intensityVariation = random(0.5, 1.5);
                
                // Add visual dye/smoke
                fluidSimulation.addDensity(
                    cellX, 
                    cellY, 
                    parameters.dyeAmount * intensityVariation
                );
                
                // Add heat (only in fire mode)
                if (parameters.buoyancy > 0) {
                    fluidSimulation.addTemperature(
                        cellX, 
                        cellY, 
                        50 * intensityVariation
                    );
                }
                
                // Add velocity based on mouse movement
                const velocityX = movedX * parameters.mouseForce;
                const velocityY = movedY * parameters.mouseForce;
                
                // Add upward push for fire
                if (parameters.buoyancy > 0) {
                    const horizontalWiggle = random(-1, 1);
                    fluidSimulation.addVelocity(cellX, cellY, horizontalWiggle, -1);
                }
                
                fluidSimulation.addVelocity(cellX, cellY, velocityX, velocityY);
            }
        }
    }
}

function applyTurbulence() {
    const timeOffset = frameCount * 0.01;
    
    for (let y = 1; y < GRID_SIZE - 1; y++) {
        for (let x = 1; x < GRID_SIZE - 1; x++) {
            const index = getGridIndex(x, y);
            
            // Only apply wind to areas with existing density
            if (fluidSimulation.density[index] > 10) {
                const noiseValue = (noise(x * 0.1, y * 0.1, timeOffset) - 0.5);
                fluidSimulation.horizontalVelocity[index] += 
                    noiseValue * parameters.turbulenceStrength;
            }
        }
    }
}

function renderFluidDensity() {
    renderBuffer.loadPixels();
    
    const redChannel = parameters.fluidColor[0];
    const greenChannel = parameters.fluidColor[1];
    const blueChannel = parameters.fluidColor[2];
    
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            const densityValue = fluidSimulation.density[getGridIndex(x, y)];
            const pixelIndex = 4 * (x + y * GRID_SIZE);
            
            if (densityValue > 5) {
                if (parameters.isFireMode) {
                    // Fire has dynamic color based on temperature
                    let red, green, blue;
                    
                    if (densityValue > 200) {
                        // White-hot core
                        red = 255;
                        green = 255;
                        blue = (densityValue - 200) * 5;
                    } else if (densityValue > 100) {
                        // Yellow-orange flames
                        red = 255;
                        green = (densityValue - 100) * 2.5;
                        blue = 0;
                    } else {
                        // Red embers
                        red = densityValue * 2.5;
                        green = densityValue * 0.5;
                        blue = 0;
                    }
                    
                    renderBuffer.pixels[pixelIndex] = red;
                    renderBuffer.pixels[pixelIndex + 1] = green;
                    renderBuffer.pixels[pixelIndex + 2] = blue;
                    renderBuffer.pixels[pixelIndex + 3] = 255;
                } else {
                    // Fluid mode uses user-selected color with density-based opacity
                    renderBuffer.pixels[pixelIndex] = redChannel;
                    renderBuffer.pixels[pixelIndex + 1] = greenChannel;
                    renderBuffer.pixels[pixelIndex + 2] = blueChannel;
                    renderBuffer.pixels[pixelIndex + 3] = constrain(densityValue * 3, 0, 255);
                }
            } else {
                // Transparent for low density areas
                renderBuffer.pixels[pixelIndex + 3] = 0;
            }
        }
    }
    
    renderBuffer.updatePixels();
    image(renderBuffer, 0, 0, width, height);
}

function renderVelocityField() {
    const samplingStep = 10;
    
    stroke(255, 150);
    strokeWeight(1);
    noFill();
    
    for (let x = 0; x < GRID_SIZE; x += samplingStep) {
        for (let y = 0; y < GRID_SIZE; y += samplingStep) {
            const screenX = x * CELL_SCALE;
            const screenY = y * CELL_SCALE;
            const index = getGridIndex(x, y);
            
            const velocityX = fluidSimulation.horizontalVelocity[index];
            const velocityY = fluidSimulation.verticalVelocity[index];
            const magnitude = Math.sqrt(velocityX * velocityX + velocityY * velocityY);
            const scaledLength = magnitude * parameters.velocityVectorScale;
            
            if (scaledLength > 1) {
                const arrowLength = constrain(scaledLength, 2, 40);
                const angle = atan2(velocityY, velocityX);
                const arrowheadSize = 3;
                
                push();
                translate(screenX, screenY);
                rotate(angle);
                
                // Draw arrow shaft
                line(0, 0, arrowLength, 0);
                
                // Draw arrowhead
                line(arrowLength, 0, arrowLength - arrowheadSize, -arrowheadSize);
                line(arrowLength, 0, arrowLength - arrowheadSize, arrowheadSize);
                
                pop();
            }
        }
    }
}

function displayFrameRate() {
    fill(255);
    noStroke();
    text("FPS: " + floor(frameRate()), 10, 20);
}

function getGridIndex(x, y) {
    x = constrain(x, 0, GRID_SIZE + 1);
    y = constrain(y, 0, GRID_SIZE + 1);
    return x + (GRID_SIZE + 2) * y;
}