import pandas as pd
import plotly.express as px
from dash import Dash, dcc, html, Input, Output, callback_context

# =========================================
# Load dataset
# =========================================
df = pd.read_csv(r"C:\Users\AdminOS\Desktop\Depi Project\mydata.csv")
df["OrderDate"] = pd.to_datetime(df["OrderDate"], errors="coerce")
df["OrderYear"] = df["OrderDate"].dt.year
df["OrderMonth"] = df["OrderDate"].dt.month
df = df.dropna(subset=["TotalDue", "ProductName", "Category", "Territory"])

# Dropdown / Checklist options
options_year = [{"label": y, "value": y} for y in sorted(df["OrderYear"].dropna().unique())]
options_territory = [{"label": t, "value": t} for t in df["Territory"].dropna().unique()]
options_category = [{"label": c, "value": c} for c in df["Category"].dropna().unique()]

# =========================================
# Chatbot logic
# =========================================
def answer_question_text(question, df):
    q = question.lower()
    dff = df.copy()
    if "top products" in q:
        top = dff.groupby("ProductName")["TotalDue"].sum().nlargest(5).reset_index()
        return "\n".join([f"{i+1}. {row['ProductName']}: {row['TotalDue']:.2f}" for i, row in top.iterrows()])
    if "sales by territory" in q or "best territory" in q:
        ter = dff.groupby("Territory")["TotalDue"].sum().reset_index().sort_values(by="TotalDue", ascending=False)
        return "\n".join([f"{row['Territory']}: {row['TotalDue']:.2f}" for i, row in ter.iterrows()])
    if "sales by category" in q or "category" in q:
        cat = dff.groupby("Category")["TotalDue"].sum().reset_index()
        return "\n".join([f"{row['Category']}: {row['TotalDue']:.2f}" for i, row in cat.iterrows()])
    if "average sales" in q:
        return f"Average Total Sales = {dff['TotalDue'].mean():.2f}"
    if "total sales" in q:
        return f"Total Sales = {dff['TotalDue'].sum():.2f}"
    if "needs marketing" in q:
     low = dff.groupby("ProductName")["TotalDue"].sum().nsmallest(5).reset_index()
     return "\n".join([f"{i+1}. {row['ProductName']}" for i, row in low.iterrows()])

    return "Click an example button 😊"

# =========================================
# Dash App
# =========================================
app = Dash(__name__)

