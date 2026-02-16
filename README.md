# EmeraBooks - Financial Management Application

A comprehensive financial management and bookkeeping application with advanced analytics, AI-powered insights, and complete accounting features.

**Live Site:** [emerabooks.com](https://emerabooks.com)

[![Deploy to Hostinger](https://github.com/Sakeel-M/EmeraBooks/actions/workflows/deploy.yml/badge.svg)](https://github.com/Sakeel-M/EmeraBooks/actions/workflows/deploy.yml)

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
- **React 18** with TypeScript for type-safe development
- **Vite** for fast build and development
- **Tailwind CSS** + **shadcn/ui** for beautiful, responsive UI
- **Supabase** for database and authentication
- **Recharts** for data visualization
- **React Query** for server state management
- **React Router** for navigation
- **Lucide React** for icons

### Backend
- **Python Flask** for API server
- **OpenPyXL** for Excel file handling
- **pdfplumber/PyPDF2/PyMuPDF** for PDF extraction
- **OpenAI API** for AI-powered insights and analysis
- **Flask-CORS** for cross-origin requests

### Infrastructure
- **Supabase** - PostgreSQL database, authentication, and real-time subscriptions
- **Hostinger VPS** - Ubuntu 24.04 LTS with Nginx
- **GitHub Actions** - CI/CD for automatic deployments
- **Gunicorn** - Production WSGI server

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

## 🚀 Deployment

### Automatic Deployment (Production)

This project uses GitHub Actions for automatic deployment to Hostinger VPS.

**Every push to `main` branch automatically deploys to production!**

#### Setup Auto-Deployment:

1. **Quick Setup** (10 minutes):
   ```powershell
   # Run the PowerShell setup script
   .\setup-github-deploy.ps1
   ```

2. **What it does:**
   - Generates SSH keys
   - Configures VPS access
   - Sets up GitHub Secrets
   - Enables automatic deployment

3. **Result:**
   - Push to main → Auto-deploys in 2-3 minutes ✨
   - Full deployment history in GitHub Actions
   - No manual SSH needed!

#### Deployment Guides:
- **Quick Reference:** [QUICK_DEPLOY_GUIDE.md](QUICK_DEPLOY_GUIDE.md)
- **Complete Setup:** [SETUP_AUTO_DEPLOY.md](SETUP_AUTO_DEPLOY.md)
- **Full Documentation:** [HOSTINGER_DEPLOYMENT.md](HOSTINGER_DEPLOYMENT.md)

#### Manual Deployment:

If you need to deploy manually:

```bash
# SSH into VPS
ssh root@72.60.222.167

# Navigate and deploy
cd /var/www/emerabooks
git pull origin main
sudo ./deploy-hostinger.sh
```

#### Deployment Status:

- **GitHub Actions:** [View Deployments](https://github.com/Sakeel-M/EmeraBooks/actions)
- **Live Site:** [emerabooks.com](https://emerabooks.com)

---

## Support

For issues and questions, please create an issue in the GitHub repository.