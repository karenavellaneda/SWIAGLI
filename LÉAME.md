# SWIACLI — Sistema Web Integral para la Gestión Administrativa, Contable, Laboral y de Inventario

Aplicación web estática (HTML5, CSS3 y JavaScript con ES Modules) desarrollada para una cafetería-panadería en Tunja, Boyacá, Colombia. Funciona sin backend y se puede publicar directamente en **GitHub Pages**.

## Arquitectura por capas

- `js/data/`: capa de persistencia (`repository.js` sobre `localStorage` con transacciones atómicas) y datos iniciales (`seed.js`).
- `js/services/`: lógica de negocio pura sin acceso al DOM (`authService`, `inventoryService`, `cashSalesService`, `accountingService`, `hrService`, `scheduleAttendanceService`, `reportService`, `dashboardService`).
- `js/utils/`: formateo en COP (`$16.000`) y fechas locales, validaciones, criptografía en cliente (`SubtleCrypto` SHA-256 + sal) y exportación PDF (`jsPDF` + `jsPDF-AutoTable`).
- `js/ui/`: vistas, componentes reutilizables, diálogos accesibles y enrutador con control de permisos por rol.

## Usuarios de ejemplo

Al iniciar por primera vez se cargan los datos de ejemplo:

| Rol | Usuario | Contraseña |
|---|---|---|
| Administrador | `admin` | `Admin123` |
| Vendedor | `vendedor` | `Clave1234` |
| Trabajador | `trabajador` | `Clave1234` |

En cualquier momento puedes restaurar el estado inicial con el botón **"Restablecer datos de ejemplo"**.

## Cómo probarlo localmente

> **Importante:** No abras `index.html` directamente con doble clic (`file:///...`), ya que los navegadores bloquean los **ES Modules** (`import`/`export`) y `SubtleCrypto` fuera de un servidor local o HTTPS.

1. Abre la carpeta del proyecto en **Visual Studio Code**.
2. Instala la extensión **Live Server**.
3. Haz clic derecho sobre `index.html` y selecciona **Open with Live Server**.
4. Para ejecutar las pruebas automatizadas de reglas críticas, abre `tests.html` desde el mismo servidor local.

## Cómo publicarlo en GitHub Pages

1. Crea un repositorio público en GitHub y sube el contenido de la carpeta del proyecto (asegúrate de que `index.html`, `tests.html`, `css/` y `js/` queden en la raíz de la rama `main`).
2. Entra en el repositorio a **Settings -> Pages**.
3. En **Source**, selecciona **Deploy from a branch**.
4. En **Branch**, elige **`main`** y carpeta **`/ (root)`**, y haz clic en **Save**.
5. Espera unos minutos y accede al enlace publicado (`https://tu-usuario.github.io/nombre-repo/`).

## Limitaciones académicas y de entorno

- **Persistencia local:** toda la información se guarda en el `localStorage` del navegador; no se sincroniza entre distintos dispositivos o navegadores.
- **Seguridad simulada del lado del cliente:** las contraseñas se almacenan con hash SHA-256 + sal mediante `SubtleCrypto` y el restablecimiento de contraseña muestra el token en pantalla al no existir servidor de correo ni backend. En un entorno productivo real, la autenticación, autorización y persistencia deben residir en un servidor seguro.
- **Pagos al personal:** el módulo contable registra pagos realizados al personal, pero no liquida ni calcula nómina legal automáticamente.