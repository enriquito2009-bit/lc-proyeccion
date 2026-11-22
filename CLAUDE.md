# CLAUDE.md — Proyección de Pizzas

App estática (HTML + CSS + JS sin dependencias ni paso de compilación). Español de México. El dueño (Enrique, gerente de LC Garbancera) prefiere respuestas cortas y al grano.

## Archivos
- `index.html`: dos vistas, Hoy (proyección) y Tienda (configuración).
- `app.js`: toda la lógica. Secciones: almacenamiento, análisis de datos, proyección, vista Hoy, vista Tienda, compartir, arranque.
- `sw.js`: service worker (red primero, caché de respaldo). Sube `V` cuando cambies archivos que deban refrescarse.
- `presets/garbancera.json`: ejemplo real de LC Garbancera (curva 70% últimas 4 semanas + 30% jul-ago).
- `tests/e2e.py`: prueba de punta a punta con Playwright (sirve el sitio en :8765).

## Reglas del modelo (no cambiar sin probar)
- Proyección = acumulado + pronóstico × (1 − c), con c = % acumulado histórico al cerrar ese horario. Si no hay pronóstico, usa acumulado / c.
- Horario "10:00 - 11:00" = hora 10; el acumulado se captura al cerrar (a las 11:00). Índice de la curva = hora − 9 (la curva cubre 09:00 a 23:00).
- Rango ≈80% = total × (1 ∓ 1.6 × error típico de esa hora). Errores por hora (`DEFAULT_MAPE`) salen de Garbancera.
- Antes de c < 8% la señal dice "muy temprano".
- Las capturas nunca se bloquean: solo avisa "Ojo" si el número rompe el orden.
- Tabla de Gateway: la columna "4 Week Avg" es la única con un decimal; así se distingue de Amount / Previous Week / Scheduled.

## Siguientes pasos posibles
1. **Sincronizar capturas entre dispositivos:** agregar un backend pequeño (Supabase, Firebase o un Worker de Cloudflare con KV) y guardar `caps` por tienda y fecha.
2. **Actualizar el modelo con datos reales:** cargar Round Pizza real por día (no solo el promedio de 4 semanas) y recalcular curva con peso reciente.
3. **Backtest en la app:** mostrar el error histórico de la proyección por hora para cada tienda.
4. **Eventos:** calendario de días especiales (Navidad, Día del Niño, Día de las Madres) con su factor.

## Cómo probar
`python3 -m http.server 8765` y `python3 tests/e2e.py`. La prueba espera /home/claude/analytix_diario.csv; cámbiale la ruta o usa tus propios datos.
