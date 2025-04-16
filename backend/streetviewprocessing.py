import osmnx as ox
import requests
import json
from PIL import Image
from io import BytesIO
import groq
from dotenv import dotenv_values
import base64
import os
from PIL import Image, ImageChops
import shapely.geometry as geometry




config = dotenv_values(".env")


# Define the location (Golden, CO)
place_name = geometry.Polygon([
    (-105.2359, 39.7555),  # Northwest corner
    (-105.2059, 39.7555),  # Northeast corner
    (-105.2059, 39.7355),  # Southeast corner
    (-105.2359, 39.7355),  # Southwest corner
])

client = groq.Client(api_key=config['GROQ'])

data_file = "golden_obstacles.json"

def check_street_view_available(lat, lon, api_key):
    """Check if Street View imagery is available at the given coordinates."""
    metadata_url = f"https://maps.googleapis.com/maps/api/streetview/metadata?location={lat},{lon}&key={api_key}"
    response = requests.get(metadata_url)
    
    if response.status_code == 200:
        data = response.json()
        return data.get('status') == 'OK'
    return False

# Function to get Street View image
def get_street_view_image(lat, lon, api_key):
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        print(f"Invalid coordinates: lat={lat}, lon={lon}")
        return None

    url = f"https://maps.googleapis.com/maps/api/streetview?size=600x300&location={lat},{lon}&key={config['MAPS']}"
    response = requests.get(url)
    if response.status_code == 200:
        return Image.open(BytesIO(response.content))
    else:
        print(f"Failed to fetch image for coordinates: lat={lat}, lon={lon}, status_code={response.status_code}")
    return None

def encode_image(image_path):
  with open(image_path, "rb") as image_file:
    return base64.b64encode(image_file.read()).decode('utf-8')

def are_images_identical(image1, image2_path):
    # image1 is already a PIL Image object, just load image2
    image2 = Image.open(image2_path)

    # Convert both images to RGB mode to ensure compatibility
    image1 = image1.convert('RGB')
    image2 = image2.convert('RGB')

    # Check if sizes are the same
    if image1.size != image2.size:
        return False

    # Check pixel-by-pixel difference
    diff = ImageChops.difference(image1, image2)
    
    return not diff.getbbox()


# Function to analyze image using Groq AI

def analyze_image_with_groq(image):
    # Convert PIL Image to base64
    buffered = BytesIO()
    image.save(buffered, format="JPEG")
    base64_image = base64.b64encode(buffered.getvalue()).decode('utf-8')
    
    # Create chat completion
    response = client.chat.completions.create(
        messages=[
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": "If there are any stairs/curbs with no ramp in this image that would prevent a wheelchair from passing that are also on the nearest sidewalk, please return '1' and NOTHING ELSE. "
                    "If there are no obstacles, please respond with '0'. "
                    "ONLY use '1' or '0'. Do NOT explain your answer."},
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{base64_image}",
                        },
                    },
                ],
            }
        ],
        model="llama-3.2-90b-vision-preview",
    )

    # print(response.choices[0].message.content.strip("!?.,*"))

    return response.choices[0].message.content.strip("!?.,*")

# Function to scan the graph for obstacles and save to file
def scan_and_save_obstacles(api_key, output_file):
    i = 0
    batch_size = 50  # Process 50 images at a time
    save_dir = "saved_images"
    os.makedirs(save_dir, exist_ok=True)

    # Initialize or load existing data
    if os.path.exists(output_file):
        with open(output_file, 'r') as f:
            obstacle_data = json.load(f)
    else:
        obstacle_data = {}

    G = ox.graph_from_polygon(place_name, network_type='walk')
    
    for u, v, d in G.edges(data=True):
        if "geometry" in d:
            coords = list(d["geometry"].coords)

            for lon, lat in coords[::10]:
                if str((lat, lon)) in obstacle_data:
                    continue

                # Check if Street View is available first
                if check_street_view_available(lat, lon, api_key):
                    image = get_street_view_image(lat, lon, api_key)
                    if image:
                        # Save the image locally
                        # image_filename = f"{save_dir}/streetview_{lat}_{lon}.jpg"
                        # image.save(image_filename)
                        # print(f"Saved image to {image_filename}")

                        analysis = analyze_image_with_groq(image)

                        obstacle = False

                        if analysis == "1":
                            obstacle = True


                        # image_filename = f"{save_dir}/{obstacle}_{lat}_{lon}.jpg"
                        # image.save(image_filename)
                        # print(f"Saved image to {image_filename}")
                        obstacle_data[str((lat, lon))] = obstacle
                        i += 1
                        
                        if i % batch_size == 0:
                            with open(output_file, "w") as f:
                                json.dump(obstacle_data, f)
                            print(f"Processed {i} images")

# Run the scanning and saving process
scan_and_save_obstacles(config['MAPS'], data_file)