# Insight Reports Co. (Full-Stack)

Full-stack web app for technicians and service businesses to generate service reports and invoices, download PDFs, share on WhatsApp, and persist records to a backend database.

## What Is Included

- Professional frontend UI with mobile and desktop navigation
- Service report generation flow with AI/fallback text
- Invoice generation with GST and line item calculations
- PDF download for reports and invoices
- WhatsApp share actions
- Backend API (Node + Express)
- SQLite persistence for reports and invoices
- Recent activity panel (latest reports/invoices from backend)

## Project Structure

- `index.html` - UI and layout
- `styles.css` - responsive styling
- `app.js` - frontend logic, API integration, PDF/share features
- `server.js` - Express API + static file hosting
- `data/insight_reports.db` - SQLite database (created automatically)

## Run Locally

Use the Node backend server (recommended for full-stack mode):

```bash
cd /workspaces/Report-generator
npm install
npm start
```

Then open `http://localhost:8080`.

## API Endpoints

- `GET /api/health` - backend status
- `GET /api/reports?limit=5` - recent reports
- `POST /api/reports` - save report
- `GET /api/invoices?limit=5` - recent invoices
- `POST /api/invoices` - save invoice

## Notes

- If backend is offline, frontend still works for session-level operations, but records will not persist to database.
- SQLite data is stored in `data/`.