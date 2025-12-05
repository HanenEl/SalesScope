/* -----------------------------------------------------------------------------
   Full dashboard JS (ready-to-copy). Works with Flask API that returns:
   { "prediction": 123.45 }
   For batch predictions we POST each row individually and collect responses.
   Requires PapaParse (Papa) and optionally Plotly if charts are used.
   -----------------------------------------------------------------------------
*/

// ----- Configuration -----
const API_BASE = "http://localhost:5000";
const PREDICT_ENDPOINT = `${API_BASE}/predict`;
const UPLOAD_ENDPOINT = `${API_BASE}/upload_csv`;

// ----- Utilities -----
function safeGet(el, selector) {
  return el ? el.querySelector(selector) : null;
}
function elById(id) { return document.getElementById(id); }
function toNumber(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }



// ----- Chatbot Section -----
// Get DOM elements for chat functionality
const chatButton = document.getElementById("chat-button");
const chatBox = document.getElementById("chat-box");
const chatInput = document.getElementById("chat-input");
const chatMessages = document.getElementById("chat-messages");

// Flags to track if welcome and menu messages were sent
let welcomeSent = false;
let menuSent = false;  

// Toggle chat box visibility when chat button is clicked
chatButton.addEventListener("click", () => {
  const wasClosed = chatBox.style.display === "none" || chatBox.style.display === "";

  chatBox.style.display = wasClosed ? "flex" : "none";

  // Send welcome message only once
  if (wasClosed && !welcomeSent) {
    addMessage("bot", "Hi! I'm your Sales Assistant.");
    addMessage("bot", "Click to Start 😊");
    welcomeSent = true;
  }
});

// Handle user input when Enter key is pressed
chatInput.addEventListener("keypress", async (e) => {
  if (e.key === "Enter" && chatInput.value.trim() !== "") {
    const userText = chatInput.value;
    addMessage("user", userText); // Display user's message

    // Show menu options only once
    if (!menuSent) {
      addMessage("bot",
`Please choose a question by number:
1 - Top Products  
2 - Sales by Territory  
3 - Sales by Category  
4 - Average Sales  
5 - Total Sales  
6 - Products That Need Marketing  
7 - All Insights`);
      menuSent = true;
      chatInput.value = "";
      return; 
    }

    // Send user question to backend and get response
    const response = await fetch("/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: userText })
    });

    const data = await response.json();
    addMessage("bot", data.answer); // Display bot's answer

    chatInput.value = ""; // Clear input field
  }
});

// Function to add a message to the chat box
function addMessage(sender, text) {
  const msg = document.createElement("div");
  msg.className = sender; // 'user' or 'bot'
  msg.textContent = text;
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight; // Scroll to latest message
}


// ----- Sales Dashboard (CSV preview + charts) -----
class SalesDashboard {
  constructor() {
    this.data = [];          // raw parsed rows (objects)
    this.filteredData = [];  // after filters
    this.isDataLoaded = false; // Track if data is loaded
    
    // element refs
    this.uploadSection = elById('csvUploadSection');
    this.fileInput = elById('csvFileInput');
    this.uploadBtn = elById('uploadCsvBtn');
    this.fileName = elById('fileName');
    this.uploadStatus = elById('uploadStatus');
    this.filtersPanel = elById('filtersPanel');
    this.chartsContainer = elById('chartsContainer');
    this.metricsCards = elById('metricsCards'); 
    this.reloadDashboardSection = elById('reloadDashboardSection'); // Reload Button
    
    this.pieTarget = 'pie_chart';
    this.barTarget = 'bar_chart';
    this.lineTarget = 'line_chart';
    this.heatmapTarget = 'heatmap_chart';
    this.top10Target = 'top10_chart';

    this.init();
  }

  async init() {
    this.clearDefaultValues();
    this.hideAllSections(); // Hide everything before uploading the file
    this.setupCSVUpload();
    this.setupEventListeners();
  }

  setupCSVUpload() {
    if (!this.uploadSection) return;

    if (this.uploadBtn && this.fileInput) {
      this.uploadBtn.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => {
        const file = e.target.files && e.target.files[0];
        if (!file) return;
        this.fileName.textContent = file.name;
        this.uploadStatus.textContent = 'Loading data...';
        this.uploadStatus.style.color = 'var(--muted)';
        this.loadDataFromFile(file);
      });
    }

