import os
import numpy as np
import pandas as pd
import joblib
import traceback

from flask import Flask, render_template, request, jsonify
from flask_cors import CORS
from sklearn.base import BaseEstimator, TransformerMixin
from sklearn.preprocessing import OneHotEncoder


class OneHotEncoderDF(BaseEstimator, TransformerMixin):
    def __init__(self, cols=None):
        self.cols = cols
        self.ohe = OneHotEncoder(handle_unknown="ignore", sparse_output=False)
        self.feature_names_ = None

    def fit(self, X, y=None):
        X = X.copy()

        if self.cols is None:
        
            self.cols = X.select_dtypes(include=["object"]).columns.tolist()

        self.ohe.fit(X[self.cols])
        self.feature_names_ = self.ohe.get_feature_names_out(self.cols)
        return self

    def transform(self, X):
        X = X.copy()

        if not self.cols:
            return X

        ohe_array = self.ohe.transform(X[self.cols])
        ohe_df = pd.DataFrame(
            ohe_array,
            columns=self.feature_names_,
            index=X.index
        )


        X = X.drop(columns=self.cols)


        X = pd.concat([X, ohe_df], axis=1)
        return X


class FrequencyEncoder(BaseEstimator, TransformerMixin):
    def __init__(self, cols=None, normalize=False):
        self.cols = cols
        self.normalize = normalize
        self.freq_maps_ = {}

    def fit(self, X, y=None):
        X = X.copy()


        if self.cols is None:
            self.cols = X.select_dtypes(include=["object"]).columns.tolist()

        for col in self.cols:
            if self.normalize:
                self.freq_maps_[col] = X[col].value_counts(normalize=True)
            else:
                self.freq_maps_[col] = X[col].value_counts()
        return self

    def transform(self, X):
        X = X.copy()
        for col in self.cols:
            new_col = f"{col}_freq"
            X[new_col] = X[col].map(self.freq_maps_[col]).fillna(0.0)

            X.drop(columns=[col], inplace=True)
        return X



class FeatureEngineer(BaseEstimator, TransformerMixin):

    def __init__(self):
        self.global_line_mean_ = None

    def fit(self, X, y=None):
        X = X.copy()

        if "LineTotal" in X.columns:
            self.global_line_mean_ = float(pd.to_numeric(X["LineTotal"], errors="coerce").mean())
        else:
            self.global_line_mean_ = 0.0

        return self

    def transform(self, X):
        X = X.copy()


        if "OrderDate" in X.columns:
            X["OrderDate"] = pd.to_datetime(X["OrderDate"], errors="coerce")

            X["OrderDay"] = X["OrderDate"].dt.day
            X["OrderMonth"] = X["OrderDate"].dt.month
            X["OrderYear"] = X["OrderDate"].dt.year
            X["OrderWeekOfYear"] = X["OrderDate"].dt.isocalendar().week.astype("Int64")
            X["OrderDayOfWeekNum"] = X["OrderDate"].dt.dayofweek  # 0=Mon .. 6=Sun
            X["OrderIsWeekend"] = X["OrderDayOfWeekNum"].isin([5, 6]).astype(int)
            X["OrderDayOfYear"] = X["OrderDate"].dt.dayofyear


            X.drop(columns=["OrderDate"], inplace=True)
        else:
            X["OrderDay"] = 0
            X["OrderMonth"] = 0
            X["OrderYear"] = 0
            X["OrderWeekOfYear"] = 0
            X["OrderDayOfWeekNum"] = 0
            X["OrderIsWeekend"] = 0
            X["OrderDayOfYear"] = 0


        for col in ["OrderWeekOfYear", "OrderDayOfWeekNum"]:
            X[col] = pd.to_numeric(X[col], errors="coerce").fillna(0).astype(int)


        if "ItemsInOrder" in X.columns:
            X["ItemsInOrder"] = pd.to_numeric(X["ItemsInOrder"], errors="coerce").fillna(1).astype(float)
        else:
            X["ItemsInOrder"] = 1.0

        if "LineTotal" in X.columns:
            X["LineTotal"] = pd.to_numeric(X["LineTotal"], errors="coerce").fillna(0.0)
        else:
            X["LineTotal"] = 0.0


        X["LineTotal_per_Item"] = X["LineTotal"] / X["ItemsInOrder"].replace(0, 1)

    
        X["Log_LineTotal"] = np.log1p(X["LineTotal"])


        if self.global_line_mean_ is not None and self.global_line_mean_ > 0:
            X["HighValueLine"] = (X["LineTotal"] > self.global_line_mean_).astype(int)
        else:
            X["HighValueLine"] = 0

        return X



# Flask App Setup
app = Flask(__name__)


