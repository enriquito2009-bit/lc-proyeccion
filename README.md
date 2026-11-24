# Proyección de Pizzas

App web instalable (PWA) que proyecta cuántas pizzas se van a vender en el día, hora por hora, para producir justo lo necesario y reducir merma. Funciona en celular, tableta y computadora. No necesita servidor ni cuenta: todo se guarda en el dispositivo.

## Cómo se usa (gerente)
1. **Tienda › Paso 1:** pega el historial diario de pizzas (fecha, total). La app saca el pronóstico por día de la semana.
2. **Tienda › Paso 2:** pega la tabla Round Pizza de Gateway (Managing Report) de un día de cada día de la semana. La app saca la curva por hora.
3. **Hoy:** cada hora en punto captura lo acumulado en el horario que cerró. Lee el total proyectado, las pizzas por vender y la señal BAJAR / MANTENER / SUBIR.

## Ponerla en internet (una sola vez)
La app es una carpeta de archivos estáticos. Cualquier hosting con HTTPS sirve:
- **Netlify Drop:** entra a app.netlify.com/drop y arrastra esta carpeta. Te da un enlace.
- **GitHub Pages:** sube la carpeta a un repositorio y activa Pages en Settings.
- **Cloudflare Pages / Vercel:** igual, sin paso de compilación.

Con el enlace en el celular: Compartir › "Agregar a pantalla de inicio" (iPhone) o menú ⋮ › "Instalar app" (Android). Después de la primera carga funciona sin señal.

## Varias tiendas y varios dispositivos
- Cada tienda es un perfil. **Tienda › Compartir** genera un enlace con la configuración (curva y pronóstico). Quien lo abre la guarda como tienda propia y después carga sus datos.
- Las capturas del día se guardan solo en el dispositivo donde se capturan. Si quieres verlas en dos dispositivos a la vez, hace falta un servidor (ver CLAUDE.md, sección "Siguientes pasos").

## Probar en tu computadora
`python3 -m http.server 8765` dentro de esta carpeta y abre http://localhost:8765. Para la prueba automática: `python3 tests/e2e.py` (necesita Playwright y el historial de ejemplo).

Más detalle del método y de cómo adaptarlo: `docs/GUIA_TIENDAS.md`.


## Días especiales
Cada tienda puede traer `events` (fecha → nombre y factor). El pronóstico de esa fecha se multiplica por el factor y la pantalla Hoy muestra el nombre del evento y ★ en la semana. El preset de Garbancera incluye posadas, Guadalupe, Navidad, Año Nuevo y Reyes.
