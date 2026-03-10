import { Router } from "express";

const router = Router();

function cleanPolishAddress(address) {
  return String(address)
    .replace(/\bul\.\s*/gi, "")
    .replace(/\baleja\s*/gi, "")
    .replace(/\bal\.\s*/gi, "")
    .replace(/\bos\.\s*/gi, "")
    .replace(/\bpl\.\s*/gi, "")
    .replace(/\bplac\s+/gi, "")
    .trim();
}

async function geocodeAddress(address) {
  const cleaned = cleanPolishAddress(address);
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(cleaned)}&countrycodes=pl&limit=1`;
  const res = await fetch(url, {
    headers: { "User-Agent": "SzczyptaSmaku/1.0", Accept: "application/json" },
  });
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!Array.isArray(data) || data.length === 0) return null;
  return {
    lat: parseFloat(data[0].lat),
    lng: parseFloat(data[0].lon),
    displayName: data[0].display_name,
  };
}

async function calculateRouteDistance(fromLat, fromLng, toLat, toLng) {
  const url = `https://router.project-osrm.org/route/v1/driving/${fromLng},${fromLat};${toLng},${toLat}?overview=false`;
  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json().catch(() => null);
  if (!data?.routes?.length) return null;
  return {
    distanceKm: Math.round(data.routes[0].distance / 100) / 10,
    durationMin: Math.round(data.routes[0].duration / 60),
  };
}

/** POST /api/calculate-delivery - body: { address, companyLat, companyLng } */
router.post("/calculate-delivery", async (req, res) => {
  try {
    const { address, companyLat, companyLng } = req.body ?? {};
    if (!address || companyLat == null || companyLng == null) {
      return res.status(400).json({ error: "Missing address or company coordinates" });
    }
    const geo = await geocodeAddress(address);
    if (!geo) {
      return res.json({ error: "address_not_found", message: "Nie znaleziono adresu" });
    }
    const route = await calculateRouteDistance(
      Number(companyLat),
      Number(companyLng),
      geo.lat,
      geo.lng
    );
    if (!route) {
      return res.json({ error: "route_not_found", message: "Nie udało się obliczyć trasy" });
    }
    res.json({
      distanceKm: route.distanceKm,
      durationMin: route.durationMin,
      customerLat: geo.lat,
      customerLng: geo.lng,
      customerAddress: geo.displayName,
    });
  } catch (err) {
    console.error("calculate-delivery error:", err);
    res.status(500).json({ error: "internal_error", message: String(err) });
  }
});

export default router;