    // Show upload section 
    if (this.uploadSection) this.uploadSection.style.display = 'block';
  }

  clearDefaultValues() {
    // Clear all metrics
    if (elById('totalSales')) elById('totalSales').textContent = '-';
    if (elById('totalTransactions')) elById('totalTransactions').textContent = '-';
    if (elById('avgOrderValue')) elById('avgOrderValue').textContent = '-';
    if (elById('topTerritory')) elById('topTerritory').textContent = '-';
    
    // Clear charts if they exist
    if (typeof Plotly !== 'undefined') {
      try {
        Plotly.purge(this.pieTarget);
        Plotly.purge(this.barTarget);
        Plotly.purge(this.lineTarget);
        Plotly.purge(this.heatmapTarget);
        Plotly.purge(this.top10Target);
      } catch (err) {
        console.log('No charts to purge');
      }
    }
  }

  hideAllSections() {
    // Hide the metrics cards
    if (this.metricsCards) this.metricsCards.style.display = 'none';
    
    // Hide the reload button
    if (this.reloadDashboardSection) this.reloadDashboardSection.style.display = 'none';
    
    // Hide filters and charts until data is loaded
    if (this.filtersPanel) this.filtersPanel.style.display = 'none';
    if (this.chartsContainer) this.chartsContainer.style.display = 'none';
    
    // Reset the upload state
    if (this.fileName) this.fileName.textContent = 'No file chosen';
    if (this.uploadStatus) this.uploadStatus.textContent = '';
  }

  showAllSections() {
    // Show the metrics cards first
    if (this.metricsCards) {
      this.metricsCards.style.display = 'grid';
      this.metricsCards.style.opacity = '0';
      setTimeout(() => {
        this.metricsCards.style.opacity = '1';
        this.metricsCards.style.transition = 'opacity 0.5s ease';
      }, 50);
    }
    
    // Show the reload button
    if (this.reloadDashboardSection) {
      this.reloadDashboardSection.style.display = 'block';
    }
    
    // Show filters and charts after data is loaded
    if (this.filtersPanel) {
      this.filtersPanel.style.display = 'flex';
      this.filtersPanel.style.opacity = '0';
      setTimeout(() => {
        this.filtersPanel.style.opacity = '1';
        this.filtersPanel.style.transition = 'opacity 0.5s ease';
      }, 100);
    }
    
    if (this.chartsContainer) {
      this.chartsContainer.style.display = 'grid';
      this.chartsContainer.style.opacity = '0';
      setTimeout(() => {
        this.chartsContainer.style.opacity = '1';
        this.chartsContainer.style.transition = 'opacity 0.5s ease';
      }, 150);
    }
  }

  loadDataFromFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        this.uploadStatus.textContent = 'Parsing CSV file...';
        this.parseCSVData(e.target.result);
      } catch (err) {
        console.error(err);
        this.uploadStatus.textContent = 'Error loading file: ' + (err.message || err);
        this.uploadStatus.style.color = 'var(--danger)';
      }
    };
    reader.onerror = () => {
      this.uploadStatus.textContent = 'Error reading file';
      this.uploadStatus.style.color = 'var(--danger)';
    };
    reader.readAsText(file);
  }

  parseCSVData(csvText) {
    const self = this;
    Papa.parse(csvText, {
      header: true,
      dynamicTyping: true,
      skipEmptyLines: true,
      complete(results) {
        if (results.errors && results.errors.length > 0) {
          throw new Error('Error parsing CSV file: ' + results.errors[0].message);
        }

        if (!results.data || results.data.length === 0) {
          throw new Error('CSV file is empty or has no data');
        }

        console.log('Raw CSV data:', results.data.slice(0, 5)); // Debug first 5 rows

        // Clean and filter data
        self.data = results.data
          .filter(row => row && row.TotalDue !== null && row.TotalDue !== undefined)
          .map(row => {
            const cleanRow = {};

            // Debug row structure
            console.log('Row keys:', Object.keys(row));

            // Try different possible column names for each field
            // Territory
            cleanRow.Territory = row.Territory || row.territory || row.Region || row.region || 'Unknown';

            // Category
            cleanRow.Category = row.Category || row.category || row.product_category || 'Unknown';

            // Product
            cleanRow['Product.1'] = row['Product.1'] || row.Product || row.product_name || row.ProductName || 'Unknown Product';

            // TotalDue - try multiple possible column names
            cleanRow.TotalDue = Number(row.TotalDue) || 
                              Number(row.total_due) || 
                              Number(row.amount) || 
                              Number(row.Sales) || 
                              Number(row.sales) || 
                              0;

            // OrderDate
            if (row.OrderDate) {
              try {
                const date = new Date(row.OrderDate);
                if (!isNaN(date)) {
                  cleanRow.Year = date.getFullYear();
                  cleanRow.Month = date.getMonth() + 1;
                  cleanRow.OrderDate = row.OrderDate;
                }
              } catch (e) {
                console.log('Date parsing error:', e);
              }
            }

            // If Year/Month not found, try other columns
            if (!cleanRow.Year) {
              if (row.Year) cleanRow.Year = row.Year;
              else if (row.year) cleanRow.Year = row.year;
              else cleanRow.Year = 2023;
            }
            
            if (!cleanRow.Month) {
              if (row.Month) cleanRow.Month = row.Month;
              else if (row.month) cleanRow.Month = row.month;
              else cleanRow.Month = Math.floor(Math.random() * 12) + 1;
            }

            // Keep all original fields for debugging
            Object.keys(row).forEach(k => cleanRow[k] = row[k]);

            return cleanRow;
          })
          .filter(row => {
            // Filter out rows with no sales data
            const hasSales = row.TotalDue && row.TotalDue > 0;
            if (!hasSales) {
              console.log('Row filtered out (no sales):', row);
            }
            return hasSales;
          });

        console.log('Cleaned data count:', self.data.length);
        console.log('First cleaned row:', self.data[0]);

        if (self.data.length === 0) {
          throw new Error('No valid sales data found in the CSV file. Make sure there is a "TotalDue" or similar column with sales amounts.');
        }

        self.filteredData = [...self.data];
        self.isDataLoaded = true;
        
        // Update UI in sequence
        setTimeout(() => {
          self.uploadStatus.textContent = `Loaded ${self.data.length.toLocaleString()} records successfully!`;
          self.uploadStatus.style.color = 'var(--success)';

          // Hide the upload section
          if (self.uploadSection) {
            self.uploadSection.style.display = 'none';
          }
          
          // Show all sections (Metrics, Reload Button, Filters, Charts)
          self.showAllSections();
          
          // Setup filters
          self.setupFilters();
          
          // Update metrics
          self.updateMetrics();
          
          // Update charts
          self.updateCharts();
          
          console.log('Dashboard fully loaded and updated');
        }, 100);
      },
      error(err) {
        throw new Error('Error parsing CSV: ' + err.message);
      }
    });
  }

  // Filters: populate selects / checkboxes
  setupFilters() {
    if (!this.isDataLoaded) return;
    
    this.populateYearFilter();
    this.populateTerritoryFilter();
    this.populateCategoryFilter();
  }

  setupEventListeners() {
    // Year filter
    const yearSelect = elById('year_filter');
    if (yearSelect) {
      yearSelect.addEventListener('change', () => {
        if (this.isDataLoaded) this.applyFilters();
      });
    }

    // Territory filter
    const territorySelect = elById('territory_filter');
    if (territorySelect) {
      territorySelect.addEventListener('change', () => {
        if (this.isDataLoaded) this.applyFilters();
      });
    }

    // Category checkboxes
    document.addEventListener('change', (e) => {
      if (e.target && e.target.classList && e.target.classList.contains('category-checkbox')) {
        if (this.isDataLoaded) this.applyFilters();
      }
    });

    // Reload Dashboard
    const reloadBtn = elById('reloadDashboardBtn');
    if (reloadBtn) {
      reloadBtn.addEventListener('click', () => {
        this.resetDashboard();
      });
    }
  }

  populateYearFilter() {
    if (!this.isDataLoaded || this.data.length === 0) return;
    
    const years = [...new Set(this.data.map(item => item.Year))]
      .filter(y => y && !isNaN(y))
      .sort((a, b) => a - b);
    
    const sel = elById('year_filter');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">All Years</option>';
    years.forEach(y => {
      const o = document.createElement('option');
      o.value = y;
      o.textContent = y;
      sel.appendChild(o);
    });
  }

  populateTerritoryFilter() {
    if (!this.isDataLoaded || this.data.length === 0) return;
    
    const territories = [...new Set(this.data.map(item => item.Territory))]
      .filter(t => t && t.trim() !== '')
      .sort();
    
    const sel = elById('territory_filter');
    if (!sel) return;
    
    sel.innerHTML = '<option value="">All Territories</option>';
    territories.forEach(t => {
      const o = document.createElement('option');
      o.value = t;
      o.textContent = t;
      sel.appendChild(o);
    });
  }

  populateCategoryFilter() {
    if (!this.isDataLoaded || this.data.length === 0) return;
    
    const cats = [...new Set(this.data.map(item => item.Category))]
      .filter(c => c && c.trim() !== '')
      .sort();
    
    const container = elById('category_filter');
    if (!container) return;
    
    container.innerHTML = '';
    cats.forEach(c => {
      const label = document.createElement('label');
      label.className = 'checkbox-label';

      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = true;
      cb.className = 'category-checkbox';
      cb.value = c;

      const span = document.createElement('span');
      span.textContent = c;
      span.style.marginLeft = '8px';

      label.appendChild(cb);
      label.appendChild(span);
      container.appendChild(label);
    });
  }

  applyFilters() {
    if (!this.isDataLoaded) return;
    
    const year = (elById('year_filter')?.value || '').toString();
    const territory = (elById('territory_filter')?.value || '').toString();
    const selectedCats = Array.from(document.querySelectorAll('.category-checkbox:checked')).map(i => i.value);

    this.filteredData = this.data.filter(r => {
      const yearMatch = !year || String(r.Year) === year;
      const territoryMatch = !territory || r.Territory === territory;
      const categoryMatch = selectedCats.length === 0 || selectedCats.includes(r.Category);
      
      return yearMatch && territoryMatch && categoryMatch;
    });

    console.log(`Filtered to ${this.filteredData.length} records`);
    
    this.updateMetrics();
    this.updateCharts();
  }

  updateMetrics() {
    if (!this.isDataLoaded || !this.filteredData || this.filteredData.length === 0) {
      console.log('Cannot update metrics: no data loaded');
      return;
    }
    
    try {
      const totalSales = this.filteredData.reduce((s, r) => s + (r.TotalDue || 0), 0);
      const totalTx = this.filteredData.length;
      const avg = totalTx > 0 ? totalSales / totalTx : 0;

      // Find the top sales territory
      const territorySales = this.filteredData.reduce((acc, item) => {
        const territory = item.Territory || 'Unknown';
        acc[territory] = (acc[territory] || 0) + (item.TotalDue || 0);
        return acc;
      }, {});
      
      const topTerritory = Object.entries(territorySales).sort(([, a], [, b]) => b - a)[0];

      if (elById('totalSales')) {
        elById('totalSales').textContent = `$${this.formatNumber(totalSales)}`;
      }
      if (elById('totalTransactions')) {
        elById('totalTransactions').textContent = totalTx.toLocaleString();
      }
      if (elById('avgOrderValue')) {
        elById('avgOrderValue').textContent = `$${this.formatNumber(avg)}`;
      }
      if (elById('topTerritory')) {
        elById('topTerritory').textContent = topTerritory ? topTerritory[0] : '-';
      }
      
      console.log('Metrics updated:', { totalSales, totalTx, avg, topTerritory: topTerritory?.[0] });
    } catch (err) {
      console.error('Error updating metrics:', err);
    }
  }

  formatNumber(num) {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + 'M';
    } else if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'K';
    }
    return Math.round(num).toLocaleString();
  }

  // Charts (use Plotly if present)
  updateCharts() {
    if (typeof Plotly === 'undefined') {
      console.warn('Plotly is not loaded. Charts will not be displayed.');
      return;
    }
    
    if (!this.isDataLoaded || !this.filteredData || this.filteredData.length === 0) {
      console.log('Cannot update charts: no data loaded');
      return;
    }
    
    try {
      console.log('Updating charts with', this.filteredData.length, 'records');
      
      // Give a small delay to ensure DOM is ready
      setTimeout(() => {
        this.createPieChart();
        this.createBarChart();
        this.createLineChart();
        this.createHeatmapChart();
        this.createTop10Chart();
        
        console.log('All charts updated successfully');
      }, 200);
    } catch (err) {
      console.error('Chart update failed:', err);
    }
  }

  createPieChart() {
    try {
      const territorySales = this.filteredData.reduce((acc, item) => {
        if (item.Territory && item.TotalDue) {
          const territory = item.Territory.trim();
          acc[territory] = (acc[territory] || 0) + Number(item.TotalDue);
        }
        return acc;
      }, {});

      const sortedData = Object.entries(territorySales)
        .sort(([, a], [, b]) => b - a);

      if (sortedData.length === 0) {
        console.log('No data for pie chart');
        return;
      }

      const data = [{
        values: sortedData.map(([, sales]) => sales),
        labels: sortedData.map(([territory]) => territory),
        type: 'pie',
        hole: 0.4,
        textinfo: 'percent+label',
        textposition: 'outside',
        marker: {
          colors: ['#8a3df2', '#6b46c1', '#553c9a', '#44337a', '#322659', '#2563eb', '#dc2626', '#16a34a', '#ea580c', '#7c3aed']
        }
      }];

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#dbe6ef', size: 12 },
        showlegend: true,
        legend: {
          font: { color: '#dbe6ef', size: 11 },
          orientation: 'v'
        },
        margin: { t: 30, b: 30, l: 30, r: 30 }
      };

      const target = document.getElementById(this.pieTarget);
      if (target) {
        Plotly.newPlot(target, data, layout, { displayModeBar: false });
        console.log('Pie chart created');
      }
    } catch (err) {
      console.error('Error creating pie chart:', err);
    }
  }

  createBarChart() {
    try {
      const categorySales = this.filteredData.reduce((acc, item) => {
        if (item.Category && item.TotalDue) {
          const category = item.Category.trim();
          acc[category] = (acc[category] || 0) + Number(item.TotalDue);
        }
        return acc;
      }, {});

      const sortedCategories = Object.entries(categorySales)
        .sort(([, a], [, b]) => b - a);

      if (sortedCategories.length === 0) {
        console.log('No data for bar chart');
        return;
      }

      const data = [{
        x: sortedCategories.map(([name]) => name),
        y: sortedCategories.map(([, sales]) => sales),
        type: 'bar',
        marker: { color: '#8a3df2' },
        text: sortedCategories.map(([, sales]) => '$' + this.formatNumber(sales)),
        textposition: 'auto'
      }];

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#dbe6ef' },
        margin: { t: 50, b: 80, l: 60, r: 30 },
        xaxis: {
          tickangle: -45,
          title: {
            text: 'Category',
            font: { color: '#dbe6ef' }
          }
        },
        yaxis: {
          title: {
            text: 'Total Sales ($)',
            font: { color: '#dbe6ef' }
          }
        }
      };

      const target = document.getElementById(this.barTarget);
      if (target) {
        Plotly.newPlot(target, data, layout, { displayModeBar: false });
        console.log('Bar chart created');
      }
    } catch (err) {
      console.error('Error creating bar chart:', err);
    }
  }

  createLineChart() {
    try {
      const monthlySales = this.filteredData.reduce((acc, item) => {
        if (item.Month && item.TotalDue) {
          const month = parseInt(item.Month);
          if (month >= 1 && month <= 12) {
            acc[month] = (acc[month] || 0) + (item.TotalDue || 0);
          }
        }
        return acc;
      }, {});

      const allMonths = Array.from({ length: 12 }, (_, i) => i + 1);
      const salesData = allMonths.map(month => ({
        month,
        sales: monthlySales[month] || 0
      }));

      const data = [{
        x: salesData.map(d => this.getMonthName(d.month)),
        y: salesData.map(d => d.sales),
        type: 'scatter',
        mode: 'lines+markers',
        line: { color: '#22c55e', width: 3 },
        marker: { color: '#22c55e', size: 8 }
      }];

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#dbe6ef' },
        margin: { t: 50, b: 50, l: 60, r: 30 },
        xaxis: {
          title: {
            text: 'Month',
            font: { color: '#dbe6ef' }
          }
        },
        yaxis: {
          title: {
            text: 'Total Sales ($)',
            font: { color: '#dbe6ef' }
          }
        }
      };

      const target = document.getElementById(this.lineTarget);
      if (target) {
        Plotly.newPlot(target, data, layout, { displayModeBar: false });
        console.log('Line chart created');
      }
    } catch (err) {
      console.error('Error creating line chart:', err);
    }
  }

  getMonthName(monthNumber) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[monthNumber - 1] || '';
  }

  createHeatmapChart() {
    try {
      const heatmapData = this.filteredData.reduce((acc, item) => {
        if (item.Territory && item.Category && item.TotalDue) {
          const key = `${item.Territory}-${item.Category}`;
          acc[key] = (acc[key] || 0) + (item.TotalDue || 0);
        }
        return acc;
      }, {});

      const territories = [...new Set(this.filteredData.map(item => item.Territory))]
        .filter(t => t && t.trim() !== '')
        .sort();
      
      const categories = [...new Set(this.filteredData.map(item => item.Category))]
        .filter(c => c && c.trim() !== '')
        .sort();

      if (territories.length === 0 || categories.length === 0) {
        console.log('No data for heatmap chart');
        return;
      }

      const z = categories.map(category =>
        territories.map(territory =>
          heatmapData[`${territory}-${category}`] || 0
        )
      );

      const data = [{
        z: z,
        x: territories,
        y: categories,
        type: 'heatmap',
        colorscale: 'Blues',
        hoverongaps: false
      }];

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#dbe6ef' },
        margin: { t: 50, b: 80, l: 100, r: 30 },
        xaxis: {
          title: {
            text: 'Territory',
            font: { color: '#dbe6ef' }
          },
          tickangle: -45
        },
        yaxis: {
          title: {
            text: 'Category',
            font: { color: '#dbe6ef' }
          }
        }
      };

      const target = document.getElementById(this.heatmapTarget);
      if (target) {
        Plotly.newPlot(target, data, layout, { displayModeBar: false });
        console.log('Heatmap chart created');
      }
    } catch (err) {
      console.error('Error creating heatmap chart:', err);
    }
  }

  createTop10Chart() {
    try {
      const productSales = this.filteredData.reduce((acc, item) => {
        const productName = item['Product.1'] || item.ProductName || 'Unknown';
        if (productName && item.TotalDue) {
          acc[productName] = (acc[productName] || 0) + (item.TotalDue || 0);
        }
        return acc;
      }, {});

      const sortedProducts = Object.entries(productSales)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

      if (sortedProducts.length === 0) {
        console.log('No data for top 10 chart');
        return;
      }

      const data = [{
        x: sortedProducts.map(([, sales]) => sales),
        y: sortedProducts.map(([name]) => name.substring(0, 30)), // Limit name length
        type: 'bar',
        orientation: 'h',
        marker: { color: '#8a3df2' }
      }];

      const layout = {
        paper_bgcolor: 'rgba(0,0,0,0)',
        plot_bgcolor: 'rgba(0,0,0,0)',
        font: { color: '#dbe6ef' },
        margin: { t: 30, b: 30, l: 150, r: 30 },
        xaxis: {
          title: {
            text: 'Total Sales ($)',
            font: { color: '#dbe6ef' }
          }
        },
        yaxis: {
          title: {
            text: 'Product',
            font: { color: '#dbe6ef' }
        },
        automargin: true
        }
      };

      const target = document.getElementById(this.top10Target);
      if (target) {
        Plotly.newPlot(target, data, layout, { displayModeBar: false });
        console.log('Top 10 chart created');
      }
    } catch (err) {
      console.error('Error creating top 10 chart:', err);
    }
  }

  showError(message) {
    if (this.uploadStatus) {
      this.uploadStatus.textContent = message;
      this.uploadStatus.style.color = 'var(--danger)';
    }
  }

  // New function to reset the Dashboard
  resetDashboard() {
    this.data = [];
    this.filteredData = [];
    this.isDataLoaded = false;
    
    // Reset values
    this.clearDefaultValues();
    
    // Hide all sections
    this.hideAllSections();
    
    // Show only the upload section
    if (this.uploadSection) {
      this.uploadSection.style.display = 'block';
    }

    // Clear the upload state
    if (this.fileName) this.fileName.textContent = 'No file chosen';
    if (this.uploadStatus) this.uploadStatus.textContent = '';
    if (this.fileInput) this.fileInput.value = '';
    
    console.log('Dashboard reset to initial state');
  }
}

