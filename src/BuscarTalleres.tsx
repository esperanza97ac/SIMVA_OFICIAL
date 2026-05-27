import { useState } from 'react';

export default function BuscarTalleres() {
  const [direccion, setDireccion] = useState('');
  const [talleres, setTalleres] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');

  // Función para convertir dirección a coordenadas (geocoding gratis con Nominatim)
  const geocodificar = async (direccion: string) => {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(direccion)}&format=json&limit=1`
    );
    const data = await response.json();
    if (data.length === 0) throw new Error('Dirección no encontrada');
    return { lat: data[0].lat, lon: data[0].lon };
  };

  // Función para buscar talleres usando tu backend en Vercel
  const buscarTalleres = async (lat: number, lon: number) => {
    const response = await fetch(`/api/overpass?lat=${lat}&lon=${lon}&radius=5000`);
    if (!response.ok) throw new Error('Error al buscar talleres');
    const data = await response.json();
    return data.elements || [];
  };

  // Manejador del botón buscar
  const handleBuscar = async () => {
    if (!direccion.trim()) {
      setError('Escribe una dirección');
      return;
    }

    setCargando(true);
    setError('');
    setTalleres([]);

    try {
      // Paso 1: dirección → coordenadas
      const { lat, lon } = await geocodificar(direccion);
      
      // Paso 2: coordenadas → talleres cercanos
      const resultados = await buscarTalleres(parseFloat(lat), parseFloat(lon));
      
      setTalleres(resultados);
      if (resultados.length === 0) {
        setError('No se encontraron talleres cerca de esta dirección');
      }
    } catch (err: any) {
      setError(err.message || 'Ocurrió un error');
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial, sans-serif' }}>
      <h2>🔧 Buscar talleres cercanos</h2>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Ej: Calle Mayor 10, Madrid"
          value={direccion}
          onChange={(e) => setDireccion(e.target.value)}
          style={{ flex: 1, padding: '10px', fontSize: '16px' }}
        />
        <button
          onClick={handleBuscar}
          disabled={cargando}
          style={{ padding: '10px 20px', fontSize: '16px', cursor: 'pointer' }}
        >
          {cargando ? 'Buscando...' : '🔍 Buscar talleres'}
        </button>
      </div>

      {error && (
        <div style={{ color: 'red', marginBottom: '20px', padding: '10px', background: '#ffeeee' }}>
          ⚠️ {error}
        </div>
      )}

      {talleres.length > 0 && (
        <div>
          <h3>📋 Talleres encontrados ({talleres.length})</h3>
          <ul style={{ listStyle: 'none', padding: 0 }}>
            {talleres.map((taller: any) => (
              <li key={taller.id} style={{ 
                border: '1px solid #ddd', 
                borderRadius: '8px', 
                padding: '12px', 
                marginBottom: '10px',
                background: '#f9f9f9'
              }}>
                <strong>🏪 {taller.tags?.name || 'Taller sin nombre'}</strong><br />
                📍 {taller.tags?.['addr:street'] 
                  ? `${taller.tags['addr:street']} ${taller.tags['addr:housenumber'] || ''}`
                  : 'Dirección no disponible'}<br />
                📞 {taller.tags?.phone || 'Teléfono no disponible'}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
