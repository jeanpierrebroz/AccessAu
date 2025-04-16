import osmnx as ox
import networkx as nx
import shapely.geometry as geometry
import json


# G = ox.load_graphml("golden_graph_with_elevation.graphml")

def print_edge_weights(G):
    for u, v, d in G.edges(data=True):
        print(f"Edge from {u} to {v} has weight: {d['length']}")


def add_elevation_weights(G, elevationpref):
    for u, v, d in G.edges(data=True):
        if 'elevation' in d:
            # Use elevation change between two points as weight
            d['length'] += (abs(u['elevation'] - v['elevation']) * (elevationpref**2))

def add_obstacle_weights(G, obstaclepref):
    if not obstaclepref:
        return 
    for u, v, d in G.edges(data=True):

        if 'obstacle' in d:
            # Use obstacle as weight
            d['length'] += 999999999999.0

def generate_graph(G, elevationpref, obstaclepref):
    # Add elevation weights
    add_elevation_weights(G, elevationpref)

    # Add obstacle weights
    add_obstacle_weights(G, obstaclepref)

    # Save the modified graph
    ox.save_graphml(G, f"./graphs/golden_graph_with_elevation_and_obstacles_userpref_{elevationpref}_avoid_{obstaclepref}.graphml")

if __name__ == "__main__":
    # higher = less tolerance for elevation
    elevationprefs = [1,2,3,4,5,6,7,8,9,10]

    #how do we want to scale the distance? we could do distance + (elevation * elevationprefs)
    # or distance * (elevation * elevationprefs)
    #guess we just have to try difference heuristics and see

    avoidobstacles = [True, False]

    for elevationpref in elevationprefs:
        for obstaclepref in avoidobstacles:
            G = ox.load_graphml("golden_graph_with_elevation.graphml")
            print(f"Generating graph with elevation preference {elevationpref} and obstacle avoidance {obstaclepref}")
            generate_graph(G, elevationpref, obstaclepref)

    # print_edge_weights(G)
    # add_elevation_weights(G)
    # save_graph(G, "golden_graph_with_elevation.graphml")