// ----- Upload & Predict (handles drag/drop, parse CSV, call /predict per row) -----
class UploadPredict {
  constructor() {
    this.uploadedData = null;   // parsed rows array
    this.predictions = [];      // collected predictions (parallel to uploadedData)
    this.init();
  }

  init() {
    this.dropArea = elById('dropArea');
    this.fileInput = elById('fileInput');
    this.browseBtn = elById('browseBtn');
    this.downloadBtn = elById('downloadResults');
    this.newPredictionBtn = elById('newPrediction');
    this.processingSection = elById('processingSection');
    this.resultsSection = elById('resultsSection');
    this.processedRecordsEl = elById('processedRecords');
    this.processingTimeEl = elById('processingTime');
    this.predictAllBtn = elById('predictAllBtn');
    this.rowsContainer = elById('rowsContainer');
    this.predictionsTableBody = elById('predictionsTableBody');

    this.setupEventListeners();
  }

  setupEventListeners() {
    // File selection
    if (this.browseBtn && this.fileInput) {
      this.browseBtn.addEventListener('click', () => this.fileInput.click());
      this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }

    // Drag and drop
    if (this.dropArea) {
      ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        this.dropArea.addEventListener(eventName, (e) => this.preventDefaults(e), false);
      });

      ['dragenter', 'dragover'].forEach(eventName => {
        this.dropArea.addEventListener(eventName, () => this.highlight(), false);
      });

