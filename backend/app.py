from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi import Request
from shortestpath import find_shortest_path
import osmnx as ox
import traceback
app = FastAPI()

# Allow CORS for all origins
origins = [
    "http://localhost:3002",
    "https://your-production-domain.com",
]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.post("/api/accessible_route")
async def get_accessible_route(request: Request):
    data = await request.json()
    origin = data.get("origin")
    destination = data.get("destination")
    elevation_pref = data.get("elevation_pref")
    obstacle_pref = data.get("obstacle_pref")

    print(destination, origin, elevation_pref, obstacle_pref)

    G = ox.load_graphml(f'./graphs/golden_graph_with_elevation_and_obstacles_userpref_{elevation_pref}_avoid_{obstacle_pref}.graphml')
    
    try:    
        route_data = find_shortest_path(G, origin, destination)
        print("Route calculated with directions")
        return {
            "route": route_data["coordinates"],
            "directions": route_data["directions"]
        }
    
    except Exception as e:
    
        error_traceback = traceback.format_exc()
        print("Error occurred:")
        print(error_traceback)
        return {
            "error": error_traceback
        }