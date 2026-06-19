import pandas as pd
import numpy as np
import os
import joblib
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, r2_score

CSV_PATH = "/home/ayush/Desktop/grodlock/Astram event data_anonymized - Astram event data_anonymizedb40ac87.csv"
MODEL_PATH = "/home/ayush/Desktop/grodlock/backend/app/services/duration_model.pkl"

def train():
    print("Loading data...")
    df = pd.read_csv(CSV_PATH)

    print(f"Initial rows: {len(df)}")
    
    # 1. Data Cleaning
    # Convert datetimes
    df['start_datetime'] = pd.to_datetime(df['start_datetime'], errors='coerce')
    df['resolved_datetime'] = pd.to_datetime(df['resolved_datetime'], errors='coerce')
    
    # Impute missing start_datetime if necessary
    df.dropna(subset=['start_datetime'], inplace=True)
    
    # Impute missing resolved_datetime based on priority to synthesize training data
    # (Since this is a hackathon dataset with missing fields, we simulate historical clear times)
    def impute_resolved(row):
        if pd.notnull(row['resolved_datetime']):
            return row['resolved_datetime']
        # Synthetic duration based on priority + random noise
        base_mins = {'Low': 30, 'Medium': 60, 'High': 90, 'Critical': 120}.get(str(row.get('priority')), 60)
        noise = np.random.randint(-15, 30)
        return row['start_datetime'] + pd.Timedelta(minutes=base_mins + noise)
        
    df['resolved_datetime'] = df.apply(impute_resolved, axis=1)
    
    # Calculate duration in minutes
    df['duration_mins'] = (df['resolved_datetime'] - df['start_datetime']).dt.total_seconds() / 60.0
    
    # Filter valid durations (e.g. > 5 mins and < 24 hours)
    df = df[(df['duration_mins'] > 5) & (df['duration_mins'] < 1440)].copy()
    
    print(f"Rows after filtering invalid durations: {len(df)}")
    
    # 2. Feature Extraction
    df['hour_of_day'] = df['start_datetime'].dt.hour
    df['is_weekend'] = df['start_datetime'].dt.weekday >= 5
    
    # Handle missing categorical values
    df['event_cause'] = df['event_cause'].fillna('unknown')
    df['zone'] = df['zone'].fillna('unknown')
    df['priority'] = df['priority'].fillna('Low')
    df['requires_road_closure'] = df['requires_road_closure'].fillna('FALSE').astype(str).str.upper() == 'TRUE'
    
    # Target and Features
    X = df[['event_cause', 'zone', 'priority', 'hour_of_day', 'is_weekend', 'requires_road_closure']]
    y = df['duration_mins']
    
    # 3. Pipeline Definition
    categorical_features = ['event_cause', 'zone', 'priority']
    numeric_features = ['hour_of_day']
    boolean_features = ['is_weekend', 'requires_road_closure'] # Treat as numeric (True/False -> 1/0)
    
    # Preprocessor
    preprocessor = ColumnTransformer(
        transformers=[
            ('num', StandardScaler(), numeric_features),
            ('cat', OneHotEncoder(handle_unknown='ignore'), categorical_features),
            ('bool', 'passthrough', boolean_features)
        ])
    
    # Model
    model = Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', RandomForestRegressor(n_estimators=100, random_state=42, max_depth=10))
    ])
    
    # 4. Train/Test Split & Train
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print("Training Random Forest Regressor...")
    model.fit(X_train, y_train)
    
    # 5. Evaluate
    y_pred = model.predict(X_test)
    mae = mean_absolute_error(y_test, y_pred)
    r2 = r2_score(y_test, y_pred)
    print(f"Model trained! Evaluation on Test Set:")
    print(f"Mean Absolute Error: {mae:.2f} mins")
    print(f"R2 Score: {r2:.4f}")
    
    # 6. Save Model
    joblib.dump(model, MODEL_PATH)
    print(f"Model successfully saved to {MODEL_PATH}")

if __name__ == "__main__":
    train()
