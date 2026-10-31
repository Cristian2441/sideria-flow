# Sideria Flow

Plataforma web para la gestión de solicitudes de compra empresariales. Digitaliza el proceso de creación, envío y aprobación de solicitudes, con soporte multiempresa, flujo de aprobaciones por monto, API REST con autenticación por API Key y trazabilidad completa de cada cambio de estado.

---

## Tabla de contenidos

- [Stack tecnológico](#stack-tecnológico)
- [Requisitos previos](#requisitos-previos)
- [Instalación y configuración](#instalación-y-configuración)
- [Variables de entorno](#variables-de-entorno)
- [Base de datos y migraciones](#base-de-datos-y-migraciones)
- [Datos iniciales (seed)](#datos-iniciales-seed)
- [Ejecución](#ejecución)
- [Tests](#tests)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Modelo de datos](#modelo-de-datos)
- [Flujo de estados](#flujo-de-estados)
- [Reglas de negocio](#reglas-de-negocio)
- [API REST](#api-rest)
- [Roles y permisos](#roles-y-permisos)

---

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16, App Router, React 19 |
| Lenguaje | TypeScript |
| Base de datos | PostgreSQL ≥ 15 |
| ORM | Prisma 8 (RC) |
| Estilos | Tailwind CSS 4 + shadcn/ui |
| Validaciones | Zod 4 |
| Autenticación | JWT con `jose` |
| Hashing de contraseñas | bcryptjs |
| Tests | Vitest 5 |
| Package manager | pnpm |

---

## Requisitos previos

- **Node.js** ≥ 20
- **pnpm** ≥ 9 — instalar con `npm install -g pnpm`
- **PostgreSQL** ≥ 15 (local o en la nube, ej. Supabase)

---

## Instalación y configuración

```bash
# 1. Clonar el repositorio
git clone <url-del-repositorio>
cd sideria-flow

# 2. Instalar dependencias
pnpm install

# 3. Configurar variables de entorno
cp .env.example .env
# Editar .env con tus valores reales
```

---

## Variables de entorno

Copia `.env.example` a `.env` y completa los valores:

```dotenv
# Conexión a PostgreSQL (obligatorio)
DATABASE_URL="postgresql://user:password@localhost:5432/sideria_flow"

# Secreto JWT — mínimo 32 caracteres (obligatorio)
JWT_SECRET="tu_secreto_super_seguro_de_al_menos_32_chars"

# Duración de la sesión en segundos (opcional, default: 28800 = 8 horas)
JWT_EXPIRES_IN=28800

# Entorno (opcional, controla cookies seguras)
NODE_ENV=development
```

> **Nota:** `JWT_SECRET` debe tener al menos 32 caracteres. La aplicación lanzará un error al arrancar si no se cumple esta condición.

---

## Base de datos y migraciones

El proyecto usa **Prisma 8 RC** con un esquema definido en `src/prisma/contract.prisma`.

Las migraciones y la lógica de negocio crítica (validaciones de transiciones de estado, cálculo de montos, reglas de idempotencia) están implementadas como **triggers de PostgreSQL** que se aplican junto a las migraciones.

```bash
# Inicializar la base de datos (crea tablas, tipos y triggers)
pnpm db:init
```

---

## Datos iniciales (seed)

El seed crea un entorno completo para probar todas las funcionalidades:

```bash
pnpm db:seed
```

### Lo que crea el seed

- **2 empresas independientes**: Empresa Alpha y Empresa Beta
- **6 usuarios** (3 por empresa, uno de cada rol)
- **2 API Keys** (una por empresa)
- **8 solicitudes de compra** en distintos estados

### Credenciales de acceso

**Empresa Alpha**

| Rol | Email | Contraseña |
|---|---|---|
| Solicitante | `solicitante@alpha.cl` | `Password123!` |
| Jefatura | `jefatura@alpha.cl` | `Password123!` |
| Finanzas | `finanzas@alpha.cl` | `Password123!` |

API Key: `sf_alpha_key_1234567890abcdef`

**Empresa Beta**

| Rol | Email | Contraseña |
|---|---|---|
| Solicitante | `solicitante@beta.cl` | `Password123!` |
| Jefatura | `jefatura@beta.cl` | `Password123!` |
| Finanzas | `finanzas@beta.cl` | `Password123!` |

API Key: `sf_beta_key_abcdef1234567890`

---

## Ejecución

```bash
# Desarrollo (con hot reload)
pnpm dev

# Build de producción
pnpm build

# Servidor de producción
pnpm start
```

La aplicación queda disponible en `http://localhost:3000`.

---

## Tests

```bash
# Ejecutar todos los tests (single run)
pnpm test

# Modo watch (re-ejecuta al guardar)
pnpm test:watch

# Con reporte de cobertura
pnpm test:coverage
```

Los tests requieren una base de datos activa con el seed aplicado, ya que algunos casos validan el comportamiento de los triggers de PostgreSQL contra datos reales.

### Cobertura de tests

| Archivo | HU | Qué verifica |
|---|---|---|
| `hu-02.company-isolation.test.ts` | HU-02 | Aislamiento entre empresas |
| `hu-03.role-permissions.test.ts` | HU-03 | Permisos por rol |
| `hu-18.pending-inbox.test.ts` | HU-18 | Bandeja de aprobaciones pendientes |
| `hu-19.api-key-auth.test.ts` | HU-19 | Autenticación por API Key |
| `hu-21.validation-errors.test.ts` | HU-21 | Errores de validación coherentes |
| `hu-22.idempotency.test.ts` | HU-22 | Idempotencia de la API externa |
| `hu-27.business-rules.test.ts` | HU-27 | Reglas de negocio (umbral 500k, no self-approval, rechazo con motivo) |
| `hu-28.cross-company.test.ts` | HU-28 | Aislamiento por empresa vía API |

---

## Estructura del proyecto

```
sideria-flow/
├── prisma/
│   └── seed.ts                  # Datos iniciales
├── src/
│   ├── app/
│   │   ├── api/                 # Route handlers (Next.js)
│   │   ├── dashboard/           # Páginas del dashboard
│   │   ├── login/               # Página de autenticación
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── components/
│   │   └── ToastProvider.tsx
│   ├── lib/
│   │   ├── schemas/             # Esquemas Zod de validación
│   │   ├── api-key-guard.ts     # Guard para API Keys
│   │   ├── api-response.ts      # Helpers de respuesta HTTP
│   │   ├── auth.ts              # JWT (sign / verify)
│   │   ├── guards.ts            # Guards de rol y permisos
│   │   ├── prisma.ts            # Instancia del cliente Prisma
│   │   ├── rate-limiter.ts      # Rate limiting
│   │   ├── session.ts           # Lectura de sesión desde cookie
│   │   └── types.ts             # Tipos compartidos y constantes
│   └── prisma/
│       ├── contract.prisma      # Esquema Prisma
│       └── db.ts                # Cliente de base de datos
└── tests/                       # Tests Vitest
```

---

## Modelo de datos

```
Company
  ├── id (PK)
  ├── name
  └── createdAt

User
  ├── id (PK)
  ├── companyId (FK → Company)
  ├── email (unique)
  ├── name
  ├── passwordHash
  ├── role: REQUESTER | MANAGER | FINANCE
  └── active

PurchaseRequest
  ├── id (PK)
  ├── companyId (FK → Company)
  ├── requesterId (FK → User)
  ├── title
  ├── description
  ├── costCenter
  ├── status: DRAFT | PENDING_MANAGER | PENDING_FINANCE | APPROVED | REJECTED
  ├── totalAmount (calculado por trigger)
  ├── source: WEB | API
  ├── externalId (para idempotencia API)
  └── payloadHash

RequestItem
  ├── id (PK)
  ├── requestId (FK → PurchaseRequest, cascade delete)
  ├── companyId
  ├── description
  ├── quantity
  └── unitPrice

ApprovalHistory (inmutable por trigger)
  ├── id (PK)
  ├── requestId (FK → PurchaseRequest)
  ├── companyId
  ├── actorId (FK → User)
  ├── fromStatus
  ├── toStatus
  └── comment

ApiKey
  ├── id (PK)
  ├── companyId (FK → Company)
  ├── name
  ├── prefix
  ├── keyHash (almacenado como SHA-256, no reversible)
  └── revokedAt
```

---

## Flujo de estados

```
DRAFT
  └─ [enviar] ──────────────────────────────► PENDING_MANAGER
                                                    │
                          total ≤ $500.000 ─────────┤
                                                    │
                          ┌──────── APPROVED ◄──────┘
                          │
                          └──── total > $500.000 ──► PENDING_FINANCE
                                                           │
                                               ┌─────── APPROVED
                                               └─────── REJECTED
                                                  (motivo obligatorio)
```

- `APPROVED` y `REJECTED` son **estados finales** — no se reabren.
- Una solicitud rechazada no se puede editar; se debe crear una nueva.

---

## Reglas de negocio

| # | Regla |
|---|---|
| RN-01 | Solicitudes de hasta $500.000 (inclusive) requieren solo aprobación de Jefatura. |
| RN-02 | Solicitudes superiores a $500.000 requieren aprobación de Jefatura y luego de Finanzas. |
| RN-03 | Un usuario no puede aprobar sus propias solicitudes (403). |
| RN-04 | Rechazar requiere motivo obligatorio; vacío o solo espacios es inválido. |
| RN-05 | `totalAmount = Σ (cantidad × precioUnitario)`, calculado por trigger en la BD. |
| RN-06 | Una solicitud rechazada no se reabre; se crea una nueva. |
| RN-07 | Si Finanzas rechaza, la solicitud queda RECHAZADA definitivamente. |
| RN-08 | Las solicitudes entrantes por API se crean en estado `PENDING_MANAGER`. |
| RN-09 | Toda consulta y mutación se filtra por el `companyId` del JWT, nunca por parámetro del cliente. |
| RN-10 | Una API Key está asociada a una empresa; no puede operar sobre datos de otra. |

---

## API REST

La API REST está disponible bajo el prefijo `/api/v1/` y permite a sistemas externos registrar solicitudes de compra.

### Autenticación

Todas las rutas `/api/v1/*` requieren autenticación mediante API Key:

```
X-API-Key: sf_alpha_key_1234567890abcdef
# o bien:
Authorization: Bearer sf_alpha_key_1234567890abcdef
```

La clave está asociada a una empresa; cualquier solicitud creada usará el `companyId` de esa clave, ignorando cualquier valor que venga en el body.

### Ejemplos con cURL (HU-23)

#### 1. Creación exitosa (201 Created)

```bash
curl -X POST http://localhost:3000/api/v1/purchase-requests \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sf_alpha_key_1234567890abcdef" \
  -d '{
    "title": "Compra de monitores para TI",
    "description": "5 monitores para el equipo de desarrollo",
    "costCenter": "CC-TI",
    "externalId": "ERP-2024-001",
    "items": [
      {
        "description": "Monitor 27\" 4K",
        "quantity": 5,
        "unitPrice": 180000
      }
    ]
  }'
```

**Respuesta (201 Created):**
```json
{
  "data": {
    "id": "c1f73b64-18d4-4bb0-80ea-3e9bc6625841",
    "title": "Compra de monitores para TI",
    "description": "5 monitores para el equipo de desarrollo",
    "costCenter": "CC-TI",
    "status": "PENDING_MANAGER",
    "totalAmount": 900000,
    "source": "API",
    "externalId": "ERP-2024-001",
    "createdAt": "2026-10-30T15:00:00.000Z"
  }
}
```

#### 2. Error de autenticación (401 Unauthorized)

```bash
curl -X POST http://localhost:3000/api/v1/purchase-requests \
  -H "Content-Type: application/json" \
  -H "X-API-Key: clave_invalida_o_inexistente" \
  -d '{ "title": "Prueba" }'
```

**Respuesta (401 Unauthorized):**
```json
{
  "error": {
    "code": "INVALID_API_KEY",
    "message": "API Key inválida o no existe.",
    "details": []
  }
}
```

#### 3. Error de validación de campos (422 Unprocessable Entity)

```bash
curl -X POST http://localhost:3000/api/v1/purchase-requests \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sf_alpha_key_1234567890abcdef" \
  -d '{
    "title": "",
    "description": "Falta información requerida",
    "costCenter": "CC-TI",
    "items": [
      {
        "description": "Item con datos erróneos",
        "quantity": 0,
        "unitPrice": -100
      }
    ]
  }'
```

**Respuesta (422 Unprocessable Entity):**
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Error de validación en los campos de la solicitud.",
    "details": [
      { "field": "title", "message": "El título es requerido" },
      { "field": "items.0.quantity", "message": "La cantidad mínima es 1" },
      { "field": "items.0.unitPrice", "message": "El precio no puede ser negativo" }
    ]
  }
}
```

#### 4. Conflicto / Duplicado (409 Conflict)

```bash
# Envío de solicitud con un externalId ya registrado con contenido distinto:
curl -X POST http://localhost:3000/api/v1/purchase-requests \
  -H "Content-Type: application/json" \
  -H "X-API-Key: sf_alpha_key_1234567890abcdef" \
  -d '{
    "title": "Otro título distinto",
    "description": "Contenido modificado",
    "costCenter": "CC-VENTAS",
    "externalId": "ERP-2024-001",
    "items": [
      {
        "description": "Teclados",
        "quantity": 2,
        "unitPrice": 45000
      }
    ]
  }'
```

**Respuesta (409 Conflict):**
```json
{
  "error": {
    "code": "IDEMPOTENCY_CONFLICT",
    "message": "Ya existe una solicitud registrada con este external_id pero con datos diferentes.",
    "details": [
      { "field": "external_id", "message": "El external_id 'ERP-2024-001' ya está en uso con otro contenido." }
    ]
  }
}
```

### Campos del body

| Campo | Tipo | Requerido | Descripción |
|---|---|---|---|
| `title` | string | Sí | Título de la solicitud |
| `description` | string | Sí | Descripción del requerimiento |
| `costCenter` | string | Sí | Centro de costo |
| `externalId` | string | No | ID único en el sistema externo (para idempotencia) |
| `items` | array | Sí (mín. 1) | Líneas de producto |
| `items[].description` | string | Sí | Descripción del producto |
| `items[].quantity` | integer | Sí | Cantidad (> 0) |
| `items[].unitPrice` | integer | Sí | Precio unitario en CLP (≥ 0) |

### Códigos de respuesta

| Código | Situación |
|---|---|
| `201` | Solicitud creada correctamente |
| `200` | Solicitud ya existente (idempotencia: mismo `externalId`) |
| `400` | JSON inválido o mal formado |
| `401` | API Key ausente o inválida |
| `409` | `externalId` ya existe con datos distintos |
| `422` | Error de validación por campo |
| `429` | Límite de tasa excedido |
| `500` | Error interno del servidor |

### Formato de errores

Todos los errores siguen el mismo formato:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Los datos enviados no son válidos.",
    "details": [
      { "field": "items[0].quantity", "message": "Expected number, received string" }
    ]
  }
}
```

### Idempotencia

Si envías la misma solicitud más de una vez (ej. reintento por error de red), usa el campo `externalId` o el header `Idempotency-Key`:

- Mismo `externalId` + mismo payload → devuelve la solicitud existente (200).
- Mismo `externalId` + payload diferente → error 409.

---

## Roles y permisos

| Acción | Solicitante | Jefatura | Finanzas |
|---|---|---|---|
| Crear solicitud | ✅ | ✅ | ✅ |
| Editar borrador propio | ✅ | ✅ | ✅ |
| Enviar solicitud a aprobación | ✅ | ✅ | ✅ |
| Ver solicitudes propias | ✅ | — | — |
| Ver todas las solicitudes de la empresa | — | ✅ | ✅ |
| Aprobar / rechazar en primera etapa | — | ✅ | — |
| Aprobar / rechazar en segunda etapa | — | — | ✅ |
| Aprobar su propia solicitud | ❌ | ❌ | ❌ |

> Los permisos se validan siempre en el servidor. La UI puede ocultar botones, pero la regla de negocio se aplica en el backend.
