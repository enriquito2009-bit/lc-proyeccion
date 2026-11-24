// Pega esto en la consola del navegador con Analytix 360 abierto (Reportes > Product Mix).
// Cambia DESDE/HASTA y la sucursal. Devuelve "fecha,clientes,pizzas" por día (pizzas = suma de la categoría HNR = Round Pizza).
(async () => {
  const DESDE = '2026-11-24', HASTA = '2026-11-30', SUC = 'Garbancera', out = [];
  for (let t = Date.parse(DESDE); t <= Date.parse(HASTA); t += 864e5) {
    const d = new Date(t).toISOString().slice(0, 10);
    const x = await fetch(`/rms/reportes/export/pmix?view=pmix&submarca=lc&sub=rango&fechaDe=${d}&fechaA=${d}&sucursal=${SUC}&conIva=1`).then(r => r.text());
    const cli = +((x.match(/Clientes,,,(\d+)/) || [])[1] || 0); let q = 0;
    for (const l of x.split('\n')) { const m = l.match(/^Producto,HNR,(?:"[^"]*"|[^,]*),[^,]*,(\d+),/); if (m) q += +m[1]; }
    if (cli > 0) out.push(`${d},${cli},${q}`);
  }
  console.log(out.join('\n')); return out.join('\n');
})();