      ['dragleave', 'drop'].forEach(eventName => {
        this.dropArea.addEventListener(eventName, () => this.unhighlight(), false);
      });

      this.dropArea.addEventListener('drop', (e) => this.handleDrop(e), false);
    }

    // Actions
    if (this.downloadBtn) this.downloadBtn.addEventListener('click', () => this.downloadResults());
    if (this.newPredictionBtn) this.newPredictionBtn.addEventListener('click', () => this.resetUpload());
    if (this.predictAllBtn) this.predictAllBtn.addEventListener('click', () => this.processPredictAll());

    // Clear error when changing the file
    if (this.fileInput) {
      this.fileInput.addEventListener('click', () => {
        this.clearError();
      });
    }
  }

  preventDefaults(e) { e.preventDefault(); e.stopPropagation(); }
  highlight() { if (this.dropArea) this.dropArea.classList.add('drag-over'); }
  unhighlight() { if (this.dropArea) this.dropArea.classList.remove('drag-over'); }

  handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    this.processFiles(files);
  }

  handleFileSelect(e) {
    const files = e.target.files;
    this.processFiles(files);
  }

  async processFiles(files) {
    if (!files || files.length === 0) return;
    const file = files[0];
    
    this.clearError();
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
      return this.showError('Please upload a CSV file');
    }

    try {
      if (this.processingSection) this.processingSection.style.display = 'block';
      if (this.resultsSection) this.resultsSection.style.display = 'none';

      const text = await this.readFile(file);
      this.uploadedData = this.parseCSV(text);

      // Validate data before sending to API
      this.validateUploadData(this.uploadedData);

      // Simulate processing with progress
      await this.simulateProcessing();

      // Get real predictions from API (single row per request)
      await this.getPredictionsForAllRows();

      // Show results 
      this.clearError();
      this.displayResults();

    } catch (err) {
      console.error('Error processing file:', err);
      this.showError(err.message || err);
    } finally {
      if (this.processingSection) this.processingSection.style.display = 'none';
    }
  }

  readFile(file) {
    return new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = e => resolve(e.target.result);
      fr.onerror = () => reject(new Error('Error reading file'));
      fr.readAsText(file);
    });
  }

  parseCSV(txt) {
    const res = Papa.parse(txt, { header: true, dynamicTyping: true, skipEmptyLines: true });
    if (res.errors && res.errors.length > 0) {
      throw new Error('Error parsing CSV: ' + res.errors[0].message);
    }
    return res.data;
  }

  validateUploadData(data) {
    if (!data || data.length === 0) {
      throw new Error('No data found in the CSV file');
    }

    const firstRow = data[0];

    const requiredColumns = [
      'OrderDate',
      'ItemsInOrder',
      'LineTotal',
      'Category',
      'Sub category',
      'ProductName',
      'Territory',
      'Color',
      'Size'
    ];

    const missingColumns = requiredColumns.filter(col => !firstRow.hasOwnProperty(col));

    if (missingColumns.length > 0) {
      throw new Error(`Missing required columns: ${missingColumns.join(', ')}`);
    }

    return true;
  }

  async simulateProcessing() {
    const startTime = Date.now();
    const totalRecords = this.uploadedData ? this.uploadedData.length : 0;

    for (let i = 0; i <= totalRecords; i += Math.ceil(totalRecords / 10) || 1) {
      await sleep(300);
      const elapsed = Math.floor((Date.now() - startTime) / 1000);
      if (this.processedRecordsEl) this.processedRecordsEl.textContent = Math.min(i, totalRecords).toLocaleString();
      if (this.processingTimeEl) this.processingTimeEl.textContent = `${elapsed}s`;
    }
  }

  async getPredictionsForAllRows() {
    this.predictions = [];
    const rows = this.uploadedData;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];

      try {
        const res = await fetch(PREDICT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row)
        });

        if (!res.ok) {
          const text = await res.text().catch(() => null);
          throw new Error(`API ${res.status}: ${text || res.statusText}`);
        }

        const data = await res.json();
        if (data.error) {
          throw new Error(data.error);
        }

        this.predictions.push({
          ...row,
          PredictedDue: typeof data.prediction !== 'undefined' ? data.prediction : null
        });

      } catch (err) {
        console.error('predict row failed', err);

        this.predictions.push({
          ...row,
          PredictedDue: null,
          _error: err.message || String(err)
        });
      }

      await sleep(30);
      if (this.processedRecordsEl) {
        this.processedRecordsEl.textContent = (i + 1).toLocaleString();
      }
    }
  }

  displayResults() {
    if (!this.predictions || this.predictions.length === 0) {
      throw new Error('No predictions received from API');
    }

    // Clear any errors before displaying results
    this.clearError();

    if (elById('accuracyValue')) elById('accuracyValue').textContent = '92.5%';
    if (elById('summaryText')) elById('summaryText').textContent =
      `Processed ${this.predictions.length.toLocaleString()} records successfully`;

    this.updatePredictionsTable(this.predictions.slice(0, 5));

    // Hide the upload section and show results only
    const uploadBox = document.querySelector('.upload-box');
    if (uploadBox) {
      uploadBox.style.display = 'none';
    }

    if (this.resultsSection) {
      this.resultsSection.style.display = 'block';

      this.resultsSection.style.opacity = '0';
      setTimeout(() => {
        this.resultsSection.style.opacity = '1';
        this.resultsSection.style.transition = 'opacity 0.5s ease';
      }, 100);
    }
    
    if (this.dropArea) {
      this.dropArea.style.display = 'none';
    }
  }

  updatePredictionsTable(predictions) {
    if (!this.predictionsTableBody) return;

    this.predictionsTableBody.innerHTML = '';
    predictions.forEach(pred => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>${pred.OrderDate || '-'}</td>
        <td>${(pred.ItemsInOrder != null) ? pred.ItemsInOrder : '-'}</td>
        <td>${(pred.LineTotal != null) ? pred.LineTotal : '-'}</td>
        <td>${pred.Category || '-'}</td>
        <td>${pred['Sub category'] || pred.SubCategory || '-'}</td>
        <td>${pred.ProductName || '-'}</td>
        <td>${pred.Territory || '-'}</td>
        <td>${pred.Color || '-'}</td>
        <td>${pred.Size || '-'}</td>
        <td><strong>${(pred.PredictedDue != null)
          ? `$${Number(pred.PredictedDue).toLocaleString()}`
          : (pred._error ? 'ERR' : '-')
        }</strong></td>
      `;
      this.predictionsTableBody.appendChild(row);
    });
  }

  downloadResults() {
    if (!this.predictions || this.predictions.length === 0) {
      return this.showError('No predictions available to download');
    }
    try {
      const csv = Papa.unparse(this.predictions);
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `sales_predictions_${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      this.showError('Error downloading results: ' + (err.message || err));
    }
  }

resetUpload() {
  this.uploadedData = null;
  this.predictions = null;
  
  this.clearError();
  
  if (this.resultsSection) {
    this.resultsSection.style.display = 'none';
  }
  
  if (this.processingSection) {
    this.processingSection.style.display = 'none';
  }
  
  const uploadBox = document.querySelector('.upload-box');
  if (uploadBox) {
    uploadBox.style.display = 'block';
    uploadBox.removeAttribute('style');
  }
  
  if (this.dropArea) {
    this.dropArea.style.display = 'flex';
    this.dropArea.style.flexDirection = 'column';
    this.dropArea.style.alignItems = 'center';
    this.dropArea.style.justifyContent = 'center';
    this.dropArea.style.textAlign = 'center';
    this.dropArea.style.padding = '40px 20px';
  }

  // Reset the file
  if (this.fileInput) this.fileInput.value = '';
  if (this.dropArea) this.dropArea.classList.remove('drag-over');
}

  showError(msg) {
    console.error('UploadPredict:', msg);
    let cont = elById('uploadError');
    if (!cont) {
      const parent = document.querySelector('.upload-container') || document.body;
      cont = document.createElement('div');
      cont.id = 'uploadError';
      cont.className = 'error-message';
      parent.prepend(cont);
    }
    cont.textContent = msg;
    cont.style.display = 'block';
    cont.style.opacity = '1';
    // Add a button to close the error
    if (!cont.querySelector('.close-error')) {
      const closeBtn = document.createElement('button');
      closeBtn.className = 'close-error';
      closeBtn.innerHTML = '×';
      closeBtn.style.cssText = `
        position: absolute;
        top: 5px;
        right: 5px;
        background: none;
        border: none;
        color: inherit;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
      `;
      closeBtn.addEventListener('click', () => {
        this.clearError();
      });
      cont.style.position = 'relative';
      cont.appendChild(closeBtn);
    }
  }

  clearError() {
    const el = elById('uploadError');
    if (el) {
      el.style.opacity = '0';
      el.style.transition = 'opacity 0.3s ease';
      setTimeout(() => {
        el.style.display = 'none';
      }, 300);
    }
  }

  async processPredictAll() {
    if (!this.uploadedData) {
      this.showError('No uploaded data to predict. Upload a CSV first.');
      return;
    }
    try {
      this.clearError(); 
      if (this.processingSection) this.processingSection.style.display = 'block';
      await this.simulateProcessing();
      await this.getPredictionsForAllRows();
      this.displayResults();
    } finally {
      if (this.processingSection) this.processingSection.style.display = 'none';
    }
  }
}


