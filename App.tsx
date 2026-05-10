import * as Location from "expo-location";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_DEFAULT } from "react-native-maps";

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
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const mapRef = useRef<any | null>(null);

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

  return (
    <View style={styles.screen}>
      <StatusBar style="auto" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Dónde estoy</Text>
        <Text style={styles.headerSubtitle}>Tu ubicación en tiempo real</Text>
      </View>

      <View style={styles.card}>
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
              />
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
          </>
        ) : (
          <View style={styles.centered}>
            <Text>No hay datos de ubicación.</Text>
          </View>
        )}
      </View>

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
    padding: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 4,
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
});
