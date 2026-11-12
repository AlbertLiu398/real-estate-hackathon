# FloorQi 🏠☯️

**Drop in a sales-brochure floorplan → get a walkable 3D model and an explainable Feng Shui score.**

London new-build flats are marketed heavily to buyers from Hong Kong, Singapore and mainland China, and for many of them Feng Shui affects whether they buy. Today an agent can't answer "is this layout good Feng Shui?" without calling in a consultant. FloorQi reads the floorplan page of a brochure, turns it into structured data, rebuilds it in 3D, and scores it with a transparent rule engine. Every point lost or gained points back to a specific room, door or window, and the 3D view highlights it.

```
Brochure PDF / floorplan image
        │  (1) Extract: vision LLM → structured JSON (rooms, dims, doors, windows, entrance, north arrow)
        ▼
  floorplan.json  ── the contract (docs/floorplan.schema.json)
        │
        ├──(2) 3D: extrude rooms & walls in three.js
        └──(3) Score: deterministic Feng Shui rules → findings[] (each cites rooms/openings)
                         │
                         └─ LLM writes the plain-English explanation + cheap remedies
```

## Hackathon track fit
- **Track 2, extracting structured data from documents.** This is the primary track: brochure floorplan → typed JSON.
- **Track 3, tracing every figure to its source.** Every score delta links to the geometry and rule behind it.
- We'll confirm the track at kick-off.

## Docs
- [`docs/PLAN.md`](docs/PLAN.md): scope, architecture, rules, team split, timeline, demo script
- [`docs/floorplan.schema.json`](docs/floorplan.schema.json): data contract shared by all workstreams
- [`data/samples/demo-2bed.json`](data/samples/demo-2bed.json): hand-annotated sample, used as a test fixture and demo fallback

## Setup
```bash
cp .env.example .env.local   # add your LLM key(s); never commit .env*
```

## Data
- `data/samples/demo-2bed.json`: hand-labelled test floor plan with expected findings
- `data/merino-court/`: Merino Court source data (listings, building model, IFC, floor plan SVGs); see its README

---

# Hackathon Prototypes - Merino Court

## Overview
Three interactive UI prototypes showcasing Merino Court property data at 152-154 Lever Street, London EC1V 8BG. All prototypes use real data from the `data/merino-court/` directory including Rightmove listings, sales history, EPC certificates, floor plans, and building information.

## Prototypes

### 1. 3D Interactive Building Viewer (Required Centerpiece)
**Location**: `prototypes/1-3d-viewer/`

An immersive 3D building visualization using Three.js and React Three Fiber. Users can orbit the building, select floors and units interactively, and view detailed information.

**Run Command**:
```bash
cd prototypes/1-3d-viewer
npm install
npm run dev
```
Opens at: http://localhost:3001

**Features**:
- 🏢 Interactive 3D building with floor-by-floor visualization
- 🎯 Click units to view detailed property information
- 📊 Sales history and pricing data
- 🏷️ EPC rating display
- 🗺️ Floor plan viewer (English & Chinese)
- 🌐 Bilingual support (EN/中文)

---

### 2. Unit Explorer & Comparison Dashboard
**Location**: `prototypes/2-unit-explorer/`

A buyer-facing property search and comparison tool designed for prospective purchasers to explore and compare units side-by-side.

**Run Command**:
```bash
cd prototypes/2-unit-explorer
npm install
npm run dev
```
Opens at: http://localhost:3002

**Features**:
- 🔍 Advanced filtering (bedrooms, floor, property type)
- 🏘️ Beautiful property cards with photos
- ⚖️ Side-by-side comparison (up to 3 units)
- 📈 Sales price history
- ⚡ EPC rating badges
- 🗺️ Floor plan preview
- 🌐 Bilingual interface (EN/中文)

---

### 3. Agent Brochure - Professional Property Showcase
**Location**: `prototypes/3-agent-brochure/`

A premium, luxury property brochure designed for estate agents to showcase Merino Court to high-end clients.

**Run Command**:
```bash
cd prototypes/3-agent-brochure
npm install
npm run dev
```
Opens at: http://localhost:3003

**Features**:
- 🎨 Luxury dark theme with premium typography
- 📸 Full-screen photo galleries with lightbox
- 📊 Market insights and statistics dashboard
- 🏛️ Building information and amenities
- 🎯 Property type filtering
- 🌐 Bilingual presentation (EN/中文)

---

## Quick Start - Run All Prototypes

```bash
# Terminal 1 - 3D Viewer
cd prototypes/1-3d-viewer && npm install && npm run dev

# Terminal 2 - Unit Explorer
cd prototypes/2-unit-explorer && npm install && npm run dev

# Terminal 3 - Agent Brochure
cd prototypes/3-agent-brochure && npm install && npm run dev
```

Then open:
- 3D Viewer: http://localhost:3001
- Unit Explorer: http://localhost:3002
- Agent Brochure: http://localhost:3003

## Technology Stack
- **Frontend Framework**: React 18
- **3D Graphics**: Three.js, React Three Fiber, @react-three/drei
- **Build Tool**: Vite 5
- **Styling**: Modern CSS with CSS Grid and Flexbox
- **Language Support**: English & Chinese (中文)
