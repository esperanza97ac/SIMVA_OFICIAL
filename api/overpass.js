export default async function handler(req, res) {
  const { lat, lon, radius = 5000 } = req.query;
  
  const query = `
    [out:json];
    (
      node["shop"="car_repair"](around:${radius},${lat},${lon});
      node["amenity"="vehicle_repair"](around:${radius},${lat},${lon});
    );
    out body;
  `;
  
  const response = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ data: query })
  });
  
  const data = await response.json();
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.status(200).json(data);
}
