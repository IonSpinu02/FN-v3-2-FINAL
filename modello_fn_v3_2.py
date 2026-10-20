#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Futuro Nazionale - scenario regionale v3.2 / audit predittivo.

Fonti: dataset EU 2024 e dati territoriali configurati dall'utente.
Non produce probabilità di esiti elettorali e NON afferma validazione predittiva.
Per l'analisi post-voto: --esiti file.csv con 20 righe complete di risultati
comparabili (FN con proprio simbolo, validi totali per regione).
"""
import argparse, csv, json, math, random
from pathlib import Path
from datetime import date

R=["Piemonte","Valle d'Aosta","Liguria","Lombardia","Trentino-Alto Adige","Veneto","Friuli-Venezia Giulia","Emilia-Romagna","Toscana","Umbria","Marche","Lazio","Abruzzo","Molise","Campania","Puglia","Basilicata","Calabria","Sicilia","Sardegna"]
CIRC={'NO':R[:4], 'NE':R[4:8], 'C':R[8:12], 'S':R[12:18], 'I':R[18:]}

def norm(x):
    z=sum(x.values())
    if z <= 0: raise ValueError('Distribuzione nulla')
    return {r:x[r]/z for r in R}
def H(x): return -sum(v*math.log(v) for v in x.values() if v>0)/math.log(len(R))
def KL(x,y): return sum(x[r]*math.log(x[r]/y[r]) for r in R if x[r]>0)
def JS(x,y):
    m={r:(x[r]+y[r])/2 for r in R}
    return (KL(x,m)+KL(y,m))/2

def corr(a,b):
    xa=[a[r] for r in R]; xb=[b[r] for r in R]
    m=sum(xa)/20; n=sum(xb)/20
    u=sum((x-m)*(y-n) for x,y in zip(xa,xb)); v=sum((x-m)**2 for x in xa); w=sum((y-n)**2 for y in xb)
    return u/math.sqrt(v*w) if v*w else None

def quantile(xs,p):
    a=sorted(xs); return a[int(round(p*(len(a)-1)))]

def read_config(p):
    data=json.loads(Path(p).read_text(encoding='utf8'))
    assert set(data['iscritti_regione'])==set(R)
    return data

def calculate(config_path, eu_path, n_sim=None):
    cfg=read_config(config_path)
    eu=json.loads(Path(eu_path).read_text(encoding='utf8'))['D']
    assert set(eu)==set(R)
    valid={r:eu[r]['valid'] for r in R}; fdi={r:eu[r]['FdI'] for r in R}; lega={r:eu[r]['Lega'] for r in R}
    aff=cfg['affluenza_percento']; nazionale=cfg['italia_2024']; pref_orig=cfg['preferenze_circoscrizione']; pref_obs=cfg['preferenze_regionali_osservate']
    ratio=sum(valid.values())/nazionale['votanti']
    votanti={r:valid[r]/ratio for r in R}
    elettori={r:votanti[r]/(aff[r]/100) for r in R}
    ast={r:elettori[r]-votanti[r] for r in R}
    k=cfg['preferenze_totali']/sum(pref_orig.values()); pref={}; pref_tipo={}
    for c,regions in CIRC.items():
        totale=pref_orig[c]*k; fixed={r:pref_obs[r] for r in regions if r in pref_obs}
        rest=[r for r in regions if r not in fixed]
        residuo=totale-sum(fixed.values()); lega_resto=sum(lega[r] for r in rest)
        for r in regions:
            pref[r]=fixed.get(r,residuo*lega[r]/lega_resto if lega_resto else 0)
            pref_tipo[r]='osservato' if r in fixed else 'ricostruito'
    iscritti=cfg['iscritti_regione']; istit=cfg['presenze_istituzionali']; punti_carica=cfg['punteggi_cariche']; lam=cfg['lambda_istituzionale']
    conti={r:sum(istit.get(k,{}).get(r,0) for k in punti_carica) for r in R}
    punti={r:sum(istit.get(k,{}).get(r,0)*w for k,w in punti_carica.items()) for r in R}
    q=norm(valid); xfd=norm(fdi); xle=norm(lega); xast=norm(ast)
    flussi=cfg['flussi_ipsos']; flussi['altri']=1-sum(flussi.values())
    f={r:flussi['FdI']*xfd[r]+flussi['Lega']*xle[r]+flussi['ast']*xast[r]+flussi['altri']*q[r] for r in R}
    v=norm(pref); s=norm(iscritti)
    raw_m=norm(punti); m={r:(punti[r]+lam*q[r])/(sum(punti.values())+lam) for r in R}
    w=cfg['pesi']; assert abs(sum(w.values())-1)<1e-8
    def mix(alpha): return {r:alpha['flussi']*f[r]+alpha['pref']*v[r]+alpha['isc']*s[r]+alpha['ist']*m[r] for r in R}
    p=mix(w); b=norm({r:fdi[r]+lega[r] for r in R}); S=cfg['sondaggio_nazionale']; V=sum(valid.values())
    alt={
       'Pesi uguali':{'flussi':.25,'pref':.25,'isc':.25,'ist':.25},
       'Senza istituzioni':{'flussi':.4,'pref':.3,'isc':.3,'ist':0},
       'Solo flussi':{'flussi':1,'pref':0,'isc':0,'ist':0},
       'Flussi + preferenze':{'flussi':.5,'pref':.5,'isc':0,'ist':0},
       'Senza preferenze':{'flussi':.45,'pref':0,'isc':.35,'ist':.2}}
    alts={name:mix(a) for name,a in alt.items()}
    N=n_sim if n_sim is not None else cfg['monte_carlo']['simulazioni']; seed=cfg['monte_carlo']['seme']; random.seed(seed)
    simulations={r:[] for r in R}; hs=[]
    c=cfg['monte_carlo']['concentrazione_dirichlet']; sd=cfg['monte_carlo']['sd_sondaggio']
    for _ in range(N):
        g=[random.gammavariate(a*c,1) for a in w.values()]; z=sum(g)
        a=dict(zip(w,[x/z for x in g])); pp=mix(a)
        SS=max(.02,random.gauss(S,sd))
        for r in R: simulations[r].append(SS*pp[r]/q[r])
        hs.append(H(pp))
    ix={name:{r:x[r]/q[r] for r in R} for name,x in {'flussi':f,'pref':v,'isc':s,'ist':m}.items()}
    correlations={a:{bb:corr(ix[a],ix[bb]) for bb in ix} for a in ix}
    rows=[]
    for r in R:
        yp=S*p[r]/q[r]; yb=S*b[r]/q[r]; vals=[yp]+[S*aa[r]/q[r] for aa in alts.values()]
        rows.append(dict(regione=r,validi2024=valid[r],FdI2024=fdi[r],Lega2024=lega[r],affluenza2024=aff[r],elettori_ricostruiti=elettori[r],astenuti_ricostruiti=ast[r],preferenze=pref[r],tipo_preferenze=pref_tipo[r],iscritti=iscritti[r],presenze=conti[r],punti_istituzionali=punti[r],q=q[r],f=f[r],v=v[r],s=s[r],m=m[r],p=p[r],w=p[r]/q[r],b=b[r],stima=yp,benchmark=yb,voti_di_scenario=S*p[r]*V,lo10=quantile(simulations[r],.1),hi90=quantile(simulations[r],.9),min_pesi=min(vals),max_pesi=max(vals)))
    metriche={'H':{a:H(x) for a,x in {'elettorato':q,'flussi':f,'preferenze':v,'iscritti':s,'istituzioni':m,'istituzioni_grezze':raw_m,'scenario':p,'benchmark':b}.items()},
     'KL':{a:KL(x,q) for a,x in {'scenario':p,'benchmark':b,'iscritti':s}.items()},
     'JS':{'scenario_benchmark':JS(p,b),'scenario_elettorato':JS(p,q),'iscritti_elettorato':JS(s,q)},
     'correlazioni_indici':correlations,'intervallo_H_sensibilita':[quantile(hs,.1),quantile(hs,.9)],
     'differenze_max_scenario_benchmark_punti':max(abs(S*(p[r]-b[r])/q[r])*100 for r in R),
     'differenza_media_ponderata_scenario_benchmark_punti':sum(q[r]*abs(S*(p[r]-b[r])/q[r]) for r in R)*100,
     'stabilita':{name: {r:S*x[r]/q[r] for r in R} for name,x in alts.items()}}
    assert abs(sum(p.values())-1)<1e-12
    assert abs(sum(row['voti_di_scenario'] for row in rows)-S*V)<1e-4
    out={'metadati':{'titolo':'Scenario territoriale FN v3.2','data':'2026-10-18','fonte':'Dati forniti dal committente e fonti pubbliche (v3.2, audit metodologico e storico mensile)','predizione_validata':False,'diagnostica':'Sensibilità e confronti strutturali NON equivalgono ad accuratezza predittiva','seme':seed,'simulazioni':N},'parametri':{'S':S,'pesi':w,'lambda':lam,'iscritti_totali_dichiarati':cfg['iscritti_totali_dichiarati'],'iscritti_attribuiti':sum(iscritti.values()),'comitati':cfg['comitati'],'validi2024':V,'nazionale2024':nazionale,'affluenza_regionali_elettori_ricostruiti':True},'metriche':metriche,'righe':rows,'validazione_predittiva':{'stato':'IN ATTESA DI ESITI REGIONALI FUTURI COMPARABILI','wmae_punti':None,'benchmark_wmae_punti':None,'skill_vs_benchmark':None,'copertura_intervalli':None}}
    return out

def evaluate(result, csvfile):
    with open(csvfile,encoding='utf-8-sig',newline='') as h: data=list(csv.DictReader(h))
    dd={r['regione']:r for r in data if r.get('regione')}
    if set(dd)!=set(R) or len(data)!=20: raise ValueError('Serve un file con esattamente 20 righe e 20 regioni distinte')
    valid={}; fn={}
    for r in R:
        valid[r]=int(dd[r]['voti_validi']); fn[r]=int(dd[r]['voti_fn'])
        if valid[r]<=0 or fn[r]<0 or fn[r]>valid[r]: raise ValueError('Risultato elettorale non valido: '+r)
    total=sum(valid.values()); fn_tot=sum(fn.values()); S_actual=fn_tot/total; q_actual={r:valid[r]/total for r in R}
    pred={a['regione']:a['stima'] for a in result['righe']}; bench={a['regione']:a['benchmark'] for a in result['righe']}
    pm={a['regione']:a['p'] for a in result['righe']}; pb={a['regione']:a['b'] for a in result['righe']}
    obs={r:fn[r]/valid[r] for r in R}
    def weighted_mae(y):return 100*sum(q_actual[r]*abs(y[r]-obs[r]) for r in R)
    def weighted_rmse(y):return 100*math.sqrt(sum(q_actual[r]*(y[r]-obs[r])**2 for r in R))
    cmp_pred={r:S_actual*pm[r]/q_actual[r] for r in R}
    cmp_b={r:S_actual*pb[r]/q_actual[r] for r in R}
    w_model=weighted_mae(pred); w_bench=weighted_mae(bench)
    c_model=weighted_mae(cmp_pred); c_bench=weighted_mae(cmp_b)
    coverage=sum(any(a['regione']==r and a['lo10']<=obs[r]<=a['hi90'] for a in result['righe']) for r in R)
    result['validazione_predittiva']={'stato':'VALUTAZIONE EX POST (controllare comparabilità del risultato!)','s_observato':S_actual,'regioni':20,'voti_validi':total,'fn_voti':fn_tot,
      'mae_punti_scenario':w_model,'mae_punti_benchmark':w_bench,'rmse_punti_scenario':weighted_rmse(pred),'rmse_punti_benchmark':weighted_rmse(bench),
      'skill_vs_benchmark':1-w_model/w_bench if w_bench>0 else None,'mae_geografico_scenario':c_model,'mae_geografico_benchmark':c_bench,
      'skill_geografico':1-c_model/c_bench if c_bench>0 else None,'copertura_regioni_sensibilita':coverage/20,
      'avvertenza':'Lo skill descrittivo ex post richiede dati che non siano stati usati per tarare il modello; il controllo geografico usa S osservato soltanto per separare livello nazionale e allocazione regionale.'}
    for a in result['righe']:
        r=a['regione']; a['voto_osservato']=obs[r]; a['errore_punti']=(pred[r]-obs[r])*100

def write_template(path):
    with open(path,'w',encoding='utf-8',newline='') as h:
        w=csv.writer(h);w.writerow(['regione','voti_validi','voti_fn']);w.writerows([[r,'',''] for r in R])

def parse_history(csvfile, baseline=None):
    """Mensilità complete di 20 regioni: H e JS consecutiva, su quote osservate ufficiali."""
    groups={}
    with open(csvfile,encoding='utf-8-sig',newline='') as f:
        for a in csv.DictReader(f):
            t=a['mese'].strip();r=a['regione'].strip();n=a['iscritti'].strip()
            if not t or not r or not n:continue
            if r not in R: raise ValueError('Regione non riconosciuta nel monitoraggio: '+r)
            if r in groups.setdefault(t,{}):raise ValueError('Regione duplicata nel mese '+t+': '+r)
            groups[t][r]=int(n)
    result=[];previous=None
    for t in sorted(groups):
        g=groups[t]
        if set(g)!=set(R):
            result.append({'mese':t,'stato':'INCOMPLETO','regioni_presenti':len(g),'H':None,'delta_H':None,'JS_precedente_nats':None,'H_scenario_condizionato':None})
            previous=None
            continue
        if any(v<0 for v in g.values()) or not sum(g.values()):raise ValueError('Conteggi iscritti non validi: '+t)
        pp=norm(g)
        entry={'mese':t,'stato':'COMPLETO','iscritti_regionalizzati':sum(g.values()),'H':H(pp),'delta_H':H(pp)-H(previous) if previous else None,'JS_precedente_nats':JS(pp,previous) if previous else None, 'H_scenario_condizionato':None}
        if baseline is not None:
            weights=baseline['parametri']['pesi']
            frozen={row['regione']:row for row in baseline['righe']}
            mix_t={r:weights['flussi']*frozen[r]['f']+weights['pref']*frozen[r]['v']+weights['isc']*pp[r]+weights['ist']*frozen[r]['m'] for r in R}
            entry['H_scenario_condizionato']=H(mix_t)
        result.append(entry)
        previous=pp
    return result

if __name__=='__main__':
    ap=argparse.ArgumentParser()
    ap.add_argument('--config',default='config_v3_2.json'); ap.add_argument('--eu',default='eu2024.json');ap.add_argument('--esiti',default=None)
    ap.add_argument('--output',default='risultati_v3_2.json');ap.add_argument('--simulazioni',type=int,default=None);ap.add_argument('--crea-template',action='store_true')
    ap.add_argument('--snapshot',default='scenario_congelato_18-10-2026.json',help='Fotografia ex ante immutabile usata per valutazioni post-voto')
    ap.add_argument('--storico',default=None,help='CSV mese,regione,iscritti; calcola H e JS solo sui mesi completi')
    args=ap.parse_args()
    if args.crea_template:write_template('esiti_futuri_TEMPLATE.csv')
    if args.esiti:
        if not Path(args.snapshot).exists():
            raise SystemExit('ERRORE: snapshot congelato non trovato; impossibile valutare senza previsione ex ante.')
        x=json.loads(Path(args.snapshot).read_text(encoding='utf-8'))
        evaluate(x,args.esiti)
        outpath=args.output if args.output!='risultati_v3_2.json' else 'validazione_ex_post.json'
    else:
        x=calculate(args.config,args.eu,args.simulazioni)
        outpath=args.output
    if args.storico:
        if not Path(args.snapshot).exists(): raise SystemExit('ERRORE: snapshot ex ante necessario per storico H scenario.')
        frozen=json.loads(Path(args.snapshot).read_text(encoding='utf-8'))
        x['monitoraggio_iscritti']=parse_history(args.storico, frozen)
    Path(outpath).write_text(json.dumps(x,ensure_ascii=False,indent=2),encoding='utf-8')
    print('File scritto:',outpath)
    print('Entropia iscritti:',round(x['metriche']['H']['iscritti'],6),'Entropia scenario:',round(x['metriche']['H']['scenario'],6))
    print('Validazione:',x['validazione_predittiva']['stato'])
    print('Differenza media modello/benchmark (punti):',round(x['metriche']['differenza_media_ponderata_scenario_benchmark_punti'],3))
