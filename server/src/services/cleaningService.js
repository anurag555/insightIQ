class CleaningService {
  /**
   * Generates a data quality report by analyzing rows against column metadata.
   */
  generateQualityReport(columns, rows) {
    if (!rows || rows.length === 0) {
      return {
        missingValueCount: 0,
        duplicateRowCount: 0,
        invalidDatesCount: 0,
        outliers: [],
        overallScore: 100,
        proposedCleanings: []
      };
    }

    let missingValueCount = 0;
    let invalidDatesCount = 0;
    const outliers = [];
    const proposedCleanings = [];

    // 1. Check duplicate rows
    const seenRowSignatures = new Set();
    let duplicateRowCount = 0;

    rows.forEach(r => {
      const sig = JSON.stringify(r);
      if (seenRowSignatures.has(sig)) {
        duplicateRowCount++;
      } else {
        seenRowSignatures.add(sig);
      }
    });

    if (duplicateRowCount > 0) {
      proposedCleanings.push({
        id: 'clean_dedup',
        type: 'drop_duplicates',
        column: null,
        strategy: 'drop',
        description: `Remove ${duplicateRowCount} duplicate row(s) while retaining first occurrence.`,
        affectedCount: duplicateRowCount,
        status: 'pending'
      });
    }

    // 2. Column-by-column inspection
    columns.forEach(col => {
      const colValues = rows.map(r => r[col.originalName]);
      const nulls = colValues.filter(v => v === null || v === undefined || String(v).trim() === '');
      missingValueCount += nulls.length;

      // Missing value cleaning proposals
      if (nulls.length > 0) {
        if (col.dataType === 'numeric') {
          proposedCleanings.push({
            id: `clean_impute_num_${col.cleanName}`,
            type: 'fill_missing_numeric',
            column: col.cleanName,
            strategy: 'median',
            description: `Impute ${nulls.length} missing values in '${col.originalName}' with column median.`,
            affectedCount: nulls.length,
            status: 'pending'
          });
        } else {
          proposedCleanings.push({
            id: `clean_impute_str_${col.cleanName}`,
            type: 'fill_missing_string',
            column: col.cleanName,
            strategy: 'Unknown',
            description: `Fill ${nulls.length} empty values in '${col.originalName}' with label 'Unknown'.`,
            affectedCount: nulls.length,
            status: 'pending'
          });
        }
      }

      // Check invalid dates
      if (col.dataType === 'date') {
        let invalidDateForCol = 0;
        colValues.forEach(v => {
          if (v !== null && v !== undefined && String(v).trim() !== '') {
            const parsed = Date.parse(v);
            if (isNaN(parsed)) invalidDateForCol++;
          }
        });
        if (invalidDateForCol > 0) {
          invalidDatesCount += invalidDateForCol;
          proposedCleanings.push({
            id: `clean_date_${col.cleanName}`,
            type: 'standardize_dates',
            column: col.cleanName,
            strategy: 'iso_format',
            description: `Standardize or nullify ${invalidDateForCol} malformed date string(s) in '${col.originalName}'.`,
            affectedCount: invalidDateForCol,
            status: 'pending'
          });
        }
      }

      // Check numeric outliers (IQR method)
      if (col.dataType === 'numeric') {
        const numValues = colValues
          .map(v => parseFloat(String(v).replace(/[$,%]/g, '')))
          .filter(n => !isNaN(n))
          .sort((a, b) => a - b);

        if (numValues.length >= 10) {
          const q1 = numValues[Math.floor(numValues.length * 0.25)];
          const q3 = numValues[Math.floor(numValues.length * 0.75)];
          const iqr = q3 - q1;
          const lowerBound = q1 - 1.5 * iqr;
          const upperBound = q3 + 1.5 * iqr;

          const outlierSamples = numValues.filter(n => n < lowerBound || n > upperBound);
          if (outlierSamples.length > 0) {
            outliers.push({
              column: col.cleanName,
              count: outlierSamples.length,
              threshold: `IQR [${lowerBound.toFixed(2)}, ${upperBound.toFixed(2)}]`,
              samples: outlierSamples.slice(0, 5)
            });

            proposedCleanings.push({
              id: `clean_outlier_${col.cleanName}`,
              type: 'remove_outliers',
              column: col.cleanName,
              strategy: 'cap',
              description: `Cap ${outlierSamples.length} extreme statistical outlier(s) in '${col.originalName}' to 99th percentile boundaries.`,
              affectedCount: outlierSamples.length,
              status: 'pending'
            });
          }
        }
      }
    });

    // Compute overall quality score (0 to 100)
    const totalCells = rows.length * columns.length;
    const penaltyMissing = totalCells > 0 ? (missingValueCount / totalCells) * 40 : 0;
    const penaltyDuplicates = rows.length > 0 ? (duplicateRowCount / rows.length) * 30 : 0;
    const penaltyDates = rows.length > 0 ? (invalidDatesCount / rows.length) * 15 : 0;
    const penaltyOutliers = outliers.length * 3;

    let score = Math.round(100 - (penaltyMissing + penaltyDuplicates + penaltyDates + penaltyOutliers));
    score = Math.max(10, Math.min(100, score));

    return {
      missingValueCount,
      duplicateRowCount,
      invalidDatesCount,
      outliers,
      overallScore: score,
      proposedCleanings
    };
  }

  /**
   * Applies selected cleaning operations to row data deterministically in-memory before saving or updating.
   */
  applyCleanings(rows, columns, approvedOperations) {
    let cleaned = [...rows];
    const logResults = [];

    for (const op of approvedOperations) {
      if (op.type === 'drop_duplicates') {
        const seen = new Set();
        const initial = cleaned.length;
        cleaned = cleaned.filter(r => {
          const sig = JSON.stringify(r);
          if (seen.has(sig)) return false;
          seen.add(sig);
          return true;
        });
        logResults.push({
          operation: 'drop_duplicates',
          rowsAffected: initial - cleaned.length,
          description: `Removed ${initial - cleaned.length} duplicate rows`
        });
      } else if (op.type === 'fill_missing_numeric') {
        const col = columns.find(c => c.cleanName === op.column || c.originalName === op.column);
        if (col) {
          const colName = col.originalName;
          const nums = cleaned.map(r => parseFloat(r[colName])).filter(n => !isNaN(n)).sort((a, b) => a - b);
          const median = nums.length > 0 ? nums[Math.floor(nums.length / 2)] : 0;
          let filledCount = 0;

          cleaned = cleaned.map(r => {
            const v = r[colName];
            if (v === null || v === undefined || String(v).trim() === '' || isNaN(v)) {
              filledCount++;
              return { ...r, [colName]: median };
            }
            return r;
          });

          logResults.push({
            operation: `fill_missing_numeric_${op.column}`,
            rowsAffected: filledCount,
            description: `Filled ${filledCount} missing values in '${colName}' with median ${median}`
          });
        }
      } else if (op.type === 'fill_missing_string') {
        const col = columns.find(c => c.cleanName === op.column || c.originalName === op.column);
        if (col) {
          const colName = col.originalName;
          let filledCount = 0;
          cleaned = cleaned.map(r => {
            const v = r[colName];
            if (v === null || v === undefined || String(v).trim() === '') {
              filledCount++;
              return { ...r, [colName]: 'Unknown' };
            }
            return r;
          });

          logResults.push({
            operation: `fill_missing_string_${op.column}`,
            rowsAffected: filledCount,
            description: `Replaced ${filledCount} empty entries in '${colName}' with 'Unknown'`
          });
        }
      }
    }

    return {
      cleanedRows: cleaned,
      auditLogs: logResults
    };
  }
}

module.exports = new CleaningService();
