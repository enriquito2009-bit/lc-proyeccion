"""Modelo con historial largo (2022+) y factores de eventos multi-año. Backtest 52 semanas."""
import json, sys, warnings, os
HERE = os.path.dirname(os.path.abspath(__file__))
import numpy as np, pandas as pd
from datetime import date, timedelta
from statsmodels.tsa.holtwinters import ExponentialSmoothing
warnings.filterwarnings('ignore')

df = pd.read_csv(HERE+'/historial_garbancera.csv', parse_dates=['d']).set_index('d')
y = df['q1'].astype(float).asfreq('D')

def easter(yr):
    a=yr%19;b=yr//100;c=yr%100;d=b//4;e=b%4;f=(b+8)//25;g=(b-f+1)//3;h=(19*a+b-d-g+15)%30;i=c//4;k=c%4
    l=(32+2*e+2*i-h-k)%7;m=(a+11*h+22*l)//451;mo=(h+l-7*m+114)//31;da=((h+l-7*m+114)%31)+1
    return date(yr,mo,da)
FIXED = {'Guadalupe':(12,12),'Posadas 14':(12,14),'Posadas 15':(12,15),'Posadas 16':(12,16),'Posadas 17':(12,17),'Posadas 18':(12,18),
 'Posadas 19':(12,19),'Posadas 20':(12,20),'Posadas 21':(12,21),'Posadas 22':(12,22),'Posadas 23':(12,23),'Nochebuena':(12,24),'Navidad':(12,25),
 'Fin de año':(12,31),'Año Nuevo':(1,1),'Reyes':(1,6),'San Valentín':(2,14),'Día del Niño':(4,30),'Día del Trabajo':(5,1),
 'Día de las Madres':(5,10),'Grito':(9,15),'Independencia':(9,16),'Halloween':(10,31),'Día de Muertos':(11,2)}
MOV = {'Jueves Santo':-3,'Viernes Santo':-2,'Sábado de Gloria':-1,'Domingo de Pascua':0}
def ev_dates(yr):
    out={n:pd.Timestamp(yr,m,d) for n,(m,d) in FIXED.items()}
    for n,o in MOV.items(): out[n]=pd.Timestamp(easter(yr)+timedelta(days=o))
    return out
names = list(FIXED)+list(MOV)
ev_by_date = {}
for yr in range(2022,2028):
    for n,d in ev_dates(yr).items(): ev_by_date[d]=n

def normal(series, d):
    v=[series.get(d+pd.Timedelta(days=7*k)) for k in (-3,-2,-1,1,2,3)]
    v=[x for x in v if x is not None and not np.isnan(x) and (d+pd.Timedelta(days=7*(v.index(x) if False else 0)))]
    return np.median(v) if len(v)>=4 else np.nan

def event_factors(series, years, ignore):
    """mediana de real/normal por evento en los años dados. 'normal' excluye otros eventos y días 'ignore'."""
    clean = series.copy()
    for d in list(ev_by_date)+list(ignore):
        if d in clean.index: clean[d]=np.nan
    fac={}
    for n in names:
        r=[]
        for yr in years:
            d=ev_dates(yr)[n]
            if d in series.index and not np.isnan(series[d]):
                nv=[clean.get(d+pd.Timedelta(days=7*k)) for k in (-3,-2,-1,1,2,3)]
                nv=[x for x in nv if x is not None and not np.isnan(x)]
                if len(nv)>=3: r.append(series[d]/np.median(nv))
        if r: fac[n]=float(np.median(r)), len(r)
    return fac

IGN = [pd.Timestamp(d) for d in json.load(open(HERE+'/excl.json'))]   # fallas / días raros confirmados

def impute(series, ignore_extra=()):
    s=series.copy()
    for d in list(ev_by_date)+IGN+list(ignore_extra):
        if d in s.index: s[d]=np.nan
    for d in s.index[s.isna()]:
        vals=[s.get(d+pd.Timedelta(days=7*k)) for k in (-2,-1,1,2)]
        vals=[v for v in vals if v is not None and not np.isnan(v)]
        s[d]=float(np.mean(vals)) if vals else np.nan
    return s.interpolate()

def hw_fc(train, h):
    m=ExponentialSmoothing(train,trend=None,seasonal='mul',seasonal_periods=7,initialization_method='estimated').fit(optimized=True)
    return m.forecast(h), m

def avg4_fc(train, h):
    return pd.Series([np.nanmean([train.get(train.index[-1]+pd.Timedelta(days=i+1)-pd.Timedelta(days=7*k)) for k in range(1,5)]) for i in range(h)],
                     index=pd.date_range(train.index[-1]+pd.Timedelta(days=1),periods=h))

if __name__=='__main__':
    H=7; N=52
    last=len(y)
    fac_bt = event_factors(y,[2022,2023,2024],IGN)        # sin mirar el año de prueba
    rows=[]
    for o in range(last-N*7, last-H+1, 7):
        for tag,lookback in (('HW 1 año',365),('HW 4 años',None)):
            tr=y.iloc[:o]; tr=tr if lookback is None else tr.iloc[-lookback:]
            yc=impute(tr)
            f,_=hw_fc(yc,H)
            for dt,fv in f.items():
                if dt in y.index and not np.isnan(y[dt]):
                    rows.append((tag,dt,y[dt],fv))
                    n=ev_by_date.get(dt)
                    adj=fv*fac_bt[n][0] if n in fac_bt else fv
                    rows.append((tag+' + eventos',dt,y[dt],adj))
        yc=impute(y.iloc[:o]); f=avg4_fc(yc,H)
        for dt,fv in f.items():
            if dt in y.index and not np.isnan(y[dt]): rows.append(('Prom 4 sem',dt,y[dt],fv))
    bt=pd.DataFrame(rows,columns=['modelo','d','real','pron']); bt['ape']=(bt.pron-bt.real).abs()/bt.real
    bt['evento']=bt.d.map(ev_by_date).notna()
    bt=bt[~bt.d.isin(IGN)]
    print('MAPE %  (todos los días | días normales | días de evento)')
    g=bt.groupby('modelo')
    print(pd.DataFrame({'todos':g.ape.mean()*100,'normales':bt[~bt.evento].groupby('modelo').ape.mean()*100,'evento':bt[bt.evento].groupby('modelo').ape.mean()*100,'n':g.size()}).round(1))
    bt.to_csv(HERE+'/backtest_largo.csv',index=False)

def robust_factors(series, years, ignore, min_n=3, min_dev=0.08, shrink=0.85):
    """Factor por evento: mediana de años; se usa solo si es consistente (todos los años del mismo lado de 1) y ≥ min_dev."""
    clean = series.copy()
    for d in list(ev_by_date)+list(ignore):
        if d in clean.index: clean[d]=np.nan
    out={}
    for n in names:
        r=[]
        for yr in years:
            d=ev_dates(yr)[n]
            if d in series.index and not np.isnan(series[d]):
                nv=[clean.get(d+pd.Timedelta(days=7*k)) for k in (-3,-2,-1,1,2,3)]
                nv=[x for x in nv if x is not None and not np.isnan(x)]
                if len(nv)>=3: r.append(series[d]/np.median(nv))
        if len(r)>=min_n:
            med=float(np.median(r)); same=sum((x-1)*(med-1)>0 for x in r)
            if abs(med-1)>=min_dev and same>=len(r)-1:
                out[n]=(round(1+(med-1)*shrink,2), len(r), [round(x,2) for x in r])
    return out
