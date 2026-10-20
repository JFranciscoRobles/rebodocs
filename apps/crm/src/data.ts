// What the CRM knows: its properties, with their owner, and the people of the
// team. All of it made up. A CRM of one's own has these in its database; the
// demo keeps the changes made in the record in the browser.

export interface Property {
  id: string;
  title: string;
  kind: string;
  address: string;
  city: string;
  surface: string;
  price: string;
  commission: string;
  term: string;
  owner: string;
  ownerEmail: string;
  adviser: string;
}

export interface Person {
  name: string;
  role: string;
  color: string;
}

export const TEAM: Person[] = [
  { name: 'Ana Ruiz', role: 'Asesora', color: '1F6FB2' },
  { name: 'Luis Mena', role: 'Jurídico', color: 'C2560F' },
];

export const PROPERTIES: Property[] = [
  {
    id: 'casa-lomas',
    title: 'Casa en Lomas del Valle',
    kind: 'Casa',
    address: 'Calle Roble 145, Lomas del Valle',
    city: 'Monterrey',
    surface: '220 m²',
    price: '4850000',
    commission: '5% (cinco por ciento)',
    term: '6 (seis) meses',
    owner: 'Mariana Torres Gil',
    ownerEmail: 'mariana@ejemplo.com',
    adviser: 'Ana Ruiz',
  },
  {
    id: 'depto-condesa',
    title: 'Departamento en la Condesa',
    kind: 'Departamento',
    address: 'Av. Ámsterdam 82, int. 4, Hipódromo Condesa',
    city: 'Ciudad de México',
    surface: '96 m²',
    price: '6200000',
    commission: '4% (cuatro por ciento)',
    term: '4 (cuatro) meses',
    owner: 'Jorge Alberto Peña Ríos',
    ownerEmail: 'jorge@ejemplo.com',
    adviser: 'Ana Ruiz',
  },
  {
    id: 'terreno-zapopan',
    title: 'Terreno en Zapopan',
    kind: 'Terreno',
    address: 'Camino Real 12, Lote 7, Colinas de San Javier',
    city: 'Zapopan',
    surface: '540 m²',
    price: '3100000',
    commission: '6% (seis por ciento)',
    term: '6 (seis) meses',
    owner: 'Lucía Hernández Ortega',
    ownerEmail: 'lucia@ejemplo.com',
    adviser: 'Ana Ruiz',
  },
];

/** The fields of the record, in the order the page shows them, and what each is called. */
export const FIELDS: [keyof Property, string][] = [
  ['owner', 'Propietario'],
  ['ownerEmail', 'Correo del propietario'],
  ['kind', 'Tipo'],
  ['address', 'Dirección'],
  ['city', 'Ciudad'],
  ['surface', 'Superficie'],
  ['price', 'Precio'],
  ['commission', 'Comisión'],
  ['term', 'Vigencia del contrato'],
  ['adviser', 'Asesor'],
];

/** Today, where the person is: not in UTC, which is tomorrow by the evening in the Americas. */
const today = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
};

/** The variables of the template, from the record: the names the template has between braces. */
export function templateValues(property: Property): Record<string, string> {
  return {
    ciudad: property.city,
    fecha: today(),
    propietario: property.owner,
    correo: property.ownerEmail,
    inmueble: `${property.kind.toLowerCase()} en ${property.address}, ${property.city}`,
    superficie: property.surface,
    precio: property.price,
    comision: property.commission,
    vigencia: property.term,
    asesor: property.adviser,
  };
}

/** A price as the page shows it. */
export const money = (value: string) => {
  const n = Number(value);
  return Number.isFinite(n) && value.trim() ? n.toLocaleString('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }) : value;
};

const KEY = 'rebodocs-crm-properties';

/** The properties as the record was last left: the changes made in its page are kept in the browser. */
export function loadProperties(): Property[] {
  try {
    const kept = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Property[] | null;
    if (Array.isArray(kept)) return PROPERTIES.map((p) => ({ ...p, ...kept.find((k) => k.id === p.id) }));
  } catch {
    // Storage that cannot be read: the record as it comes.
  }
  return PROPERTIES;
}

export function saveProperties(properties: Property[]): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(properties));
  } catch {
    // Not kept: the record goes back to how it came on reloading.
  }
}
