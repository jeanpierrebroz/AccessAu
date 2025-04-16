import osmnx as ox
import networkx as nx
import numpy as np
import math


def find_shortest_path(G, start_coordinates, end_coordinates):
    # Find the nearest nodes to the start and end coordinates
    start_node = ox.distance.nearest_nodes(G, start_coordinates[1], start_coordinates[0])
    end_node = ox.distance.nearest_nodes(G, end_coordinates[1], end_coordinates[0])

    # Find the shortest path
    shortest_path = nx.shortest_path(G, source=start_node, target=end_node, weight='length')
    coordinates = [(G.nodes[node]['y'], G.nodes[node]['x']) for node in shortest_path]
    
    # Generate directions
    directions = generate_directions(G, shortest_path)
    
    return {
        "coordinates": coordinates,
        "directions": directions
    }

def generate_directions(G, path):
    directions = []
    
    if len(path) < 2:
        return directions
    
    # Initial step
    start_node = path[0]
    
    # Handle MultiDiGraph - get first edge attributes between nodes
    edge_data = None
    if G.has_edge(path[0], path[1]):
        # For MultiDiGraph, get the first edge's attributes
        edge_data = list(G.get_edge_data(path[0], path[1]).values())[0]
    
    current_street = edge_data.get('name', 'sidewalk') if edge_data else 'sidewalk'
    
    # Format initial direction
    directions.append({
        "text": f"Start on {current_street}",
        "distance": 0,
        "node_index": 0
    })
    
    accumulated_distance = 0
    last_direction_index = 0
    
    # Track previous bearings to detect direction changes
    last_bearing = None
    
    for i in range(1, len(path)-1):
        # Get edge data safely for both edge types
        edge1_data = None
        edge2_data = None
        
        if G.has_edge(path[i-1], path[i]):
            edge1_data = list(G.get_edge_data(path[i-1], path[i]).values())[0]
        
        if G.has_edge(path[i], path[i+1]):
            edge2_data = list(G.get_edge_data(path[i], path[i+1]).values())[0]
        
        prev_street = edge1_data.get('name', 'sidewalk') if edge1_data else 'sidewalk'
        next_street = edge2_data.get('name', 'sidewalk') if edge2_data else 'sidewalk'
        
        # Calculate edge length
        if edge1_data and 'length' in edge1_data:
            accumulated_distance += edge1_data.get('length', 0)
        
        # Calculate bearings and check for direction change
        prev_coords = (G.nodes[path[i-1]]['y'], G.nodes[path[i-1]]['x'])
        current_coords = (G.nodes[path[i]]['y'], G.nodes[path[i]]['x'])
        next_coords = (G.nodes[path[i+1]]['y'], G.nodes[path[i+1]]['x'])
        
        current_bearing = calculate_bearing(current_coords, next_coords)
        
        # Check for significant bearing change or street name change
        is_direction_change = False
        if last_bearing is not None:
            angle_diff = ((current_bearing - last_bearing + 180) % 360) - 180
            is_direction_change = abs(angle_diff) > 25  # Adjust this threshold as needed
        
        if prev_street != next_street or is_direction_change:
            turn_direction = get_turn_direction(prev_coords, current_coords, next_coords)
            
            # Don't add "Continue straight" directions if the street name is the same
            if not (turn_direction == "Continue straight" and prev_street == next_street):
                # Add distance to previous direction
                if len(directions) > 0:
                    directions[last_direction_index]["distance"] = round(accumulated_distance)
                
                # Create new direction text based on whether it's a new street or just a turn
                direction_text = ""
                if prev_street != next_street:
                    direction_text = f"{turn_direction} onto {next_street}"
                else:
                    direction_text = f"{turn_direction} on {next_street}"
                
                # Create new direction
                directions.append({
                    "text": direction_text,
                    "distance": 0,
                    "node_index": i
                })
                
                last_direction_index = len(directions) - 1
                accumulated_distance = 0
        
        # Update the last bearing
        last_bearing = current_bearing
    
    # Add final segment distance
    if len(path) > 1:
        if G.has_edge(path[-2], path[-1]):
            edge_data = list(G.get_edge_data(path[-2], path[-1]).values())[0]
            if edge_data and 'length' in edge_data:
                accumulated_distance += edge_data.get('length', 0)
    
    if len(directions) > 0:
        directions[last_direction_index]["distance"] = round(accumulated_distance)
    
    # Add destination arrival
    directions.append({
        "text": "Arrive at your destination",
        "distance": 0,
        "node_index": len(path) - 1
    })
    
    return directions

def calculate_bearing(point1, point2):
    """Calculate the bearing between two latitude/longitude points."""
    try:
        lat1, lon1 = map(math.radians, point1)
        lat2, lon2 = map(math.radians, point2)
        dlon = lon2 - lon1
        
        y = math.sin(dlon) * math.cos(lat2)
        x = math.cos(lat1) * math.sin(lat2) - math.sin(lat1) * math.cos(lat2) * math.cos(dlon)
        
        initial_bearing = math.degrees(math.atan2(y, x))
        compass_bearing = (initial_bearing + 360) % 360
        
        return compass_bearing
    except Exception as e:
        print(f"Error in calculate_bearing: {e}")
        return 0

def get_turn_direction(prev_coords, current_coords, next_coords):
    """Determine the turn direction based on three latitude/longitude points."""
    try:
        bearing1 = calculate_bearing(prev_coords, current_coords)
        bearing2 = calculate_bearing(current_coords, next_coords)
        
        angle_diff = ((bearing2 - bearing1 + 180) % 360) - 180
        
        if abs(angle_diff) < 20:
            return "Continue straight"
        elif angle_diff < 0:
            if angle_diff > -45:
                return "Turn slight left"
            elif angle_diff > -120:
                return "Turn left"
            else:
                return "Make a sharp left"
        else:
            if angle_diff < 45:
                return "Turn slight right"
            elif angle_diff < 120:
                return "Turn right"
            else:
                return "Make a sharp right"
    except Exception as e:
        print(f"Error in get_turn_direction: {e}")
        return "Continue"

# Example usage
from_point = (37.7749, -122.4194)  # San Francisco, CA
current_point = (34.0522, -118.2437)  # Los Angeles, CA
to_point = (36.1699, -115.1398)  # Las Vegas, NV

direction = get_turn_direction(from_point, current_point, to_point)
print(f"Turn direction: {direction}")
