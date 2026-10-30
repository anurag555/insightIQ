const fs = require('fs');
const csv = require('csv-parser');
const XLSX = require('xlsx');

class IngestionService {
  /**
   * Parse uploaded CSV file and extract preview, rows, and headers.
   */
  async parseCsv(filePath, maxPreviewRows = 50) {
    return new Promise((resolve, reject) => {
      const results = [];
      let rowCount = 0;
      let headers = [];

      if (!fs.existsSync(filePath)) {
        return reject(new Error(`File not found: ${filePath}`));
      }

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (h) => {
          headers = h.map(col => col.trim());
        })
        .on('data', (data) => {
          rowCount++;
          if (results.length < maxPreviewRows) {
            results.push(data);
          }
        })
        .on('end', () => {
          if (headers.length === 0 && rowCount === 0) {
            return reject(new Error('The uploaded CSV file is empty or corrupted.'));
          }
          resolve({
            headers,
            rowCount,
            columnCount: headers.length,
            sampleRows: results
          });
        })
        .on('error', (err) => {
          reject(new Error(`CSV parsing failed: ${err.message}`));
        });
    });
  }

  /**
   * Parse all rows from a CSV for storage.
   */
  async parseAllCsvRows(filePath) {
    return new Promise((resolve, reject) => {
      const rows = [];
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => rows.push(data))
        .on('end', () => resolve(rows))
        .on('error', (err) => reject(err));
    });
  }

  /**
   * Parse XLSX/XLS workbook.
   */
  async parseExcel(filePath, sheetName = null, maxPreviewRows = 50) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      const workbook = XLSX.readFile(filePath, { cellDates: true });
      const availableSheets = workbook.SheetNames;
      if (!availableSheets || availableSheets.length === 0) {
        throw new Error('No worksheets found in the Excel file.');
      }

      const targetSheet = sheetName || availableSheets[0];
      const worksheet = workbook.Sheets[targetSheet];
      if (!worksheet) {
        throw new Error(`Sheet '${targetSheet}' not found.`);
      }

      const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: null });
      if (rawJson.length === 0) {
        throw new Error('The selected Excel worksheet contains no data.');
      }

      const headers = Object.keys(rawJson[0]).map(h => h.trim());
      const sampleRows = rawJson.slice(0, maxPreviewRows);

      return {
        headers,
        rowCount: rawJson.length,
        columnCount: headers.length,
        availableSheets,
        currentSheet: targetSheet,
        sampleRows,
        allRows: rawJson
      };
    } catch (err) {
      throw new Error(`Excel parsing failed: ${err.message}`);
    }
  }

  /**
   * Unified file inspection.
   */
  async inspectFile(filePath, fileType) {
    if (fileType === 'csv') {
      return this.parseCsv(filePath);
    } else if (fileType === 'xlsx' || fileType === 'xls') {
      return this.parseExcel(filePath);
    } else {
      throw new Error(`Unsupported dataset file type: ${fileType}`);
    }
  }
}

module.exports = new IngestionService();
