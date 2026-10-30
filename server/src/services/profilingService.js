class ProfilingService {
  /**
   * Cleans a column name for SQL/Postgres compatibility.
   */
  sanitizeColumnName(name) {
    let clean = name.toLowerCase()
      .replace(/[^a-z0-9_]/g, '_')
      .replace(/^_+|_+$/g, '')
      .replace(/_{2,}/g, '_');
    if (!clean || /^[0-9]/.test(clean)) {
      clean = `col_${clean}`;
    }
    return clean;
  }

  /**
   * Infers primitive data type: 'numeric', 'date', 'boolean', 'categorical', or 'string'.
   */
  inferPrimitiveType(values) {
    if (!values || values.length === 0) return 'string';

    const nonNullValues = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
    if (nonNullValues.length === 0) return 'string';

    let numericCount = 0;
    let dateCount = 0;
    let booleanCount = 0;

    const boolRegex = /^(true|false|t|f|yes|no|1|0)$/i;

    const datePattern = /^(\d{4}[-/]\d{1,2}[-/]\d{1,2}|\d{1,2}[-/]\d{1,2}[-/]\d{2,4})(?:[T ]\d{2}:\d{2}(?::\d{2})?)?/;

    for (const val of nonNullValues) {
      const strVal = String(val).trim();

      // Check numeric (e.g. 123, -45.67, $1,234.50, 45%)
      const cleanNum = strVal.replace(/[$,%]/g, '');
      if (!isNaN(cleanNum) && !isNaN(parseFloat(cleanNum)) && isFinite(cleanNum)) {
        numericCount++;
      }

      // Check boolean
      if (typeof val === 'boolean' || boolRegex.test(strVal)) {
        booleanCount++;
      }

      // Check date - must match explicit calendar date pattern
      if (typeof val === 'object' && val instanceof Date && !isNaN(val.getTime())) {
        dateCount++;
      } else if (typeof strVal === 'string' && datePattern.test(strVal)) {
        const parsed = Date.parse(strVal);
        if (!isNaN(parsed)) {
          const year = new Date(parsed).getFullYear();
          if (year >= 1970 && year <= 2099) {
            dateCount++;
          }
        }
      }
    }

    const total = nonNullValues.length;
    if (numericCount / total >= 0.85) return 'numeric';
    if (dateCount / total >= 0.85) return 'date';
    if (booleanCount / total >= 0.90) return 'boolean';

    // Check categorical: low cardinality string
    const uniqueValues = new Set(nonNullValues.map(v => String(v).toLowerCase()));
    if (uniqueValues.size <= 25 && uniqueValues.size / total <= 0.35 && total >= 10) {
      return 'categorical';
    }

    return 'string';
  }

  /**
   * Infer semantic role from column name, sample values, and primitive type.
   */
  inferSemanticRole(colName, dataType, sampleValues) {
    const lower = colName.toLowerCase().replace(/[^a-z0-9]/g, '_');
    const suggestedRoles = [];
    let bestRole = 'none';
    let confidence = 0.5;

    // Rules for Identifiers (Check first to avoid false date/category matches)
    if (lower.includes('customer') || lower.includes('client') || lower.includes('buyer') || lower.includes('account_id') || lower === 'cust_id') {
      suggestedRoles.push('customer_id');
      bestRole = 'customer_id';
      confidence = 0.95;
    } else if (lower.endsWith('_id') || lower === 'id' || lower.includes('txn') || lower.includes('transaction_id') || lower.includes('order_id') || lower.includes('invoice')) {
      suggestedRoles.push('transaction_id');
      bestRole = 'transaction_id';
      confidence = 0.95;
    }

    // Rules for Date
    if (dataType === 'date' || lower.includes('date') || lower.includes('timestamp') || lower.endsWith('_at')) {
      if (lower.includes('order_date') || lower.includes('transaction_date') || lower.includes('sale_date') || lower === 'date') {
        suggestedRoles.push('date');
        bestRole = 'date';
        confidence = 0.98;
      } else if (bestRole === 'none') {
        suggestedRoles.push('date');
        bestRole = 'date';
        confidence = 0.88;
      }
    }

    // Rules for Revenue / Monetary
    if (dataType === 'numeric') {
      if (lower.includes('revenue') || lower.includes('sales') || lower.includes('amount') || lower.includes('total') || lower.includes('gross') || lower.includes('mrr')) {
        suggestedRoles.push('revenue');
        if (bestRole === 'none' || confidence < 0.9) {
          bestRole = 'revenue';
          confidence = 0.94;
        }
      } else if (lower.includes('profit') || lower.includes('margin') || lower.includes('net')) {
        suggestedRoles.push('profit');
        if (bestRole === 'none') {
          bestRole = 'profit';
          confidence = 0.92;
        }
      } else if (lower.includes('cost') || lower.includes('expense')) {
        suggestedRoles.push('cost');
        if (bestRole === 'none') {
          bestRole = 'cost';
          confidence = 0.90;
        }
      } else if (lower.includes('price') || lower.includes('rate') || lower.includes('fee')) {
        suggestedRoles.push('price');
        if (bestRole === 'none') {
          bestRole = 'price';
          confidence = 0.90;
        }
      } else if (lower.includes('discount') || lower.includes('rebate') || lower.includes('markdown')) {
        suggestedRoles.push('discount');
        if (bestRole === 'none') {
          bestRole = 'discount';
          confidence = 0.91;
        }
      } else if (lower.includes('qty') || lower.includes('quantity') || lower.includes('units') || lower.includes('volume') || lower.includes('count')) {
        suggestedRoles.push('quantity');
        if (bestRole === 'none') {
          bestRole = 'quantity';
          confidence = 0.93;
        }
      } else {
        // Generic measure
        suggestedRoles.push('measure');
        if (bestRole === 'none') {
          bestRole = 'measure';
          confidence = 0.65;
        }
      }
    }

    // Rules for Category & Product & Geography
    if (dataType === 'string' || dataType === 'categorical') {
      if (lower.includes('product') || lower.includes('item') || lower.includes('sku') || lower.includes('title')) {
        suggestedRoles.push('product');
        if (bestRole === 'none') {
          bestRole = 'product';
          confidence = 0.88;
        }
      } else if (lower.includes('category') || lower.includes('department') || lower.includes('segment') || lower.includes('genre') || lower.includes('type')) {
        suggestedRoles.push('category');
        if (bestRole === 'none') {
          bestRole = 'category';
          confidence = 0.90;
        }
      } else if (lower.includes('region') || lower.includes('country') || lower.includes('state') || lower.includes('city') || lower.includes('territory')) {
        suggestedRoles.push('region');
        if (bestRole === 'none') {
          bestRole = 'region';
          confidence = 0.88;
        }
      } else if (lower.includes('status') || lower.includes('state') || lower.includes('condition')) {
        suggestedRoles.push('status');
        if (bestRole === 'none') {
          bestRole = 'status';
          confidence = 0.86;
        }
      } else {
        suggestedRoles.push('dimension');
        if (bestRole === 'none') {
          bestRole = 'dimension';
          confidence = 0.60;
        }
      }
    }

    const isAmbiguous = suggestedRoles.length > 1 && confidence < 0.85;

    return {
      role: bestRole,
      confidence,
      isAmbiguous,
      suggestedRoles: Array.from(new Set(suggestedRoles))
    };
  }

  /**
   * Profiles a collection of rows and computes descriptive stats per column.
   */
  profileDataset(headers, rows) {
    const columns = [];

    for (const header of headers) {
      const originalName = header;
      const cleanName = this.sanitizeColumnName(header);
      const values = rows.map(r => r[header]);
      const dataType = this.inferPrimitiveType(values);
      const sampleValues = values.filter(v => v !== null && v !== undefined && v !== '').slice(0, 5);

      const nonNulls = values.filter(v => v !== null && v !== undefined && String(v).trim() !== '');
      const nullCount = values.length - nonNulls.length;
      const uniqueCount = new Set(nonNulls.map(v => String(v))).size;

      let min = null;
      let max = null;
      let avg = null;

      if (dataType === 'numeric' && nonNulls.length > 0) {
        const numbers = nonNulls.map(v => parseFloat(String(v).replace(/[$,%]/g, ''))).filter(n => !isNaN(n));
        if (numbers.length > 0) {
          min = Math.min(...numbers);
          max = Math.max(...numbers);
          const sum = numbers.reduce((a, b) => a + b, 0);
          avg = parseFloat((sum / numbers.length).toFixed(2));
        }
      } else if (dataType === 'date' && nonNulls.length > 0) {
        const timestamps = nonNulls.map(v => new Date(v).getTime()).filter(t => !isNaN(t));
        if (timestamps.length > 0) {
          min = new Date(Math.min(...timestamps)).toISOString().split('T')[0];
          max = new Date(Math.max(...timestamps)).toISOString().split('T')[0];
        }
      }

      const { role, confidence, isAmbiguous, suggestedRoles } = this.inferSemanticRole(originalName, dataType, sampleValues);

      columns.push({
        originalName,
        cleanName,
        dataType,
        semanticRole: role,
        confidence,
        isAmbiguous,
        suggestedRoles,
        sampleValues,
        stats: {
          min,
          max,
          avg,
          nullCount,
          uniqueCount
        }
      });
    }

    return columns;
  }
}

module.exports = new ProfilingService();
