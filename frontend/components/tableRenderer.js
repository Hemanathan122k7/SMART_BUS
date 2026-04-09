/**
 * Table Renderer Component
 * Reusable functions for rendering and managing tables
 */

/**
 * Render a table with data
 * @param {string} tableId - ID of the table tbody element
 * @param {Array} data - Array of data objects
 * @param {Array} columns - Array of column definitions
 */
function renderTable(tableId, data, columns) {
    const tbody = document.getElementById(tableId);
    
    if (!tbody) {
        console.error(`Table body with ID ${tableId} not found`);
        return;
    }

    // Clear existing rows
    tbody.innerHTML = '';

    // Check if data is empty
    if (!data || data.length === 0) {
        const row = document.createElement('tr');
        row.innerHTML = `<td colspan="${columns.length}" style="text-align: center; padding: 20px; opacity: 0.6;">No data available</td>`;
        tbody.appendChild(row);
        return;
    }

    // Create rows
    data.forEach(item => {
        const row = document.createElement('tr');
        
        columns.forEach(column => {
            const cell = document.createElement('td');
            
            // Handle custom render function
            if (column.render) {
                cell.innerHTML = column.render(item[column.field], item);
            } else {
                cell.textContent = item[column.field] || '-';
            }
            
            row.appendChild(cell);
        });
        
        tbody.appendChild(row);
    });
}

/**
 * Add a row to a table
 * @param {string} tableId - ID of the table tbody
 * @param {Object} rowData - Data for the new row
 * @param {Array} columns - Column definitions
 * @param {boolean} prepend - If true, add to beginning of table
 */
function addTableRow(tableId, rowData, columns, prepend = false) {
    const tbody = document.getElementById(tableId);
    
    if (!tbody) return;

    const row = document.createElement('tr');
    
    columns.forEach(column => {
        const cell = document.createElement('td');
        
        if (column.render) {
            cell.innerHTML = column.render(rowData[column.field], rowData);
        } else {
            cell.textContent = rowData[column.field] || '-';
        }
        
        row.appendChild(cell);
    });

    if (prepend) {
        tbody.insertBefore(row, tbody.firstChild);
    } else {
        tbody.appendChild(row);
    }
}

/**
 * Update a specific row in a table
 * @param {string} tableId - ID of the table tbody
 * @param {number} rowIndex - Index of the row to update
 * @param {Object} newData - New data for the row
 * @param {Array} columns - Column definitions
 */
function updateTableRow(tableId, rowIndex, newData, columns) {
    const tbody = document.getElementById(tableId);
    
    if (!tbody || !tbody.rows[rowIndex]) return;

    const row = tbody.rows[rowIndex];
    row.innerHTML = '';

    columns.forEach(column => {
        const cell = document.createElement('td');
        
        if (column.render) {
            cell.innerHTML = column.render(newData[column.field], newData);
        } else {
            cell.textContent = newData[column.field] || '-';
        }
        
        row.appendChild(cell);
    });
}

/**
 * Delete a row from a table
 * @param {string} tableId - ID of the table tbody
 * @param {number} rowIndex - Index of the row to delete
 */
function deleteTableRow(tableId, rowIndex) {
    const tbody = document.getElementById(tableId);
    
    if (!tbody || !tbody.rows[rowIndex]) return;

    tbody.deleteRow(rowIndex);
}

/**
 * Sort table by column
 * @param {string} tableId - ID of the table tbody
 * @param {number} columnIndex - Index of column to sort by
 * @param {string} direction - 'asc' or 'desc'
 */
function sortTable(tableId, columnIndex, direction = 'asc') {
    const tbody = document.getElementById(tableId);
    
    if (!tbody) return;

    const rows = Array.from(tbody.rows);
    
    rows.sort((a, b) => {
        const aValue = a.cells[columnIndex].textContent;
        const bValue = b.cells[columnIndex].textContent;
        
        if (direction === 'asc') {
            return aValue.localeCompare(bValue, undefined, { numeric: true });
        } else {
            return bValue.localeCompare(aValue, undefined, { numeric: true });
        }
    });

    // Clear and re-append sorted rows
    tbody.innerHTML = '';
    rows.forEach(row => tbody.appendChild(row));
}

/**
 * Filter table rows based on search term
 * @param {string} tableId - ID of the table tbody
 * @param {string} searchTerm - Term to search for
 */
function filterTable(tableId, searchTerm) {
    const tbody = document.getElementById(tableId);
    
    if (!tbody) return;

    const rows = tbody.getElementsByTagName('tr');
    const term = searchTerm.toLowerCase();

    Array.from(rows).forEach(row => {
        const text = row.textContent.toLowerCase();
        row.style.display = text.includes(term) ? '' : 'none';
    });
}

/**
 * Create action buttons for table rows
 * @param {Object} actions - Object with action definitions
 * @param {Object} rowData - Data for the current row
 * @returns {string} - HTML string for action buttons
 */
function createActionButtons(actions, rowData) {
    let html = '<div class="action-buttons">';
    
    if (actions.edit) {
        html += `<button class="btn btn-sm btn-edit" onclick="${actions.edit}('${rowData.id}')">Edit</button>`;
    }
    
    if (actions.delete) {
        html += `<button class="btn btn-sm btn-delete" onclick="${actions.delete}('${rowData.id}')">Delete</button>`;
    }
    
    if (actions.view) {
        html += `<button class="btn btn-sm btn-view" onclick="${actions.view}('${rowData.id}')">View</button>`;
    }

    html += '</div>';
    return html;
}

/**
 * Create status badge HTML
 * @param {string} status - Status text
 * @param {string} type - Badge type (success, warning, danger, info)
 * @returns {string} - HTML string for status badge
 */
function createStatusBadge(status, type = 'info') {
    const typeClass = `badge-${type}`;
    return `<span class="badge ${typeClass}">${status}</span>`;
}

/**
 * Export table data to CSV
 * @param {string} tableId - ID of the table element (not tbody)
 * @param {string} filename - Name for the CSV file
 */
function exportTableToCSV(tableId, filename = 'table_export.csv') {
    const table = document.getElementById(tableId);
    
    if (!table) return;

    let csv = [];
    const rows = table.querySelectorAll('tr');

    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const csvRow = [];
        
        cols.forEach(col => {
            csvRow.push('"' + col.textContent.replace(/"/g, '""') + '"');
        });
        
        csv.push(csvRow.join(','));
    });

    // Create download link
    const csvContent = csv.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    window.URL.revokeObjectURL(url);
}
