import React from 'react';
import ReactDOM from 'react-dom/client';

interface HistoryEntry {
  timestamp: string;
  sql: string;
}

const App: React.FC = () => {
  const [host, setHost] = React.useState('localhost');
  const [port, setPort] = React.useState('5432');
  const [database, setDatabase] = React.useState('postgres');
  const [user, setUser] = React.useState('postgres');
  const [password, setPassword] = React.useState('');
  const [sql, setSql] = React.useState('SELECT 1');
  const [status, setStatus] = React.useState('Ready');
  const [rows, setRows] = React.useState<any[]>([]);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);
  const [rowSelection, setRowSelection] = React.useState<{
    start: number;
    end: number;
  } | null>(null);
  const [colSelection, setColSelection] = React.useState<{
    start: number;
    end: number;
  } | null>(null);
  const [isSelectingRow, setIsSelectingRow] = React.useState(false);
  const [isSelectingCol, setIsSelectingCol] = React.useState(false);
  const [colWidths, setColWidths] = React.useState<Record<string, number>>({});
  const [isFormatted, setIsFormatted] = React.useState(false);

  const loadHistory = React.useCallback(async () => {
    const list = await window.pgace.historyList();
    setHistory(list);
  }, []);

  React.useEffect(() => {
    void loadHistory();
  }, [loadHistory]);

  const handleConnect = React.useCallback(async () => {
    try {
      await window.pgace.connect({
        host,
        port: Number(port),
        database,
        user,
        password
      });
      setStatus('Connected');
    } catch (e: any) {
      setStatus(e.message);
    }
  }, [host, port, database, user, password]);

  const handleQuery = React.useCallback(async () => {
    try {
      const r = await window.pgace.query({ sql });
      setRows(r);
      const cols = Object.keys(r[0] ?? {});
      setColWidths((prev) => {
        const next: Record<string, number> = { ...prev };
        cols.forEach((c) => {
          if (!(c in next)) next[c] = 150;
        });
        return next;
      });
      setRowSelection(null);
      setColSelection(null);
      setStatus(`${r.length} rows`);
      await loadHistory();
    } catch (e: any) {
      setStatus(e.message);
      setRows([]);
      setRowSelection(null);
      setColSelection(null);
    }
  }, [sql, loadHistory]);

  const handleFormatToggle = React.useCallback(() => {
    if (isFormatted) {
      setSql((s) => s.replace(/\s+/g, ' ').trim());
    } else {
      const formatted = sql
        .replace(/\s+/g, ' ')
        .replace(/(SELECT|FROM|WHERE|GROUP BY|ORDER BY|INSERT|INTO|VALUES|UPDATE|SET|DELETE|JOIN)/gi, '\n$1')
        .replace(/\n\s+/g, '\n')
        .trim();
      setSql(formatted);
    }
    setIsFormatted(!isFormatted);
  }, [sql, isFormatted]);

  const handleExportCsv = React.useCallback(() => {
    if (rows.length === 0) return;
    const columns = Object.keys(rows[0]);
    const csv = [
      columns.join(','),
      ...rows.map((r) =>
        columns
          .map((c) => {
            const v = r[c];
            return JSON.stringify(v ?? '');
          })
          .join(',')
      )
    ].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'result.csv';
    a.click();
    URL.revokeObjectURL(url);
  }, [rows]);

  React.useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'F5') {
        e.preventDefault();
        void handleQuery();
      }
      if (e.ctrlKey && e.key.toLowerCase() === 'l') {
        e.preventDefault();
        handleFormatToggle();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [handleQuery, handleFormatToggle]);

  const handleMouseDown = (
    e: React.MouseEvent<HTMLDivElement>,
    column: string
  ) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startWidth = colWidths[column] ?? 150;
    const onMouseMove = (ev: MouseEvent) => {
      const diff = ev.clientX - startX;
      setColWidths((prev) => ({
        ...prev,
        [column]: Math.max(30, startWidth + diff)
      }));
    };
    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };
    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  const handleRowMouseDown = (idx: number) => {
    setRowSelection({ start: idx, end: idx });
    setIsSelectingRow(true);
    setColSelection(null);
  };

  const handleRowMouseEnter = (idx: number) => {
    if (!isSelectingRow || !rowSelection) return;
    setRowSelection({ start: rowSelection.start, end: idx });
  };

  const handleColMouseDown = (
    e: React.MouseEvent<HTMLTableCellElement>,
    idx: number
  ) => {
    e.preventDefault();
    setColSelection({ start: idx, end: idx });
    setIsSelectingCol(true);
    setRowSelection(null);
  };

  const handleColMouseEnter = (idx: number) => {
    if (!isSelectingCol || !colSelection) return;
    setColSelection({ start: colSelection.start, end: idx });
  };

  React.useEffect(() => {
    const onMouseUp = () => {
      setIsSelectingRow(false);
      setIsSelectingCol(false);
    };
    document.addEventListener('mouseup', onMouseUp);
    return () => document.removeEventListener('mouseup', onMouseUp);
  }, []);

  const renderResultTable = () => {
    if (rows.length === 0) return null;
    const columns = Object.keys(rows[0]);
    const isRowSelected = (idx: number) => {
      if (!rowSelection) return false;
      const s = Math.min(rowSelection.start, rowSelection.end);
      const e = Math.max(rowSelection.start, rowSelection.end);
      return idx >= s && idx <= e;
    };
    const isColSelected = (idx: number) => {
      if (!colSelection) return false;
      const s = Math.min(colSelection.start, colSelection.end);
      const e = Math.max(colSelection.start, colSelection.end);
      return idx >= s && idx <= e;
    };
    return (
      <div style={{ marginTop: '1rem', overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', userSelect: 'none' }}>
          <thead>
            <tr>
              <th
                style={{
                  border: '1px solid #ccc',
                  background: '#eee',
                  width: 40,
                  minWidth: 40
                }}
              />
              {columns.map((c, idx) => (
                <th
                  key={c}
                  style={{
                    position: 'relative',
                    border: '1px solid #ccc',
                    background: isColSelected(idx) ? '#b3d7ff' : '#eee',
                    width: colWidths[c] ?? 150,
                    minWidth: colWidths[c] ?? 150,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis'
                  }}
                  onMouseDown={(e) => handleColMouseDown(e, idx)}
                  onMouseEnter={() => handleColMouseEnter(idx)}
                >
                  {c}
                  <div
                    style={{
                      position: 'absolute',
                      top: 0,
                      right: 0,
                      width: 4,
                      height: '100%',
                      cursor: 'col-resize'
                    }}
                    onMouseDown={(e) => handleMouseDown(e, c)}
                  />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, idx) => (
              <tr key={idx}>
                <th
                  style={{
                    border: '1px solid #ccc',
                    background: '#eee',
                    textAlign: 'right',
                    padding: '0 4px',
                    width: 40,
                    minWidth: 40,
                    backgroundColor: isRowSelected(idx) ? '#b3d7ff' : '#eee'
                  }}
                  onMouseDown={() => handleRowMouseDown(idx)}
                  onMouseEnter={() => handleRowMouseEnter(idx)}
                >
                  {idx + 1}
                </th>
                {columns.map((c, cIdx) => (
                  <td
                    key={c}
                    style={{
                      border: '1px solid #ccc',
                      padding: '0 4px',
                      width: colWidths[c] ?? 150,
                      minWidth: colWidths[c] ?? 150,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      backgroundColor:
                        isRowSelected(idx) || isColSelected(cIdx)
                          ? '#d7ebff'
                          : 'transparent'
                    }}
                  >
                    {String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const renderHistoryTable = () => {
    if (history.length === 0) return null;
    return (
      <div style={{ marginTop: '1rem' }}>
        <h2>履歴</h2>
        <table border={1} cellPadding={4}>
          <thead>
            <tr>
              <th>時刻</th>
              <th>SQL</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h, idx) => (
              <tr key={idx}>
                <td>{h.timestamp}</td>
                <td>{h.sql}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '1rem',
        padding: '1rem',
        fontFamily: 'sans-serif'
      }}
    >
      <h1>PgAce</h1>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.5rem',
          alignItems: 'center'
        }}
      >
        <input
          placeholder="host"
          value={host}
          onChange={(e) => setHost(e.target.value)}
        />
        <input
          placeholder="port"
          type="number"
          value={port}
          onChange={(e) => setPort(e.target.value)}
        />
        <input
          placeholder="database"
          value={database}
          onChange={(e) => setDatabase(e.target.value)}
        />
        <input
          placeholder="user"
          value={user}
          onChange={(e) => setUser(e.target.value)}
        />
        <input
          placeholder="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <button onClick={handleConnect}>Connect</button>
      </div>
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '0.5rem'
        }}
      >
        <textarea
          rows={4}
          value={sql}
          onChange={(e) => setSql(e.target.value)}
          style={{ width: '100%' }}
        />
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button onClick={handleQuery}>Run Query (F5)</button>
          <button onClick={handleFormatToggle}>Format (Ctrl+L)</button>
          <button onClick={handleExportCsv} disabled={rows.length === 0}>
            Export CSV
          </button>
        </div>
      </div>
      <div>{status}</div>
      {renderResultTable()}
      {renderHistoryTable()}
    </div>
  );
};

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<App />);
