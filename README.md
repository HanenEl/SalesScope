# **SalesScope — End-to-End Sales Analytics & Forecasting System**

SalesScope is an integrated end-to-end sales analytics and forecasting system designed to help businesses make smarter decisions in inventory planning, marketing strategy, and sales management.
The project combines **data processing, machine learning, dashboard visualization, and a chatbot system** into one unified pipeline.

### It provides:

* **Deployment Interface**: Upload your own dataset manually or use a preloaded file to generate predictions instantly.
* **Sales Forecasting**: Predict future sales based on uploaded data for better inventory and marketing planning.
* **Interactive Dashboard**: Visualize sales insights, trends, and product performance with dynamic charts.
* **Chatbot Assistance**: Ask simple questions within the dashboard to get immediate insights from the data.

This project demonstrates the complete journey from **data cleaning → EDA → feature engineering → model training → deployment**.

---

## **About the Dataset**

This project uses a curated portion of the **Microsoft AdventureWorks Sales Dataset**, which is publicly provided by Microsoft for analytics, SQL training, and machine learning experimentation.

🔗 **Original Dataset (AdventureWorks):**
[Datase Link.](https://learn.microsoft.com/en-us/sql/samples/adventureworks-install-configure?view=sql-server-ver16)

A customized subset from the following tables was extracted and cleaned:

* Sales Orders
* Sales Order Details
* Customers
* Products
* Sales Territories

All preprocessing steps—including missing value handling, feature engineering, encoding, and outlier treatment—were done inside the Jupyter Notebook `Sales_EndToEnd_Project.ipynb`.

---

## **Repository Structure:**

```
SalesScope/
│── app.py
│── requirements.txt   
│── data        
│── Sales_EndToEnd_Project.ipynb
│
├── templates/
│     └── Sales Scope.html
├── Dash/
|     ├── dash.py
|     └── Image
└── static/
      ├── style.css
      └── app.js
```
---

## ⚙️ **5. Running the Project Locally**

### **1. Clone the repo**

```bash
git clone https://github.com/HanenEl/SalesScope.git
cd SalesScope
```

### **2. Install requirements**

```bash
pip install -r Requirements.txt
```

### **3. Start the Flask app**

```bash 
python app.py
```

Backend runs on:
`[http://127.0.0.1:5000/](http://127.0.0.1:5000)`

---

## **Tech Stack**

- **Languages:** Python, JavaScript, HTML/CSS
- **Frameworks:** Flask, Dash
- **Libraries:** pandas, numpy, scikit-learn, matplotlib, seaborn, plotly
- **Other tools:** Jupyter Notebook, Git/GitHub
  