# Chatbot Section
df = pd.read_csv(r"D:\Depi_project\Data\SalesScope_DataCleaned.csv")
def answer_question_text(question, df):
    dff = df.copy()
    try:
        q = int(question) 
    except ValueError:
        return "Please enter a valid number 😊"
    
    if  q == 1:
        top = dff.groupby("ProductName")["TotalDue"].sum().nlargest(5).reset_index()
        return "\n".join([f"{i+1}. {row['ProductName']}: {row['TotalDue']:.2f}" for i, row in top.iterrows()])
    if  q ==2:
        ter = dff.groupby("Territory")["TotalDue"].sum().reset_index().sort_values(by="TotalDue", ascending=False)
        return "\n".join([f"{row['Territory']}: {row['TotalDue']:.2f}" for i, row in ter.iterrows()])
    if q == 3:
        cat = dff.groupby("Category")["TotalDue"].sum().reset_index()
        return "\n".join([f"{row['Category']}: {row['TotalDue']:.2f}" for i, row in cat.iterrows()])
    if q == 4 :
        return f"Average Total Sales = {dff['TotalDue'].mean():.2f}"
    if q == 5 :
        return f"Total Sales = {dff['TotalDue'].sum():.2f}"
    if q == 6 :
        low = dff.groupby("ProductName")["TotalDue"].sum().nsmallest(5).reset_index()
        return "\n".join([f"{i+1}. {row['ProductName']}" for i, row in low.iterrows()])
    if q == 7:
        total = dff["TotalDue"].sum()
        best_product = dff.groupby("ProductName")["TotalDue"].sum().idxmax()
        best_terr = dff.groupby("Territory")["TotalDue"].sum().idxmax()
        best_cat = dff.groupby("Category")["TotalDue"].sum().idxmax()

        return (
            "All Insights:\n"
            f"1. Total Sales: {total:.2f}\n"
            f"2. Best Selling Product: {best_product}\n"
            f"3. Best Territory: {best_terr}\n"
            f"4. Best Category: {best_cat}"
        )
    return "Please Try Another one 😊"

# Chat Page
@app.route('/')
def index():
    return render_template('Sales Scope.html')


# API For Replay 
@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json(force=True)
    question = data.get("question", "")
    answer = answer_question_text(question, df)
    return jsonify({"answer": answer})



CORS(app)

DEPLOY_COLS = [
    "OrderDate",
    "ItemsInOrder",
    "LineTotal",
    "Category",
    "Sub category",
    "ProductName",
    "Territory",
    "Color",
    "Size"
]

# Load model
model = None
try:
    model = joblib.load("D:\Depi_project\Final project\model.pkl")
    print("Model loaded successfully.")
except Exception as e:
    print(f"Error loading the model: {e}")

UPLOAD_FOLDER = "uploads"
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

#ٌRoutes

@app.route("/")
def home():

    return render_template("Sales Scope.html")


@app.route("/predict", methods=["POST"])
def predict():
    try:
        if model is None:
            return jsonify({"error": "Model not loaded"}), 500

        payload = request.get_json()

        if isinstance(payload, dict):
            payload = [payload]

        df_input = pd.DataFrame(payload)


        if "ItemsInOrder" not in df_input.columns:
            df_input["ItemsInOrder"] = 1  
        if "LineTotal" not in df_input.columns:
            df_input["LineTotal"] = 0.0
        if "ProductName" not in df_input.columns:
            df_input["ProductName"] = "Unknown"


        df_input = df_input.reindex(columns=DEPLOY_COLS)


        for col in ["ItemsInOrder", "LineTotal"]:
            if col in df_input.columns:
                df_input[col] = pd.to_numeric(df_input[col], errors="coerce")

   
        for col in ["Category", "Sub category", "ProductName", "Territory", "Color", "Size"]:
            if col in df_input.columns:
                df_input[col] = df_input[col].astype(str)

        print("\n==== /predict INPUT ====")
        print(df_input.head())
        print(df_input.dtypes)
        print("==== END INPUT ====\n")

        preds = model.predict(df_input)


        preds = np.maximum(preds, 0.0)

        if len(preds) == 1:
            return jsonify({"prediction": float(preds[0])})

        return jsonify({"predictions": [float(p) for p in preds]})

    except Exception as e:
        print("Error in /predict:", traceback.format_exc())
        return jsonify({"error": str(e)}), 500


@app.route("/upload_csv", methods=["POST"])
def upload_csv():
    if "file" not in request.files:
        return jsonify({"message": "No file part"}), 400
    file = request.files["file"]
    if file.filename == "":
        return jsonify({"message": "No selected file"}), 400
    filepath = os.path.join(UPLOAD_FOLDER, file.filename)
    file.save(filepath)
    try:
        df = pd.read_csv(filepath)
        return jsonify({"message": f"File {file.filename} uploaded successfully", "rows": len(df)})
    except Exception as e:
        return jsonify({"message": f"Failed to read CSV: {e}"}), 500


# ===========================
# Main Entry
# ===========================
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000,debug=True)



    