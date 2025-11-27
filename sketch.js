// --- CONFIGURATION ---
const N = 200;
const SCALE = 3;
const iter = 4;

let fluid;
let fluidImg;

// --- SETTINGS ---
let settings = {
    // Physics
    viscosity: 0.0000001,
    diffusion: 0.0000,
    dyeAmount: 250,
    force: 0.5,
    
    // Fire Physics
    buoyancy: 0.0,
    cooling: 0.99,
    turbulence: 0.5,
    
    // Modes
    fireMode: false,
    
    // Visuals
    color: [200, 255, 255],
    showVelocity: false, // <--- NEW TOGGLE
    vectorScale: 10,
    
    clear: function() {
        fluid = new Fluid(0.2, 0, 0.0000001);
        updateSimulationMode();
    }
};

function setup() {
    let canvasSize = N * SCALE;
    createCanvas(canvasSize, canvasSize);
    noStroke();
    frameRate(60);
    
    colorMode(HSB, 360, 100, 100, 1);

    fluid = new Fluid(0.2, settings.diffusion, settings.viscosity);

    // Create an empty image the same size as the simulation grid
    fluidImg = createImage(N, N); 

    // --- GUI ---
    let gui = new dat.GUI();
    
    let f1 = gui.addFolder('Behavior');
    f1.add(settings, 'fireMode').name("Rafeh On Fire Mode").onChange(updateSimulationMode);
    f1.add(settings, 'buoyancy', 0, 0.05).name("Buoyancy").listen();
    f1.add(settings, 'cooling', 0.90, 1.0).name("Cooling").listen();
    f1.add(settings, 'turbulence', 0, 2.0).name("Wind/Chaos");
    
    let f2 = gui.addFolder('Visuals');
    f2.addColor(settings, 'color').name("Fluid Color");
    f2.add(settings, 'showVelocity').name("Show Vectors");
    f2.add(settings, 'vectorScale', 0, 50).name("Arrow Size"); 
    f2.open();

    gui.add(settings, 'clear').name("Reset Fluid");
}

function updateSimulationMode() {
    if (settings.fireMode) {
        settings.buoyancy = 0.04;
        settings.cooling = 0.99;
        settings.vectorScale = 10; // Fire is fast, keep arrows normal
    } else {
        settings.buoyancy = 0.0;
        settings.cooling = 0.99;
        settings.vectorScale = 50; // Fluid is slow, magnify arrows x5
    }
}

function draw() {
    background(0);

    // 1. UPDATE ENGINE
    fluid.visc = settings.viscosity;
    fluid.diff = settings.diffusion;
    fluid.buoyancy = settings.buoyancy;
    fluid.cooling = settings.cooling;

    // 2. FIRE TURBULENCE
    if (settings.fireMode) {
        addFireTurbulence();
    }

    // 3. INTERACTION & STEP
    handleMouse();
    fluid.step();

    // 4. RENDER FLUID
    noStroke(); // Ensure no borders on fluid pixels
    renderFluid();

    // 5. RENDER VECTORS (Overlay)
    if (settings.showVelocity) {
        renderVelocityVectors();
    }
    
    // Debug FPS
    fill(255);
    noStroke();
    text("FPS: " + floor(frameRate()), 10, 20);
}

function renderVelocityVectors() {
    let step = 8; // Grid step (draw an arrow every 8 pixels)
    
    stroke(255, 150); // White with transparency
    strokeWeight(1);
    noFill();

    for (let i = 0; i < N; i += step) {
        for (let j = 0; j < N; j += step) {
            
            let x = i * SCALE;
            let y = j * SCALE;

            let index = IX(i, j);
            let vx = fluid.Vx[index];
            let vy = fluid.Vy[index];

            // Calculate the velocity magnitude (speed)
            // We use p5's dist() function or just manual math
            let len = Math.sqrt(vx * vx + vy * vy) * settings.vectorScale;

            // Only draw if the arrow is big enough to see (removes noise)
            if (len > 0.5) {
                // Limit max length so arrows don't overlap too much
                len = constrain(len, 2, SCALE * step);

                // Calculate angle of the wind
                let angle = atan2(vy, vx);

                push(); // 1. Save current drawing state
                translate(x, y); // 2. Move origin to the cell center
                rotate(angle);   // 3. Rotate the "paper" to match wind dir
                
                // 4. Draw the arrow shaft (Always straight along X axis now)
                line(0, 0, len, 0);
                
                // 5. Draw the arrow head (Two little lines at the tip)
                let arrowSize = 3;
                line(len, 0, len - arrowSize, -arrowSize);
                line(len, 0, len - arrowSize, arrowSize);
                
                pop(); // 6. Restore drawing state for next loop
            }
        }
    }
}

