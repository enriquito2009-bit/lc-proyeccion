# Prueba de punta a punta. Uso: python3 tests/e2e.py  (con el sitio en http://localhost:8765)
import csv, sys
from playwright.sync_api import sync_playwright
URL = "http://localhost:8765/index.html"
rows = list(csv.DictReader(open("/home/claude/analytix_diario.csv")))
daily = "\n".join(f"{r['d']},{r['q1']}" for r in rows if r['d'] >= '2026-07-01')
TUE = """Hour\tAmount\tPrevious Week\t4 Week Avg\tScheduled
09:00\t\t\t2,0\t
10:00\t28\t56\t31,0\t
11:00\t\t5\t12,8\t
12:00\t\t33\t34,3\t
13:00\t\t69\t59,0\t20
14:00\t\t65\t60,5\t
15:00\t\t57\t66,5\t
16:00\t\t61\t66,0\t
17:00\t\t80\t67,0\t
18:00\t\t79\t84,5\t
19:00\t\t82\t68,5\t
20:00\t\t55\t63,5\t
21:00\t\t37\t45,0\t
Total\t28\t679\t659,0\t"""
ok = True
def check(name, cond, info=""):
    global ok; ok &= bool(cond); print(("OK   " if cond else "FALLA"), name, info)
with sync_playwright() as p:
    b = p.chromium.launch(); ctx = b.new_context(viewport={"width": 390, "height": 844}); pg = ctx.new_page()
    errs = []; pg.on("pageerror", lambda e: errs.append(str(e)))
    pg.goto(URL)
    check("primer arranque abre Tienda", pg.is_visible("#vTienda"))
    pg.fill("#inName", "Tienda de prueba")
    pg.fill("#taDaily", daily); pg.click("#btnDaily")
    out = pg.inner_text("#outDaily"); check("historial calculado", "Error típico" in out, out.split("\n")[0][:110])
    pg.locator("#ta2").evaluate("e=>e.closest('details').open=true"); pg.fill("#ta2", TUE); pg.click("#btnCurve")
    out = pg.inner_text("#outCurve"); check("curva leída (1 de 7)", "1 de 7" in out)
    pg.click("#tabHoy"); pg.fill("#fecha", "2026-11-17"); pg.dispatch_event("#fecha", "change")
    for h, v in [(10, 20), (11, 45), (12, 80), (13, 120), (14, 170), (15, 215)]:
        pg.select_option("#hora", str(h)); pg.fill("#val", str(v)); pg.press("#val", "Enter")
    big = pg.inner_text("#big"); check("proyección con datos propios", big.isdigit(), big + " | " + pg.inner_text("#range") + " | " + pg.inner_text("#pill"))
    # compartir por enlace
    pg.click("#tabTienda"); ctx.grant_permissions(["clipboard-read", "clipboard-write"])
    pg.click("#btnLink"); pg.wait_for_timeout(300); link = pg.evaluate("navigator.clipboard.readText()")
    check("enlace generado", "#cfg=" in link, f"{len(link)} caracteres")
    pg2 = ctx.new_page(); pg2.on("pageerror", lambda e: errs.append(str(e)))
    ctx2 = b.new_context(viewport={"width": 390, "height": 844}); pg3 = ctx2.new_page(); pg3.goto(link)
    check("banner de importación", pg3.is_visible("#banner"), pg3.inner_text("#banner").split("\n")[0])
    pg3.click("#bnOk"); check("tienda importada en otro dispositivo", pg3.inner_text("#storeName") == "Tienda de prueba")
    # ejemplo Garbancera + captura estándar
    pg.click("#btnDemo"); pg.wait_for_timeout(300); pg.click("#tabHoy"); pg.fill("#fecha", "2026-11-24"); pg.dispatch_event("#fecha", "change")
    for h, v in [(10, 20), (11, 45), (12, 80), (13, 120), (14, 170), (15, 215)]:
        pg.select_option("#hora", str(h)); pg.fill("#val", str(v)); pg.press("#val", "Enter")
    check("ejemplo Garbancera = 610 (igual que el dashboard)", pg.inner_text("#big") == "610", pg.inner_text("#big") + " " + pg.inner_text("#range"))
    # día especial: jueves 17-dic (posadas, +38%) sin capturas
    pg.fill("#fecha", "2026-12-17"); pg.dispatch_event("#fecha", "change")
    check("día especial aplica factor (base 818 x 1.16 = 949)", pg.inner_text("#big") == "949", pg.inner_text("#big") + " | " + pg.inner_text("#sub"))
    check("muestra nombre del evento", "Posadas" in pg.inner_text("#sub"))
    check("sin desbordar a lo ancho", pg.evaluate("document.documentElement.scrollWidth") <= 390)
    pg.screenshot(path="/home/claude/lc-proyeccion/tests/hoy.png", full_page=True)
    pg.click("#tabTienda"); pg.screenshot(path="/home/claude/lc-proyeccion/tests/tienda.png", full_page=True)
    check("sin errores de JavaScript", not errs, str(errs))
    b.close()
sys.exit(0 if ok else 1)
