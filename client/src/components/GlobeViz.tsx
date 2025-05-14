import { useState, useRef, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import Globe from "react-globe.gl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Type for location data from API
interface LocationData {
  city: string;
  region: string;
  country: string;
  count: number;
}

// Type for globe point data
interface GlobePoint extends LocationData {
  lat: number;
  lng: number;
  size: number;
  color: string;
}

// Coordinates data structure
interface CityCoords {
  [key: string]: {
    lat: number;
    lng: number;
  };
}

export function GlobeViz() {
  const globeRef = useRef<any>();
  const [timeframe, setTimeframe] = useState<string>("month");
  const [points, setPoints] = useState<GlobePoint[]>([]);
  
  // Sample city coordinates lookup (in a real implementation, this would be more comprehensive)
  const cityCoordinates: CityCoords = {
    "New York": { lat: 40.7128, lng: -74.0060 },
    "London": { lat: 51.5074, lng: -0.1278 },
    "Paris": { lat: 48.8566, lng: 2.3522 },
    "Tokyo": { lat: 35.6762, lng: 139.6503 },
    "Sydney": { lat: -33.8688, lng: 151.2093 },
    "Los Angeles": { lat: 34.0522, lng: -118.2437 },
    "Chicago": { lat: 41.8781, lng: -87.6298 },
    "Berlin": { lat: 52.5200, lng: 13.4050 },
    "Toronto": { lat: 43.6532, lng: -79.3832 },
    "San Francisco": { lat: 37.7749, lng: -122.4194 },
    "Mumbai": { lat: 19.0760, lng: 72.8777 },
    "Dubai": { lat: 25.2048, lng: 55.2708 },
    "Singapore": { lat: 1.3521, lng: 103.8198 },
    "São Paulo": { lat: -23.5505, lng: -46.6333 },
    "Cairo": { lat: 30.0444, lng: 31.2357 },
    "Moscow": { lat: 55.7558, lng: 37.6173 },
    "Beijing": { lat: 39.9042, lng: 116.4074 },
    "Delhi": { lat: 28.7041, lng: 77.1025 },
    "Mexico City": { lat: 19.4326, lng: -99.1332 },
    "Rome": { lat: 41.9028, lng: 12.4964 },
    "Madrid": { lat: 40.4168, lng: -3.7038 },
    "Amsterdam": { lat: 52.3676, lng: 4.9041 },
  };
  
  // Fetch location data based on timeframe
  const { data: locationData, isLoading } = useQuery<LocationData[]>({
    queryKey: ["/api/webhooks/locations", timeframe],
    refetchInterval: 30000,
  });
  
  // Process the location data and add coordinates
  useEffect(() => {
    if (!locationData) return;
    
    // Try to match cities to coordinates
    const processedData = locationData.map(loc => {
      // Try to find coordinates for this city
      const cityKey = Object.keys(cityCoordinates).find(
        city => city.toLowerCase() === loc.city.toLowerCase()
      );
      
      const coords = cityKey ? cityCoordinates[cityKey] : null;
      
      if (coords) {
        return {
          ...loc,
          lat: coords.lat,
          lng: coords.lng,
          size: Math.max(0.5, Math.min(3, loc.count / 5)), // Scale point size based on count
          color: "hsl(var(--primary))",
        } as GlobePoint;
      }
      return null;
    }).filter(Boolean) as GlobePoint[]; // Remove null values
    
    setPoints(processedData);
    
    // Auto-rotate the globe slightly
    if (globeRef.current) {
      globeRef.current.controls().autoRotate = true;
      globeRef.current.controls().autoRotateSpeed = 0.5;
    }
  }, [locationData]);
  
  // Handle timeframe change
  const handleTimeframeChange = (value: string) => {
    setTimeframe(value);
  };
  
  return (
    <Card className="mt-4">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">
          Global Download Locations
        </CardTitle>
        <Tabs
          defaultValue="month"
          value={timeframe}
          onValueChange={handleTimeframeChange}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="day">Today</TabsTrigger>
            <TabsTrigger value="week">This Week</TabsTrigger>
            <TabsTrigger value="month">This Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </CardHeader>
      <CardContent className="p-1">
        <div className="h-[400px] w-full">
          {isLoading ? (
            <div className="flex h-full items-center justify-center">
              Loading map data...
            </div>
          ) : (
            <Globe
              ref={globeRef}
              globeImageUrl="//unpkg.com/three-globe/example/img/earth-blue-marble.jpg"
              backgroundColor="rgba(0,0,0,0)"
              pointsData={points}
              pointColor="color"
              pointAltitude={0.01}
              pointRadius="size"
              pointLabel={((d: any) => `${d.city}, ${d.country}: ${d.count} downloads`) as any}
              width={800}
              height={400}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}