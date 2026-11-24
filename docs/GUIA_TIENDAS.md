# Guía para adaptar la proyección a otra tienda

## Qué hace
Le dice al gerente, durante el día, cuántas pizzas va a vender en total y si va por arriba o por abajo de lo normal.

`Proyección = vendido hasta ahora + pronóstico del día × (1 − % del día que normalmente ya se vendió a esta hora)`

Ejemplo: martes, pronóstico 637, a las 15:00 en punto llevas 215 y normalmente a esa hora ya se vendió 39%. Proyección = 215 + 637 × 0.61 ≈ 604. Si el ritmo real (215 contra 0.39 × 637 = 248) está más de 15% abajo, la señal dice BAJAR producción.

## Los dos datos que necesita
1. **Total de pizzas por día**, de 8 a 12 semanas (Analytix 360, Product Mix Diario, categoría HNR). Con eso se saca el pronóstico: promedio de los últimos 4 mismos días de la semana. Los días raros (falla de sistema, Navidad, Día del Niño) se ignoran solos si se desvían más de 30%, o se excluyen por fecha.
2. **Curva por hora**, de LCE Gateway: Managing Report, pestaña Round Pizza, columna "4 Week Avg". Se copia la tabla completa de una fecha de cada día de la semana. Un solo día ya funciona; los demás usan el promedio.

## Qué tan confiable es (tienda de referencia: Garbancera, noviembre 2026)
- Error diario del pronóstico: alrededor de 5.6% con el promedio de 4 semanas.
- Con la curva ya ajustada, a las 15:00 el error de la proyección es de unos 3.5% si el pronóstico fuera perfecto.
- La hora de las 10:00 es irregular (a veces trae pedidos grandes). No conviene reaccionar a esa hora.
- Antes de las 11:00 la app solo avisa "muy temprano".

## Reglas de captura
- Se captura el **acumulado** (no lo de esa hora sola) cuando **cierra** el horario. A las 11:00 en punto, el horario "10:00 - 11:00".
- Si te equivocas, toca la hora capturada y corrígela.
- Cuando haya promoción, evento o clima raro, escribe el pronóstico a mano en Ajustes del día.

## Cuidado con los datos
La configuración incluye ventas de la tienda. Antes de compartirla fuera de la operación, confirma con tu supervisor.

## Mantenimiento
Cada 4 a 6 semanas: vuelve a pegar el historial (Paso 1) y las tablas Round Pizza (Paso 2). El pronóstico se mueve con las últimas 4 semanas, y la curva se afina con la estación del año.
