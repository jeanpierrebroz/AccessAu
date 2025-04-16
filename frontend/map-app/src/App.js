import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, ZoomControl } from 'react-leaflet';import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { LoadScript, Autocomplete } from '@react-google-maps/api';
// import { MapContainer, TileLayer, Marker, Polyline, CircleMarker, useMap, ZoomControl } from 'react-leaflet';
// Fix Leaflet icon issue in React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Custom marker icons for start and end points
const startIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
  className: 'start-marker'
});

const endIcon = new L.Icon({
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  shadowSize: [41, 41],
  className: 'end-marker'
});

// MapUpdater component to handle map view changes
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 15);
    }
  }, [center, map]);
  return null;
}

function App() {
  // State
  const [elevationSensitivity, setElevationSensitivity] = useState(5);
  const [avoidObstacles, setAvoidObstacles] = useState(true);
  const [center, setCenter] = useState([39.7518908, -105.2158803]);
  const [startPoint, setStartPoint] = useState(null);
  const [endPoint, setEndPoint] = useState(null);
  const [activeInput, setActiveInput] = useState(null); // 'start' or 'destination'
  const [routePath, setRoutePath] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showOptions, setShowOptions] = useState(false);
  const [directions, setDirections] = useState([]);
  const [activeDirectionIndex, setActiveDirectionIndex] = useState(null);
  const [showDirectionsPanel, setShowDirectionsPanel] = useState(false);
  
  // Refs
  const startAutocompleteRef = useRef(null);
  const destAutocompleteRef = useRef(null);
  const startInputRef = useRef(null);
  const destInputRef = useRef(null);
  const mapRef = useRef(null);

  // Handle using current location as start point
  const handleUseMyLocation = (inputType) => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const newPosition = [position.coords.latitude, position.coords.longitude];
          setCenter(newPosition);
          
          if (inputType === 'start') {
            setStartPoint(newPosition);
            if (startInputRef.current) {
              startInputRef.current.value = 'My Location';
            }
          } else if (inputType === 'destination') {
            setEndPoint(newPosition);
            if (destInputRef.current) {
              destInputRef.current.value = 'My Location';
            }
          }
        },
        (error) => {
          console.error("Error getting location:", error);
          alert("Could not get your location. Please check your permissions.");
        }
      );
    } else {
      alert("Geolocation is not supported by your browser.");
    }
  };

  // Handle place select for either start or destination
  const handlePlaceSelect = (inputType) => {
    if (inputType === 'start' && startAutocompleteRef.current) {
      const place = startAutocompleteRef.current.getPlace();
      if (place && place.geometry && place.geometry.location) {
        const newPosition = [
          place.geometry.location.lat(),
          place.geometry.location.lng()
        ];
        setStartPoint(newPosition);
        setCenter(newPosition);
      }
    } else if (inputType === 'destination' && destAutocompleteRef.current) {
      const place = destAutocompleteRef.current.getPlace();
      if (place && place.geometry && place.geometry.location) {
        const newPosition = [
          place.geometry.location.lat(),
          place.geometry.location.lng()
        ];
        setEndPoint(newPosition);
        setCenter(newPosition);
      }
    }
  };

  // Handle direct map clicks to set points
  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng;
    const newPosition = [lat, lng];
    
    if (activeInput === 'start') {
      setStartPoint(newPosition);
      if (startInputRef.current) {
        startInputRef.current.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    } else if (activeInput === 'destination') {
      setEndPoint(newPosition);
      if (destInputRef.current) {
        destInputRef.current.value = `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
      }
    }
  };

  // Swap start and end points
  const swapStartAndEnd = () => {
    const tempStart = startPoint;
    const tempStartVal = startInputRef.current ? startInputRef.current.value : '';
    
    setStartPoint(endPoint);
    if (startInputRef.current && destInputRef.current) {
      startInputRef.current.value = destInputRef.current.value;
    }
    
    setEndPoint(tempStart);
    if (destInputRef.current) {
      destInputRef.current.value = tempStartVal;
    }
    
    if (routePath) {
      calculateRoute();
    }
  };

  // Calculate route function
  const calculateRoute = async () => {
    if (!startPoint || !endPoint) {
      setError("Please set both start and end points");
      return;
    }
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('http://localhost:8000/api/accessible_route', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          origin: startPoint,
          destination: endPoint,
          elevation_pref: elevationSensitivity,
          obstacle_pref: avoidObstacles
        }),
      });
      
      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      if (data.route && Array.isArray(data.route)) {
        setRoutePath(data.route);
        
        // Set directions if available
        if (data.directions && Array.isArray(data.directions)) {
          setDirections(data.directions);
          setShowDirectionsPanel(true);
        }
        
        // Fit map to show the entire route
        if (mapRef.current) {
          const bounds = L.latLngBounds(data.route);
          mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
      } else {
        throw new Error("Invalid route data received from server");
      }
    } catch (err) {
      console.error("Error calculating route:", err);
      setError(err.message || "Failed to calculate route");
    } finally {
      setIsLoading(false);
    }
  };

  // Function to focus on a specific direction step on the map
  const focusOnDirectionStep = (index) => {
    setActiveDirectionIndex(index);
    
    if (directions && directions.length > index && routePath) {
      const nodeIndex = directions[index].node_index;
      if (nodeIndex < routePath.length) {
        const position = routePath[nodeIndex];
        mapRef.current.setView(position, 18);
      }
    }
  };

  // Function to format distance
  const formatDistance = (meters) => {
    if (meters < 1000) {
      return `${meters} m`;
    } else {
      const km = (meters / 1000).toFixed(1);
      return `${km} km`;
    }
  };

  // Clear input and point
  const clearInput = (inputType) => {
    if (inputType === 'start') {
      setStartPoint(null);
      if (startInputRef.current) {
        startInputRef.current.value = '';
      }
    } else if (inputType === 'destination') {
      setEndPoint(null);
      if (destInputRef.current) {
        destInputRef.current.value = '';
      }
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <div style={{ 
        position: 'absolute', 
        // top: '10px', 
        left: '10px', 
        right: '10px',
        zIndex: 1000
      }}>
        <LoadScript
          googleMapsApiKey="AIzaSyCmSJVUpHRXe6o3SOkm7v5NFp_u08GMfv0"
          libraries={['places']}
        >
          <div style={{ 
            
            background: 'white', 
            boxShadow: '0 2px 6px rgba(0,0,0,0.3)', 
            borderRadius: '8px',
            overflow: 'hidden'
          }}>
            {/* Directions input panel */}
            <div style={{ padding: '16px' }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                marginBottom: '8px',
                position: 'relative'
              }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  backgroundColor: '#1a73e8', 
                  borderRadius: '50%', 
                  marginRight: '12px'
                }}></div>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      startAutocompleteRef.current = autocomplete;
                    }}
                    onPlaceChanged={() => handlePlaceSelect('start')}
                  >
                    <input
                      ref={startInputRef}
                      type="text"
                      placeholder="Choose starting point, or click on the map"
                      onFocus={() => setActiveInput('start')}
                      style={{
                        width: '100%',
                        padding: '8px 32px 8px 0',
                        border: 'none',
                        fontSize: '14px',
                        outline: 'none',
                        borderBottom: '1px solid #ddd'
                      }}
                    />
                  </Autocomplete>
                  {startInputRef.current && startInputRef.current.value && (
                    <button
                      onClick={() => clearInput('start')}
                      style={{
                        position: 'absolute',
                        right: '2px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px',
                        color: '#5f6368'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ 
                display: 'flex', 
                alignItems: 'center',
                position: 'relative'
              }}>
                <div style={{ 
                  width: '10px', 
                  height: '10px', 
                  backgroundColor: '#d93025', 
                  borderRadius: '50%', 
                  marginRight: '12px'
                }}></div>
                <div style={{ position: 'relative', flexGrow: 1 }}>
                  <Autocomplete
                    onLoad={(autocomplete) => {
                      destAutocompleteRef.current = autocomplete;
                    }}
                    onPlaceChanged={() => handlePlaceSelect('destination')}
                  >
                    <input
                      ref={destInputRef}
                      type="text"
                      placeholder="Choose destination..."
                      onFocus={() => setActiveInput('destination')}
                      style={{
                        width: '100%',
                        padding: '8px 32px 8px 0',
                        border: 'none',
                        fontSize: '14px',
                        outline: 'none'
                      }}
                    />
                  </Autocomplete>
                  {destInputRef.current && destInputRef.current.value && (
                    <button
                      onClick={() => clearInput('destination')}
                      style={{
                        position: 'absolute',
                        right: '2px',
                        top: '50%',
                        transform: 'translateY(-50%)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '18px',
                        color: '#5f6368'
                      }}
                    >
                      ×
                    </button>
                  )}
                </div>
              </div>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '16px' }}>
                <button
                  onClick={swapStartAndEnd}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    color: '#1a73e8',
                    fontSize: '14px'
                  }}
                >
                  ⇅ Swap
                </button>
                
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => setShowOptions(!showOptions)}
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#1a73e8',
                      fontSize: '14px'
                    }}
                  >
                    {showOptions ? 'Hide options' : 'Show options'}
                  </button>
                  
                  <button
                    onClick={calculateRoute}
                    disabled={!startPoint || !endPoint || isLoading}
                    style={{
                      padding: '8px 16px',
                      background: (!startPoint || !endPoint || isLoading) ? '#ccc' : '#1a73e8',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: (!startPoint || !endPoint || isLoading) ? 'not-allowed' : 'pointer',
                      fontSize: '14px'
                    }}
                  >
                    {isLoading ? 'Loading...' : 'Directions'}
                  </button>
                </div>
              </div>
              
              {/* My location buttons */}
              <div style={{ display: 'flex', marginTop: '8px', gap: '8px' }}>
                <button
                  onClick={() => handleUseMyLocation('start')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#5f6368',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📍 My location as start
                </button>
                
                <button
                  onClick={() => handleUseMyLocation('destination')}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontSize: '12px',
                    color: '#5f6368',
                    padding: '4px 8px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                >
                  📍 My location as destination
                </button>
              </div>
              
              {/* Additional options */}
              {showOptions && (
                <div style={{ 
                  marginTop: '16px', 
                  padding: '12px',
                  borderTop: '1px solid #ddd'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                    <label htmlFor="elevation-sensitivity" style={{ fontSize: '14px', color: '#5f6368' }}>
                      Elevation Sensitivity:
                    </label>
                    <input
                      type="range"
                      id="elevation-sensitivity"
                      min="1"
                      max="10"
                      value={elevationSensitivity}
                      onChange={e => setElevationSensitivity(parseInt(e.target.value))}
                      style={{ flexGrow: 1 }}
                    />
                    <span style={{ fontSize: '14px', color: '#5f6368', width: '20px', textAlign: 'right' }}>
                      {elevationSensitivity}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center' }}>
                    <input
                      type="checkbox"
                      id="avoid-obstacles"
                      checked={avoidObstacles}
                      onChange={e => setAvoidObstacles(e.target.checked)}
                      style={{ marginRight: '8px' }}
                    />
                    <label htmlFor="avoid-obstacles" style={{ fontSize: '14px', color: '#5f6368' }}>
                      Avoid Obstacles
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>
          
          {error && (
            <div style={{ 
              padding: '10px', 
              background: '#ffebee', 
              color: '#c62828',
              borderRadius: '4px',
              marginTop: '10px',
              fontSize: '14px'
            }}>
              {error}
            </div>
          )}
        </LoadScript>
      </div>

      <div style={{ flexGrow: 1, display: 'flex'}}>
        {/* Directions panel */}
        {showDirectionsPanel && directions.length > 0 && (
        <div style={{
          width: '300px',
          height: 'calc(100% - 190px)', // Adjust based on your search panel height
          position: 'absolute',
          top: '190px', // Position it below the search panel
          left: '10px',
          background: 'white',
          boxShadow: '2px 0 5px rgba(0,0,0,0.1)',
          zIndex: 900,
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '8px',
          maxHeight: 'calc(100vh - 210px)', // Prevent it from being too tall
          overflow: 'hidden' // Important to prevent the container from expanding
        }}>
          <div style={{ 
            padding: '16px', 
            borderBottom: '1px solid #ddd', 
            display: 'flex', 
            justifyContent: 'space-between', 
            alignItems: 'center',
            flexShrink: 0 // Prevent the header from shrinking
          }}>
            <h2 style={{ margin: 0, fontSize: '18px' }}>Directions</h2>
            <button 
              onClick={() => setShowDirectionsPanel(false)}
              style={{ background: 'none', border: 'none', fontSize: '16px', cursor: 'pointer' }}
            >
              ×
            </button>
          </div>
          
          <div style={{ 
            overflowY: 'auto', // Only make the inner content scrollable
            flexGrow: 1,
            height: '100%' // Ensure it takes up the remaining height
          }}>
            {directions.map((direction, index) => (
              <div 
                key={index}
                onClick={() => focusOnDirectionStep(index)}
                style={{
                  padding: '16px',
                  borderBottom: '1px solid #f0f0f0',
                  cursor: 'pointer',
                  background: activeDirectionIndex === index ? '#f0f9ff' : 'white',
                  display: 'flex',
                  alignItems: 'center'
                }}
              >
                <div style={{ marginRight: '12px', width: '24px', height: '24px', backgroundColor: '#1a73e8', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '50%', flexShrink: 0 }}>
                  {index + 1}
                </div>
                <div style={{ flexGrow: 1 }}>
                  <div style={{ fontSize: '14px' }}>{direction.text}</div>
                  {direction.distance > 0 && (
                    <div style={{ fontSize: '12px', color: '#5f6368', marginTop: '4px' }}>
                      {formatDistance(direction.distance)}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

        {/* Map container */}
        <div style={{ flexGrow: 1 }}>
          <MapContainer
            center={center}
            zoom={13}
            style={{ height: '100%', width: '100%' }}
            zoomControl={false}
            whenCreated={mapInstance => { 
              mapRef.current = mapInstance;
              mapInstance.on('click', handleMapClick);
            }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <ZoomControl position="bottomright" />
            <MapUpdater center={center} />
            
            {startPoint && (
              <Marker 
                position={startPoint} 
                icon={startIcon}
              />
            )}
            
            {endPoint && (
              <Marker 
                position={endPoint} 
                icon={endIcon}
              />
            )}
            
            {routePath && (
              <Polyline 
                positions={routePath}
                color="#1a73e8"
                weight={5}
                opacity={0.7}
              />
            )}
            
            {/* Highlight active direction step on the map */}
            {activeDirectionIndex !== null && directions && directions.length > activeDirectionIndex && routePath && (
              <CircleMarker
                center={routePath[directions[activeDirectionIndex].node_index]}
                radius={8}
                color="#1a73e8"
                fillColor="#ffffff"
                weight={3}
                fillOpacity={1}
              />
            )}
          </MapContainer>
        </div>
      </div>
    </div>
  );
}

export default App;