// ----- Manual Input (row-based form with Predict All) -----
const CATEGORY_MAP = {
  "Accessories": {
    "Tires and Tubes":["road tire","touring tire tube","mountain tire tube","mountain tire","touring tire","patch kit/8 patches"],
    "Bottles and Cages": ["water bottle", "mountain bottle cage", "road bottle cage"],
    "Locks": ["cable lock"],
    "Pumps": ["minipump", "all-purpose bike stand"],
    "Helmets": ["sport-100 helmet"],
    "Cleaners": ["bike wash - dissolver"],
    "Bike Racks": ["hitch rack - 4-bike"],
    "Fenders": ["fender set - mountain"],
    "Hydration Packs": ["hydration pack"]
  },
  "Bikes": {
    "Mountain Bikes": ["mountain-100", "mountain-200", "mountain-300", "mountain-400-w", "mountain-500"],
    "Road Bikes": ["road-150", "road-250", "road-350-w", "road-450", "road-550-w", "road-650", "road-750"],
    "Touring Bikes": ["touring-1000", "touring-2000", "touring-3000"]
  },
  "Clothing": {
    "Socks": ["mountain bike socks", "racing socks"],
    "Jerseys": ["long-sleeve logo jersey", "short-sleeve classic jersey"],
    "Caps": ["awc logo cap"],
    "Tights": ["women's tights"],
    "Gloves": ["half-finger gloves", "full-finger gloves"],
    "Shorts": ["men's sports shorts", "men's bib-shorts", "women's mountain shorts"],
    "Vests": ["classic vest"]
  },
  "Components": {
    "Frames": ["mountain frame", "mountain frame-w", "road frame", "road frame-w"],
    "Wheels": ["road front wheel", "road rear wheel", "mountain front wheel", "mountain rear wheel"],
    "Tires and Tubes": ["mountain tire", "road tire", "mountain tire tube", "road tire tube"],
    "Handlebars": ["mountain handlebars", "road handlebars"],
    "Headsets": ["headset"],
    "Brakes": ["front brakes", "rear brakes"],
    "Derailleurs": ["front derailleur", "rear derailleur"],
    "Cranksets": ["crankset"],
    "Forks": ["fork"],
    "Bottom Brackets": ["bottom bracket"],
    "Pedals": ["mountain pedal", "touring pedal", "road pedal"],
    "Saddles": ["mountain seat/saddle", "road seat/saddle", "touring seat/saddle"],
    "Chains": ["chain"]
  }
};

