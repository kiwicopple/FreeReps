import PageSection from "../PageSection";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { WorkoutRoute } from "../../api";
import { useMemo } from "react";
import type { LatLngTuple, LatLngBoundsExpression } from "leaflet";
import { tokenColor } from "../../utils/tokenColor";

interface Props {
  route: WorkoutRoute[];
}

export default function RouteMap({ route }: Props) {
  const { positions, bounds } = useMemo(() => {
    const positions: LatLngTuple[] = route.map((p) => [
      p.Latitude,
      p.Longitude,
    ]);

    if (positions.length === 0) return { positions, bounds: null };

    let minLat = Infinity,
      maxLat = -Infinity,
      minLng = Infinity,
      maxLng = -Infinity;
    for (const [lat, lng] of positions) {
      if (lat < minLat) minLat = lat;
      if (lat > maxLat) maxLat = lat;
      if (lng < minLng) minLng = lng;
      if (lng > maxLng) maxLng = lng;
    }

    const bounds: LatLngBoundsExpression = [
      [minLat - 0.001, minLng - 0.001],
      [maxLat + 0.001, maxLng + 0.001],
    ];

    return { positions, bounds };
  }, [route]);

  if (positions.length === 0 || !bounds) return null;

  return (
    <PageSection title={<>Route</>}>
      <div className="min-w-0">
        <div style={{ height: 320 }}>
          <MapContainer
            bounds={bounds}
            scrollWheelZoom={true}
            style={{ height: "100%", width: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <Polyline
              positions={positions}
              pathOptions={{
                /* The fallback moves with the token: it applies when the
                   variable is missing, where a hard-coded brand blue would set
                   the track back to the brand colour without saying so. On OSM
                   tiles the blue competed with water and trunk roads, which
                   are blue there themselves. */
                color: tokenColor("--color-data-3", "#337475"),
                weight: 3,
                opacity: 0.9,
              }}
            />
          </MapContainer>
        </div>
      </div>
    </PageSection>
  );
}
