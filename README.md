# Farmacia Selene — Sistema de Gestión

![Tests](https://github.com/luc881/pharmatrack-frontend/actions/workflows/test.yml/badge.svg)

Sistema de gestión de inventario, ventas y compras para Farmacia Selene. Desarrollado como proyecto de titulación.

## Tecnologías

- **React 19** + **Vite 7**
- **Material UI 7** (MUI)
- **React Router 7**
- **SWR 2** — fetching y caché de datos
- **Axios** — cliente HTTP con interceptores JWT
- **Framer Motion** — animaciones

## Módulos del sistema

| Módulo | Descripción |
|---|---|
| Dashboard | Estadísticas del mes: ventas, ingresos, productos, lotes por vencer |
| Productos | Catálogo de productos con categorías, marcas e ingredientes |
| Lotes | Control de lotes con fechas de vencimiento y stock |
| Compras | Registro de órdenes de compra a proveedores |
| Ventas | Punto de venta con detalle de productos, pagos y uso de lotes |
| Devoluciones | Registro de productos devueltos |
| Proveedores | Directorio de proveedores |
| Sucursales | Gestión de sucursales de la farmacia |
| Calendario | Vista mensual de lotes próximos a vencer |
| Usuarios | Administración de usuarios del sistema |
| Roles | Control de roles y permisos |
| Sensor | Monitoreo de temperatura y humedad vía ESP32 |

## Requisitos previos

- Node.js 18 o superior
- npm 9 o superior
- Backend de Farmacia Selene corriendo (ver repositorio del backend)

## Instalación local

```bash
# Clonar el repositorio
git clone <url-del-repo>
cd pharmatrack-frontend

# Instalar dependencias
npm install

# Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con la URL del backend
```

## Variables de entorno

Crear un archivo `.env.local` en la raíz del proyecto:

```env
VITE_SERVER_URL=https://api.farmaciaselene.com
```

Para desarrollo local contra un backend local:

```env
VITE_SERVER_URL=http://localhost:8000
```

## Comandos

```bash
# Desarrollo con hot-reload
npm run dev

# Build de producción
npm run build

# Preview del build de producción
npm run preview
```

## Deploy en Vercel

El proyecto incluye `vercel.json` con las reglas de rewrite necesarias para que React Router funcione correctamente con rutas del lado del cliente.

1. Importar el repositorio en [vercel.com](https://vercel.com)
2. Agregar la variable de entorno `VITE_SERVER_URL` en la configuración del proyecto
3. Vercel detecta automáticamente Vite y configura el build

## Autenticación

El sistema utiliza JWT. Las credenciales se almacenan en `sessionStorage` (se limpian al cerrar el navegador).

**Roles disponibles:**
- `admin` — acceso completo a todos los módulos
- `empleado` — acceso restringido (sin gestión de usuarios, roles ni sensor)

## Estructura del proyecto

```
src/
├── actions/        # Hooks de datos con SWR (fetching, caché)
├── auth/           # Contexto y guardas de autenticación JWT
├── components/     # Componentes reutilizables
├── layouts/        # Layouts de dashboard y autenticación
├── lib/            # Axios instance y endpoints
├── pages/          # Páginas por ruta
├── routes/         # Definición de rutas y guardas
└── sections/       # Vistas y formularios de cada módulo
```

## Backend

El backend (FastAPI + PostgreSQL) está disponible en un repositorio separado.

- API base: `https://api.farmaciaselene.com`
- Documentación interactiva: `https://api.farmaciaselene.com/docs`
