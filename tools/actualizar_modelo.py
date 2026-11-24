"""Reentrena con TODO el historial (2022+) y pronostica 70 días. Escribe tools/salida_modelo.json (hw, lo, hi, events, evhist).
Uso: 1) corre analytix_descarga.js en Analytix 360 y agrega las líneas nuevas (fecha,clientes,pizzas) a historial_garbancera.csv
     2) python3 tools/actualizar_modelo.py   3) copia hw/events al preset (presets/garbancera.json: dayF y events)"""
import sys, json
import os
HERE=os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0,HERE)
from model_long import *

H=70
yc=impute(y)
f,m=hw_fc(yc,H)
res=((yc-m.fittedvalues)/m.fittedvalues).iloc[7:]; sd=float(res.std())
years=[2022,2023,2024,2025]
fac=robust_factors(y,years,IGN)
last=y.index.max(); first=last+pd.Timedelta(days=1)
D={}
D['hw']={str(d.date()):int(round(v)) for d,v in f.items()}
D['lo']={str(d.date()):int(round(v*(1-1.28*sd))) for d,v in f.items()}
D['hi']={str(d.date()):int(round(v*(1+1.28*sd))) for d,v in f.items()}
D['built']=str((last+pd.Timedelta(days=1)).date()); D['lastdata']=str(last.date())
# eventos futuros dentro del horizonte
ev={}
for yr in (last.year, last.year+1):
    for n,d in ev_dates(yr).items():
        if first<=d<=f.index.max() and n in fac:
            ev[str(d.date())]={'n':'Posadas' if n.startswith('Posadas') else n,'f':fac[n][0]}
D['events']=dict(sorted(ev.items()))
# tabla histórica (mediana 2022-2025, sin recorte)
def med(n): return round((np.median(fac[n][2])-1)*100)
rows=[('Día del Niño (30-abr)','Día del Niño'),('San Valentín','San Valentín'),('Día del Trabajo','Día del Trabajo'),('Posadas 15-dic','Posadas 15'),('Posadas 18-dic','Posadas 18'),
      ('Jueves Santo','Jueves Santo'),('Independencia (16-sep)','Independencia'),('Halloween','Halloween'),('Día de Muertos','Día de Muertos'),
      ('Sábado de Gloria','Sábado de Gloria'),('Navidad','Navidad'),('Nochebuena','Nochebuena'),('Año Nuevo','Año Nuevo'),('Fin de año','Fin de año')]
D['evhist']=[[a,med(n)] for a,n in rows if n in fac]
D['curvenote']="Curva: 70% últimas 4 semanas (Gateway, 17-nov) + 30% jul-ago. Pronóstico diario y festivos con 4 años de datos (2022 a 2025)"
json.dump(D,open(HERE+'/salida_modelo.json','w'),ensure_ascii=False)
print('sd resid %.3f | ev:'%sd,len(ev)); 
for k,v in D['events'].items(): print(k,v)
print({k:D['hw'][k] for k in list(D['hw'])[:7]})
