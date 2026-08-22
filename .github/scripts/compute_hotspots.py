"""
Motor de zonas calientes de demanda para MoTaxi.
Usa DBSCAN para encontrar clusters de viajes por zona geográfica,
hora del día y día de la semana, y escribe los resultados en la BD
via el endpoint interno del backend.

Requiere variables de entorno:
  API_URL          — URL base del backend (ej: https://motaxi-api.julii1295.workers.dev)
  INTERNAL_SECRET  — Valor del secret INTERNAL_API_SECRET configurado en Cloudflare
"""

import os
import sys
import json
import math
import requests
import numpy as np
from sklearn.cluster import DBSCAN
from datetime import datetime, timezone, timedelta

API_URL = os.environ["API_URL"].rstrip("/")
INTERNAL_SECRET = os.environ["INTERNAL_SECRET"]
HEADERS = {"x-internal-secret": INTERNAL_SECRET, "Content-Type": "application/json"}

COLOMBIA_TZ = timezone(timedelta(hours=-5))

# Radio DBSCAN en radianes (250 metros sobre la superficie terrestre)
EARTH_RADIUS_KM = 6371.0
EPS_METERS = 250
EPS_RAD = EPS_METERS / (EARTH_RADIUS_KM * 1000)
MIN_SAMPLES = 3  # mínimo de viajes para considerar un cluster válido


def fetch_trips() -> list[dict]:
    resp = requests.get(
        f"{API_URL}/analytics/trips-export",
        headers={"x-internal-secret": INTERNAL_SECRET},
        params={"days": 90},
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json().get("trips", [])


def haversine_km(lat1, lon1, lat2, lon2) -> float:
    r = 6371.0
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = math.sin(dlat / 2) ** 2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def compute_hotspots(trips: list[dict], hour_of_day: int | None = None) -> list[dict]:
    """
    Calcula clusters con DBSCAN para el subconjunto de viajes dado.
    hour_of_day=None → todos los viajes (patrón general).
    """
    if not trips:
        return []

    # Filtrar por hora si se especifica
    subset = trips
    if hour_of_day is not None:
        subset = [t for t in trips if int(t.get("hour", -1)) == hour_of_day]

    if len(subset) < MIN_SAMPLES:
        return []

    coords = np.array([
        [math.radians(float(t["pickup_latitude"])), math.radians(float(t["pickup_longitude"]))]
        for t in subset
        if t.get("pickup_latitude") and t.get("pickup_longitude")
    ])

    if len(coords) < MIN_SAMPLES:
        return []

    db = DBSCAN(eps=EPS_RAD, min_samples=MIN_SAMPLES, algorithm="ball_tree", metric="haversine")
    labels = db.fit_predict(coords)

    hotspots = []
    unique_labels = set(labels) - {-1}  # -1 = ruido

    max_count = max((np.sum(labels == lbl) for lbl in unique_labels), default=1)

    for lbl in unique_labels:
        mask = labels == lbl
        cluster_coords = coords[mask]
        trip_count = int(np.sum(mask))

        # Centroide del cluster
        center_lat = float(np.degrees(np.mean(cluster_coords[:, 0])))
        center_lon = float(np.degrees(np.mean(cluster_coords[:, 1])))

        # Score normalizado 0-1
        score = round(trip_count / max_count, 4)

        hotspots.append({
            "latitude": round(center_lat, 5),
            "longitude": round(center_lon, 5),
            "radius_meters": EPS_METERS,
            "score": score,
            "trip_count": trip_count,
            "hour_of_day": hour_of_day,
            "label": None,  # se puede enriquecer con geocodificación inversa en el futuro
        })

    # Ordenar por score descendente
    hotspots.sort(key=lambda h: h["score"], reverse=True)
    return hotspots


def main():
    print(f"[{datetime.now(COLOMBIA_TZ).strftime('%Y-%m-%d %H:%M')} CO] Iniciando cálculo de zonas calientes…")

    trips = fetch_trips()
    print(f"  → {len(trips)} viajes históricos obtenidos")

    if len(trips) < MIN_SAMPLES:
        print("  → Datos insuficientes. Se necesitan al menos", MIN_SAMPLES, "viajes con GPS.")
        sys.exit(0)

    now_co = datetime.now(COLOMBIA_TZ)
    current_hour = now_co.hour

    all_hotspots: list[dict] = []

    # 1. Hotspots para la hora actual (mayor relevancia)
    hourly = compute_hotspots(trips, hour_of_day=current_hour)
    print(f"  → Hora {current_hour:02d}h: {len(hourly)} clusters encontrados")
    all_hotspots.extend(hourly[:5])

    # 2. Hotspots generales (sin filtro de hora) — como respaldo si no hay suficientes
    if len(all_hotspots) < 3:
        general = compute_hotspots(trips, hour_of_day=None)
        print(f"  → Generales: {len(general)} clusters encontrados")
        all_hotspots.extend(general[:5 - len(all_hotspots)])

    # Deduplicar hotspots muy cercanos (< 300 m entre centros)
    deduped: list[dict] = []
    for h in all_hotspots:
        too_close = any(
            haversine_km(h["latitude"], h["longitude"], d["latitude"], d["longitude"]) < 0.3
            for d in deduped
        )
        if not too_close:
            deduped.append(h)

    print(f"  → {len(deduped)} zonas calientes únicas para enviar")

    if not deduped:
        print("  → Sin zonas calientes para reportar.")
        sys.exit(0)

    # Enviar al backend
    resp = requests.post(
        f"{API_URL}/analytics/hotspots",
        headers=HEADERS,
        json={"hotspots": deduped},
        timeout=30,
    )
    resp.raise_for_status()
    result = resp.json()
    print(f"  → Backend confirmó {result.get('count', '?')} hotspots escritos y notificaciones enviadas.")
    print("Listo.")


if __name__ == "__main__":
    main()
