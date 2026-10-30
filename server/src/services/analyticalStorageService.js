const { query, pool } = require('../config/pg');

class AnalyticalStorageService {
  /**
   * Generates a safe physical table name for a dataset within a workspace.
   */
  getTableName(workspaceId, datasetId) {
    const cleanWs = String(workspaceId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    const cleanDs = String(datasetId).replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
    return `ws_${cleanWs}_ds_${cleanDs}`;
  }

  /**
   * Maps generic data type to Postgres SQL type.
   */
  mapToPostgresType(dataType) {
    switch (dataType) {
      case 'numeric':
        return 'NUMERIC(16, 4)';
      case 'date':
        return 'TIMESTAMPTZ';
      case 'boolean':
        return 'BOOLEAN';
      case 'categorical':
      case 'string':
      default:
        return 'TEXT';
    }
  }

  /**
   * Creates the physical analytical table in PostgreSQL.
   */
  async createDatasetTable(workspaceId, datasetId, columns) {
    const tableName = this.getTableName(workspaceId, datasetId);

    // Drop table if exists to allow fresh re-ingestion
    await query(`DROP TABLE IF EXISTS "${tableName}" CASCADE;`);

    const colDefs = columns.map(col => {
      const pgType = this.mapToPostgresType(col.dataType);
      return `"${col.cleanName}" ${pgType}`;
    });

    const createSql = `
      CREATE TABLE "${tableName}" (
        "_id" BIGSERIAL PRIMARY KEY,
        ${colDefs.join(',\n')}
      );
    `;

    await query(createSql);

    // Create indexes on key semantic columns
    for (const col of columns) {
      if (['date', 'customer_id', 'product', 'category', 'transaction_id'].includes(col.semanticRole)) {
        try {
          const idxTarget = (col.dataType === 'string' || col.dataType === 'categorical')
            ? `(LEFT("${col.cleanName}", 100))`
            : `("${col.cleanName}")`;
          await query(`CREATE INDEX IF NOT EXISTS "idx_${tableName}_${col.cleanName}" ON "${tableName}" ${idxTarget};`);
        } catch (idxErr) {
          console.warn(`[PG Storage] Could not index ${col.cleanName}:`, idxErr.message);
        }
      }
    }

    return tableName;
  }

  /**
   * Clean and cast row values before SQL insertion.
   */
  castValue(value, dataType) {
    if (value === null || value === undefined || value === '') return null;
    if (dataType === 'numeric') {
      const clean = String(value).replace(/[$,% ]/g, '');
      const parsed = parseFloat(clean);
      return isNaN(parsed) ? null : parsed;
    } else if (dataType === 'date') {
      const d = new Date(value);
      if (isNaN(d.getTime())) return null;
      const yr = d.getFullYear();
      if (yr < 1970 || yr > 2099) return null;
      return d.toISOString();
    } else if (dataType === 'boolean') {
      const str = String(value).toLowerCase().trim();
      return str === 'true' || str === '1' || str === 'yes' || str === 't';
    } else {
      return String(value);
    }
  }

  /**
   * Inserts rows into the PostgreSQL table in batches using parameterized statements.
   */
  async insertRowsBatch(tableName, columns, rows, batchSize = 250) {
    if (!rows || rows.length === 0) return 0;

    const colNames = columns.map(c => `"${c.cleanName}"`).join(', ');

    let insertedCount = 0;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const valueParams = [];
      const rowPlaceholders = [];

      batch.forEach((row, rowIdx) => {
        const itemPlaceholders = [];
        columns.forEach((col, colIdx) => {
          const rawVal = row[col.originalName] !== undefined ? row[col.originalName] : row[col.cleanName];
          const val = this.castValue(rawVal, col.dataType);
          valueParams.push(val);
          itemPlaceholders.push(`$${valueParams.length}`);
        });
        rowPlaceholders.push(`(${itemPlaceholders.join(', ')})`);
      });

      const sql = `
        INSERT INTO "${tableName}" (${colNames})
        VALUES ${rowPlaceholders.join(',\n')};
      `;

      await query(sql, valueParams);
      insertedCount += batch.length;
    }

    return insertedCount;
  }

  /**
   * Executes a safe query with pagination against an analytical table.
   */
  async getTableRows(tableName, limit = 50, offset = 0, sortColumn = '_id', sortOrder = 'ASC') {
    const safeOrder = sortOrder.toUpperCase() === 'DESC' ? 'DESC' : 'ASC';
    const cleanSort = String(sortColumn).replace(/[^a-zA-Z0-9_]/g, '');

    const countRes = await query(`SELECT COUNT(*) as total FROM "${tableName}"`);
    const total = parseInt(countRes.rows[0].total, 10);

    const rowsRes = await query(
      `SELECT * FROM "${tableName}" ORDER BY "${cleanSort}" ${safeOrder} LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    return {
      total,
      limit,
      offset,
      rows: rowsRes.rows
    };
  }

  /**
   * Safely drops an analytical table.
   */
  async dropTable(tableName) {
    const cleanName = String(tableName).replace(/[^a-zA-Z0-9_]/g, '');
    await query(`DROP TABLE IF EXISTS "${cleanName}" CASCADE;`);
  }

  /**
   * Safely executes an authorized join between two datasets in the same workspace.
   */
  async executeJoin(wsId, ds1, ds2, col1, col2, joinType = 'INNER', limit = 100) {
    const table1 = this.getTableName(wsId, ds1._id);
    const table2 = this.getTableName(wsId, ds2._id);

    const safeJoin = ['INNER', 'LEFT', 'RIGHT', 'FULL'].includes(joinType.toUpperCase()) ? joinType.toUpperCase() : 'INNER';
    const cleanCol1 = String(col1).replace(/[^a-zA-Z0-9_]/g, '');
    const cleanCol2 = String(col2).replace(/[^a-zA-Z0-9_]/g, '');

    const sql = `
      SELECT t1.*, t2.*
      FROM "${table1}" t1
      ${safeJoin} JOIN "${table2}" t2
      ON t1."${cleanCol1}" = t2."${cleanCol2}"
      LIMIT $1;
    `;

    const res = await query(sql, [limit]);
    return res.rows;
  }
}

module.exports = new AnalyticalStorageService();
