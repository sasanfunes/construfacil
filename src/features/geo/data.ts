/**
 * Geografía de Honduras. Es una copia de los datos que carga la migración
 * `20261124000200_reference_data.sql`, en el mismo orden: el id de cada municipio es su
 * posición en esta lista (la base los numera al insertarlos). `geo.test.ts` comprueba
 * que ambas fuentes coincidan.
 */

export type Department = {
  id: number;
  isoCode: string;
  name: string;
  isActive: boolean;
  latitude: number;
  longitude: number;
};

export type Municipality = {
  id: number;
  departmentId: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
};

export const DEPARTMENTS: readonly Department[] = [
  { id: 1, isoCode: "HN-AT", name: "Atlántida", isActive: true, latitude: 15.7597, longitude: -86.7822 },
  { id: 2, isoCode: "HN-CL", name: "Colón", isActive: false, latitude: 15.9167, longitude: -85.95 },
  { id: 3, isoCode: "HN-CM", name: "Comayagua", isActive: true, latitude: 14.46, longitude: -87.65 },
  { id: 4, isoCode: "HN-CP", name: "Copán", isActive: false, latitude: 14.7667, longitude: -88.7833 },
  { id: 5, isoCode: "HN-CR", name: "Cortés", isActive: true, latitude: 15.5042, longitude: -88.025 },
  { id: 6, isoCode: "HN-CH", name: "Choluteca", isActive: false, latitude: 13.3, longitude: -87.19 },
  { id: 7, isoCode: "HN-EP", name: "El Paraíso", isActive: false, latitude: 13.9436, longitude: -86.8494 },
  {
    id: 8,
    isoCode: "HN-FM",
    name: "Francisco Morazán",
    isActive: true,
    latitude: 14.0723,
    longitude: -87.1921,
  },
  {
    id: 9,
    isoCode: "HN-GD",
    name: "Gracias a Dios",
    isActive: false,
    latitude: 15.2667,
    longitude: -83.7667,
  },
  { id: 10, isoCode: "HN-IN", name: "Intibucá", isActive: false, latitude: 14.3, longitude: -88.1833 },
  {
    id: 11,
    isoCode: "HN-IB",
    name: "Islas de la Bahía",
    isActive: false,
    latitude: 16.3167,
    longitude: -86.5333,
  },
  { id: 12, isoCode: "HN-LP", name: "La Paz", isActive: false, latitude: 14.3167, longitude: -87.6833 },
  { id: 13, isoCode: "HN-LE", name: "Lempira", isActive: false, latitude: 14.5833, longitude: -88.5833 },
  { id: 14, isoCode: "HN-OC", name: "Ocotepeque", isActive: false, latitude: 14.4333, longitude: -89.1833 },
  { id: 15, isoCode: "HN-OL", name: "Olancho", isActive: false, latitude: 14.6667, longitude: -86.2194 },
  {
    id: 16,
    isoCode: "HN-SB",
    name: "Santa Bárbara",
    isActive: false,
    latitude: 14.9167,
    longitude: -88.2333,
  },
  { id: 17, isoCode: "HN-VA", name: "Valle", isActive: false, latitude: 13.5333, longitude: -87.4833 },
  { id: 18, isoCode: "HN-YO", name: "Yoro", isActive: false, latitude: 15.1333, longitude: -87.1333 },
];

const MUNICIPALITY_ROWS: ReadonlyArray<
  [departmentId: number, name: string, latitude: number, longitude: number]
> = [
  // Cortés
  [5, "San Pedro Sula", 15.5042, -88.025],
  [5, "Choloma", 15.6144, -87.953],
  [5, "Villanueva", 15.3167, -88.0],
  [5, "Puerto Cortés", 15.8256, -87.9297],
  [5, "La Lima", 15.4333, -87.9167],
  [5, "San Manuel", 15.3333, -87.9167],
  [5, "Santa Cruz de Yojoa", 14.9833, -87.8833],
  [5, "Omoa", 15.7667, -88.0333],
  [5, "Potrerillos", 15.2333, -87.9667],
  [5, "Pimienta", 15.2667, -87.9667],
  [5, "San Antonio de Cortés", 15.1167, -88.0333],
  [5, "San Francisco de Yojoa", 15.0167, -87.9667],
  // Francisco Morazán
  [8, "Distrito Central", 14.0723, -87.1921],
  [8, "Valle de Ángeles", 14.15, -87.0333],
  [8, "Santa Lucía", 14.1167, -87.1167],
  [8, "Talanga", 14.4, -87.0833],
  [8, "Santa Ana", 13.9333, -87.25],
  [8, "Ojojona", 13.9333, -87.3],
  [8, "Sabanagrande", 13.8, -87.25],
  [8, "Guaimaca", 14.5333, -86.8167],
  [8, "Cedros", 14.6, -87.1167],
  [8, "Cantarranas", 14.2667, -87.0167],
  [8, "Tatumbla", 14.0167, -87.0833],
  [8, "San Antonio de Oriente", 13.9833, -87.0],
  // Atlántida
  [1, "La Ceiba", 15.7597, -86.7822],
  [1, "Tela", 15.7833, -87.45],
  [1, "El Porvenir", 15.75, -86.9333],
  [1, "Jutiapa", 15.7667, -86.5167],
  [1, "La Masica", 15.6167, -87.1167],
  [1, "San Francisco", 15.6667, -87.0333],
  [1, "Arizona", 15.6333, -87.3167],
  [1, "Esparta", 15.6667, -87.2333],
  // Comayagua
  [3, "Comayagua", 14.46, -87.65],
  [3, "Siguatepeque", 14.6, -87.8333],
  [3, "La Libertad", 14.7667, -87.6],
  [3, "Villa de San Antonio", 14.3167, -87.6167],
  [3, "Taulabé", 14.6833, -87.9667],
  [3, "Ajuterique", 14.3833, -87.7],
  [3, "Lejamaní", 14.3667, -87.7],
  [3, "San Jerónimo", 14.6, -87.6],
  [3, "El Rosario", 14.5833, -87.75],
  [3, "Esquías", 14.7333, -87.3667],
];

export const MUNICIPALITIES: readonly Municipality[] = MUNICIPALITY_ROWS.map(
  ([departmentId, name, latitude, longitude], index) => ({
    id: index + 1,
    departmentId,
    name,
    latitude,
    longitude,
  }),
);

/** Busca un municipio por departamento y nombre. Lanza un error si no existe (sirve para datos fijos). */
export function municipalityId(departmentId: number, name: string): number {
  const found = MUNICIPALITIES.find((m) => m.departmentId === departmentId && m.name === name);
  if (!found) throw new Error(`Municipio desconocido: ${name} (departamento ${departmentId})`);
  return found.id;
}

/** Bandera de departamentos por id, para búsquedas rápidas. */
export const DEPARTMENT_BY_ID: ReadonlyMap<number, Department> = new Map(DEPARTMENTS.map((d) => [d.id, d]));