function addFireTurbulence() {
    let t = frameCount * 0.01;
    for (let j = 1; j < N - 1; j++) {
        for (let i = 1; i < N - 1; i++) {
            let index = IX(i, j);
            if (fluid.density[index] > 5) {
                let noiseVal = (noise(i * 0.1, j * 0.1, t) - 0.5); 
                fluid.Vx[index] += noiseVal * settings.turbulence;
            }
        }
    }
}

function renderFluid() {
    // 1. Prepare the buffer
    fluidImg.loadPixels();
    
    for (let i = 0; i < N; i++) {
        for (let j = 0; j < N; j++) {
            
            // Get density
            let d = fluid.density[IX(i, j)];
            
            // Pixel index in the image buffer
            // (p5.js images use a 1D array: [R, G, B, A, R, G, B, A...])
            let index = 4 * (i + j * N);
            
            if (d > 5) { // Only draw if visible
                let r, g, b;
                
                if (settings.fireMode) {
                    // --- FIRE MODE (Manual RGB mixing for speed) ---
                    // Density determines color: White -> Yellow -> Red -> Dark
                    
                    let bright = constrain(d, 0, 255);
                    
                    if (d > 200) {
                        // Core (White to Yellow)
                        r = 255; 
                        g = 255; 
                        b = (d - 200) * 5; // Blue tint adds whiteness
                    } else if (d > 100) {
                        // Mid (Yellow to Orange)
                        r = 255;
                        g = (d - 100) * 2.5; 
                        b = 0;
                    } else {
                        // Outer (Orange to Red)
                        r = d * 2.5; 
                        g = d * 0.5;
                        b = 0;
                    }
                    
                    // Set pixels
                    fluidImg.pixels[index] = r;     // Red
                    fluidImg.pixels[index + 1] = g; // Green
                    fluidImg.pixels[index + 2] = b; // Blue
                    fluidImg.pixels[index + 3] = 255; // Alpha (Fully Opaque)
                    
                } else {
                    // --- FLUID MODE ---
                    // Use a simple blue gradient based on density
                    
                    // Note: We are manually doing HSB->RGB approximate here for speed
                    // Blue-ish color
                    fluidImg.pixels[index] = 0;       // Red
                    fluidImg.pixels[index + 1] = d;   // Green (adds cyan/teal feel)
                    fluidImg.pixels[index + 2] = d * 2; // Blue (Strongest)
                    fluidImg.pixels[index + 3] = 255; // Alpha
                }
            } else {
                // Transparent if empty (Important!)
                fluidImg.pixels[index + 3] = 0; 
            }
        }
    }
    
    // 2. Update and Draw
    fluidImg.updatePixels();
    
    // Draw the tiny image stretched to fill the canvas
    // The browser automatically smooths the pixels!
    image(fluidImg, 0, 0, width, height);
}

function handleMouse() {
    if (mouseIsPressed) {
        let x = floor(mouseX / SCALE);
        let y = floor(mouseY / SCALE);
        let noiseAmt = random(0.8, 1.2); 
        fluid.addDensity(x, y, settings.dyeAmount * noiseAmt);
        
        let amtX = movedX * settings.force;
        let amtY = movedY * settings.force;
        
        if (settings.fireMode) {
             let wiggle = random(-1, 1);
             fluid.addVelocity(x, y, wiggle, -3); 
        }
        
        fluid.addVelocity(x, y, amtX, amtY);
    }
}

function IX(x, y) {
    x = constrain(x, 0, N + 1);
    y = constrain(y, 0, N + 1);
    return x + (N + 2) * y;
}