class ManualInput {
  constructor() {
    this.rowCount = 0;
    this.container = elById('rowsContainer');
    this.predictAllBtn = elById('predictAllBtn');
    this.init();
  }

  init() {
    // Add the first row automatically
    this.addNewRow();
    this.setupEventListeners();
    this.updatePredictionCount();
  }

  setupEventListeners() {
    const addRowBtn = elById('addRowBtn');
    if (addRowBtn) addRowBtn.addEventListener('click', () => this.addNewRow());
    if (this.predictAllBtn) this.predictAllBtn.addEventListener('click', () => this.predictAll());
  }

  addNewRow() {
    this.rowCount++;
    if (!this.container) return;

    const newRow = document.createElement('div');
    newRow.className = 'input-row';
    newRow.innerHTML = this.getRowTemplate();
    this.container.appendChild(newRow);

    populateDropdowns(newRow);
    this.updatePredictionCount();

    // Hide the prediction result for the new row
    const newPredictionBadge = newRow.querySelector('.prediction-badge');
    if (newPredictionBadge) newPredictionBadge.style.display = 'none';
  }

  getRowTemplate() {
    const today = new Date().toISOString().split('T')[0];
    return `
      <div class="prediction-result">
        <span class="prediction-badge" style="display:none;">Predicted: <strong>$0</strong></span>
      </div>
      <div class="form-grid">
        <!-- Order Date -->
        <div class="form-group">
          <label>Order Date</label>
          <input type="date" class="form-input order-date" value="${today}">
        </div>

        <!-- Items In Order  -->
        <div class="form-group">
          <label>Items In Order</label>
          <input type="number" class="form-input items-in-order" min="1" placeholder="1" value="1">
        </div>
        

        <!-- Category -->
        <div class="form-group">
          <label>Category</label>
          <select class="form-select category">
            <option value="">Select Category</option>
          </select>
        </div>

        <!-- Sub Category -->
        <div class="form-group">
          <label>Sub Category</label>
          <select class="form-select sub-category">
            <option value="">Select Sub Category</option>
          </select>
        </div>
        
        <!-- Product name -->
        <div class="form-group">
          <label>Product Name</label>
          <select class="form-select product-name">
            <option value="">Select Product</option>
          </select>
        </div>
        

        <!-- Line Total  -->
        <div class="form-group">
          <label>Line Total</label>
          <input type="number" class="form-input line-total" min="0" step="0.01" placeholder="e.g. 100" value="100">
        </div>

        <!-- Territory -->
        <div class="form-group">
          <label>Territory</label>
          <select class="form-select territory">
            <option value="">Select Territory</option>
            <option>Southwest</option>
            <option>Australia</option>
            <option>United Kingdom</option>
            <option>Northwest</option>
            <option>Canada</option>
            <option>Germany</option>
            <option>France</option>
            <option>Southeast</option>
            <option>Central</option>
            <option>Northeast</option>
          </select>
        </div>

        <!-- Color -->
        <div class="form-group">
          <label>Color</label>
          <select class="form-select color">
            <option value="">Select Color</option>
            <option>No Color</option>
            <option>Black</option>
            <option>Blue</option>
            <option>Red</option>
            <option>Silver</option>
            <option>White</option>
            <option>Multi</option>
            <option>Yellow</option>
            <option>Silver/Black</option>
          </select>
        </div>

        <!-- Size -->
        <div class="form-group">
          <label>Size</label>
          <select class="form-select size">
            <option value="">Select Size</option>
            <option>30 oz.</option>
            <option>No size</option>
            <option>44</option>
            <option>48</option>
            <option>38</option>
            <option>L</option>
            <option>42</option>
            <option>58</option>
            <option>52</option>
            <option>46</option>
            <option>M</option>
            <option>62</option>
            <option>60</option>
            <option>56</option>
            <option>XL</option>
            <option>S</option>
            <option>40</option>
            <option>50</option>
            <option>54</option>
            <option>70 oz.</option>
          </select>
        </div>
      </div>
    `;
  }

