"""Refinement 4.5: optimize safety decision thresholds without touching Digha.

The classifier predicts four calibrated probabilities. This script searches thresholds
ONLY on the temporal calibration block, using a safety-oriented objective that rewards
HIGH/EXTREME recall while penalizing excessive escalation. Digha is evaluated once at
the selected thresholds and is never used to choose them.
"""
from __future__ import annotations
import json
import numpy as np
import pandas as pd
from sklearn.metrics import precision_score, recall_score, f1_score, balanced_accuracy_score
from sklearn.frozen import FrozenEstimator
from sklearn.calibration import CalibratedClassifierCV
from xgboost import XGBClassifier
from config import PROCESSED_DIR, MODELS_DIR, FEATURE_COLUMNS, RISK_HORIZON_HOURS, RISK_CLASS_NAMES

RISK_ORDER = [RISK_CLASS_NAMES[i] for i in range(4)]
HOLDOUT_LOCATION = "digha_wb"
RANDOM_STATE = 42
GRID = np.arange(0.30, 0.96, 0.025)


def severity(row):
    vals = lambda names: [float(row[n]) for n in names if pd.notna(row.get(n))]
    w = max(vals(["wind_speed_kts", "wind_gust_kts"]) or [0.0]); s = max(vals(["wave_height_m", "swell_height_m"]) or [0.0])
    return (3 if w >= 48 else 2 if w >= 34 else 1 if w >= 25 else 0, 3 if s >= 4 else 2 if s >= 2.5 else 1 if s >= 1.25 else 0)


def policy(row):
    w, s = severity(row)
    if w >= 3 or s >= 3: return 3
    if (w >= 2 and s >= 1) or (s >= 2 and w >= 1): return 3
    if w >= 2 or s >= 2: return 2
    return max(w, s)


def features(df):
    cols = list(FEATURE_COLUMNS)
    for c in FEATURE_COLUMNS:
        df[c] = pd.to_numeric(df[c], errors="coerce"); n=f"{c}_missing"; df[n]=df[c].isna().astype(np.int8); cols.append(n)
    for c,p in [("wind_direction_deg","wind"),("wave_direction_deg","wave"),("swell_direction_deg","swell")]:
        r=np.deg2rad(df[c]); df[f"{p}_direction_sin"]=np.sin(r); df[f"{p}_direction_cos"]=np.cos(r); cols += [f"{p}_direction_sin",f"{p}_direction_cos"]
    for c in ["wind_speed_kts","wind_gust_kts","wave_height_m","swell_height_m","air_pressure_hpa"]:
        for h in (3,6): n=f"{c}_delta_{h}h"; df[n]=df.groupby("location_id")[c].diff(h); cols.append(n)
    return cols


def target(df):
    f=df[["location_id","timestamp","wind_speed_kts","wind_gust_kts","wave_height_m","swell_height_m"]].copy(); f["risk"]=f.apply(policy,axis=1); f["timestamp"]=f["timestamp"]-pd.to_timedelta(int(RISK_HORIZON_HOURS),unit="h"); return df.merge(f[["location_id","timestamp","risk"]],on=["location_id","timestamp"],how="left").dropna(subset=["risk"])


def decide(p, high_t, extreme_t):
    # Safety gate: extreme first, then high if combined elevated-risk probability is high.
    out=np.argmax(p,axis=1)
    ext=p[:,3] >= extreme_t
    high=(p[:,2]+p[:,3]) >= high_t
    out[high]=np.maximum(out[high],2); out[ext]=3
    return out


def safety_metrics(y,p):
    elevated=(np.asarray(y)>=2).astype(int); pred_e=(np.asarray(p)>=2).astype(int)
    return {"balanced_accuracy":float(balanced_accuracy_score(y,p)),"macro_f1":float(f1_score(y,p,average="macro",zero_division=0)),"high_extreme_recall":float(recall_score(elevated,pred_e,zero_division=0)),"high_extreme_precision":float(precision_score(elevated,pred_e,zero_division=0)),"high_extreme_f1":float(f1_score(elevated,pred_e,zero_division=0)),"escalation_rate":float(pred_e.mean())}


def main():
    df=pd.read_parquet(PROCESSED_DIR/"orca_historical_marine_risk.parquet"); df["timestamp"]=pd.to_datetime(df["timestamp"],utc=True); df=df.sort_values(["location_id","timestamp"]).copy(); fs=features(df); data=target(df); data["risk"]=data.risk.astype(int)
    pool=data[data.location_id!=HOLDOUT_LOCATION].sort_values("timestamp"); digha=data[data.location_id==HOLDOUT_LOCATION]; n=len(pool); a,b=int(n*.70),int(n*.85); train,val=pool.iloc[:a],pool.iloc[a:b]; cal_cut=len(val)//2; cal,test=val.iloc[:cal_cut],val.iloc[cal_cut:]
    counts=train.risk.value_counts().sort_index(); weights={int(k):float(len(train)/(4*v)) for k,v in counts.items()}
    model=XGBClassifier(objective="multi:softprob",num_class=4,n_estimators=900,learning_rate=.035,max_depth=6,min_child_weight=8,subsample=.85,colsample_bytree=.85,reg_alpha=.15,reg_lambda=2,gamma=.05,tree_method="hist",eval_metric="mlogloss",random_state=RANDOM_STATE,n_jobs=-1)
    model.fit(train[fs],train.risk,sample_weight=train.risk.map(weights).to_numpy(dtype=np.float32),verbose=False)
    calibrated=CalibratedClassifierCV(FrozenEstimator(model),method="sigmoid"); calibrated.fit(cal[fs],cal.risk)
    p_cal=calibrated.predict_proba(cal[fs]); p_test=calibrated.predict_proba(test[fs]); p_digha=calibrated.predict_proba(digha[fs])
    ycal,ytest,yd=cal.risk.to_numpy(),test.risk.to_numpy(),digha.risk.to_numpy()
    candidates=[]
    for ht in GRID:
        for et in GRID:
            if et < ht: continue
            pred=decide(p_cal,ht,et); m=safety_metrics(ycal,pred)
            # Optimize safety first: maximize elevated recall, then F1, while limiting escalation.
            score=m["high_extreme_recall"] + .35*m["high_extreme_f1"] + .15*m["macro_f1"] - .20*max(0,m["escalation_rate"]-0.60)
            candidates.append((score,ht,et,m))
    candidates.sort(reverse=True,key=lambda x:x[0]); best=candidates[0]; _,ht,et,cal_m=best
    test_m=safety_metrics(ytest,decide(p_test,ht,et)); digha_m=safety_metrics(yd,decide(p_digha,ht,et))
    result={"risk_policy":"small_craft_conservative","prediction_horizon_hours":int(RISK_HORIZON_HOURS),"selected_thresholds":{"high_plus_extreme_probability":float(ht),"extreme_probability":float(et)},"calibration_metrics":cal_m,"temporal_test_metrics":test_m,"digha_holdout_metrics":digha_m,"selection_note":"Thresholds selected only on the temporal calibration block. Digha was not used for threshold selection."}
    out=MODELS_DIR/"safety_threshold_optimization.json"; out.parent.mkdir(parents=True,exist_ok=True); out.write_text(json.dumps(result,indent=2),encoding="utf-8")
    print("Selected thresholds:",result["selected_thresholds"]); print("Calibration:",cal_m); print("Temporal test:",test_m); print("Digha:",digha_m); print(f"Saved threshold optimization: {out}")

if __name__=="__main__": main()
