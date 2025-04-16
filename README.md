# 🛣️ AccessAU: Accessible Route Finding

Welcome to **AccessAU**, an ongoing open-source project to make cities (starting with Golden, CO) more accessible. The project provides wheelchair-accessible walking directions, powered by real-time Street View analysis and custom routing on OpenStreetMap data. The name "AccessAU" reflects our goal: increasing access while tipping our hats to Gold(AU) — because it all started in Golden, Colorado!

## 🌍 Features

### 🔍 Smart, Street-Level Obstacle Detection
- Uses **Google Street View** to evaluate obstacles like **curbs without ramps or stairs** that are common in Golden and other cities.
- AI-powered analysis using **Groq's LLaMA vision models** to classify obstacles (0: clear, 1: obstacle).

### 🧭 Dynamic Accessible Directions
- Built with **OSMnx** and **NetworkX** to to build a weighted graph to find the shortest walking path given a users needs.
- Automatically **avoids locations with known accessibility obstacles**.
- Outputs detailed step-by-step directions, detecting **turns**, **distance**, and **street names**.

### 🗺️ Google Maps-Style Frontend 
- Zoom, pan, and click your way through an interactive map.
- Visualizes routes, obstacles, and street imagery.
- Syncs with the backend for real-time rerouting.

---

## 📁 Project Structure

### 📁Backend

### `streetviewprocessing.py` 
- Extracts street view images using Google Street View API.
- Analyzes each image using Groq's vision model to detect curb/stair obstacles.
- Stores results in `golden_obstacles.json` for routing to use.

### `shortestpath.py` 
- Computes the **shortest accessible path** given start/end coordinates.
- Outputs both coordinates for plotting and **natural-language directions**.
- Detects turns using bearing angles and intelligently names transitions.

### 📁Frontend


### 📁Mapapp
- Contains the basic react app that we currently use. 


---

## 🚀 Getting Started

### 🔧 Prerequisites
- Python 3.10+
- API Keys for:
  - Google Maps (for Street View)
  - Groq API (for AI-based image classification)

### 📦 Install Dependencies

```bash
pip install osmnx networkx pillow python-dotenv groq requests


