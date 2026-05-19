import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT, Polyline } from "react-native-maps";

const GOOGLE_MAPS_API_KEY = "AIzaSyBjxwKdTvEcQdKnafVBzMi9JAFk2G9ePtg";

export default function App() {
  const [location, setLocation] = useState<Location.LocationObject | null>(
    null,
  );
  const [address, setAddress] = useState<string | null>(null);

  const [mapCenter, setMapCenter] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);

  const [centerPlaceName, setCenterPlaceName] = useState<string | null>(null);
  const lastCenterRef = useRef<{ latitude: number; longitude: number } | null>(
    null,
  );
  const lastLocationRef = useRef<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const mapRef = useRef<any | null>(null);

  const [searchText, setSearchText] = useState<string>("");
  const [destinationLocation, setDestinationLocation] = useState<{
    latitude: number;
    longitude: number;
    name: string;
  } | null>(null);
  const [routeCoordinates, setRouteCoordinates] = useState<
    Array<{ latitude: number; longitude: number }>
  >([]);
  const [searchResults, setSearchResults] = useState<
    Array<{ name: string; lat: number; lng: number }>
  >([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== "granted") {
          setErrorMsg("Permiso denegado para acceder a la ubicación.");
          setLoading(false);
          return;
        }

        const loc = await Location.getCurrentPositionAsync({});
        if (mounted) {
          setLocation(loc);
          setMapCenter({
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
          });
          try {
            const rev = await Location.reverseGeocodeAsync({
              latitude: loc.coords.latitude,
              longitude: loc.coords.longitude,
            });
            if (rev && rev.length > 0) {
              const r = rev[0];
              const addr =
                `${r.name ?? ""} ${r.street ?? ""}`.trim() ||
                r.city ||
                r.region ||
                r.country ||
                null;
              setAddress(addr);
              setCenterPlaceName(r.name ?? null);
            }
          } catch (e) {
            // ignore reverse geocode errors
          }
          setLoading(false);
          animateToLocation(loc);
        }
      } catch (e) {
        setErrorMsg("Error al obtener la ubicación.");
        setLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;
    const interval = setInterval(async () => {
      try {
        const loc = await Location.getCurrentPositionAsync({});
        if (!mounted) return;
        const center = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };
        const last = lastLocationRef.current;
        const diff = last
          ? Math.max(
              Math.abs(last.latitude - center.latitude),
              Math.abs(last.longitude - center.longitude),
            )
          : Infinity;

        // Only update state if location changed enough to be relevant
        if (diff > 0.00001) {
          lastLocationRef.current = center;
          setLocation(loc);
          setMapCenter(center);

          // Reverse geocode only on significant moves to avoid excessive queries
          if (diff > 0.0005) {
            try {
              const rev = await Location.reverseGeocodeAsync({
                latitude: center.latitude,
                longitude: center.longitude,
              });
              if (rev && rev.length > 0) {
                const r = rev[0];
                const addr =
                  `${r.name ?? ""} ${r.street ?? ""}`.trim() ||
                  r.city ||
                  r.region ||
                  r.country ||
                  null;
                setAddress(addr);
                setCenterPlaceName(r.name ?? null);
              }
            } catch (e) {
              // ignore reverse geocode errors
            }
          }

          // Animate map to new location without toggling loading UI
          animateToLocation(loc);
        }
      } catch (e) {
        // ignore periodic location errors
      }
    }, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  const animateToLocation = (loc: Location.LocationObject) => {
    const region = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      latitudeDelta: 0.01,
      longitudeDelta: 0.01,
    };
    mapRef.current?.animateToRegion(region, 600);
  };

  const refresh = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const loc = await Location.getCurrentPositionAsync({});
      setLocation(loc);
      setMapCenter({
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      });
      try {
        const rev = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        });
        if (rev && rev.length > 0) {
          const r = rev[0];
          const addr =
            `${r.name ?? ""} ${r.street ?? ""}`.trim() ||
            r.city ||
            r.region ||
            r.country ||
            null;
          setAddress(addr);
          setCenterPlaceName(r.name ?? null);
        }
      } catch (e) {
        // ignore
      }
      animateToLocation(loc);
    } catch (e) {
      setErrorMsg("Error al actualizar la ubicación.");
    } finally {
      setLoading(false);
    }
  };

  const searchAddress = async (query: string) => {
    if (query.trim().length === 0) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(
        query,
      )}&key=${GOOGLE_MAPS_API_KEY}`;
      console.log("Buscando:", query);
      const response = await fetch(url);
      const data = await response.json();

      console.log("Respuesta API:", data);

      if (data.results && data.results.length > 0) {
        const results = data.results.slice(0, 5).map((result: any) => ({
          name: result.formatted_address,
          lat: result.geometry.location.lat,
          lng: result.geometry.location.lng,
        }));
        console.log("Resultados encontrados:", results.length);
        console.log("Actualizando estado con:", results);
        setSearchResults(results);
        setErrorMsg(null);
      } else {
        console.log("No se encontraron resultados");
        setSearchResults([]);
        setErrorMsg("No se encontraron resultados");
      }
    } catch (e) {
      console.error("Error en búsqueda:", e);
      setErrorMsg("Error buscando dirección");
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const selectDestination = async (lat: number, lng: number, name: string) => {
    console.log("Seleccionando destino:", { lat, lng, name });
    setDestinationLocation({ latitude: lat, longitude: lng, name });
    setSearchResults([]);
    setSearchText("");

    if (location) {
      console.log(
        "Calculando ruta desde:",
        location.coords.latitude,
        location.coords.longitude,
      );
      await getRoute(
        location.coords.latitude,
        location.coords.longitude,
        lat,
        lng,
      );
    }
  };

  const animateToCoordinate = (latitude: number, longitude: number) => {
    mapRef.current?.animateToRegion(
      {
        latitude,
        longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      },
      600,
    );
  };

  const getRoute = async (
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
  ) => {
    try {
      console.log("Obteniendo ruta:", { startLat, startLng, endLat, endLng });
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?origin=${startLat},${startLng}&destination=${endLat},${endLng}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await response.json();

      console.log("Respuesta directions API:", data);

      if (data.routes && data.routes.length > 0) {
        const points: Array<{ latitude: number; longitude: number }> = [];
        const route = data.routes[0];

        for (const leg of route.legs) {
          for (const step of leg.steps) {
            const poly = step.polyline.points;
            const decodedPoints = decodePolyline(poly);
            points.push(...decodedPoints);
          }
        }

        console.log("Ruta decodificada con", points.length, "puntos");
        setRouteCoordinates(points);
        animateToCoordinate(endLat, endLng);
      } else {
        console.log("No se encontraron rutas");
      }
    } catch (e) {
      console.error("Error obteniendo ruta:", e);
      setErrorMsg("Error obteniendo ruta");
    }
  };

  const decodePolyline = (encoded: string) => {
    const points: Array<{ latitude: number; longitude: number }> = [];
    let index = 0;
    let lat = 0;
    let lng = 0;

    while (index < encoded.length) {
      let result = 0;
      let shift = 0;
      let b;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlat = result & 1 ? ~(result >> 1) : result >> 1;
      lat += dlat;

      result = 0;
      shift = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);

      const dlng = result & 1 ? ~(result >> 1) : result >> 1;
      lng += dlng;

      points.push({
        latitude: lat / 1e5,
        longitude: lng / 1e5,
      });
    }

    return points;
  };

  const clearRoute = () => {
    setDestinationLocation(null);
    setRouteCoordinates([]);
  };

  return (
    <View style={styles.screen}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dónde estoy</Text>
        <Text style={styles.headerSubtitle}>Tu ubicación en tiempo real</Text>

        <TextInput
          style={styles.searchInput}
          placeholder="Buscar dirección..."
          placeholderTextColor="#94A3B8"
          value={searchText}
          onChangeText={setSearchText}
          onSubmitEditing={() => {
            if (searchText.trim().length > 0) {
              setErrorMsg(null);
              searchAddress(searchText);
            }
          }}
          returnKeyType="search"
        />

        <TouchableOpacity
          style={styles.searchButton}
          onPress={() => {
            if (searchText.trim().length > 0) {
              setErrorMsg(null);
              searchAddress(searchText);
            }
          }}
        >
          <Text style={styles.searchButtonText}>Buscar</Text>
        </TouchableOpacity>

        {searchResults.length > 0 && (
          <View style={styles.searchResultsContainer}>
            <ScrollView
              style={styles.searchResults}
              nestedScrollEnabled={true}
              keyboardShouldPersistTaps="handled"
            >
              {searchResults.map((result, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={styles.resultItem}
                  onPress={() =>
                    selectDestination(result.lat, result.lng, result.name)
                  }
                >
                  <Text style={styles.resultText}>{result.name}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.card}
        contentContainerStyle={styles.cardContent}
        keyboardShouldPersistTaps="handled"
      >
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" />
          </View>
        ) : errorMsg ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{errorMsg}</Text>
          </View>
        ) : location ? (
          <>
            <MapView
              ref={mapRef}
              provider={PROVIDER_DEFAULT}
              style={styles.map}
              initialRegion={{
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                latitudeDelta: 0.01,
                longitudeDelta: 0.01,
              }}
              onPress={async (e) => {
                const coord = e.nativeEvent.coordinate;
              }}
              onRegionChangeComplete={async (reg) => {
                const center = {
                  latitude: reg.latitude,
                  longitude: reg.longitude,
                };
                setMapCenter(center);
                const last = lastCenterRef.current;
                const diff = last
                  ? Math.max(
                      Math.abs(last.latitude - center.latitude),
                      Math.abs(last.longitude - center.longitude),
                    )
                  : Infinity;
                if (diff > 0.0005) {
                  lastCenterRef.current = center;
                  try {
                    const rev = await Location.reverseGeocodeAsync({
                      latitude: center.latitude,
                      longitude: center.longitude,
                    });
                    if (rev && rev.length > 0) {
                      const r = rev[0];
                      setCenterPlaceName(r.name ?? null);
                    }
                  } catch (err) {
                    // ignore
                  }
                }
              }}
            >
              <Marker
                coordinate={{
                  latitude: location.coords.latitude,
                  longitude: location.coords.longitude,
                }}
                title={address ?? "Mi ubicación"}
                pinColor="blue"
              />
              {destinationLocation && (
                <Marker
                  coordinate={{
                    latitude: destinationLocation.latitude,
                    longitude: destinationLocation.longitude,
                  }}
                  title={destinationLocation.name}
                  pinColor="red"
                />
              )}
              {routeCoordinates.length > 0 && (
                <Polyline
                  coordinates={routeCoordinates}
                  strokeColor="#2563EB"
                  strokeWidth={4}
                  lineDashPattern={[0]}
                />
              )}
            </MapView>

            <View style={styles.infoRow}>
              <View>
                <Text style={styles.label}>Latitud</Text>
                <Text style={styles.value}>
                  {location.coords.latitude.toFixed(6)}
                </Text>
              </View>
              <View>
                <Text style={styles.label}>Longitud</Text>
                <Text style={styles.value}>
                  {location.coords.longitude.toFixed(6)}
                </Text>
              </View>
            </View>

            <View style={styles.metaRow}>
              <View style={styles.addressBox}>
                <Text style={styles.addressLabel}>Dirección aproximada</Text>
                <Text style={styles.addressValue}>
                  {address ?? "No disponible"}
                </Text>
                <Text style={[styles.addressLabel, { marginTop: 8 }]}>
                  Lugar más cercano
                </Text>
                <Text style={styles.addressValue}>
                  {centerPlaceName ?? "No disponible"}
                </Text>
              </View>
              <View style={styles.centerBox}>
                <Text style={styles.addressLabel}>Centro del mapa</Text>
                <Text style={styles.addressValue}>
                  {mapCenter
                    ? `${mapCenter.latitude.toFixed(6)}, ${mapCenter.longitude.toFixed(6)}`
                    : "-"}
                </Text>
              </View>
            </View>

            {destinationLocation && (
              <View style={styles.destinationBox}>
                <Text
                  style={styles.destinationName}
                  numberOfLines={2}
                  ellipsizeMode="tail"
                >
                  {destinationLocation.name}
                </Text>
                <TouchableOpacity
                  style={styles.clearButton}
                  onPress={clearRoute}
                >
                  <Text style={styles.clearButtonText}>X</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        ) : (
          <View style={styles.centered}>
            <Text>No hay datos de ubicación.</Text>
          </View>
        )}
      </ScrollView>

      <TouchableOpacity
        activeOpacity={0.8}
        style={styles.fab}
        onPress={refresh}
      >
        <Text style={styles.fabText}>{Platform.OS === "ios" ? "↻" : "⟳"}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F3F6F9", padding: 16 },
  header: { marginTop: 36, marginBottom: 12 },
  headerTitle: { fontSize: 24, fontWeight: "700", color: "#0F172A" },
  headerSubtitle: { fontSize: 14, color: "#475569", marginTop: 4 },
  card: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
  },
  cardContent: {
    padding: 12,
    paddingBottom: 24,
  },
  map: { width: "100%", height: 320, borderRadius: 10, overflow: "hidden" },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
  },
  label: { color: "#64748B", fontSize: 12 },
  value: { fontSize: 14, fontWeight: "600", color: "#0F172A" },
  fab: {
    position: "absolute",
    right: 20,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#2563EB",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 22, fontWeight: "700" },
  centered: { alignItems: "center", justifyContent: "center", height: 320 },
  error: { color: "#DC2626" },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 12,
    gap: 8,
  },
  addressBox: {
    flex: 1,
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  centerBox: {
    flex: 1,
    padding: 8,
    backgroundColor: "#F8FAFC",
    borderRadius: 8,
  },
  addressLabel: { fontSize: 12, color: "#64748B" },
  addressValue: { fontSize: 13, color: "#0F172A", marginTop: 4 },
  searchInput: {
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#F1F5F9",
    borderRadius: 8,
    fontSize: 14,
    color: "#0F172A",
  },
  searchResultsContainer: {
    height: 150,
    marginTop: 8,
    backgroundColor: "#FFFFFF",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E2E8F0",
    zIndex: 10,
  },
  searchResults: {
    paddingVertical: 4,
    paddingHorizontal: 2,
  },
  searchButton: {
    marginTop: 10,
    alignSelf: "flex-start",
    backgroundColor: "#2563EB",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
  },
  searchButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
  resultItem: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F1F5F9",
  },
  resultText: {
    fontSize: 13,
    color: "#0F172A",
  },
  destinationBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: "#F59E0B",
  },
  destinationName: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    marginRight: 12,
    fontSize: 13,
    color: "#0F172A",
  },
  clearButton: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DC2626",
    borderRadius: 16,
    flexShrink: 0,
  },
  clearButtonText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },
});
