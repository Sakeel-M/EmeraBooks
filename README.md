# FinanceTracker - MicroSaaS Financial Analytics

A comprehensive financial analytics application that helps you categorize spending, analyze patterns, and get AI-powered insights from your financial data.

## Features

✨ **Smart Financial Analysis**
- Upload Excel (.xlsx, .xls) or PDF bank statements
- AI-powered spending categorization using OpenAI
- Intelligent PDF extraction with multiple parsing methods
- Detailed analytics and spending insights
- Month-on-month revenue/expense analysis

📊 **Interactive Dashboard**
- Beautiful, responsive UI built with React and Tailwind CSS
- Interactive charts and infographics
- Real-time data visualization with Chart.js
- Mobile-responsive design

🤖 **AI-Powered Insights**
- Personalized spending recommendations
- Spending alerts and anomaly detection
- Financial advice and optimization tips
- Automatic categorization of expenses

## Tech Stack

### Frontend
- **React** with Vite for fast development
- **Tailwind CSS** for responsive styling
- **Chart.js & React-ChartJS-2** for data visualization
- **Lucide React** for icons
- **Axios** for API communication

### Backend
- **Python Flask** for API server
- **Pandas** for data processing
- **OpenPyXL** for Excel file handling
- **pdfplumber/PyPDF2/PyMuPDF** for PDF extraction
- **OpenAI API** for intelligent analysis and PDF parsing
- **Flask-CORS** for cross-origin requests

## Setup Instructions

### Prerequisites
- Node.js (v16 or higher)
- Python 3.8+
- OpenAI API key (optional - app works in demo mode without it)

### Quick Start (Windows)

1. **Double-click `start.bat`** - This will automatically:
   - Start the backend server
   - Start the frontend development server
   - Open your browser to the application

### Manual Setup

### 1. Install Dependencies

```bash
# Install frontend dependencies
cd frontend
npm install

# Install backend dependencies
cd ../backend
pip install -r requirements.txt
```

### 2. Environment Setup (Optional)

Create a `.env` file in the `backend` directory for OpenAI integration:

```env
OPENAI_API_KEY=your_openai_api_key_here
```

**Note: The application works in demo mode without OpenAI API key**

### 3. Run the Application

**Option A: Using the provided batch file (Windows)**
```bash
./start.bat
```

**Option B: Manual start**
```bash
# Terminal 1 - Backend
cd backend
python app_simple.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

### 4. Access the Application

- **Backend API**: http://localhost:5000
- **Frontend**: http://localhost:5176 (or next available port)
- **Health Check**: http://localhost:5000/api/health

## Usage

1. **Upload Data**: Upload your bank statement as Excel (.xlsx, .xls) or PDF (.pdf)
2. **AI Processing**: The system intelligently extracts and analyzes your data using OpenAI
3. **View Insights**: Explore interactive charts, spending categories, and AI recommendations
4. **Get Recommendations**: Receive personalized advice on spending optimization

### Supported File Formats
- **Excel Files** (.xlsx, .xls) - Direct data import with automatic column detection
- **PDF Files** (.pdf) - AI-powered text extraction from bank statements

## Data Format

Your Excel file should contain columns like:
- Date/Transaction Date
- Amount/Expense/Income
- Category (optional - AI will categorize if missing)
- Description (optional)

Example:
```
Date       | Amount  | Category    | Description
2024-01-15 | -50.00  | Food        | Groceries
2024-01-16 | -25.99  | Transport   | Gas
2024-01-17 | 2500.00 | Income      | Salary
```

## Features Overview

### 📈 Analytics Dashboard
- **Overview Tab**: Summary cards, spending breakdown charts
- **Trends Tab**: Month-over-month analysis, spending patterns
- **Insights Tab**: AI recommendations, alerts, and financial tips

### 🎯 Key Metrics
- Total spending analysis
- Average transaction amounts
- Largest and smallest expenses
- Category-wise breakdown
- Monthly trends and patterns

### 🔮 AI Insights
- Spending pattern analysis
- Budget recommendations
- Expense optimization suggestions
- Unusual transaction alerts
- Financial health scoring

## API Endpoints

- `GET /api/health` - Health check and capabilities (Excel/PDF support status)
- `POST /api/upload` - Upload and process Excel or PDF file
- `POST /api/analyze` - Analyze financial data with AI

## Development

### Project Structure
```
finance-analytics/
├── frontend/           # React frontend application
│   ├── src/
│   │   ├── components/    # React components
│   │   ├── App.jsx       # Main application component
│   │   └── index.css     # Tailwind CSS styles
├── backend/            # Flask backend API
│   ├── app.py           # Main Flask application
│   ├── excel_processor.py # Excel file processor
│   ├── pdf_processor.py   # PDF file processor with AI
│   └── requirements.txt   # Python dependencies
└── package.json        # Root package configuration
```

### Build for Production

```bash
npm run build
```

## Security & Privacy

- Data processing happens locally - no data is stored permanently
- Files are processed in memory and discarded after analysis
- OpenAI API is used only for analysis, not data storage
- All communication is secured and encrypted

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions, please create an issue in the GitHub repository.