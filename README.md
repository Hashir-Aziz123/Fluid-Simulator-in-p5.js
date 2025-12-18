# Interactive Fluid & Fire Simulator

A real-time, grid-based physics engine built with **p5.js**.
This project visualizes fluid dynamics and combustion thermodynamics in an interactive web environment, designed to help students and developers build intuition for how fluids move and how fire behaves.

---

## Educational Goal

Fluid dynamics (Navier–Stokes equations) and thermodynamics are often abstract and mathematically dense. This simulator aims to make these ideas concrete by allowing users to:

* **Visualize the invisible**
  Observe how velocity fields transport density (smoke or dye) across the grid.

* **Experiment with real physics parameters**
  Adjust viscosity, diffusion, buoyancy, and damping to see immediate effects.

* **Compare physical systems**
  Switch between a standard fluid model (ink in water) and a reactive fire model to understand how heat and fuel change system behavior.

---

## Project Structure

The project follows a **Model–View–Controller (MVC)** architecture, separating physics, rendering, and interaction.

### `sketch.js` — Controller

* Manages the main simulation loop (`draw()`).
* Handles mouse interaction.
* Connects GUI sliders to physics parameters.

### `FluidBase.js` — Math Core

* Abstract base class implementing Jos Stam’s *Stable Fluids* solver.
* Core numerical steps:

  * Diffusion
  * Advection
  * Projection (incompressibility)

### `Fluid.js` — Fluid Model

* Extends `FluidBase`.
* Simulates passive transport of dye within a liquid.

### `Fire.js` — Fire Model

* Extends `FluidBase`.
* Adds combustion logic (fuel + heat).
* Implements buoyancy (hot air rises).
* Includes vorticity confinement for turbulence.

### `Renderer.js` — View

* Converts simulation data into pixels.
* Uses:

  * Density-based opacity for fluids
  * Heat-map gradients for fire

---

## Physics Overview

### 1. Fluid Solver (Navier–Stokes)

The simulation uses an **Eulerian grid**. Each frame consists of three main steps:

* **Diffusion**
  Models viscosity by spreading velocity and density to neighboring cells.

* **Advection**
  Moves fluid quantities using the velocity field itself.
  Backward advection is used for numerical stability.

* **Projection**
  Enforces incompressibility. Any fluid flowing into a cell must flow out, creating pressure and natural swirling motion.

---

### 2. Fire Dynamics

Fire adds thermodynamic behavior on top of fluid motion:

* **Combustion**
  Fuel burns only when temperature exceeds the ignition threshold.

* **Buoyancy**
  Heat counteracts gravity. Vertical velocity is increased proportionally to temperature.

* **Vorticity Confinement**
  Enhances small-scale turbulence by amplifying the curl of the velocity field, producing rolling flames and smoke.

---

## Controls and Parameters

All parameters are adjustable through a GUI panel.

### Global Physics

* **Viscosity**
  Controls fluid thickness.
  Low values resemble air or water, high values resemble syrup or honey.

* **Buoyancy (Fire only)**
  Controls how strongly hot air rises.

---

### Fluid Mode

* **Vorticity (Swirl)**
  Adds rotational motion. Higher values create stronger eddies.

* **Dye Amount**
  Amount of dye injected with the mouse.

* **Mouse Force**
  Strength of velocity applied during mouse interaction.

---

### Fire Mode

* **Fuel Amount**
  Quantity of burnable material added.

* **Ignition Heat**
  Temperature injected. Must exceed ignition temperature to trigger combustion.

* **Vorticity (Turbulence)**
  Controls flame chaos:

  * Low: smooth, laminar flames
  * High: turbulent, rolling fire

---

### Decay Parameters

* **Velocity Damping**
  Friction applied to velocity over time.

* **Density Fade**
  Rate at which smoke or dye dissipates.

* **Cooling Rate (Fire only)**
  Controls how quickly hot air cools:

  * Low: fire rises continuously
  * High: fire extinguishes quickly, forming realistic flame shapes

---

## Interaction

* **Left Click + Drag**

  * Fluid Mode: injects dye and velocity
  * Fire Mode: injects fuel, heat, and velocity (ignition)

* **Reset Simulation**

  * Clears the grid
  * Restores default stable parameters

---

## Summary

This project combines numerical fluid simulation with interactive visualization to provide an intuitive understanding of fluid motion and fire behavior. It is suitable for educational use, experimentation, and as a foundation for more advanced physics-based simulations.
