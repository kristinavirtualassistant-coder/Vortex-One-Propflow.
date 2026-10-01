import { getAccessToken } from './dataClient';

export class GoogleWorkspaceService {
  private static async request(endpoint: string, options: RequestInit = {}) {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated with Google Workspace');
    
    const headers = {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };

    const response = await fetch(`https://www.googleapis.com${endpoint}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(`Google API Error: ${response.status} ${error.error?.message || response.statusText}`);
    }

    return response.json();
  }

  // Drive API: Search for files
  static async searchDriveFiles(query: string) {
    // q=name contains 'query'
    const q = encodeURIComponent(`name contains '${query}' and trashed = false`);
    return this.request(`/drive/v3/files?q=${q}&fields=files(id,name,mimeType,webViewLink,iconLink)`);
  }

  // Calendar API: Get upcoming events
  static async getUpcomingEvents() {
    const token = await getAccessToken();
    if (!token) return { items: [] };
    const timeMin = new Date().toISOString();
    return this.request(`/calendar/v3/calendars/primary/events?timeMin=${timeMin}&maxResults=10&orderBy=startTime&singleEvents=true`);
  }

  // Sheets API: Create a new spreadsheet and populate with data
  static async exportToSheets(title: string, headers: string[], rows: any[][]) {
    // Create new sheet
    const sheet = await this.request('/sheets/v4/spreadsheets', {
      method: 'POST',
      body: JSON.stringify({
        properties: { title }
      })
    });

    const spreadsheetId = sheet.spreadsheetId;
    const values = [headers, ...rows];

    // Update values
    await this.request(`/sheets/v4/spreadsheets/${spreadsheetId}/values/Sheet1!A1:append?valueInputOption=USER_ENTERED`, {
      method: 'POST',
      body: JSON.stringify({
        values
      })
    });

    return sheet.spreadsheetUrl;
  }

  // Forms API: Get form responses (assuming a known formId)
  static async getFormResponses(formId: string) {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated with Google Workspace');
    
    const response = await fetch(`https://forms.googleapis.com/v1/forms/${formId}/responses`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    if (!response.ok) throw new Error('Failed to fetch form responses');
    return response.json();
  }

  // Forms API: Create a new form
  static async createMaintenanceForm() {
    const token = await getAccessToken();
    if (!token) throw new Error('Not authenticated with Google Workspace');
    
    // Create form
    const createRes = await fetch(`https://forms.googleapis.com/v1/forms`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        info: {
          title: "Maintenance Request Form",
          documentTitle: "PropertyFlow Maintenance Request"
        }
      })
    });
    if (!createRes.ok) throw new Error('Failed to create form');
    const form = await createRes.json();
    
    // Add items (questions)
    const updateRes = await fetch(`https://forms.googleapis.com/v1/forms/${form.formId}:batchUpdate`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        requests: [
          {
            createItem: {
              item: { title: "Property Name / Unit", questionItem: { question: { required: true, textQuestion: { paragraph: false } } } },
              location: { index: 0 }
            }
          },
          {
            createItem: {
              item: { title: "Issue Description", questionItem: { question: { required: true, textQuestion: { paragraph: true } } } },
              location: { index: 1 }
            }
          }
        ]
      })
    });
    if (!updateRes.ok) throw new Error('Failed to update form');
    
    return form;
  }
}