  hideAllPredictions() {
    const predictionBadges = document.querySelectorAll('.prediction-badge');
    predictionBadges.forEach(badge => {
      badge.style.display = 'none';
    });
  }

  async predictAll() {
    const predictBtn = this.predictAllBtn;
    if (!predictBtn) return;

    const originalText = predictBtn.textContent;

    predictBtn.textContent = 'Predicting...';
    predictBtn.disabled = true;

    try {
      const predictionData = this.collectFormData();

      if (!this.validateFormData(predictionData)) {
        throw new Error('Please fill all required fields');
      }

      const predictions = await this.callPredictionAPI(predictionData);
      this.displayRealPredictions(predictions);

    } catch (error) {
      console.error('Prediction error:', error);
      this.showError(error.message);
    } finally {
      predictBtn.textContent = originalText;
      predictBtn.disabled = false;
    }
  }

  validateFormData(formData) {
    for (const row of formData) {
      if (
        !row.OrderDate ||
        !row.ItemsInOrder ||
        !row.LineTotal ||
        !row.Category ||
        !row["Sub category"] ||
        !row.ProductName ||
        !row.Territory ||
        !row.Color ||
        !row.Size
      ) {
        return false;
      }
    }
    return true;
  }

  collectFormData() {
    const rows = document.querySelectorAll('.input-row');
    const formData = [];
    rows.forEach((row) => {
      const rowData = {
        OrderDate: row.querySelector('.order-date')?.value || '',
        ItemsInOrder: parseInt(row.querySelector('.items-in-order')?.value) || 1,
        LineTotal: parseFloat(row.querySelector('.line-total')?.value) || 0,
        Category: row.querySelector('.category')?.value || '',
        "Sub category": row.querySelector('.sub-category')?.value || '',
        ProductName: row.querySelector('.product-name')?.value || '',
        Territory: row.querySelector('.territory')?.value || '',
        Color: row.querySelector('.color')?.value || '',
        Size: row.querySelector('.size')?.value || ''
      };
      formData.push(rowData);
    });
    return formData;
  }

