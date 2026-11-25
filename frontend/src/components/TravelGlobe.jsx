
import { useEffect, useRef, useState } from 'react';
import Globe from 'react-globe.gl';
import { MapPin, X, Compass } from 'lucide-react';
import './TravelGlobe.css';

const destinations = [
  {
    name: 'Paris',
    country: 'France',
    lat: 48.8566,
    lng: 2.3522,
    description: 'Explore the Eiffel Tower, museums and beautiful streets.',
    category: 'Romantic Escape'
  },
  {
    name: 'Bali',
    country: 'Indonesia',
    lat: -8.4095,
    lng: 115.1889,
    description: 'Discover tropical beaches, temples and beautiful landscapes.',
    category: 'Beach Destination'
  },
  {
    name: 'Manali',
    country: 'India',
    lat: 32.2432,
    lng: 77.1892,
    description: 'Enjoy mountains, adventure activities and scenic views.',
    category: 'Mountain Escape'
  },
  {
    name: 'Tokyo',
    country: 'Japan',
    lat: 35.6762,
    lng: 139.6503,
    description: 'Experience modern cities, technology and Japanese culture.',
    category: 'City Experience'
  },
  {
    name: 'New York',
    country: 'United States',
    lat: 40.7128,
    lng: -74.006,
    description: 'Explore Times Square, Central Park and famous landmarks.',
    category: 'City Experience'
  },
  {
    name: 'London',
    country: 'United Kingdom',
    lat: 51.5072,
    lng: -0.1276,
    description: 'Discover historic attractions and iconic British landmarks.',
    category: 'Historic City'
  },
  {
    name: 'Dubai',
    country: 'United Arab Emirates',
    lat: 25.2048,
    lng: 55.2708,
    description: 'Experience luxury shopping, desert adventures and skyscrapers.',
    category: 'Luxury Destination'
  },
  {
    name: 'Rome',
    country: 'Italy',
    lat: 41.9028,
    lng: 12.4964,
    description: 'Explore ancient architecture, history and Italian food.',
    category: 'Historic City'
  },
  {
    name: 'Sydney',
    country: 'Australia',
    lat: -33.8688,
    lng: 151.2093,
    description: 'Enjoy beautiful beaches, the Opera House and harbour views.',
    category: 'Coastal Destination'
  },
  {
    name: 'Cape Town',
    country: 'South Africa',
    lat: -33.9249,
    lng: 18.4241,
    description: 'Discover Table Mountain and beautiful coastal scenery.',
    category: 'Nature Escape'
  },
  {
    name: 'Singapore',
    country: 'Singapore',
    lat: 1.3521,
    lng: 103.8198,
    description: 'Explore modern architecture, gardens and amazing food.',
    category: 'City Experience'
  },
  {
    name: 'Istanbul',
    country: 'Turkey',
    lat: 41.0082,
    lng: 28.9784,
    description: 'Experience a unique mix of European and Asian culture.',
    category: 'Cultural Destination'
  },
  {
    name: 'Maldives',
    country: 'Maldives',
    lat: 3.2028,
    lng: 73.2207,
    description: 'Relax on tropical islands with crystal-clear water.',
    category: 'Beach Destination'
  },
  {
    name: 'Barcelona',
    country: 'Spain',
    lat: 41.3874,
    lng: 2.1686,
    description: 'Discover beautiful architecture, beaches and Spanish culture.',
    category: 'Cultural Destination'
  }
];

function TravelGlobe() {
  const globeRef = useRef(null);

  const [selectedPlace, setSelectedPlace] = useState(null);
  const [hoveredPlace, setHoveredPlace] = useState(null);

  useEffect(() => {
    const globe = globeRef.current;

    if (globe) {
      globe.pointOfView(
        { lat: 20, lng: 0, altitude: 2.5 },
        1000
      );

      const controls = globe.controls();

      controls.autoRotate = true;
      controls.autoRotateSpeed = 0.35;
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
    }
  }, []);

  const handlePlaceClick = (place) => {
    setSelectedPlace(place);

    globeRef.current?.pointOfView(
      {
        lat: place.lat,
        lng: place.lng,
        altitude: 1.5
      },
      1200
    );
  };

  const handleCloseDetails = () => {
    setSelectedPlace(null);
  };

  return (
    <section className="travel-globe-section">

      <div className="travel-globe-heading">

        <span>
          <Compass size={15} />
          EXPLORE THE WORLD
        </span>

        <h2>Discover Your Next Destination</h2>

        <p>
          Explore amazing places around the world.
          Rotate the globe, zoom in and select a destination
          to discover more.
        </p>

      </div>

      <div className="travel-globe-container">

        <Globe
          ref={globeRef}
          width={900}
          height={600}
          globeImageUrl="https://unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
          bumpImageUrl="https://unpkg.com/three-globe/example/img/earth-topology.png"
          backgroundColor="#071426"

          pointsData={destinations}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.025}
          pointRadius={(place) =>
            hoveredPlace?.name === place.name ? 0.75 : 0.45
          }
          pointColor={(place) =>
            hoveredPlace?.name === place.name
              ? '#facc15'
              : '#38bdf8'
          }

          pointLabel={(place) => `
            <div class="globe-tooltip">
              <strong>${place.name}</strong>
              <span>${place.country}</span>
            </div>
          `}

          onPointClick={handlePlaceClick}
          onPointHover={setHoveredPlace}

          atmosphereColor="#38bdf8"
          atmosphereAltitude={0.2}

          showAtmosphere
          animateIn
        />

        {selectedPlace && (
          <div className="globe-place-details">

            <button
              className="globe-close-btn"
              onClick={handleCloseDetails}
              aria-label="Close destination details"
            >
              <X size={20} />
            </button>

            <span className="globe-details-label">
              SELECTED DESTINATION
            </span>

            <div className="globe-details-icon">
              <MapPin size={22} />
            </div>

            <h3>{selectedPlace.name}</h3>

            <p className="globe-country">
              {selectedPlace.country}
            </p>

            <span className="globe-category">
              {selectedPlace.category}
            </span>

            <p className="globe-description">
              {selectedPlace.description}
            </p>

          </div>
        )}

      </div>

      <div className="globe-bottom-text">
        <span>Drag to rotate</span>
        <span>Scroll to zoom</span>
        <span>Click a marker to explore</span>
      </div>

    </section>
  );
}

export default TravelGlobe;