# =========================================
# Layout
# =========================================
app.layout = html.Div(
    style={"backgroundColor": "#001f3f", "color": "white", "padding": "20px", "font-family": "Arial", "minHeight":"100vh"},
    children=[
        html.H1("Sales Dashboard", style={"textAlign": "center", "color": "white", "marginBottom":"30px"}),

        # Filters
        html.Div([
            html.Div([
                html.Label("Select Year", style={"color": "white"}),
                dcc.Dropdown(id="year_filter", options=options_year, value=None, multi=False, placeholder="Choose a Year",
                             style={"backgroundColor":"#001f3f","color":"white"})
            ], style={"width": "30%", "display": "inline-block"}),

            html.Div([
                html.Label("Select Territory", style={"color": "white"}),
                dcc.Dropdown(id="territory_filter", options=options_territory, value=[], multi=True, placeholder="Choose Territory",
                             style={"backgroundColor":"#001f3f","color":"white"})
            ], style={"width": "30%", "display": "inline-block", "marginLeft": "30px"}),

            html.Div([
                html.Label("Select Category", style={"color": "white"}),
                dcc.Checklist(id="category_filter", options=options_category, value=[], inline=True,
                              inputStyle={"margin-right": "5px", "margin-left": "10px"})
            ], style={"width": "30%", "display": "inline-block", "marginLeft": "30px"})
        ], style={"marginBottom": "30px"}),

        # Graphs
        html.Div([
            dcc.Graph(id="pie_chart", style={"width": "48%", "display": "inline-block"}),
            dcc.Graph(id="bar_chart", style={"width": "48%", "display": "inline-block"})
        ]),

        html.Div([
            dcc.Graph(id="line_chart", style={"width": "48%", "display": "inline-block"}),
            dcc.Graph(id="heatmap_chart", style={"width": "48%", "display": "inline-block"})
        ]),

        html.Div([
            dcc.Graph(id="top10_chart", style={"width": "100%", "display": "inline-block"})
        ]),

        # Chatbot button
        html.Button("💬", id="open_chatbot", n_clicks=0,
                    style={"borderRadius":"50%","width":"60px","height":"60px","fontSize":"24px",
                           "position":"fixed","bottom":"20px","right":"20px",
                           "backgroundColor":"#00aced","color":"white","border":"none","cursor":"pointer"}),

        # Chatbot panel
        html.Div(id="chatbot_panel", style={"display":"none","position":"fixed","bottom":"90px","right":"20px",
                                           "width":"350px","backgroundColor":"#001f3f",
                                           "padding":"15px","borderRadius":"10px","boxShadow":"0px 0px 10px #000"},
                 children=[
                     html.H3("Chatbot", style={"textAlign":"center","color":"white"}),
                     html.Div(id="text_output", style={"color":"white","whiteSpace":"pre-line","marginBottom":"10px"}),
                     html.Div([
                         html.H4("What You Need ??", style={"color":"white","marginBottom":"5px"}),
                         html.Button("Top Products", id="ex1", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"}),
                         html.Button("Sales by Territory", id="ex2", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"}),
                         html.Button("Sales by Category", id="ex3", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"}),
                         html.Button("Average Sales", id="ex4", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"}),
                         html.Button("Total Sales", id="ex5", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"}),
                         html.Button("Needs Marketing", id="ex6", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"}),
                         html.Button("Best Territory", id="ex7", n_clicks=0,
                                     style={"backgroundColor":"#001f3f","color":"white","margin":"2px"})
                     ])
                 ])
    ]
)

# =========================================
# Callbacks
# =========================================
@app.callback(
    Output("chatbot_panel", "style"),
    Input("open_chatbot", "n_clicks")
)
def toggle_chatbot(n):
    if n is None or n % 2 == 0:
        return {"display":"none","position":"fixed","bottom":"90px","right":"20px",
                "width":"350px","backgroundColor":"#001f3f",
                "padding":"15px","borderRadius":"10px","boxShadow":"0px 0px 10px #000"}
    return {"display":"block","position":"fixed","bottom":"90px","right":"20px",
            "width":"350px","backgroundColor":"#001f3f",
            "padding":"15px","borderRadius":"10px","boxShadow":"0px 0px 10px #000"}

@app.callback(
    Output("text_output", "children"),
    [Input("ex1","n_clicks"), Input("ex2","n_clicks"), Input("ex3","n_clicks"),
     Input("ex4","n_clicks"), Input("ex5","n_clicks"), Input("ex6","n_clicks"),
     Input("ex7","n_clicks")]
)
def chatbot_callback(ex1, ex2, ex3, ex4, ex5, ex6, ex7):
    triggered_id = callback_context.triggered[0]['prop_id'].split('.')[0]
    if triggered_id == "ex1": return answer_question_text("top products", df)
    elif triggered_id == "ex2": return answer_question_text("sales by territory", df)
    elif triggered_id == "ex3": return answer_question_text("sales by category", df)
    elif triggered_id == "ex4": return answer_question_text("average sales", df)
    elif triggered_id == "ex5": return answer_question_text("total sales", df)
    elif triggered_id == "ex6": return answer_question_text("needs marketing", df)
    elif triggered_id == "ex7": return answer_question_text("best territory", df)
    return "Click To Get Answer"

# Dashboard charts callback
@app.callback(
    [Output("pie_chart", "figure"), Output("bar_chart", "figure"),
     Output("line_chart", "figure"), Output("heatmap_chart", "figure"),
     Output("top10_chart", "figure")],
    [Input("year_filter","value"), Input("territory_filter","value"), Input("category_filter","value")]
)
def update_charts(selected_year, selected_territory, selected_category):
    dff = df.copy()
    if selected_year: dff = dff[dff["OrderYear"]==selected_year]
    if selected_territory: dff = dff[dff["Territory"].isin(selected_territory)]
    if selected_category: dff = dff[dff["Category"].isin(selected_category)]

    pie_fig = px.pie(dff.groupby("Territory")["TotalDue"].sum().reset_index(),
                     names="Territory", values="TotalDue", title="Sales by Territory")
    pie_fig.update_traces(textinfo="percent+label", textfont_color="white")
    pie_fig.update_layout(paper_bgcolor="#001f3f", plot_bgcolor="#001f3f", font_color="white")

    bar_fig = px.bar(dff.groupby("Category")["TotalDue"].sum().reset_index(),
                     x="Category", y="TotalDue", text="TotalDue",
                     color="TotalDue", color_continuous_scale="Blues", title="Sales by Category")
    bar_fig.update_traces(textfont_color="white")
    bar_fig.update_layout(paper_bgcolor="#001f3f", plot_bgcolor="#001f3f", font_color="white")

    line_fig = px.line(dff.groupby("OrderMonth")["TotalDue"].mean().reset_index(),
                       x="OrderMonth", y="TotalDue", markers=True, title="Average Sales per Month")
    line_fig.update_traces(marker=dict(color="cyan"), line=dict(color="cyan"))
    line_fig.update_layout(paper_bgcolor="#001f3f", plot_bgcolor="#001f3f", font_color="white")

    heatmap_data = dff.groupby(["Territory","Category"])["TotalDue"].sum().reset_index()
    heatmap_fig = px.density_heatmap(heatmap_data, x="Territory", y="Category", z="TotalDue",
                                     color_continuous_scale="Blues", title="Sales ( Territory vs Category )")
    heatmap_fig.update_layout(paper_bgcolor="#001f3f", plot_bgcolor="#001f3f", font_color="white")

    top10 = dff.groupby("ProductName")["TotalDue"].sum().reset_index().sort_values(by="TotalDue", ascending=False).head(10)
    top10_fig = px.bar(top10, x="ProductName", y="TotalDue", text="TotalDue",
                       color="TotalDue", color_continuous_scale="Blues", title="Top 10 Products")
    top10_fig.update_traces(textfont_color="white")
    top10_fig.update_layout(paper_bgcolor="#001f3f", plot_bgcolor="#001f3f", font_color="white")

    return pie_fig, bar_fig, line_fig, heatmap_fig, top10_fig

# =========================================
if __name__ == "__main__":
    app.run(debug=True, use_reloader=False)