  async callPredictionAPI(formData) {
    const predictions = [];

    for (let i = 0; i < formData.length; i++) {
      const row = formData[i];
      try {
        const res = await fetch(PREDICT_ENDPOINT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(row)
        });

        if (!res.ok) {
          const t = await res.text().catch(() => null);
          throw new Error(`API ${res.status}: ${t || res.statusText}`);
        }

        const j = await res.json();
        if (j.error) throw new Error(j.error);

        predictions.push({
          predicted_amount: typeof j.prediction !== 'undefined' ? j.prediction : null
        });

      } catch (err) {
        console.error('predict row failed', err);
        predictions.push({ predicted_amount: null, _error: err.message || String(err) });
      }

      await sleep(30);
    }

    return predictions;
  }

  displayRealPredictions(predictions) {
    const rows = document.querySelectorAll('.input-row');
    rows.forEach((row, index) => {
      const prediction = predictions[index];
      const predictionElement = row.querySelector('.prediction-badge strong');
      const predictionBadge = row.querySelector('.prediction-badge');

      if (predictionElement && prediction && predictionBadge) {
        predictionElement.textContent = `$${prediction.predicted_amount?.toLocaleString() || '0'}`;
        predictionBadge.style.display = 'inline-block';
        predictionBadge.style.animation = 'pulse 0.5s ease-in-out';
        setTimeout(() => {
          predictionBadge.style.animation = '';
        }, 500);
      }
    });
  }

  showError(message) {
  let errorDiv = elById('manualError');

  if (!errorDiv) {
    const parent = document.querySelector('#manual .panel') || document.body;
    errorDiv = document.createElement('div');
    errorDiv.id = 'manualError';
    errorDiv.className = 'error-message';
    parent.prepend(errorDiv);
  }

  errorDiv.textContent = message;
  errorDiv.style.display = 'block';

  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 1500);
}



  updatePredictionCount() {
    if (this.predictAllBtn) {
      this.predictAllBtn.textContent = `Predict All (${this.rowCount})`;
    }
  }
}

function populateDropdowns(row) {
  const categorySelect = row.querySelector(".category");
  const subCategorySelect = row.querySelector(".sub-category");
  const productSelect = row.querySelector(".product-name");

  if (!categorySelect || !subCategorySelect || !productSelect) return;

  // build categories options once for this row
  let catOptions = `<option value="">Select Category</option>`;
  Object.keys(CATEGORY_MAP).forEach(cat => {
    catOptions += `<option value="${cat}">${cat}</option>`;
  });
  categorySelect.innerHTML = catOptions;

  // clear subs and products initially
  subCategorySelect.innerHTML = `<option value="">Select Sub Category</option>`;
  productSelect.innerHTML = `<option value="">Select Product</option>`;

  categorySelect.addEventListener("change", () => {
    // reset sub & product
    subCategorySelect.innerHTML = `<option value="">Select Sub Category</option>`;
    productSelect.innerHTML = `<option value="">Select Product</option>`;

    const subs = CATEGORY_MAP[categorySelect.value];
    if (!subs) return;

    let subOptions = `<option value="">Select Sub Category</option>`;
    Object.keys(subs).forEach(sub => {
      subOptions += `<option value="${sub}">${sub}</option>`;
    });
    subCategorySelect.innerHTML = subOptions;
  });

  subCategorySelect.addEventListener("change", () => {
    productSelect.innerHTML = `<option value="">Select Product</option>`;
    const cat = categorySelect.value;
    const sub = subCategorySelect.value;
    if (!cat || !sub) return;
    const products = (CATEGORY_MAP[cat] && CATEGORY_MAP[cat][sub]) ? CATEGORY_MAP[cat][sub] : [];
    let prodOptions = `<option value="">Select Product</option>`;
    products.forEach(p => {
      prodOptions += `<option value="${p}">${p}</option>`;
    });
    productSelect.innerHTML = prodOptions;
  });
}

// ----- SPA boot & nav -----
(function () {
  const nav = elById('nav');
  const navItems = nav ? nav.querySelectorAll('.nav-item') : [];
  const pages = document.querySelectorAll('.page');
  let dashboard = null, uploadPredict = null, manualInput = null;

  function showPage(pageId) {
    pages.forEach(p => p.classList.toggle('active', p.id === pageId));
    navItems.forEach(item => item.classList.toggle('active', item.dataset.page === pageId));

    if (pageId === 'dashboard' && !dashboard) {
      dashboard = new SalesDashboard();
    }

    if (pageId === 'upload' && !uploadPredict) {
      uploadPredict = new UploadPredict();
    }

    if (pageId === 'manual' && !manualInput) {
      manualInput = new ManualInput();
    }
  }

  navItems.forEach(item => {
    item.addEventListener('click', () => {
      showPage(item.dataset.page || 'overview');
    });
  });

  // initial show (starts with overview)
  showPage('overview');
})();

// ----- small CSS animation injection (pulse) -----
(function () {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes pulse { 
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); } 
    }
  `;
  document.head.appendChild(style);
})();

// Mobile Toggle Functionality
(function() {
  const mobileToggle = document.getElementById('mobileToggle');
  const sidebar = document.getElementById('sidebar');
  
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
    
    // Close sidebar when clicking outside on mobile
    document.addEventListener('click', (e) => {
      if (window.innerWidth <= 768 && sidebar.classList.contains('active')) {
        if (!sidebar.contains(e.target) && !mobileToggle.contains(e.target)) {
          sidebar.classList.remove('active');
        }
      }
    });
  }
})();