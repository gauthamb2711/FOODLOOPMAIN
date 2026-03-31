import React, { useEffect, useRef, useState } from 'react';
import { SurplusItem } from '@/lib/store';

interface MapViewProps {
  items: SurplusItem[];
}

declare global {
  interface Window {
    L: any;
  }
}

function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
    Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function getColor(status: string) {
  if (status === "on_the_way") return "https://maps.google.com/mapfiles/ms/icons/purple-dot.png";
  if (status === "approved") return "https://maps.google.com/mapfiles/ms/icons/blue-dot.png";
  if (status === "requested") return "https://maps.google.com/mapfiles/ms/icons/orange-dot.png";
  return "https://maps.google.com/mapfiles/ms/icons/green-dot.png";
}

export default function MapView({ items }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapInstance = useRef<any>(null);
  const [userLoc, setUserLoc] = useState<[number, number]>([13.0827, 80.2707]);

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setUserLoc([pos.coords.latitude, pos.coords.longitude]);
      }, () => {
        console.log("Geolocation denied, using fallback");
      });
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current || !window.L) return;

    // Initialize map if not already initialized
    if (!mapInstance.current) {
      mapInstance.current = window.L.map(mapRef.current).setView(userLoc, 12);
      window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap'
      }).addTo(mapInstance.current);
    }

    // Clear existing markers (effectively by removing layers that are markers)
    mapInstance.current.eachLayer((layer: any) => {
      if (layer instanceof window.L.Marker) {
        mapInstance.current.removeLayer(layer);
      }
    });

    // Add user marker
    const userIcon = window.L.icon({
      iconUrl: 'https://maps.google.com/mapfiles/ms/icons/red-pushpin.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
      popupAnchor: [0, -32]
    });
    window.L.marker(userLoc, { icon: userIcon, zIndexOffset: 1000 }).addTo(mapInstance.current).bindPopup("<b>You are here</b><br/>Current Location");

    // Add items
    items.forEach(item => {
      if (!item.lat || !item.lng) return;

      const distance = getDistance(userLoc[0], userLoc[1], item.lat, item.lng);
      const iconColor = getColor(item.status);
      
      const icon = window.L.icon({
        iconUrl: iconColor,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const popupText = `
        <div style="font-family: sans-serif; padding: 5px;">
          <b style="font-size: 14px; color: #111;">${item.food}</b><br/>
          <div style="margin-top: 5px; font-size: 12px; color: #666;">
            Qty: <b>${item.quantity} kg</b><br/>
            Location: ${item.location}<br/>
            ${distance < 3 ? '<span style="color: #10b981; font-weight: bold; display: block; margin-top: 4px;">Nearby Recommended</span>' : ''}
          </div>
        </div>
      `;

      window.L.marker([item.lat, item.lng], { icon })
        .addTo(mapInstance.current)
        .bindPopup(popupText);
    });

    // Adjust view to show markers if there are items
    if (items.length > 0) {
      const markers = items.filter(i => i.lat && i.lng).map(i => [i.lat, i.lng]);
      if (markers.length > 0) {
        try {
          mapInstance.current.fitBounds([...markers, userLoc], { padding: [50, 50], maxZoom: 15 });
        } catch (e) {
          console.error("Map fitBounds failed");
        }
      }
    }

  }, [items, userLoc]);

  return (
    <div className="w-full rounded-2xl overflow-hidden border border-border/50 shadow-2xl bg-card">
      {/* Map container */}
      <div className="relative w-full h-[500px]">
        {!window.L && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/20 backdrop-blur-sm z-10">
            <div className="text-center">
              <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading interactive map...</p>
            </div>
          </div>
        )}
        <div id="map" ref={mapRef} className="w-full h-full z-0" />

        {/* Map Legend */}
        <div
          style={{
            position: 'absolute',
            bottom: '24px',
            left: '12px',
            zIndex: 1000,
            background: 'rgba(10, 20, 15, 0.85)',
            backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: '14px',
            padding: '12px 16px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
            minWidth: '180px',
          }}
        >
          <div style={{ fontSize: '11px', fontWeight: '700', color: '#9ca3af', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: '10px' }}>
            Map Legend
          </div>
          {[
            { color: '#22c55e', label: 'Available', sub: 'Ready for pickup' },
            { color: '#f97316', label: 'Requested', sub: 'Awaiting approval' },
            { color: '#3b82f6', label: 'Approved', sub: 'Pickup confirmed' },
            { color: '#a855f7', label: 'On the way', sub: '🚚 Driver moving' },
          ].map((item) => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{
                width: '13px', height: '13px', borderRadius: '50%',
                backgroundColor: item.color,
                boxShadow: `0 0 6px ${item.color}88`,
                flexShrink: 0,
              }} />
              <div>
                <div style={{ fontSize: '12px', fontWeight: '600', color: '#f1f5f9', lineHeight: 1.2 }}>
                  {item.label}
                </div>
                <div style={{ fontSize: '10px', color: '#6b7280', lineHeight: 1.2 }}>{item.sub}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats bar below map */}
      <div style={{
        display: 'flex', gap: '0', borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        {[
          { color: '#22c55e', label: 'Available', count: items.filter(i => i.status === 'available').length },
          { color: '#f97316', label: 'Requested', count: items.filter(i => i.status === 'requested').length },
          { color: '#3b82f6', label: 'Approved', count: items.filter(i => i.status === 'approved').length },
          { color: '#a855f7', label: 'Moving', count: items.filter(i => i.status === 'on_the_way').length },
        ].map((s, idx, arr) => (
          <div key={s.label} style={{
            flex: 1, textAlign: 'center', padding: '10px 8px',
            borderRight: idx < arr.length - 1 ? '1px solid rgba(255,255,255,0.07)' : 'none',
          }}>
            <div style={{ fontSize: '18px', fontWeight: '700', color: s.color }}>{s.count}</div>
            <div style={{ fontSize: '10px', color: '#6b7280', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: s.color, display: 'inline-block' }}></span>
              {s.label}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
